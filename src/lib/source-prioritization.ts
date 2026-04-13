/**
 * Source Prioritization System
 *
 * Implements hybrid smart source targeting to provide competitive advantage:
 * 1. Company career pages (24-48 hour advantage)
 * 2. Major job boards (Indeed, LinkedIn, Glassdoor)
 * 3. Niche industry sites (gap filling)
 *
 * Prioritizes Pro users in first 2 hours of each crawl wave.
 */

import type { Database } from '@/integrations/supabase/types'

// type Profile = Database['public']['Tables']['profiles']['Row']

export interface SourceConfig {
  name: string
  type: 'career_page' | 'job_board' | 'niche_site'
  priority: number
  rateLimitPerMinute: number
  avgResponseTime: number
  reliability: number // 0-1 score
  industries?: string[]
  jobTypes?: string[]
}

export interface CrawlTarget {
  source: SourceConfig
  users: string[] // User IDs to crawl for
  estimatedJobs: number
  crawlUrl?: string
  searchTerms?: string[]
}

export interface WaveAllocation {
  proUsers: string[]
  freeUsers: string[]
  totalUsers: number
}

interface UserProfile {
  id: string
  targetRoles: string[]
  industries: string[]
  experienceLevel: string
  skills: string[]
  crawlPriority: number
  proUser: boolean
}

class SourcePrioritizationEngine {

  private readonly sourceConfigs: SourceConfig[] = [
    // Tier 1: Company Career Pages (Highest Priority - 24-48h advantage)
    {
      name: 'google_careers',
      type: 'career_page',
      priority: 1,
      rateLimitPerMinute: 10,
      avgResponseTime: 2000,
      reliability: 0.95,
      industries: ['technology', 'ai', 'cloud'],
      jobTypes: ['engineering', 'product', 'research']
    },
    {
      name: 'meta_careers',
      type: 'career_page',
      priority: 1,
      rateLimitPerMinute: 10,
      avgResponseTime: 1800,
      reliability: 0.93,
      industries: ['technology', 'social_media'],
      jobTypes: ['engineering', 'product', 'design']
    },
    {
      name: 'microsoft_careers',
      type: 'career_page',
      priority: 1,
      rateLimitPerMinute: 12,
      avgResponseTime: 1500,
      reliability: 0.96,
      industries: ['technology', 'cloud', 'enterprise'],
      jobTypes: ['engineering', 'product', 'sales']
    },
    {
      name: 'apple_careers',
      type: 'career_page',
      priority: 1,
      rateLimitPerMinute: 8,
      avgResponseTime: 2200,
      reliability: 0.91,
      industries: ['technology', 'hardware', 'consumer'],
      jobTypes: ['engineering', 'design', 'product']
    },
    {
      name: 'amazon_careers',
      type: 'career_page',
      priority: 1,
      rateLimitPerMinute: 15,
      avgResponseTime: 1600,
      reliability: 0.94,
      industries: ['technology', 'ecommerce', 'cloud'],
      jobTypes: ['engineering', 'product', 'operations']
    },

    // Tier 2: Major Job Boards (Medium Priority)
    {
      name: 'linkedin',
      type: 'job_board',
      priority: 2,
      rateLimitPerMinute: 30,
      avgResponseTime: 800,
      reliability: 0.88,
      industries: [], // All industries
      jobTypes: [] // All job types
    },
    {
      name: 'indeed',
      type: 'job_board',
      priority: 2,
      rateLimitPerMinute: 25,
      avgResponseTime: 1000,
      reliability: 0.85,
      industries: [],
      jobTypes: []
    },
    {
      name: 'glassdoor',
      type: 'job_board',
      priority: 2,
      rateLimitPerMinute: 20,
      avgResponseTime: 1200,
      reliability: 0.82,
      industries: [],
      jobTypes: []
    },

    // Tier 3: Niche Industry Sites (Lower Priority - Gap Filling)
    {
      name: 'stackoverflow_jobs',
      type: 'niche_site',
      priority: 3,
      rateLimitPerMinute: 15,
      avgResponseTime: 1400,
      reliability: 0.79,
      industries: ['technology'],
      jobTypes: ['engineering', 'development']
    },
    {
      name: 'angellist',
      type: 'niche_site',
      priority: 3,
      rateLimitPerMinute: 18,
      avgResponseTime: 1100,
      reliability: 0.76,
      industries: ['technology', 'startup'],
      jobTypes: ['engineering', 'product', 'sales', 'marketing']
    },
    {
      name: 'techcareers',
      type: 'niche_site',
      priority: 3,
      rateLimitPerMinute: 12,
      avgResponseTime: 1600,
      reliability: 0.74,
      industries: ['technology'],
      jobTypes: ['engineering', 'product', 'design']
    },
    {
      name: 'dice',
      type: 'niche_site',
      priority: 3,
      rateLimitPerMinute: 20,
      avgResponseTime: 1300,
      reliability: 0.77,
      industries: ['technology'],
      jobTypes: ['engineering', 'development', 'consulting']
    }
  ]

