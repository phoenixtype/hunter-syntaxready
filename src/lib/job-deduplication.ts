/**
 * Job Deduplication System
 *
 * Implements SHA-256 fingerprinting to detect and prevent duplicate job listings
 * across multiple sources. Maintains a 7-day temporal window for deduplication
 * and tracks source attribution.
 */

import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'

type JobListing = Database['public']['Tables']['job_listings']['Row']
type JobFingerprint = Database['public']['Tables']['job_fingerprints']['Row']

interface JobFingerprintData {
  fingerprint_hash: string
  first_seen_at: string
  last_seen_at: string
  source_count: number
  sources: string[]
}

interface DeduplicationResult {
  isDuplicate: boolean
  fingerprintHash: string
  existingFingerprint?: JobFingerprintData
  sources: string[]
}

class JobDeduplicationEngine {

  /**
   * Generate SHA-256 fingerprint for a job listing
   * Uses normalized title + company + location for consistent hashing
   */
  async generateFingerprint(job: Partial<JobListing>): Promise<string> {
    if (!job.title || !job.company) {
      throw new Error('Job must have title and company for fingerprinting')
    }

    // Normalize job data for consistent fingerprinting
    const normalizedTitle = this.normalizeText(job.title)
    const normalizedCompany = this.normalizeText(job.company)
    const normalizedLocation = this.normalizeText(job.location || 'remote')

    const fingerprintData = `${normalizedTitle}|${normalizedCompany}|${normalizedLocation}`

    // Generate SHA-256 hash
    const encoder = new TextEncoder()
    const data = encoder.encode(fingerprintData)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    return hashHex
  }

