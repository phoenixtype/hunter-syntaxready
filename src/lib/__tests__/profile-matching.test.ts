/**
 * Tests for Profile Matching System
 * Verifies weighted scoring and 70% threshold logic
 */

import { describe, it, expect } from 'vitest'
import {
  calculateProfileMatch,
  batchMatchJobs,
  getMatchingStats,
  type ExtendedProfile,
  type MatchResult
} from '../profile-matching'
import type { Database } from '@/integrations/supabase/types'

type JobListing = Database['public']['Tables']['job_listings']['Row']
type UserPreferences = Database['public']['Tables']['user_preferences']['Row']

describe('ProfileMatchingEngine', () => {

  const mockProfile: ExtendedProfile = {
    id: 'user1',
    targetRoles: ['Software Engineer', 'Full Stack Developer'],
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS'],
    industries: ['technology', 'fintech'],
    experienceLevel: 'mid',
    preferredLocations: ['San Francisco, CA', 'New York, NY', 'Remote'],
    salaryExpectation: {
      min: 120000,
      max: 160000,
      currency: 'USD'
    },
    remotePreference: 'preferred',
    jobTypes: ['full-time']
  }

  const mockPreferences = {
    user_id: 'user1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    job_alerts: true,
    email_frequency: 'weekly',
    target_roles: ['Software Engineer'],
    preferred_locations: ['Remote'],
    experience_level: 'mid',
    track_views: false,
    fresh_job_digest_time: '08:00:00',
    fresh_job_digest_enabled: true,
    fresh_job_digest_timezone: 'UTC'
  } as any

  const createMockJob = (overrides: any = {}): any => ({
    id: 'job1',
    title: 'Software Engineer',
    company: 'Tech Corp',
    location: 'San Francisco, CA',
    description: 'Looking for a skilled developer with React and Node.js experience',
    required_skills: 'React, Node.js, TypeScript',
    experience_level: 'mid',
    job_type: 'full-time',
    salary_min: 130000,
    salary_max: 150000,
    salary_currency: 'USD',
    posted_date: new Date().toISOString(),
    application_deadline: null,
    application_url: 'https://example.com/apply',
    remote_ok: false,
    freshness_score: 1.0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  })

  describe('calculateMatch', () => {
    it('calculates high score for perfect match', () => {
      const job = createMockJob()
      const result = calculateProfileMatch(mockProfile, mockPreferences, job)

      expect(result.score).toBeGreaterThanOrEqual(70)
      expect(result.shouldInclude).toBe(true)
      expect(result.qualityLevel).toMatch(/good|excellent/)
      expect(result.reasons.length).toBeGreaterThan(0)
    })

    it('identifies skill matches correctly', () => {
      const job = createMockJob({
        required_skills: 'React, Node.js, TypeScript, PostgreSQL',
        description: 'Expert in JavaScript frameworks and AWS cloud services'
      })

      const result = calculateProfileMatch(mockProfile, mockPreferences, job)

      expect(result.score).toBeGreaterThanOrEqual(70)
      expect(result.reasons.some(r => r.includes('Skill matches'))).toBe(true)
    })

    it('handles semantic skill matching', () => {
      const job = createMockJob({
        required_skills: 'JavaScript, Node, Postgres',
        description: 'Experience with JS frameworks and cloud platforms'
      })

      const result = calculateProfileMatch(mockProfile, mockPreferences, job)

      expect(result.score).toBeGreaterThan(50)
      expect(result.reasons.some(r => r.includes('Skill matches'))).toBe(true)
    })

    it('matches job titles with semantic similarity', () => {
      const engineerJob = createMockJob({ title: 'Senior Software Engineer' })
      const developerJob = createMockJob({ title: 'Full Stack Developer' })
      const unrelatedJob = createMockJob({ title: 'Marketing Manager' })

      const engineerResult = calculateProfileMatch(mockProfile, mockPreferences, engineerJob)
      const developerResult = calculateProfileMatch(mockProfile, mockPreferences, developerJob)
      const unrelatedResult = calculateProfileMatch(mockProfile, mockPreferences, unrelatedJob)

      expect(engineerResult.score).toBeGreaterThan(unrelatedResult.score)
      expect(developerResult.score).toBeGreaterThan(unrelatedResult.score)
    })

    it('handles location preferences correctly', () => {
      const preferredLocationJob = createMockJob({ location: 'San Francisco, CA' })
      const remoteJob = createMockJob({ location: 'Remote' })
      const unwantedLocationJob = createMockJob({ location: 'Austin, TX' })

      const preferredResult = calculateProfileMatch(mockProfile, mockPreferences, preferredLocationJob)
      const remoteResult = calculateProfileMatch(mockProfile, mockPreferences, remoteJob)
      const unwantedResult = calculateProfileMatch(mockProfile, mockPreferences, unwantedLocationJob)

      // Remote should score highest due to user's preference
      expect(remoteResult.score).toBeGreaterThan(unwantedResult.score)
      expect(preferredResult.score).toBeGreaterThan(unwantedResult.score)
    })

    it('handles remote work preferences', () => {
      const remoteRequiredProfile = { ...mockProfile, remotePreference: 'required' as const }
      const remoteNotPreferredProfile = { ...mockProfile, remotePreference: 'not_preferred' as const }

      const remoteJob = createMockJob({ location: 'Remote' })
      const onsiteJob = createMockJob({ location: 'San Francisco, CA' })

      const remoteRequiredRemoteJob = calculateProfileMatch(remoteRequiredProfile, mockPreferences, remoteJob)
      const remoteRequiredOnsiteJob = calculateProfileMatch(remoteRequiredProfile, mockPreferences, onsiteJob)
      const remoteNotPreferredRemoteJob = calculateProfileMatch(remoteNotPreferredProfile, mockPreferences, remoteJob)
      const remoteNotPreferredOnsiteJob = calculateProfileMatch(remoteNotPreferredProfile, mockPreferences, onsiteJob)

      // Remote required user should score remote jobs much higher than onsite
      expect(remoteRequiredRemoteJob.score).toBeGreaterThan(remoteRequiredOnsiteJob.score)

      // Remote not preferred user should score onsite jobs higher than remote
      expect(remoteNotPreferredOnsiteJob.score).toBeGreaterThan(remoteNotPreferredRemoteJob.score)
    })

    it('matches experience levels appropriately', () => {
      const midLevelJob = createMockJob({ experience_level: 'mid' })
      const seniorJob = createMockJob({ experience_level: 'senior' })
      const juniorJob = createMockJob({ experience_level: 'junior' })

      const midResult = calculateProfileMatch(mockProfile, mockPreferences, midLevelJob)
      const seniorResult = calculateProfileMatch(mockProfile, mockPreferences, seniorJob)
      const juniorResult = calculateProfileMatch(mockProfile, mockPreferences, juniorJob)

      // Exact match should score highest
      expect(midResult.score).toBeGreaterThan(seniorResult.score)
      expect(midResult.score).toBeGreaterThan(juniorResult.score)

      // Adjacent levels should score higher than distant levels
      expect(seniorResult.score).toBeGreaterThan(0)
      expect(juniorResult.score).toBeGreaterThan(0)
    })

    it('handles salary matching correctly', () => {
      const overlappingJob = createMockJob({ salary_min: 130000, salary_max: 150000 })
      const tooLowJob = createMockJob({ salary_min: 80000, salary_max: 100000 })
      const tooHighJob = createMockJob({ salary_min: 200000, salary_max: 250000 })
      const noSalaryJob = createMockJob({ salary_min: null, salary_max: null })

      const overlappingResult = calculateProfileMatch(mockProfile, mockPreferences, overlappingJob)
      const tooLowResult = calculateProfileMatch(mockProfile, mockPreferences, tooLowJob)
      const tooHighResult = calculateProfileMatch(mockProfile, mockPreferences, tooHighJob)
      const noSalaryResult = calculateProfileMatch(mockProfile, mockPreferences, noSalaryJob)

      expect(overlappingResult.score).toBeGreaterThan(tooLowResult.score)
      expect(overlappingResult.score).toBeGreaterThan(tooHighResult.score)
      expect(noSalaryResult.score).toBeGreaterThan(0) // Should handle gracefully
    })

    it('matches job types correctly', () => {
      const fullTimeJob = createMockJob({ job_type: 'full-time' })
      const contractJob = createMockJob({ job_type: 'contract' })

      const fullTimeResult = calculateProfileMatch(mockProfile, mockPreferences, fullTimeJob)
      const contractResult = calculateProfileMatch(mockProfile, mockPreferences, contractJob)

      // Should prefer full-time based on profile
      expect(fullTimeResult.score).toBeGreaterThan(contractResult.score)
    })

    it('applies 70% threshold correctly', () => {
      const highQualityJob = createMockJob()
      const lowQualityJob = createMockJob({
        title: 'Unrelated Job',
        required_skills: 'Unrelated skills',
        location: 'Unwanted Location',
        experience_level: 'entry',
        salary_min: 50000,
        salary_max: 60000
      })

      const highResult = calculateProfileMatch(mockProfile, mockPreferences, highQualityJob)
      const lowResult = calculateProfileMatch(mockProfile, mockPreferences, lowQualityJob)

      if (highResult.score >= 70) {
        expect(highResult.shouldInclude).toBe(true)
      }

      if (lowResult.score < 70) {
        expect(lowResult.shouldInclude).toBe(false)
      }
    })

    it('uses custom weights when provided', () => {
      const job = createMockJob()

      // Emphasize salary over skills
      const customWeights = {
        salary: 0.6,  // 60%
        skills: 0.1   // 10%
      }

      const defaultResult = calculateProfileMatch(mockProfile, mockPreferences, job)
      const customResult = calculateProfileMatch(mockProfile, mockPreferences, job, customWeights)

      // Results should be different due to different weighting
      expect(defaultResult.score).not.toBe(customResult.score)
    })
  })

  describe('batchMatchJobs', () => {
    it('processes multiple jobs and filters by threshold', async () => {
      const jobs = [
        createMockJob({ title: 'Software Engineer', required_skills: 'React, Node.js' }),
        createMockJob({ title: 'Product Manager', required_skills: 'Analytics, Strategy' }),
        createMockJob({ title: 'Data Scientist', required_skills: 'Python, Machine Learning' }),
        createMockJob({ title: 'Frontend Developer', required_skills: 'React, JavaScript' })
      ]

      const results = await batchMatchJobs(mockProfile, mockPreferences, jobs)

      // Should filter to only matches above 70%
      results.forEach(result => {
        expect(result.match.score).toBeGreaterThanOrEqual(70)
        expect(result.match.shouldInclude).toBe(true)
      })

      // Should be sorted by score descending
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].match.score).toBeGreaterThanOrEqual(results[i + 1].match.score)
      }
    })

    it('returns empty array when no jobs meet threshold', async () => {
      const jobs = [
        createMockJob({
          title: 'Completely Unrelated Job',
          required_skills: 'Irrelevant skills',
          location: 'Unwanted location',
          salary_min: 30000,
          salary_max: 40000
        })
      ]

      const results = await batchMatchJobs(mockProfile, mockPreferences, jobs)
      expect(results).toHaveLength(0)
    })
  })

  describe('getMatchingStats', () => {
    it('generates accurate statistics for match results', () => {
      const matches: MatchResult[] = [
        {
          score: 95,
          reasons: ['Skill matches: React', 'Strong title match'],
          qualityLevel: 'excellent',
          shouldInclude: true
        },
        {
          score: 80,
          reasons: ['Skill matches: Node.js', 'Good salary alignment'],
          qualityLevel: 'good',
          shouldInclude: true
        },
        {
          score: 65,
          reasons: ['Partial title match', 'Location not preferred'],
          qualityLevel: 'fair',
          shouldInclude: false
        },
        {
          score: 40,
          reasons: ['Limited skill alignment'],
          qualityLevel: 'poor',
          shouldInclude: false
        }
      ]

      const stats = getMatchingStats(matches)

      expect(stats.totalMatches).toBe(4)
      expect(stats.averageScore).toBe(70) // (95 + 80 + 65 + 40) / 4
      expect(stats.qualityDistribution.excellent).toBe(1)
      expect(stats.qualityDistribution.good).toBe(1)
      expect(stats.qualityDistribution.fair).toBe(1)
      expect(stats.qualityDistribution.poor).toBe(1)
      expect(stats.topReasons.length).toBeGreaterThan(0)
      expect(stats.topReasons[0]).toHaveProperty('reason')
      expect(stats.topReasons[0]).toHaveProperty('count')
    })
  })

  describe('quality level determination', () => {
    it('assigns correct quality levels', () => {
      const excellentJob = createMockJob()
      const testProfile = {
        ...mockProfile,
        skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS'] // Perfect match
      }

      const result = calculateProfileMatch(testProfile, mockPreferences, excellentJob)

      if (result.score >= 90) {
        expect(result.qualityLevel).toBe('excellent')
      } else if (result.score >= 75) {
        expect(result.qualityLevel).toBe('good')
      } else if (result.score >= 60) {
        expect(result.qualityLevel).toBe('fair')
      } else {
        expect(result.qualityLevel).toBe('poor')
      }
    })
  })

  describe('edge cases', () => {
    it('handles missing profile data gracefully', () => {
      const incompleteProfile: ExtendedProfile = {
        id: 'user2',
        targetRoles: [],
        skills: [],
        industries: [],
        experienceLevel: '',
        preferredLocations: [],
        remotePreference: 'acceptable',
        jobTypes: []
      }

      const job = createMockJob()
      const result = calculateProfileMatch(incompleteProfile, mockPreferences, job)

      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
      expect(result.reasons.length).toBeGreaterThan(0)
    })

    it('handles missing job data gracefully', () => {
      const incompleteJob = createMockJob({
        title: '',
        required_skills: null,
        description: null,
        experience_level: null,
        salary_min: null,
        salary_max: null,
        location: null
      })

      const result = calculateProfileMatch(mockProfile, mockPreferences, incompleteJob)

      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
      expect(result.reasons.length).toBeGreaterThan(0)
    })

    it('handles zero scores gracefully', () => {
      const job = createMockJob({
        title: 'Irrelevant Job Title',
        required_skills: 'Completely different skills',
        experience_level: 'director',
        location: 'Unwanted City',
        salary_min: 500000,
        salary_max: 600000
      })

      const result = calculateProfileMatch(mockProfile, mockPreferences, job)

      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.shouldInclude).toBe(false)
      expect(result.qualityLevel).toBe('poor')
    })
  })
})