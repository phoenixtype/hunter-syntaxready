/**
 * Profile Matching System
 *
 * Implements weighted scoring system to match jobs with user profiles.
 * Uses 70% minimum threshold for inclusion in daily digest queue.
 * Supports real-time scoring during crawl operations.
 */

import type { Database } from '@/integrations/supabase/types'

type JobListing = Database['public']['Tables']['job_listings']['Row']
// type UserProfile = Database['public']['Tables']['profiles']['Row']
type UserPreferences = Database['public']['Tables']['user_preferences']['Row']

export interface MatchResult {
  score: number
  reasons: string[]
  qualityLevel: 'excellent' | 'good' | 'fair' | 'poor'
  shouldInclude: boolean
}

export interface MatchWeights {
  skills: number
  jobTitle: number
  location: number
  experienceLevel: number
  salary: number
  company: number
  remote: number
  jobType: number
}

export interface ExtendedProfile {
  id: string
  targetRoles: string[]
  skills: string[]
  industries: string[]
  experienceLevel: string
  preferredLocations: string[]
  salaryExpectation?: {
    min?: number
    max?: number
    currency?: string
  }
  remotePreference: 'required' | 'preferred' | 'acceptable' | 'not_preferred'
  jobTypes: string[] // full-time, part-time, contract, internship
}

interface MatchingContext {
  userProfile: ExtendedProfile
  userPreferences: UserPreferences
  jobListing: JobListing
  weights: MatchWeights
}

class ProfileMatchingEngine {

  // Default matching weights (can be customized per user)
  private readonly defaultWeights: MatchWeights = {
    skills: 0.35,        // 35% - Most important for job success
    jobTitle: 0.20,      // 20% - Role alignment
    location: 0.15,      // 15% - Location preference
    experienceLevel: 0.10, // 10% - Experience fit
    salary: 0.08,        // 8% - Compensation alignment
    company: 0.07,       // 7% - Company preference
    remote: 0.03,        // 3% - Remote work preference
    jobType: 0.02        // 2% - Employment type
  }

  // Minimum threshold for inclusion in digest
  private readonly MIN_MATCH_THRESHOLD = 70.0

  /**
   * Calculate match score between a user profile and job listing
   */
  calculateMatch(
    profile: ExtendedProfile,
    preferences: UserPreferences,
    job: JobListing,
    customWeights?: Partial<MatchWeights>
  ): MatchResult {
    const weights = { ...this.defaultWeights, ...customWeights }
    const context: MatchingContext = {
      userProfile: profile,
      userPreferences: preferences,
      jobListing: job,
      weights
    }

    let totalScore = 0
    const reasons: string[] = []

    // Skills matching (35%)
    const skillsResult = this.matchSkills(context)
    totalScore += skillsResult.score * weights.skills
    reasons.push(...skillsResult.reasons)

    // Job title matching (20%)
    const titleResult = this.matchJobTitle(context)
    totalScore += titleResult.score * weights.jobTitle
    reasons.push(...titleResult.reasons)

    // Location matching (15%)
    const locationResult = this.matchLocation(context)
    totalScore += locationResult.score * weights.location
    reasons.push(...locationResult.reasons)

    // Experience level matching (10%)
    const experienceResult = this.matchExperience(context)
    totalScore += experienceResult.score * weights.experienceLevel
    reasons.push(...experienceResult.reasons)

    // Salary matching (8%)
    const salaryResult = this.matchSalary(context)
    totalScore += salaryResult.score * weights.salary
    reasons.push(...salaryResult.reasons)

    // Company matching (7%)
    const companyResult = this.matchCompany(context)
    totalScore += companyResult.score * weights.company
    reasons.push(...companyResult.reasons)

    // Remote work matching (3%)
    const remoteResult = this.matchRemoteWork(context)
    totalScore += remoteResult.score * weights.remote
    reasons.push(...remoteResult.reasons)

    // Job type matching (2%)
    const jobTypeResult = this.matchJobType(context)
    totalScore += jobTypeResult.score * weights.jobType
    reasons.push(...jobTypeResult.reasons)

    // Convert to percentage and determine quality
    const finalScore = Math.min(Math.round(totalScore * 100), 100)
    const qualityLevel = this.determineQualityLevel(finalScore)
    const shouldInclude = finalScore >= this.MIN_MATCH_THRESHOLD

    return {
      score: finalScore,
      reasons: reasons.filter(r => r.length > 0),
      qualityLevel,
      shouldInclude
    }
  }

