/**
 * Tests for Job Deduplication System
 * Verifies SHA-256 fingerprinting and duplicate detection logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { jobDeduplicationEngine, generateJobFingerprint, checkJobDuplicate } from '../job-deduplication'
import type { Database } from '@/integrations/supabase/types'

// Mock Supabase client
const mockSupabaseChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  limit: vi.fn().mockReturnThis()
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => mockSupabaseChain)
  }
}))

type JobListing = Database['public']['Tables']['job_listings']['Row']

describe('JobDeduplicationEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateFingerprint', () => {
    it('generates consistent SHA-256 hash for identical job data', async () => {
      const job1: Partial<JobListing> = {
        title: 'Senior Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA'
      }

      const job2: Partial<JobListing> = {
        title: 'Senior Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA'
      }

      const hash1 = await generateJobFingerprint(job1)
      const hash2 = await generateJobFingerprint(job2)

      expect(hash1).toBe(hash2)
      expect(hash1).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex format
    })

    it('normalizes job titles consistently', async () => {
      const job1: Partial<JobListing> = {
        title: 'Senior Software Engineer',
        company: 'Tech Corp',
        location: 'Remote'
      }

      const job2: Partial<JobListing> = {
        title: 'Sr. Software Engineer',
        company: 'Tech Corp',
        location: 'Remote'
      }

      const hash1 = await generateJobFingerprint(job1)
      const hash2 = await generateJobFingerprint(job2)

      expect(hash1).toBe(hash2)
    })

    it('normalizes company names consistently', async () => {
      const job1: Partial<JobListing> = {
        title: 'Software Engineer',
        company: 'Tech Corp Inc.',
        location: 'Remote'
      }

      const job2: Partial<JobListing> = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'Remote'
      }

      const hash1 = await generateJobFingerprint(job1)
      const hash2 = await generateJobFingerprint(job2)

      expect(hash1).toBe(hash2)
    })

    it('normalizes location variations', async () => {
      const job1: Partial<JobListing> = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'Remote'
      }

      const job2: Partial<JobListing> = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'Hybrid'
      }

      const job3: Partial<JobListing> = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: undefined
      }

      const hash1 = await generateJobFingerprint(job1)
      const hash2 = await generateJobFingerprint(job2)
      const hash3 = await generateJobFingerprint(job3)

      expect(hash1).toBe(hash2)
      expect(hash1).toBe(hash3)
    })

    it('generates different hashes for different jobs', async () => {
      const job1: Partial<JobListing> = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'Remote'
      }

      const job2: Partial<JobListing> = {
        title: 'Product Manager',
        company: 'Tech Corp',
        location: 'Remote'
      }

      const hash1 = await generateJobFingerprint(job1)
      const hash2 = await generateJobFingerprint(job2)

      expect(hash1).not.toBe(hash2)
    })

    it('throws error for jobs without required fields', async () => {
      const incompleteJob: Partial<JobListing> = {
        location: 'Remote'
        // Missing title and company
      }

      await expect(generateJobFingerprint(incompleteJob)).rejects.toThrow(
        'Job must have title and company for fingerprinting'
      )
    })
  })

  describe('checkDuplicate', () => {
    it('detects new job as non-duplicate', async () => {
      // Mock no existing fingerprint found
      mockSupabaseChain.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' } // No rows found
      })

      // Mock successful insert
      mockSupabaseChain.insert.mockResolvedValueOnce({ error: null })

      const job: Partial<JobListing> = {
        title: 'Software Engineer',
        company: 'New Corp',
        location: 'Remote'
      }

      const result = await checkJobDuplicate(job, 'linkedin')

      expect(result.isDuplicate).toBe(false)
      expect(result.fingerprintHash).toMatch(/^[a-f0-9]{64}$/)
      expect(result.sources).toEqual(['linkedin'])
    })

    it('detects existing job as duplicate', async () => {
      const existingFingerprint = {
        fingerprint_hash: 'existing123',
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        source_count: 1,
        sources: ['indeed']
      }

      // Mock existing fingerprint found
      mockSupabaseChain.single.mockResolvedValueOnce({
        data: existingFingerprint,
        error: null
      })

      // Mock successful update
      mockSupabaseChain.update.mockResolvedValueOnce({ error: null })

      const job: Partial<JobListing> = {
        title: 'Software Engineer',
        company: 'Existing Corp',
        location: 'Remote'
      }

      const result = await checkJobDuplicate(job, 'glassdoor')

      expect(result.isDuplicate).toBe(true)
      expect(result.existingFingerprint).toBeDefined()
      expect(result.sources).toEqual(['indeed'])
    })

    it('handles database errors gracefully', async () => {
      // Mock database error
      mockSupabaseChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection error' }
      })

      const job: Partial<JobListing> = {
        title: 'Software Engineer',
        company: 'Test Corp',
        location: 'Remote'
      }

      const result = await checkJobDuplicate(job, 'linkedin')

      // Should return non-duplicate on error to avoid blocking job processing
      expect(result.isDuplicate).toBe(false)
      expect(result.fingerprintHash).toMatch(/^[a-f0-9]{64}$/) // Should still generate valid hash
      expect(result.sources).toEqual(['linkedin'])
    })
  })

  describe('cleanupExpiredFingerprints', () => {
    it('removes fingerprints older than 7 days', async () => {
      const deletedFingerprints = [
        { fingerprint_hash: 'old1' },
        { fingerprint_hash: 'old2' }
      ]

      const mockSupabase = await import('@/integrations/supabase/client')
      vi.mocked(mockSupabase.supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: deletedFingerprints,
          error: null
        })
      } as any)

      const deletedCount = await jobDeduplicationEngine.cleanupExpiredFingerprints()

      expect(deletedCount).toBe(2)
    })

    it('handles cleanup errors gracefully', async () => {
      const mockSupabase = await import('@/integrations/supabase/client')
      vi.mocked(mockSupabase.supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Cleanup failed' }
        })
      } as any)

      const deletedCount = await jobDeduplicationEngine.cleanupExpiredFingerprints()

      expect(deletedCount).toBe(0)
    })
  })

  describe('getStats', () => {
    it('returns deduplication statistics', async () => {
      const mockSupabase = await import('@/integrations/supabase/client')

      // Mock count queries returning structured responses
      vi.mocked(mockSupabase.supabase.from)
        .mockReturnValueOnce({
          select: vi.fn().mockResolvedValue({ count: 150, data: null, error: null })
        } as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockResolvedValue({ count: 75, data: null, error: null })
        } as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              { sources: ['linkedin', 'indeed'] },
              { sources: ['glassdoor'] },
              { sources: ['linkedin'] }
            ],
            error: null
          })
        } as any)

      const stats = await jobDeduplicationEngine.getStats()

      expect(stats.totalFingerprints).toBe(150)
      expect(stats.activeFingerprintsLast7Days).toBe(75)
      expect(stats.topSources.length).toBeGreaterThan(0)
      expect(stats.topSources[0]).toHaveProperty('source')
      expect(stats.topSources[0]).toHaveProperty('count')
    })
  })
})