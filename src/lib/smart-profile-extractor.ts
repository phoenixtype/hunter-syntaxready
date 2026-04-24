/**
 * Smart Profile Extractor
 *
 * Extracts and enriches user profiles for more targeted job searches,
 * reducing API calls by finding the most relevant jobs on the first attempt.
 */

import { CandidateProfile } from './resume_engine';
import { UserPreferences } from './user_preferences';

export interface EnhancedSearchProfile {
  primaryRole: string;
  alternativeRoles: string[];
  skillKeywords: string[];
  locationPreferences: string[];
  remotePolicy: 'remote' | 'hybrid' | 'onsite';
  seniorityLevel: 'junior' | 'mid' | 'senior' | 'lead' | 'executive';
  industryPreferences: string[];
  salaryRange?: { min: number; max: number; currency: string };
  companyTypes: string[];
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
}

class SmartProfileExtractor {
  /**
   * Extract enhanced search profile from resume and preferences
   */
  extractEnhancedProfile(
    profile: CandidateProfile | null,
    preferences: UserPreferences | null
  ): EnhancedSearchProfile {
    const enhanced: EnhancedSearchProfile = {
      primaryRole: this.extractPrimaryRole(profile, preferences),
      alternativeRoles: this.extractAlternativeRoles(profile, preferences),
      skillKeywords: this.extractSkillKeywords(profile, preferences),
      locationPreferences: this.extractLocationPreferences(preferences),
      remotePolicy: this.extractRemotePolicy(preferences),
      seniorityLevel: this.extractSeniorityLevel(profile),
      industryPreferences: this.extractIndustryPreferences(profile, preferences),
      salaryRange: this.extractSalaryRange(preferences),
      companyTypes: this.extractCompanyTypes(preferences),
      mustHaveSkills: this.extractMustHaveSkills(profile),
      niceToHaveSkills: this.extractNiceToHaveSkills(profile)
    };

    console.log('[SMART_PROFILE] Enhanced profile:', {
      primaryRole: enhanced.primaryRole,
      alternativeRoles: enhanced.alternativeRoles.slice(0, 2),
      topSkills: enhanced.skillKeywords.slice(0, 5),
      locations: enhanced.locationPreferences,
      seniority: enhanced.seniorityLevel
    });

    return enhanced;
  }

  /**
   * Generate optimized search terms for maximum relevance
   */
  generateOptimizedSearchTerms(enhanced: EnhancedSearchProfile): {
    primarySearch: string;
    fallbackSearch?: string;
    locationModifier: string;
  } {
    // Primary search: Role + critical skills
    const criticalSkills = enhanced.mustHaveSkills.slice(0, 2);
    const primarySearch = criticalSkills.length > 0
      ? `${enhanced.primaryRole} ${criticalSkills.join(' ')}`
      : enhanced.primaryRole;

    // Fallback search: Alternative role or seniority variant
    let fallbackSearch: string | undefined;
    if (enhanced.alternativeRoles.length > 0) {
      fallbackSearch = enhanced.alternativeRoles[0];
    } else if (enhanced.seniorityLevel !== 'mid') {
      fallbackSearch = `${enhanced.seniorityLevel} ${enhanced.primaryRole}`;
    }

    // Location modifier based on preferences
    const locationModifier = enhanced.remotePolicy === 'remote'
      ? 'remote'
      : enhanced.locationPreferences[0] || '';

    return {
      primarySearch: primarySearch.trim(),
      fallbackSearch: fallbackSearch?.trim(),
      locationModifier: locationModifier.trim()
    };
  }