  /**
   * Allocate users between Pro and Free tiers for a crawl wave
   * Pro users get first 2 hours of each wave (75% of capacity)
   */
  allocateWaveUsers(profiles: UserProfile[]): WaveAllocation {
    const proUsers = profiles
      .filter(p => p.proUser || p.crawlPriority >= 2)
      .map(p => p.id)

    const freeUsers = profiles
      .filter(p => !p.proUser && p.crawlPriority < 2)
      .map(p => p.id)

    return {
      proUsers,
      freeUsers,
      totalUsers: proUsers.length + freeUsers.length
    }
  }

  /**
   * Generate prioritized crawl targets based on user profiles and source hierarchy
   */
  generateCrawlTargets(
    profiles: UserProfile[],
    _waveType: 'morning' | 'midday' | 'evening' | 'midnight'
  ): CrawlTarget[] {
    const targets: CrawlTarget[] = []

    // Group users by priority (Pro users first)
    const allocation = this.allocateWaveUsers(profiles)

    // First pass: Pro users with Tier 1 sources (Career Pages)
    const tier1Sources = this.sourceConfigs.filter(s => s.priority === 1)
    for (const source of tier1Sources) {
      const relevantProUsers = allocation.proUsers.filter(userId => {
        const profile = profiles.find(p => p.id === userId)
        return this.isSourceRelevantForUser(source, profile!)
      })

      if (relevantProUsers.length > 0) {
        targets.push({
          source,
          users: relevantProUsers,
          estimatedJobs: this.estimateJobsForSource(source, relevantProUsers.length),
          searchTerms: this.generateSearchTermsForUsers(profiles.filter(p => relevantProUsers.includes(p.id)))
        })
      }
    }

    // Second pass: All users with Tier 2 sources (Job Boards)
    const tier2Sources = this.sourceConfigs.filter(s => s.priority === 2)
    for (const source of tier2Sources) {
      const allUsers = [...allocation.proUsers, ...allocation.freeUsers]
      const relevantUsers = allUsers.filter(userId => {
        const profile = profiles.find(p => p.id === userId)
        return this.isSourceRelevantForUser(source, profile!)
      })

      if (relevantUsers.length > 0) {
        targets.push({
          source,
          users: relevantUsers,
          estimatedJobs: this.estimateJobsForSource(source, relevantUsers.length),
          searchTerms: this.generateSearchTermsForUsers(profiles.filter(p => relevantUsers.includes(p.id)))
        })
      }
    }

    // Third pass: Gap filling with Tier 3 sources (Niche Sites)
    const tier3Sources = this.sourceConfigs.filter(s => s.priority === 3)
    for (const source of tier3Sources) {
      const allUsers = [...allocation.proUsers, ...allocation.freeUsers]
      const relevantUsers = allUsers.filter(userId => {
        const profile = profiles.find(p => p.id === userId)
        return this.isSourceRelevantForUser(source, profile!) && this.needsNicheCoverage(profile!, targets)
      })

      if (relevantUsers.length > 0) {
        targets.push({
          source,
          users: relevantUsers,
          estimatedJobs: this.estimateJobsForSource(source, relevantUsers.length),
          searchTerms: this.generateSearchTermsForUsers(profiles.filter(p => relevantUsers.includes(p.id)))
        })
      }
    }

    // Sort by priority, then by estimated value
    return targets.sort((a, b) => {
      if (a.source.priority !== b.source.priority) {
        return a.source.priority - b.source.priority
      }
      return (b.estimatedJobs * b.source.reliability) - (a.estimatedJobs * a.source.reliability)
    })
  }

