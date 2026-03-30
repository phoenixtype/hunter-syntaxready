/**
 * Tests for Source Prioritization System
 * Verifies hybrid smart source targeting and Pro-first user allocation
 */

import { describe, it, expect } from 'vitest'
import {
  sourcePrioritizationEngine,
  allocateWaveUsers,
  generateCrawlTargets,
  getSourceConfig,
  calculateRateLimit,
  type UserProfile,
  type SourceConfig
} from '../source-prioritization'

describe('SourcePrioritizationEngine', () => {

  const mockProfiles: UserProfile[] = [
    {
      id: 'user1',
      targetRoles: ['Software Engineer', 'Full Stack Developer'],
      industries: ['technology', 'fintech'],
      experienceLevel: 'mid',
      skills: ['React', 'Node.js', 'TypeScript'],
      crawlPriority: 2,
      proUser: true
    },
    {
      id: 'user2',
      targetRoles: ['Product Manager'],
      industries: ['technology', 'startup'],
      experienceLevel: 'senior',
      skills: ['Product Strategy', 'Analytics', 'Leadership'],
      crawlPriority: 2,
      proUser: true
    },
    {
      id: 'user3',
      targetRoles: ['Data Scientist'],
      industries: ['healthcare', 'ai'],
      experienceLevel: 'junior',
      skills: ['Python', 'Machine Learning', 'SQL'],
      crawlPriority: 1,
      proUser: false
    },
    {
      id: 'user4',
      targetRoles: ['Frontend Developer'],
      industries: ['ecommerce'],
      experienceLevel: 'mid',
      skills: ['Vue.js', 'CSS', 'JavaScript'],
      crawlPriority: 1,
      proUser: false
    }
  ]

  describe('allocateWaveUsers', () => {
    it('correctly separates Pro and free users', () => {
      const allocation = allocateWaveUsers(mockProfiles)

      expect(allocation.proUsers).toEqual(['user1', 'user2'])
      expect(allocation.freeUsers).toEqual(['user3', 'user4'])
      expect(allocation.totalUsers).toBe(4)
    })

    it('handles all Pro users', () => {
      const allProProfiles = mockProfiles.map(p => ({ ...p, proUser: true, crawlPriority: 2 }))
      const allocation = allocateWaveUsers(allProProfiles)

      expect(allocation.proUsers).toHaveLength(4)
      expect(allocation.freeUsers).toHaveLength(0)
      expect(allocation.totalUsers).toBe(4)
    })

    it('handles all free users', () => {
      const allFreeProfiles = mockProfiles.map(p => ({ ...p, proUser: false, crawlPriority: 1 }))
      const allocation = allocateWaveUsers(allFreeProfiles)

      expect(allocation.proUsers).toHaveLength(0)
      expect(allocation.freeUsers).toHaveLength(4)
      expect(allocation.totalUsers).toBe(4)
    })
  })

  describe('generateCrawlTargets', () => {
    it('generates prioritized targets with Pro users first', () => {
      const targets = generateCrawlTargets(mockProfiles, 'morning')

      expect(targets.length).toBeGreaterThan(0)

      // Check that we have different priority tiers
      const tier1Targets = targets.filter(t => t.source.priority === 1)
      const tier2Targets = targets.filter(t => t.source.priority === 2)
      const tier3Targets = targets.filter(t => t.source.priority === 3)

      expect(tier1Targets.length).toBeGreaterThan(0) // Should have career page targets
      expect(tier2Targets.length).toBeGreaterThan(0) // Should have job board targets
      expect(tier3Targets.length).toBeGreaterThan(0) // Should have niche site targets

      // Verify sorting by priority
      for (let i = 0; i < targets.length - 1; i++) {
        expect(targets[i].source.priority).toBeLessThanOrEqual(targets[i + 1].source.priority)
      }
    })

    it('assigns relevant sources to users based on profiles', () => {
      const targets = generateCrawlTargets(mockProfiles, 'morning')

      // Find targets for tech users (user1, user2)
      const techTargets = targets.filter(t =>
        t.users.includes('user1') || t.users.includes('user2')
      )

      expect(techTargets.length).toBeGreaterThan(0)

      // Check that tech users get tech-relevant sources
      const googleTarget = techTargets.find(t => t.source.name === 'google_careers')
      expect(googleTarget).toBeDefined()
      if (googleTarget) {
        expect(googleTarget.users).toContain('user1') // Software engineer should match Google
      }
    })

    it('generates appropriate search terms for user groups', () => {
      const targets = generateCrawlTargets(mockProfiles, 'morning')

      // Check that search terms are relevant
      const target = targets[0]
      expect(target.searchTerms).toBeDefined()
      expect(target.searchTerms!.length).toBeGreaterThan(0)

      // Should contain some role or skill terms from user profiles
      const hasRelevantTerm = target.searchTerms!.some(term =>
        term.toLowerCase().includes('engineer') ||
        term.toLowerCase().includes('developer') ||
        term.toLowerCase().includes('react') ||
        term.toLowerCase().includes('product')
      )
      expect(hasRelevantTerm).toBe(true)
    })

    it('estimates reasonable job counts for sources', () => {
      const targets = generateCrawlTargets(mockProfiles, 'morning')

      targets.forEach(target => {
        expect(target.estimatedJobs).toBeGreaterThan(0)
        expect(target.estimatedJobs).toBeLessThan(500) // Reasonable upper bound
      })
    })
  })

  describe('getSourceConfig', () => {
    it('retrieves existing source configurations', () => {
      const googleConfig = getSourceConfig('google_careers')
      expect(googleConfig).toBeDefined()
      expect(googleConfig?.name).toBe('google_careers')
      expect(googleConfig?.type).toBe('career_page')
      expect(googleConfig?.priority).toBe(1)
    })

    it('returns undefined for non-existent sources', () => {
      const nonExistentConfig = getSourceConfig('fake_source')
      expect(nonExistentConfig).toBeUndefined()
    })
  })

  describe('calculateRateLimit', () => {
    it('calculates appropriate rate limits based on user count', () => {
      const sourceConfig: SourceConfig = {
        name: 'test_source',
        type: 'job_board',
        priority: 2,
        rateLimitPerMinute: 20,
        avgResponseTime: 1000,
        reliability: 0.8
      }

      const rateLimit = calculateRateLimit(sourceConfig, 50)

      expect(rateLimit.requestsPerMinute).toBeGreaterThan(0)
      expect(rateLimit.delayBetweenRequests).toBeGreaterThan(0)
      expect(rateLimit.recommendedBatchSize).toBeGreaterThan(0)

      // Delay should be inversely related to requests per minute
      const expectedDelay = Math.ceil(60000 / rateLimit.requestsPerMinute)
      expect(rateLimit.delayBetweenRequests).toBe(expectedDelay)
    })

    it('scales rate limits with user count', () => {
      const sourceConfig: SourceConfig = {
        name: 'test_source',
        type: 'job_board',
        priority: 2,
        rateLimitPerMinute: 20,
        avgResponseTime: 1000,
        reliability: 0.8
      }

      const smallUserCount = calculateRateLimit(sourceConfig, 10)
      const largeUserCount = calculateRateLimit(sourceConfig, 100)

      // Should allow more requests per minute for larger user count
      expect(largeUserCount.requestsPerMinute).toBeGreaterThanOrEqual(smallUserCount.requestsPerMinute)
      expect(largeUserCount.recommendedBatchSize).toBeGreaterThan(smallUserCount.recommendedBatchSize)
    })
  })

  describe('getSourcesByTier', () => {
    it('returns sources grouped by priority tier', () => {
      const tier1Sources = sourcePrioritizationEngine.getSourcesByTier(1)
      const tier2Sources = sourcePrioritizationEngine.getSourcesByTier(2)
      const tier3Sources = sourcePrioritizationEngine.getSourcesByTier(3)

      expect(tier1Sources.length).toBeGreaterThan(0)
      expect(tier2Sources.length).toBeGreaterThan(0)
      expect(tier3Sources.length).toBeGreaterThan(0)

      // All tier 1 sources should be career pages
      tier1Sources.forEach(source => {
        expect(source.type).toBe('career_page')
        expect(source.priority).toBe(1)
      })

      // All tier 2 sources should be job boards
      tier2Sources.forEach(source => {
        expect(source.type).toBe('job_board')
        expect(source.priority).toBe(2)
      })

      // All tier 3 sources should be niche sites
      tier3Sources.forEach(source => {
        expect(source.type).toBe('niche_site')
        expect(source.priority).toBe(3)
      })
    })
  })

  describe('getCrawlStats', () => {
    it('generates accurate statistics for crawl targets', () => {
      const targets = generateCrawlTargets(mockProfiles, 'morning')
      const stats = sourcePrioritizationEngine.getCrawlStats(targets)

      expect(stats.totalSources).toBe(targets.length)
      expect(stats.totalUsers).toBeLessThanOrEqual(mockProfiles.length) // Unique users only
      expect(stats.estimatedTotalJobs).toBeGreaterThan(0)
      expect(stats.avgReliability).toBeGreaterThan(0)
      expect(stats.avgReliability).toBeLessThanOrEqual(1)

      // Check source distribution by tier
      expect(stats.sourcesByTier[1]).toBeGreaterThan(0) // Should have tier 1 sources
      expect(stats.sourcesByTier[2]).toBeGreaterThan(0) // Should have tier 2 sources
      expect(stats.sourcesByTier[3]).toBeGreaterThan(0) // Should have tier 3 sources
    })
  })

  describe('source relevance matching', () => {
    it('matches technology users to technology sources', () => {
      const techProfile: UserProfile = {
        id: 'tech_user',
        targetRoles: ['Software Engineer'],
        industries: ['technology'],
        experienceLevel: 'mid',
        skills: ['React', 'Node.js'],
        crawlPriority: 2,
        proUser: true
      }

      const targets = generateCrawlTargets([techProfile], 'morning')

      // Should include Google, Microsoft, Meta careers (tech companies)
      const careerPageTargets = targets.filter(t => t.source.type === 'career_page')
      const techCareerTargets = careerPageTargets.filter(t =>
        t.users.includes('tech_user') &&
        (t.source.name === 'google_careers' ||
         t.source.name === 'microsoft_careers' ||
         t.source.name === 'meta_careers')
      )

      expect(techCareerTargets.length).toBeGreaterThan(0)
    })

    it('excludes irrelevant sources for specific profiles', () => {
      const financeProfile: UserProfile = {
        id: 'finance_user',
        targetRoles: ['Financial Analyst'],
        industries: ['finance', 'banking'],
        experienceLevel: 'junior',
        skills: ['Excel', 'Financial Modeling'],
        crawlPriority: 1,
        proUser: false
      }

      const targets = generateCrawlTargets([financeProfile], 'morning')

      // Should not include engineering-focused niche sites like Stack Overflow
      const stackOverflowTargets = targets.filter(t =>
        t.source.name === 'stackoverflow_jobs' && t.users.includes('finance_user')
      )

      expect(stackOverflowTargets.length).toBe(0)
    })
  })

  describe('Pro user prioritization', () => {
    it('prioritizes Pro users in tier 1 sources', () => {
      const targets = generateCrawlTargets(mockProfiles, 'morning')

      // Find tier 1 targets (career pages)
      const tier1Targets = targets.filter(t => t.source.priority === 1)

      tier1Targets.forEach(target => {
        // Pro users should be included in tier 1 targets when relevant
        const hasProUsers = target.users.some(userId =>
          mockProfiles.find(p => p.id === userId)?.proUser
        )

        if (target.users.length > 0) {
          // If there are any users, at least some should be Pro users for tier 1
          expect(hasProUsers).toBe(true)
        }
      })
    })
  })
})