  /**
   * Calculate search priority score for job relevance
   */
  calculateJobRelevanceScore(
    job: any,
    enhanced: EnhancedSearchProfile
  ): number {
    let score = 0;

    // Role matching (40% weight)
    const jobTitle = (job.title || '').toLowerCase();
    if (jobTitle.includes(enhanced.primaryRole.toLowerCase())) {
      score += 0.4;
    } else if (enhanced.alternativeRoles.some(role =>
      jobTitle.includes(role.toLowerCase())
    )) {
      score += 0.3;
    }

    // Skill matching (30% weight)
    const jobDescription = (job.description || '').toLowerCase();
    const mustHaveMatches = enhanced.mustHaveSkills.filter(skill =>
      jobDescription.includes(skill.toLowerCase()) || jobTitle.includes(skill.toLowerCase())
    ).length;

    score += (mustHaveMatches / Math.max(enhanced.mustHaveSkills.length, 1)) * 0.3;

    // Location matching (15% weight)
    const jobLocation = (job.location || '').toLowerCase();
    if (enhanced.remotePolicy === 'remote' && jobLocation.includes('remote')) {
      score += 0.15;
    } else if (enhanced.locationPreferences.some(loc =>
      jobLocation.includes(loc.toLowerCase())
    )) {
      score += 0.15;
    }

    // Seniority matching (10% weight)
    const seniorityMatch = this.matchSeniorityLevel(jobTitle, enhanced.seniorityLevel);
    score += seniorityMatch * 0.1;

    // Nice-to-have skills bonus (5% weight)
    const niceToHaveMatches = enhanced.niceToHaveSkills.filter(skill =>
      jobDescription.includes(skill.toLowerCase())
    ).length;

    score += (niceToHaveMatches / Math.max(enhanced.niceToHaveSkills.length, 1)) * 0.05;

    return Math.min(score, 1.0);
  }

  private extractPrimaryRole(
    profile: CandidateProfile | null,
    preferences: UserPreferences | null
  ): string {
    // Preference roles take priority
    if (preferences?.target_roles?.length > 0) {
      return preferences.target_roles[0];
    }

    // Extract from latest job experience
    if (profile?.experience_atoms?.length > 0) {
      return profile.experience_atoms[0].role;
    }

    // Fallback based on skills
    const topSkills = profile?.skills?.slice(0, 3).map(s => s.name) || [];
    if (topSkills.some(skill => skill.toLowerCase().includes('react'))) {
      return 'Frontend Developer';
    }
    if (topSkills.some(skill => skill.toLowerCase().includes('python'))) {
      return 'Backend Developer';
    }
    if (topSkills.some(skill => skill.toLowerCase().includes('data'))) {
      return 'Data Scientist';
    }

    return 'Software Engineer';
  }

  private extractAlternativeRoles(
    profile: CandidateProfile | null,
    preferences: UserPreferences | null
  ): string[] {
    const alternatives: string[] = [];

    // Additional preference roles
    if (preferences?.target_roles?.length > 1) {
      alternatives.push(...preferences.target_roles.slice(1, 3));
    }

    // Previous roles from experience
    if (profile?.experience_atoms) {
      const previousRoles = profile.experience_atoms
        .slice(1, 4)
        .map(exp => exp.role)
        .filter(role => role && role.toLowerCase() !== this.extractPrimaryRole(profile, preferences).toLowerCase());
      alternatives.push(...previousRoles);
    }

    // Skill-based role suggestions
    const topSkills = profile?.skills?.slice(0, 5).map(s => s.name.toLowerCase()) || [];
    if (topSkills.includes('javascript') || topSkills.includes('react') || topSkills.includes('vue')) {
      if (!alternatives.some(r => r.toLowerCase().includes('frontend'))) {
        alternatives.push('Frontend Developer');
      }
    }
    if (topSkills.includes('node.js') || topSkills.includes('python') || topSkills.includes('java')) {
      if (!alternatives.some(r => r.toLowerCase().includes('backend'))) {
        alternatives.push('Backend Developer');
      }
    }

    return [...new Set(alternatives)].slice(0, 3);
  }

  private extractSkillKeywords(
    profile: CandidateProfile | null,
    preferences: UserPreferences | null
  ): string[] {
    const keywords: string[] = [];

    // Top skills from profile
    if (profile?.skills) {
      keywords.push(...profile.skills.slice(0, 8).map(s => s.name));
    }

    // Additional keywords from preferences or experience
    if (profile?.experience_atoms) {
      const recentExp = profile.experience_atoms[0];
      if (recentExp?.description) {
        const techKeywords = this.extractTechKeywords(recentExp.description);
        keywords.push(...techKeywords.slice(0, 5));
      }
    }

    return [...new Set(keywords)];
  }