  /**
   * Match skills between profile and job
   */
  private matchSkills(context: MatchingContext): { score: number; reasons: string[] } {
    const { userProfile, jobListing } = context

    if (!userProfile.skills?.length) {
      return { score: 0.5, reasons: ['No skills data available'] }
    }

    if (!(jobListing as any).required_skills && !jobListing.description) {
      return { score: 0.5, reasons: ['No job skills data available'] }
    }

    const userSkills = userProfile.skills.map(s => s.toLowerCase().trim())
    const jobSkillsText = `${(jobListing as any).required_skills || ''} ${jobListing.description || ''}`.toLowerCase()

    let matchedSkills = 0
    let totalRelevantSkills = 0
    const matchedSkillNames: string[] = []

    // Direct skill matching
    userSkills.forEach(skill => {
      if (skill.length > 2) { // Ignore very short terms
        totalRelevantSkills++
        if (jobSkillsText.includes(skill)) {
          matchedSkills++
          matchedSkillNames.push(skill)
        }
      }
    })

    // Semantic skill matching
    const skillSynonyms: Record<string, string[]> = {
      'javascript': ['js', 'node.js', 'nodejs', 'react', 'vue', 'angular'],
      'python': ['django', 'flask', 'fastapi', 'pandas', 'numpy'],
      'react': ['jsx', 'next.js', 'nextjs', 'javascript'],
      'sql': ['postgresql', 'mysql', 'database', 'postgres'],
      'aws': ['cloud', 'amazon web services', 'ec2', 's3'],
      'machine learning': ['ml', 'ai', 'artificial intelligence', 'tensorflow', 'pytorch']
    }

    userSkills.forEach(skill => {
      const synonyms = skillSynonyms[skill] || []
      synonyms.forEach(synonym => {
        if (jobSkillsText.includes(synonym) && !matchedSkillNames.includes(skill)) {
          matchedSkills += 0.8 // Partial credit for semantic match
          matchedSkillNames.push(`${skill} (${synonym})`)
        }
      })
    })

    const skillsScore = totalRelevantSkills > 0 ? Math.min(matchedSkills / totalRelevantSkills, 1.0) : 0.5

    const reasons = []
    if (matchedSkillNames.length > 0) {
      reasons.push(`Skill matches: ${matchedSkillNames.slice(0, 5).join(', ')}`)
    }
    if (skillsScore < 0.3) {
      reasons.push('Limited skill alignment')
    }

    return { score: skillsScore, reasons }
  }

  /**
   * Match job title with target roles
   */
  private matchJobTitle(context: MatchingContext): { score: number; reasons: string[] } {
    const { userProfile, jobListing } = context

    if (!userProfile.targetRoles?.length || !jobListing.title) {
      return { score: 0.5, reasons: ['Insufficient job title data'] }
    }

    const jobTitle = jobListing.title.toLowerCase()
    let bestMatch = 0
    let matchedRole = ''

    userProfile.targetRoles.forEach(targetRole => {
      const roleLower = targetRole.toLowerCase()

      // Exact match
      if (jobTitle.includes(roleLower) || roleLower.includes(jobTitle)) {
        if (1.0 > bestMatch) {
          bestMatch = 1.0
          matchedRole = targetRole
        }
        return
      }

      // Semantic matching
      const roleScore = this.calculateSemanticSimilarity(roleLower, jobTitle)
      if (roleScore > bestMatch) {
        bestMatch = roleScore
        matchedRole = targetRole
      }
    })

    const reasons = []
    if (bestMatch > 0.7) {
      reasons.push(`Strong title match: ${matchedRole}`)
    } else if (bestMatch > 0.4) {
      reasons.push(`Partial title match: ${matchedRole}`)
    } else {
      reasons.push('Limited title alignment')
    }

    return { score: bestMatch, reasons }
  }

  /**
   * Match location preferences
   */
  private matchLocation(context: MatchingContext): { score: number; reasons: string[] } {
    const { userProfile, jobListing } = context

    if (!jobListing.location) {
      return { score: 0.7, reasons: ['Location not specified'] }
    }

    const jobLocation = jobListing.location.toLowerCase()
    const isRemote = jobLocation.includes('remote') || jobLocation.includes('anywhere')

    // Handle remote work preference
    if (isRemote) {
      if (userProfile.remotePreference === 'required' || userProfile.remotePreference === 'preferred') {
        return { score: 1.0, reasons: ['Remote work available'] }
      } else if (userProfile.remotePreference === 'acceptable') {
        return { score: 0.8, reasons: ['Remote work acceptable'] }
      } else {
        return { score: 0.3, reasons: ['Remote work not preferred'] }
      }
    }

    // Match against preferred locations
    if (userProfile.preferredLocations?.length) {
      for (const preferredLoc of userProfile.preferredLocations) {
        const prefLower = preferredLoc.toLowerCase()
        if (jobLocation.includes(prefLower) || prefLower.includes(jobLocation.split(',')[0])) {
          return { score: 1.0, reasons: [`Location match: ${preferredLoc}`] }
        }
      }

      // Partial location matching (same state/country)
      for (const preferredLoc of userProfile.preferredLocations) {
        const jobParts = jobLocation.split(',').map(p => p.trim())
        const prefParts = preferredLoc.toLowerCase().split(',').map(p => p.trim())

        if (jobParts.length > 1 && prefParts.length > 1) {
          if (jobParts[1] === prefParts[1]) { // Same state/country
            return { score: 0.6, reasons: [`Same region: ${jobParts[1]}`] }
          }
        }
      }

      return { score: 0.2, reasons: ['Location not in preferred areas'] }
    }

    return { score: 0.6, reasons: ['No location preferences set'] }
  }