  /**
   * Check if a source is relevant for a user's profile
   */
  private isSourceRelevantForUser(source: SourceConfig, profile: UserProfile): boolean {
    // General job boards are relevant to everyone
    if (source.industries?.length === 0 && source.jobTypes?.length === 0) {
      return true
    }

    // Check industry alignment
    if (source.industries && source.industries.length > 0) {
      const hasIndustryMatch = source.industries.some(industry =>
        profile.industries.some(userIndustry =>
          userIndustry.toLowerCase().includes(industry.toLowerCase()) ||
          industry.toLowerCase().includes(userIndustry.toLowerCase())
        )
      )
      if (!hasIndustryMatch) return false
    }

    // Check job type alignment
    if (source.jobTypes && source.jobTypes.length > 0) {
      const hasJobTypeMatch = source.jobTypes.some(jobType =>
        profile.targetRoles.some(role => {
          const roleLower = role.toLowerCase()
          const jobTypeLower = jobType.toLowerCase()

          // Direct substring matching
          if (roleLower.includes(jobTypeLower) || jobTypeLower.includes(roleLower)) {
            return true
          }

          // Semantic matching for common terms
          const engineeringTerms = ['engineer', 'engineering', 'developer', 'development']
          const productTerms = ['product', 'pm', 'product manager']
          const designTerms = ['design', 'designer', 'ux', 'ui']

          const roleHasEngineering = engineeringTerms.some(term => roleLower.includes(term))
          const jobTypeHasEngineering = engineeringTerms.some(term => jobTypeLower.includes(term))

          const roleHasProduct = productTerms.some(term => roleLower.includes(term))
          const jobTypeHasProduct = productTerms.some(term => jobTypeLower.includes(term))

          const roleHasDesign = designTerms.some(term => roleLower.includes(term))
          const jobTypeHasDesign = designTerms.some(term => jobTypeLower.includes(term))

          return (roleHasEngineering && jobTypeHasEngineering) ||
                 (roleHasProduct && jobTypeHasProduct) ||
                 (roleHasDesign && jobTypeHasDesign)
        })
      )
      if (!hasJobTypeMatch) return false
    }

    return true
  }

  /**
   * Check if user needs niche site coverage (gaps in mainstream sources)
   */
  private needsNicheCoverage(_profile: UserProfile, _existingTargets: CrawlTarget[]): boolean {
    // Always provide some niche coverage for comprehensive job discovery
    // This ensures we capture jobs that might not be on mainstream sources
    return true
  }

  /**
   * Estimate number of jobs a source might return for a given number of users
   */
  private estimateJobsForSource(source: SourceConfig, userCount: number): number {
    const baseJobsPerUser = {
      'career_page': 8, // Career pages have fewer but higher quality jobs
      'job_board': 25,  // Job boards have many jobs
      'niche_site': 12  // Niche sites have moderate numbers
    }[source.type] || 10

    // Apply reliability and rate limit factors
    const reliabilityFactor = source.reliability
    const capacityFactor = Math.min(source.rateLimitPerMinute / 20, 1.5) // Normalized capacity

    return Math.round(baseJobsPerUser * userCount * reliabilityFactor * capacityFactor)
  }