  private extractLocationPreferences(preferences: UserPreferences | null): string[] {
    return preferences?.locations?.slice(0, 3) || [];
  }

  private extractRemotePolicy(preferences: UserPreferences | null): 'remote' | 'hybrid' | 'onsite' {
    return preferences?.remote_policy === 'remote' ? 'remote' :
           preferences?.remote_policy === 'onsite' ? 'onsite' : 'hybrid';
  }

  private extractSeniorityLevel(profile: CandidateProfile | null): 'junior' | 'mid' | 'senior' | 'lead' | 'executive' {
    if (!profile?.experience_atoms?.length) return 'junior';

    const totalYears = profile.experience_atoms.reduce((sum, exp) => {
      const match = exp.duration?.match(/(\d+)\s*year/);
      return sum + (match ? parseInt(match[1]) : 1);
    }, 0);

    const latestRole = profile.experience_atoms[0]?.role?.toLowerCase() || '';

    if (latestRole.includes('cto') || latestRole.includes('vp') || latestRole.includes('director')) {
      return 'executive';
    }
    if (latestRole.includes('lead') || latestRole.includes('principal') || latestRole.includes('staff')) {
      return 'lead';
    }
    if (latestRole.includes('senior') || totalYears >= 5) {
      return 'senior';
    }
    if (totalYears >= 2) {
      return 'mid';
    }

    return 'junior';
  }

  private extractIndustryPreferences(
    profile: CandidateProfile | null,
    preferences: UserPreferences | null
  ): string[] {
    // Could be enhanced based on previous companies or preferences
    return [];
  }

  private extractSalaryRange(preferences: UserPreferences | null): { min: number; max: number; currency: string } | undefined {
    // Could be enhanced based on preferences or experience level
    return undefined;
  }

  private extractCompanyTypes(preferences: UserPreferences | null): string[] {
    // Could be enhanced based on preferences (startup, enterprise, etc.)
    return [];
  }

  private extractMustHaveSkills(profile: CandidateProfile | null): string[] {
    // Top 3-5 most important skills
    return profile?.skills?.slice(0, 5).map(s => s.name) || [];
  }

  private extractNiceToHaveSkills(profile: CandidateProfile | null): string[] {
    // Additional skills that would be good to have
    return profile?.skills?.slice(5, 10).map(s => s.name) || [];
  }

  private extractTechKeywords(text: string): string[] {
    const techKeywords = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'React', 'Vue', 'Angular',
      'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'AWS', 'Docker',
      'Kubernetes', 'PostgreSQL', 'MongoDB', 'Redis', 'GraphQL', 'REST'
    ];

    return techKeywords.filter(keyword =>
      text.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private matchSeniorityLevel(jobTitle: string, userLevel: string): number {
    const titleLower = jobTitle.toLowerCase();

    switch (userLevel) {
      case 'junior':
        if (titleLower.includes('junior') || titleLower.includes('entry')) return 1;
        if (titleLower.includes('senior') || titleLower.includes('lead')) return 0;
        return 0.8; // Mid-level roles are still reasonable

      case 'mid':
        if (titleLower.includes('senior') || titleLower.includes('lead')) return 0.7;
        if (titleLower.includes('junior')) return 0.5;
        return 1; // Perfect match for mid-level

      case 'senior':
        if (titleLower.includes('senior')) return 1;
        if (titleLower.includes('lead') || titleLower.includes('staff')) return 0.9;
        if (titleLower.includes('junior')) return 0.2;
        return 0.8;

      case 'lead':
        if (titleLower.includes('lead') || titleLower.includes('staff') || titleLower.includes('principal')) return 1;
        if (titleLower.includes('senior')) return 0.8;
        return 0.6;

      case 'executive':
        if (titleLower.includes('director') || titleLower.includes('vp') || titleLower.includes('cto')) return 1;
        if (titleLower.includes('lead') || titleLower.includes('principal')) return 0.7;
        return 0.4;

      default:
        return 0.8;
    }
  }
}

// Export singleton instance
export const smartProfileExtractor = new SmartProfileExtractor();
export { EnhancedSearchProfile };