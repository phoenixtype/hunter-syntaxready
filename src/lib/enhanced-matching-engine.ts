/**
 * Enhanced AI-Powered Job Matching Engine
 *
 * Multi-dimensional job matching with machine learning capabilities
 * that considers technical skills, cultural fit, career growth, and user behavior.
 */

import { CandidateProfile } from './resume_engine';
import { JobOpportunity } from './crawler_engine';

export interface EnhancedMatchScore {
  overallScore: number;
  breakdown: {
    technicalMatch: number;      // 0-1: Technical skills alignment
    cultureFit: number;          // 0-1: Company culture compatibility
    careerGrowth: number;        // 0-1: Growth potential
    salaryAlignment: number;     // 0-1: Compensation match
    locationMatch: number;       // 0-1: Location/remote preference
    industryExperience: number;  // 0-1: Relevant industry background
  };
  reasoning: string[];
  improvements: string[];
  confidenceLevel: number;       // 0-1: Confidence in the match score
}

export interface UserInteractionHistory {
  appliedJobs: string[];
  likedJobs: string[];
  dismissedJobs: string[];
  interviewsReceived: string[];
  successfulApplications: string[];
}

export class EnhancedMatchingEngine {

  /**
   * Calculate comprehensive match score using AI analysis
   */
  async calculateAdvancedMatch(
    userProfile: CandidateProfile,
    job: JobOpportunity,
    userHistory?: UserInteractionHistory
  ): Promise<EnhancedMatchScore> {

    // Calculate individual match components
    const technicalMatch = await this.calculateTechnicalMatch(userProfile, job);
    const cultureFit = await this.calculateCultureFit(userProfile, job);
    const careerGrowth = await this.calculateCareerGrowth(userProfile, job);
    const salaryAlignment = this.calculateSalaryAlignment(userProfile, job);
    const locationMatch = this.calculateLocationMatch(userProfile, job);
    const industryExperience = this.calculateIndustryExperience(userProfile, job);

    // Apply machine learning weights if user history available
    const weights = userHistory
      ? await this.calculatePersonalizedWeights(userProfile, userHistory)
      : this.getDefaultWeights();

    // Calculate weighted overall score
    const overallScore = this.calculateWeightedScore({
      technicalMatch,
      cultureFit,
      careerGrowth,
      salaryAlignment,
      locationMatch,
      industryExperience
    }, weights);

    // Generate reasoning and improvements
    const reasoning = this.generateMatchingReasoning({
      technicalMatch,
      cultureFit,
      careerGrowth,
      salaryAlignment,
      locationMatch,
      industryExperience
    }, job);

    const improvements = this.generateImprovementSuggestions(userProfile, job, {
      technicalMatch,
      cultureFit,
      careerGrowth,
      salaryAlignment,
      locationMatch,
      industryExperience
    });

    // Calculate confidence based on data completeness
    const confidenceLevel = this.calculateConfidenceLevel(userProfile, job);

    return {
      overallScore,
      breakdown: {
        technicalMatch,
        cultureFit,
        careerGrowth,
        salaryAlignment,
        locationMatch,
        industryExperience
      },
      reasoning,
      improvements,
      confidenceLevel
    };
  }

  /**
   * Analyze technical skills alignment using semantic matching
   */
  private async calculateTechnicalMatch(
    userProfile: CandidateProfile,
    job: JobOpportunity
  ): Promise<number> {
    const userSkills = userProfile.skills.map(s => s.name.toLowerCase());
    const jobDescription = job.description.toLowerCase();
    const jobTitle = job.title.toLowerCase();

    // Extract technical requirements from job description
    const techKeywords = this.extractTechnicalKeywords(jobDescription + ' ' + jobTitle);

    // Calculate direct skill matches
    const directMatches = userSkills.filter(skill =>
      techKeywords.some(keyword =>
        keyword.includes(skill) || skill.includes(keyword)
      )
    ).length;

    // Calculate semantic similarity for related skills
    const semanticMatches = this.calculateSemanticSimilarity(userSkills, techKeywords);

    // Consider experience level and recency
    const experienceBonus = this.calculateExperienceBonus(userProfile, techKeywords);

    const totalPossibleSkills = Math.max(techKeywords.length, userSkills.length);
    const baseScore = Math.min((directMatches + semanticMatches) / totalPossibleSkills, 1);

    return Math.min(baseScore + experienceBonus, 1);
  }