  /**
   * Match experience level
   */
  private matchExperience(context: MatchingContext): { score: number; reasons: string[] } {
    const { userProfile, jobListing } = context

    if (!userProfile.experienceLevel || !jobListing.experience_level) {
      return { score: 0.6, reasons: ['Experience level not specified'] }
    }

    const userLevel = userProfile.experienceLevel.toLowerCase()
    const jobLevel = jobListing.experience_level.toLowerCase()

    // Exact match
    if (userLevel === jobLevel) {
      return { score: 1.0, reasons: [`Experience match: ${jobLevel}`] }
    }

    // Experience level hierarchy
    const levels = ['entry', 'junior', 'mid', 'senior', 'lead', 'principal', 'director']
    const userIndex = levels.indexOf(userLevel)
    const jobIndex = levels.indexOf(jobLevel)

    if (userIndex === -1 || jobIndex === -1) {
      return { score: 0.5, reasons: ['Unknown experience level'] }
    }

    // Calculate compatibility based on level difference
    const difference = Math.abs(userIndex - jobIndex)
    let score = 1.0
    let reason = ''

    if (difference === 1) {
      score = 0.8
      reason = 'Close experience level match'
    } else if (difference === 2) {
      score = 0.5
      reason = 'Moderate experience level gap'
    } else {
      score = 0.2
      reason = 'Significant experience level gap'
    }

    return { score, reasons: [reason] }
  }

  /**
   * Match salary expectations
   */
  private matchSalary(context: MatchingContext): { score: number; reasons: string[] } {
    const { userProfile, jobListing } = context

    if (!userProfile.salaryExpectation || (!jobListing.salary_min && !jobListing.salary_max)) {
      return { score: 0.7, reasons: ['Salary information not available'] }
    }

    const userMin = userProfile.salaryExpectation.min || 0
    const userMax = userProfile.salaryExpectation.max || Infinity
    const jobMin = jobListing.salary_min || 0
    const jobMax = jobListing.salary_max || Infinity

    // Check for overlap in salary ranges
    const overlapMin = Math.max(userMin, jobMin)
    const overlapMax = Math.min(userMax, jobMax)

    if (overlapMax >= overlapMin) {
      const userRange = userMax - userMin
      const jobRange = jobMax - jobMin
      const overlapRange = overlapMax - overlapMin

      // Calculate percentage of overlap
      const overlapRatio = userRange > 0 ? overlapRange / userRange : 1.0

      if (overlapRatio > 0.8) {
        return { score: 1.0, reasons: ['Excellent salary alignment'] }
      } else if (overlapRatio > 0.5) {
        return { score: 0.8, reasons: ['Good salary alignment'] }
      } else {
        return { score: 0.6, reasons: ['Partial salary overlap'] }
      }
    } else {
      // No overlap - check how far apart
      const gap = Math.min(Math.abs(userMin - jobMax), Math.abs(jobMin - userMax))
      const avgSalary = (userMin + userMax + jobMin + jobMax) / 4
      const relativeGap = gap / avgSalary

      if (relativeGap < 0.1) {
        return { score: 0.4, reasons: ['Salary slightly below/above expectations'] }
      } else {
        return { score: 0.1, reasons: ['Salary significantly misaligned'] }
      }
    }
  }

  /**
   * Match company preferences
   */
  private matchCompany(context: MatchingContext): { score: number; reasons: string[] } {
    // Placeholder for company preference matching
    // Could be enhanced with company size, industry, culture preferences
    return { score: 0.7, reasons: ['Company matching not implemented'] }
  }