  /**
   * Generate relevant search terms based on user profiles
   */
  private generateSearchTermsForUsers(profiles: UserProfile[]): string[] {
    const allRoles = new Set<string>()
    const allSkills = new Set<string>()
    const allIndustries = new Set<string>()

    profiles.forEach(profile => {
      profile.targetRoles.forEach(role => allRoles.add(role))
      profile.skills.forEach(skill => allSkills.add(skill))
      profile.industries.forEach(industry => allIndustries.add(industry))
    })

    // Combine and prioritize search terms
    const searchTerms: string[] = []

    // Add role-based terms (highest priority)
    Array.from(allRoles).slice(0, 5).forEach(role => searchTerms.push(role))

    // Add skill-based terms
    Array.from(allSkills).slice(0, 8).forEach(skill => searchTerms.push(skill))

    // Add industry context
    Array.from(allIndustries).slice(0, 3).forEach(industry => searchTerms.push(industry))

    return searchTerms.slice(0, 15) // Limit total terms to avoid overloading
  }

  /**
   * Get source configuration by name
   */
  getSourceConfig(sourceName: string): SourceConfig | undefined {
    return this.sourceConfigs.find(s => s.name === sourceName)
  }

  /**
   * Get all sources by priority tier
   */
  getSourcesByTier(tier: 1 | 2 | 3): SourceConfig[] {
    return this.sourceConfigs.filter(s => s.priority === tier)
  }

  /**
   * Calculate optimal rate limiting for a source based on user load
   */
  calculateRateLimit(source: SourceConfig, userCount: number): {
    requestsPerMinute: number
    delayBetweenRequests: number
    recommendedBatchSize: number
  } {
    const baseLimit = source.rateLimitPerMinute
    const loadFactor = Math.min(userCount / 100, 2.0) // Scale with user count
    const adjustedLimit = Math.round(baseLimit * loadFactor)

    return {
      requestsPerMinute: Math.min(adjustedLimit, baseLimit * 1.5), // Cap at 50% above base
      delayBetweenRequests: Math.ceil(60000 / adjustedLimit), // ms between requests
      recommendedBatchSize: Math.ceil(userCount / 10) // Process users in batches
    }
  }

  /**
   * Get crawl statistics for monitoring
   */
  getCrawlStats(targets: CrawlTarget[]): {
    totalSources: number
    sourcesByTier: Record<number, number>
    totalUsers: number
    estimatedTotalJobs: number
    avgReliability: number
  } {
    const totalSources = targets.length
    const sourcesByTier = targets.reduce((acc, target) => {
      acc[target.source.priority] = (acc[target.source.priority] || 0) + 1
      return acc
    }, {} as Record<number, number>)

    const uniqueUsers = new Set<string>()
    targets.forEach(target => target.users.forEach(user => uniqueUsers.add(user)))

    const totalUsers = uniqueUsers.size
    const estimatedTotalJobs = targets.reduce((sum, target) => sum + target.estimatedJobs, 0)
    const avgReliability = targets.reduce((sum, target) => sum + target.source.reliability, 0) / targets.length

    return {
      totalSources,
      sourcesByTier,
      totalUsers,
      estimatedTotalJobs,
      avgReliability
    }
  }
}

// Export singleton instance
export const sourcePrioritizationEngine = new SourcePrioritizationEngine()

// Export convenience functions
export const allocateWaveUsers = sourcePrioritizationEngine.allocateWaveUsers.bind(sourcePrioritizationEngine)
export const generateCrawlTargets = sourcePrioritizationEngine.generateCrawlTargets.bind(sourcePrioritizationEngine)
export const getSourceConfig = sourcePrioritizationEngine.getSourceConfig.bind(sourcePrioritizationEngine)
export const calculateRateLimit = sourcePrioritizationEngine.calculateRateLimit.bind(sourcePrioritizationEngine)

export type { WaveAllocation }