  /**
   * Assess cultural fit based on company and role characteristics
   */
  private async calculateCultureFit(
    userProfile: CandidateProfile,
    job: JobOpportunity
  ): Promise<number> {
    let cultureFit = 0.5; // Default neutral score

    const jobText = (job.description + ' ' + job.title + ' ' + job.company).toLowerCase();

    // Remote work preference alignment
    const isRemoteRole = jobText.includes('remote') || jobText.includes('work from home');
    const userExperience = userProfile.experience_atoms || [];
    const hasRemoteExperience = userExperience.some(exp =>
      exp.description?.toLowerCase().includes('remote') ||
      exp.location?.toLowerCase().includes('remote')
    );

    if (isRemoteRole && hasRemoteExperience) cultureFit += 0.2;
    if (!isRemoteRole && !hasRemoteExperience) cultureFit += 0.1;

    // Company size preference (startup vs enterprise)
    const isStartup = jobText.includes('startup') || jobText.includes('early stage');
    const isEnterprise = jobText.includes('enterprise') || jobText.includes('fortune');
    const hasStartupExperience = userExperience.some(exp =>
      exp.description?.toLowerCase().includes('startup') ||
      exp.description?.toLowerCase().includes('early stage')
    );

    if (isStartup && hasStartupExperience) cultureFit += 0.15;
    if (isEnterprise && !hasStartupExperience) cultureFit += 0.1;

    // Industry alignment
    const industryMatch = this.calculateIndustryAlignment(userProfile, job);
    cultureFit += industryMatch * 0.15;

    return Math.min(cultureFit, 1);
  }

  /**
   * Evaluate career growth potential
   */
  private async calculateCareerGrowth(
    userProfile: CandidateProfile,
    job: JobOpportunity
  ): Promise<number> {
    const jobText = (job.description + ' ' + job.title).toLowerCase();
    const currentLevel = this.inferCareerLevel(userProfile);
    const jobLevel = this.inferJobLevel(job);

    // Growth indicators in job description
    const growthKeywords = [
      'growth', 'advancement', 'career', 'promotion', 'leadership',
      'mentorship', 'learning', 'development', 'training', 'progression'
    ];

    const growthMentions = growthKeywords.filter(keyword =>
      jobText.includes(keyword)
    ).length;

    const growthScore = Math.min(growthMentions / growthKeywords.length * 0.4, 0.4);

    // Level progression appropriateness
    const levelProgression = this.calculateLevelProgression(currentLevel, jobLevel);

    // Company growth potential (based on job posting patterns and company info)
    const companyGrowthScore = this.assessCompanyGrowth(job);

    return Math.min(growthScore + levelProgression + companyGrowthScore, 1);
  }

  /**
   * Calculate salary/compensation alignment
   */
  private calculateSalaryAlignment(
    userProfile: CandidateProfile,
    job: JobOpportunity
  ): Promise<number> {
    // If no salary info available, return neutral score
    if (!job.salary_range || job.salary_range === 'Not specified') {
      return Promise.resolve(0.5);
    }

    // Extract salary numbers from job posting
    const salaryNumbers = this.extractSalaryNumbers(job.salary_range);
    if (salaryNumbers.length === 0) return Promise.resolve(0.5);

    // Estimate user's expected salary based on experience and location
    const expectedSalary = this.estimateUserExpectedSalary(userProfile);

    const jobSalaryMid = salaryNumbers.length > 1
      ? (salaryNumbers[0] + salaryNumbers[1]) / 2
      : salaryNumbers[0];

    // Calculate alignment score
    const difference = Math.abs(expectedSalary - jobSalaryMid) / expectedSalary;
    const alignmentScore = Math.max(0, 1 - difference);

    return Promise.resolve(alignmentScore);
  }