  /**
   * Match remote work preferences
   */
  private matchRemoteWork(context: MatchingContext): { score: number; reasons: string[] } {
    const { userProfile, jobListing } = context

    const jobLocation = jobListing.location?.toLowerCase() || ''
    const isRemote = jobLocation.includes('remote') || jobLocation.includes('anywhere')
    const isHybrid = jobLocation.includes('hybrid')

    switch (userProfile.remotePreference) {
      case 'required':
        if (isRemote) return { score: 1.0, reasons: ['Remote work required and available'] }
        if (isHybrid) return { score: 0.6, reasons: ['Hybrid available, remote required'] }
        return { score: 0.0, reasons: ['Remote work required but not available'] }

      case 'preferred':
        if (isRemote) return { score: 1.0, reasons: ['Remote work preferred and available'] }
        if (isHybrid) return { score: 0.8, reasons: ['Hybrid available, remote preferred'] }
        return { score: 0.4, reasons: ['Remote work preferred but not available'] }

      case 'acceptable':
        if (isRemote) return { score: 0.8, reasons: ['Remote work acceptable'] }
        if (isHybrid) return { score: 0.9, reasons: ['Hybrid work acceptable'] }
        return { score: 1.0, reasons: ['On-site work acceptable'] }

      case 'not_preferred':
        if (isRemote) return { score: 0.3, reasons: ['Remote work not preferred'] }
        if (isHybrid) return { score: 0.6, reasons: ['Hybrid work acceptable'] }
        return { score: 1.0, reasons: ['On-site work preferred'] }

      default:
        return { score: 0.7, reasons: ['No remote work preference specified'] }
    }
  }

  /**
   * Match job type (full-time, contract, etc.)
   */
  private matchJobType(context: MatchingContext): { score: number; reasons: string[] } {
    const { userProfile, jobListing } = context

    if (!userProfile.jobTypes?.length || !jobListing.job_type) {
      return { score: 0.8, reasons: ['Job type not specified'] }
    }

    const jobType = jobListing.job_type.toLowerCase()
    const userTypes = userProfile.jobTypes.map(t => t.toLowerCase())

    if (userTypes.includes(jobType)) {
      return { score: 1.0, reasons: [`Job type match: ${jobType}`] }
    }

    // Partial matches
    if (jobType.includes('full') && userTypes.some(t => t.includes('full'))) {
      return { score: 1.0, reasons: ['Full-time position match'] }
    }

    if (jobType.includes('contract') && userTypes.some(t => t.includes('contract'))) {
      return { score: 1.0, reasons: ['Contract position match'] }
    }

    return { score: 0.3, reasons: ['Job type mismatch'] }
  }

  /**
   * Calculate semantic similarity between two text strings
   */
  private calculateSemanticSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity
    const words1 = text1.split(/\s+/).filter(w => w.length > 2)
    const words2 = text2.split(/\s+/).filter(w => w.length > 2)

    if (words1.length === 0 || words2.length === 0) return 0

    let matches = 0
    words1.forEach(word1 => {
      if (words2.some(word2 => word2.includes(word1) || word1.includes(word2))) {
        matches++
      }
    })

    return matches / Math.max(words1.length, words2.length)
  }

  /**
   * Determine quality level based on score
   */
  private determineQualityLevel(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score >= 90) return 'excellent'
    if (score >= 75) return 'good'
    if (score >= 60) return 'fair'
    return 'poor'
  }

  /**
   * Batch process multiple jobs for a user
   */
  async batchMatchJobs(
    profile: ExtendedProfile,
    preferences: UserPreferences,
    jobs: JobListing[],
    customWeights?: Partial<MatchWeights>
  ): Promise<Array<{ job: JobListing; match: MatchResult }>> {
    const results = jobs.map(job => ({
      job,
      match: this.calculateMatch(profile, preferences, job, customWeights)
    }))

    // Filter to only include matches above threshold
    return results.filter(result => result.match.shouldInclude)
      .sort((a, b) => b.match.score - a.match.score) // Sort by score descending
  }

  /**
   * Get matching statistics for monitoring
   */
  getMatchingStats(matches: MatchResult[]): {
    totalMatches: number
    qualityDistribution: Record<string, number>
    averageScore: number
    topReasons: Array<{ reason: string; count: number }>
  } {
    const totalMatches = matches.length
    const qualityDistribution = matches.reduce((acc, match) => {
      acc[match.qualityLevel] = (acc[match.qualityLevel] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const averageScore = matches.length > 0
      ? matches.reduce((sum, match) => sum + match.score, 0) / matches.length
      : 0

    // Count reason frequency
    const reasonCounts: Record<string, number> = {}
    matches.forEach(match => {
      match.reasons.forEach(reason => {
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1
      })
    })

    const topReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalMatches,
      qualityDistribution,
      averageScore,
      topReasons
    }
  }
}

// Export singleton instance
export const profileMatchingEngine = new ProfileMatchingEngine()

// Export convenience functions
export const calculateProfileMatch = profileMatchingEngine.calculateMatch.bind(profileMatchingEngine)
export const batchMatchJobs = profileMatchingEngine.batchMatchJobs.bind(profileMatchingEngine)
export const getMatchingStats = profileMatchingEngine.getMatchingStats.bind(profileMatchingEngine)

export type { ExtendedProfile, MatchingContext }