  /**
   * Check if a job is a duplicate and update fingerprint tracking
   */
  async checkDuplicate(
    job: Partial<JobListing>,
    source: string = 'unknown'
  ): Promise<DeduplicationResult> {
    try {
      const fingerprintHash = await this.generateFingerprint(job)

      // Check if fingerprint exists in last 7 days
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { data: existingFingerprint, error } = await supabase
        .from('job_fingerprints')
        .select('*')
        .eq('fingerprint_hash', fingerprintHash)
        .gte('last_seen_at', sevenDaysAgo.toISOString())
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('[DEDUP] Database error checking fingerprint:', error)
        // Assume not duplicate on DB error to avoid blocking job insertion
        return {
          isDuplicate: false,
          fingerprintHash,
          sources: [source]
        }
      }

      if (existingFingerprint) {
        // Job is duplicate - update existing fingerprint
        await this.updateFingerprint(fingerprintHash, source, existingFingerprint)

        return {
          isDuplicate: true,
          fingerprintHash,
          existingFingerprint,
          sources: existingFingerprint.sources
        }
      } else {
        // New job - create fingerprint
        await this.createFingerprint(fingerprintHash, source)

        return {
          isDuplicate: false,
          fingerprintHash,
          sources: [source]
        }
      }

    } catch (error) {
      console.error('[DEDUP] Error in duplicate check:', error)
      // Return non-duplicate on error to avoid blocking job processing
      return {
        isDuplicate: false,
        fingerprintHash: 'error',
        sources: [source]
      }
    }
  }

  /**
   * Create new fingerprint record
   */
  private async createFingerprint(hash: string, source: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('job_fingerprints')
        .insert({
          fingerprint_hash: hash,
          first_seen_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          source_count: 1,
          sources: [source]
        })

      if (error) {
        console.error('[DEDUP] Error creating fingerprint:', error)
      }
    } catch (error) {
      console.error('[DEDUP] Exception creating fingerprint:', error)
    }
  }

  /**
   * Update existing fingerprint with new source and timestamp
   */
  private async updateFingerprint(
    hash: string,
    source: string,
    existing: JobFingerprintData
  ): Promise<void> {
    try {
      const updatedSources = existing.sources.includes(source)
        ? existing.sources
        : [...existing.sources, source]

      const { error } = await supabase
        .from('job_fingerprints')
        .update({
          last_seen_at: new Date().toISOString(),
          source_count: updatedSources.length,
          sources: updatedSources
        })
        .eq('fingerprint_hash', hash)

      if (error) {
        console.error('[DEDUP] Error updating fingerprint:', error)
      }
    } catch (error) {
      console.error('[DEDUP] Exception updating fingerprint:', error)
    }
  }

  /**
   * Normalize text for consistent fingerprinting
   * Removes extra whitespace, converts to lowercase, removes common variations
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\b(inc|incorporated|llc|ltd|limited|corp|corporation|co)\b/g, '') // Remove company suffixes
      .replace(/\b(senior|sr|junior|jr|lead|principal)\b/g, '') // Normalize seniority levels
      .replace(/\b(remote|hybrid|on-site|onsite)\b/g, 'remote') // Normalize location types
      .trim()
  }

  /**
   * Clean up old fingerprints beyond 7-day window
   * Should be called periodically by cleanup job
   */
  async cleanupExpiredFingerprints(): Promise<number> {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { data, error } = await supabase
        .from('job_fingerprints')
        .delete()
        .lt('last_seen_at', sevenDaysAgo.toISOString())
        .select('fingerprint_hash')

      if (error) {
        console.error('[DEDUP] Error cleaning expired fingerprints:', error)
        return 0
      }

      const deletedCount = data?.length || 0
      console.log(`[DEDUP] Cleaned up ${deletedCount} expired fingerprints`)
      return deletedCount

    } catch (error) {
      console.error('[DEDUP] Exception during cleanup:', error)
      return 0
    }
  }

  /**
   * Get deduplication statistics for monitoring
   */
  async getStats(): Promise<{
    totalFingerprints: number
    activeFingerprintsLast7Days: number
    topSources: Array<{ source: string; count: number }>
  }> {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      // Total fingerprints
      const { count: totalCount } = await supabase
        .from('job_fingerprints')
        .select('*', { count: 'exact', head: true })

      // Active in last 7 days
      const { count: activeCount } = await supabase
        .from('job_fingerprints')
        .select('*', { count: 'exact', head: true })
        .gte('last_seen_at', sevenDaysAgo.toISOString())

      // Source distribution (simplified - would need more complex query for exact counts)
      const { data: fingerprintSamples } = await supabase
        .from('job_fingerprints')
        .select('sources')
        .gte('last_seen_at', sevenDaysAgo.toISOString())
        .limit(1000)

      const sourceMap: Record<string, number> = {}
      fingerprintSamples?.forEach(fp => {
        fp.sources?.forEach(source => {
          sourceMap[source] = (sourceMap[source] || 0) + 1
        })
      })

      const topSources = Object.entries(sourceMap)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      return {
        totalFingerprints: totalCount || 0,
        activeFingerprintsLast7Days: activeCount || 0,
        topSources
      }

    } catch (error) {
      console.error('[DEDUP] Error getting stats:', error)
      return {
        totalFingerprints: 0,
        activeFingerprintsLast7Days: 0,
        topSources: []
      }
    }
  }

  /**
   * Test fingerprint generation with sample job data
   */
  async testFingerprint(testJob: Partial<JobListing>): Promise<string> {
    return this.generateFingerprint(testJob)
  }
}

// Export singleton instance
export const jobDeduplicationEngine = new JobDeduplicationEngine()

// Export convenience functions
export const checkJobDuplicate = jobDeduplicationEngine.checkDuplicate.bind(jobDeduplicationEngine)
export const generateJobFingerprint = jobDeduplicationEngine.generateFingerprint.bind(jobDeduplicationEngine)
export const cleanupExpiredFingerprints = jobDeduplicationEngine.cleanupExpiredFingerprints.bind(jobDeduplicationEngine)
export const getDeduplicationStats = jobDeduplicationEngine.getStats.bind(jobDeduplicationEngine)

export type { DeduplicationResult, JobFingerprintData }