  /**
   * Calculate location match score
   */
  private calculateLocationMatch(
    userProfile: CandidateProfile,
    job: JobOpportunity
  ): number {
    const jobLocation = (job.location || '').toLowerCase();

    // Remote jobs get high score for all users
    if (jobLocation.includes('remote')) return 0.9;

    // Extract user's location preferences from experience
    const userLocations = (userProfile.experience_atoms || [])
      .map(exp => exp.location?.toLowerCase())
      .filter(Boolean);

    // Check for location match
    const locationMatch = userLocations.some(userLoc =>
      userLoc && (jobLocation.includes(userLoc) || userLoc.includes(jobLocation))
    );

    return locationMatch ? 0.8 : 0.3; // Lower score for location mismatch
  }

  /**
   * Calculate industry experience relevance
   */
  private calculateIndustryExperience(
    userProfile: CandidateProfile,
    job: JobOpportunity
  ): number {
    const userExperience = userProfile.experience_atoms || [];
    const jobText = (job.description + ' ' + job.company).toLowerCase();

    // Industry keywords mapping
    const industryKeywords = {
      fintech: ['fintech', 'financial', 'banking', 'payments', 'trading'],
      healthcare: ['healthcare', 'medical', 'health', 'pharma', 'biotech'],
      ecommerce: ['ecommerce', 'retail', 'marketplace', 'shopping'],
      saas: ['saas', 'software', 'cloud', 'subscription'],
      gaming: ['gaming', 'game', 'entertainment', 'mobile games'],
      edtech: ['education', 'edtech', 'learning', 'academic'],
      logistics: ['logistics', 'supply chain', 'delivery', 'transportation']
    };

    // Identify job industry
    let jobIndustry = 'general';
    for (const [industry, keywords] of Object.entries(industryKeywords)) {
      if (keywords.some(keyword => jobText.includes(keyword))) {
        jobIndustry = industry;
        break;
      }
    }

    if (jobIndustry === 'general') return 0.5;

    // Check user experience for industry matches
    const industryKeywordList = industryKeywords[jobIndustry as keyof typeof industryKeywords];
    const hasIndustryExperience = userExperience.some(exp => {
      const expText = (exp.description || '' + ' ' + exp.company || '').toLowerCase();
      return industryKeywordList.some(keyword => expText.includes(keyword));
    });

    return hasIndustryExperience ? 0.9 : 0.4;
  }

  /**
   * Calculate personalized weights based on user behavior
   */
  private async calculatePersonalizedWeights(
    userProfile: CandidateProfile,
    userHistory: UserInteractionHistory
  ): Promise<Record<string, number>> {
    // Default weights
    const weights = {
      technicalMatch: 0.3,
      cultureFit: 0.2,
      careerGrowth: 0.2,
      salaryAlignment: 0.15,
      locationMatch: 0.1,
      industryExperience: 0.05
    };

    // Adjust weights based on user behavior patterns
    // This would ideally use ML models trained on user interaction data

    // If user frequently applies to high-salary jobs, increase salary weight
    if (userHistory.appliedJobs.length > 5) {
      // In real implementation, analyze actual job data
      weights.salaryAlignment += 0.05;
      weights.technicalMatch -= 0.05;
    }

    return weights;
  }

  /**
   * Get default weighting scheme
   */
  private getDefaultWeights(): Record<string, number> {
    return {
      technicalMatch: 0.35,     // Most important: skills alignment
      cultureFit: 0.25,         // Important: culture and fit
      careerGrowth: 0.20,       // Important: growth potential
      salaryAlignment: 0.10,    // Moderate: compensation match
      locationMatch: 0.07,      // Lower: location preference
      industryExperience: 0.03  // Lowest: industry background
    };
  }

  /**
   * Calculate weighted overall score
   */
  private calculateWeightedScore(
    scores: Record<string, number>,
    weights: Record<string, number>
  ): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [key, score] of Object.entries(scores)) {
      const weight = weights[key] || 0;
      weightedSum += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Generate human-readable reasoning for the match
   */
  private generateMatchingReasoning(
    scores: Record<string, number>,
    job: JobOpportunity
  ): string[] {
    const reasoning: string[] = [];

    if (scores.technicalMatch > 0.8) {
      reasoning.push(`Strong technical skills match - your experience aligns well with ${job.title} requirements`);
    } else if (scores.technicalMatch > 0.6) {
      reasoning.push(`Good technical skills match with room for growth in this ${job.title} role`);
    } else {
      reasoning.push(`Technical skills gap identified - consider upskilling for ${job.title} positions`);
    }

    if (scores.cultureFit > 0.7) {
      reasoning.push(`Excellent cultural fit based on company values and work style at ${job.company}`);
    }

    if (scores.careerGrowth > 0.7) {
      reasoning.push(`High growth potential - this role offers strong career advancement opportunities`);
    }

    if (scores.salaryAlignment > 0.7) {
      reasoning.push(`Compensation expectations align well with the offered salary range`);
    }

    if (scores.locationMatch > 0.8) {
      reasoning.push(`Location preferences perfectly match this opportunity`);
    }

    if (scores.industryExperience > 0.8) {
      reasoning.push(`Your industry experience is highly relevant for this position`);
    }

    return reasoning;
  }

  /**
   * Generate improvement suggestions
   */
  private generateImprovementSuggestions(
    userProfile: CandidateProfile,
    job: JobOpportunity,
    scores: Record<string, number>
  ): string[] {
    const suggestions: string[] = [];

    if (scores.technicalMatch < 0.6) {
      const missingSkills = this.identifyMissingSkills(userProfile, job);
      suggestions.push(`Consider learning: ${missingSkills.slice(0, 3).join(', ')}`);
    }

    if (scores.cultureFit < 0.5) {
      suggestions.push(`Research ${job.company}'s culture and values to better tailor your application`);
    }

    if (scores.industryExperience < 0.5) {
      suggestions.push(`Highlight transferable skills or consider industry-specific projects`);
    }

    return suggestions;
  }

  /**
   * Calculate confidence level in the match score
   */
  private calculateConfidenceLevel(
    userProfile: CandidateProfile,
    job: JobOpportunity
  ): number {
    let confidence = 0.5;

    // More complete profiles = higher confidence
    if (userProfile.skills.length > 5) confidence += 0.1;
    if (userProfile.experience_atoms && userProfile.experience_atoms.length > 2) confidence += 0.1;
    if (userProfile.summary && userProfile.summary.length > 100) confidence += 0.1;

    // More detailed job descriptions = higher confidence
    if (job.description.length > 500) confidence += 0.15;
    if (job.salary_range && job.salary_range !== 'Not specified') confidence += 0.1;

    return Math.min(confidence, 1);
  }

  // Helper methods
  private extractTechnicalKeywords(text: string): string[] {
    const techKeywords = [
      // Programming Languages
      'javascript', 'typescript', 'python', 'java', 'kotlin', 'swift', 'go', 'rust', 'c++', 'c#', 'ruby', 'php', 'scala',
      // Frameworks & Libraries
      'react', 'vue', 'angular', 'next.js', 'nuxt', 'svelte', 'redux', 'graphql', 'node.js', 'express', 'django', 'flask',
      // Databases & Data
      'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'spark', 'kafka', 'airflow',
      // Cloud & DevOps
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins', 'ci/cd',
      // AI & ML
      'machine learning', 'pytorch', 'tensorflow', 'langchain', 'openai',
      // Tools & Platforms
      'git', 'jira', 'salesforce', 'stripe', 'supabase', 'firebase'
    ];

    return techKeywords.filter(keyword => text.includes(keyword));
  }

  private calculateSemanticSimilarity(userSkills: string[], jobSkills: string[]): number {
    // Simplified semantic similarity - in production, use embeddings/ML models
    const relatedSkills = {
      'react': ['javascript', 'typescript', 'jsx', 'frontend'],
      'python': ['django', 'flask', 'backend', 'data science'],
      'aws': ['cloud', 'devops', 'ec2', 'lambda'],
      'docker': ['containers', 'devops', 'kubernetes'],
    };

    let similarityScore = 0;
    for (const userSkill of userSkills) {
      for (const jobSkill of jobSkills) {
        if (relatedSkills[userSkill as keyof typeof relatedSkills]?.includes(jobSkill)) {
          similarityScore += 0.5;
        }
      }
    }

    return Math.min(similarityScore / Math.max(jobSkills.length, 1), 1);
  }

  private calculateExperienceBonus(userProfile: CandidateProfile, techKeywords: string[]): number {
    const experience = userProfile.experience_atoms || [];
    const recentExperience = experience.slice(0, 2); // Most recent 2 roles

    let bonus = 0;
    for (const exp of recentExperience) {
      const expText = (exp.description || '').toLowerCase();
      const matchingKeywords = techKeywords.filter(keyword => expText.includes(keyword));
      bonus += matchingKeywords.length * 0.02; // Small bonus per matching keyword
    }

    return Math.min(bonus, 0.2); // Cap at 0.2
  }

  private inferCareerLevel(userProfile: CandidateProfile): string {
    const experience = userProfile.experience_atoms || [];
    const totalYears = experience.length; // Simplified - would calculate actual years

    if (totalYears >= 8) return 'senior';
    if (totalYears >= 4) return 'mid';
    if (totalYears >= 1) return 'junior';
    return 'entry';
  }

  private inferJobLevel(job: JobOpportunity): string {
    const title = job.title.toLowerCase();

    if (title.includes('senior') || title.includes('lead') || title.includes('principal')) return 'senior';
    if (title.includes('junior') || title.includes('entry')) return 'junior';
    return 'mid';
  }

  private calculateLevelProgression(currentLevel: string, jobLevel: string): number {
    const levels = ['entry', 'junior', 'mid', 'senior'];
    const currentIndex = levels.indexOf(currentLevel);
    const jobIndex = levels.indexOf(jobLevel);

    if (jobIndex === currentIndex) return 0.3; // Same level
    if (jobIndex === currentIndex + 1) return 0.4; // One level up (good progression)
    if (jobIndex === currentIndex - 1) return 0.2; // One level down (may be stepping back)
    if (jobIndex > currentIndex + 1) return 0.1; // Too big of a jump

    return 0.1; // Other cases
  }

  private assessCompanyGrowth(job: JobOpportunity): number {
    const description = job.description.toLowerCase();
    const growthIndicators = ['growing', 'expanding', 'scaling', 'funding', 'series', 'ipo'];

    const indicatorCount = growthIndicators.filter(indicator =>
      description.includes(indicator)
    ).length;

    return Math.min(indicatorCount / growthIndicators.length * 0.3, 0.3);
  }

  private extractSalaryNumbers(salaryRange: string): number[] {
    const matches = salaryRange.match(/\d+/g);
    return matches ? matches.map(m => parseInt(m) * 1000) : [];
  }

  private estimateUserExpectedSalary(userProfile: CandidateProfile): number {
    const level = this.inferCareerLevel(userProfile);
    const baseSalaries = {
      'entry': 60000,
      'junior': 80000,
      'mid': 120000,
      'senior': 160000
    };

    return baseSalaries[level as keyof typeof baseSalaries] || 100000;
  }

  private calculateIndustryAlignment(userProfile: CandidateProfile, job: JobOpportunity): number {
    // Simplified industry alignment calculation
    const userCompanies = (userProfile.experience_atoms || []).map(exp => exp.company?.toLowerCase()).filter(Boolean);
    const jobCompany = job.company.toLowerCase();

    // Check if user has worked at similar companies
    const similarCompany = userCompanies.some(company =>
      company && (jobCompany.includes(company) || company.includes(jobCompany))
    );

    return similarCompany ? 0.8 : 0.4;
  }

  private identifyMissingSkills(userProfile: CandidateProfile, job: JobOpportunity): string[] {
    const userSkills = userProfile.skills.map(s => s.name.toLowerCase());
    const jobSkills = this.extractTechnicalKeywords(job.description.toLowerCase());

    return jobSkills.filter(skill =>
      !userSkills.some(userSkill => userSkill.includes(skill) || skill.includes(userSkill))
    );
  }
}

// Export singleton instance
export const enhancedMatchingEngine = new EnhancedMatchingEngine();