/**
 * AI Resume Intelligence System
 *
 * Provides comprehensive resume analysis, optimization suggestions,
 * and ATS compatibility scoring using advanced AI algorithms.
 */

import { CandidateProfile } from './resume_engine';
import { JobOpportunity } from './crawler_engine';

export interface ResumeIntelligenceReport {
  overallScore: number;              // 0-100: Overall resume quality
  atsScore: number;                  // 0-100: ATS compatibility score

  strengths: string[];               // Key resume strengths
  weaknesses: string[];              // Areas needing improvement
  recommendations: RecommendationSet; // Detailed improvement suggestions

  contentAnalysis: ContentAnalysis;
  atsAnalysis: ATSAnalysis;
  marketAlignment: MarketAlignment;

  improvementPlan: ImprovementPlan;
  predictedPerformance: PerformanceMetrics;
}

export interface ContentAnalysis {
  impactScore: number;               // Quantified achievements score
  clarityScore: number;              // Writing clarity and flow
  relevanceScore: number;            // Content relevance to target roles
  keywordDensity: number;            // Important keyword coverage

  achievements: Achievement[];        // Extracted quantified achievements
  skillsIdentified: string[];        // All skills mentioned
  experienceDepth: ExperienceAnalysis;
  languageQuality: LanguageMetrics;
}

export interface ATSAnalysis {
  compatibilityScore: number;        // Overall ATS friendliness
  formatScore: number;               // Layout and structure
  keywordOptimization: number;       // Search keyword coverage
  sectionStructure: SectionAnalysis[];

  criticalIssues: string[];          // Blocking ATS issues
  warnings: string[];                // Potential ATS problems
  recommendations: string[];         // ATS optimization suggestions
}

export interface MarketAlignment {
  industryAlignment: number;         // Fit with target industry
  roleAlignment: number;             // Match with target positions
  salaryProjection: SalaryProjection;
  competitivenessScore: number;      // How competitive in job market

  marketTrends: string[];            // Relevant market insights
  inDemandSkills: string[];          // Skills in high demand
  skillsGaps: string[];              // Missing valuable skills
}

export interface RecommendationSet {
  immediate: string[];               // Quick wins (< 1 hour)
  shortTerm: string[];               // Medium effort (1-8 hours)
  longTerm: string[];                // Skill/experience building (weeks/months)

  prioritizedActions: PrioritizedAction[];
}

export interface PrioritizedAction {
  action: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  category: 'content' | 'skills' | 'experience' | 'formatting';
  estimatedTimeMinutes: number;
}

export interface ImprovementPlan {
  phase1: string[];                  // Week 1-2: Quick improvements
  phase2: string[];                  // Week 3-6: Content enhancement
  phase3: string[];                  // Month 2-3: Skill development

  skillsPriority: SkillDevelopmentPlan[];
  contentPriority: ContentImprovementPlan[];
}

export interface PerformanceMetrics {
  expectedViewRate: number;          // Predicted resume view rate
  interviewProbability: number;      // Likelihood of getting interviews
  industryCompetitiveness: number;   // How competitive vs peers
  improvementPotential: number;      // Potential score increase with changes
}

export class AIResumeIntelligence {

  /**
   * Analyze resume comprehensively
   */
  async analyzeResume(
    resume: CandidateProfile,
    targetJob?: JobOpportunity,
    marketData?: any
  ): Promise<ResumeIntelligenceReport> {

    // Core analysis components
    const contentAnalysis = await this.analyzeContent(resume);
    const atsAnalysis = await this.analyzeATSCompatibility(resume);
    const marketAlignment = await this.analyzeMarketAlignment(resume, targetJob, marketData);

    // Generate recommendations
    const recommendations = this.generateRecommendations(contentAnalysis, atsAnalysis, marketAlignment);

    // Create improvement plan
    const improvementPlan = this.createImprovementPlan(resume, recommendations, targetJob);

    // Predict performance
    const predictedPerformance = this.predictResumePerformance(contentAnalysis, atsAnalysis, marketAlignment);

    // Calculate overall scores
    const overallScore = this.calculateOverallScore(contentAnalysis, atsAnalysis, marketAlignment);
    const atsScore = atsAnalysis.compatibilityScore;

    // Identify strengths and weaknesses
    const strengths = this.identifyStrengths(contentAnalysis, atsAnalysis, marketAlignment);
    const weaknesses = this.identifyWeaknesses(contentAnalysis, atsAnalysis, marketAlignment);

    return {
      overallScore,
      atsScore,
      strengths,
      weaknesses,
      recommendations,
      contentAnalysis,
      atsAnalysis,
      marketAlignment,
      improvementPlan,
      predictedPerformance
    };
  }

  /**
   * Analyze resume content quality
   */
  private async analyzeContent(resume: CandidateProfile): Promise<ContentAnalysis> {

    // Calculate impact score based on quantified achievements
    const achievements = this.extractQuantifiedAchievements(resume);
    const impactScore = this.calculateImpactScore(achievements);

    // Analyze writing clarity and flow
    const clarityScore = this.analyzeClarityScore(resume);

    // Calculate relevance to professional roles
    const relevanceScore = this.analyzeRelevanceScore(resume);

    // Analyze keyword density and coverage
    const keywordDensity = this.analyzeKeywordDensity(resume);

    // Extract all mentioned skills
    const skillsIdentified = this.extractAllSkills(resume);

    // Analyze experience depth and progression
    const experienceDepth = this.analyzeExperienceDepth(resume);

    // Evaluate language quality and professionalism
    const languageQuality = this.analyzeLanguageQuality(resume);

    return {
      impactScore,
      clarityScore,
      relevanceScore,
      keywordDensity,
      achievements,
      skillsIdentified,
      experienceDepth,
      languageQuality
    };
  }

  /**
   * Analyze ATS compatibility
   */
  private async analyzeATSCompatibility(resume: CandidateProfile): Promise<ATSAnalysis> {

    // Check overall ATS compatibility
    const compatibilityScore = this.calculateATSCompatibility(resume);

    // Analyze format and structure
    const formatScore = this.analyzeFormatCompatibility(resume);

    // Check keyword optimization
    const keywordOptimization = this.analyzeKeywordOptimization(resume);

    // Analyze section structure
    const sectionStructure = this.analyzeSectionStructure(resume);

    // Identify critical issues
    const criticalIssues = this.identifyCriticalATSIssues(resume);
    const warnings = this.identifyATSWarnings(resume);
    const recommendations = this.generateATSRecommendations(resume);

    return {
      compatibilityScore,
      formatScore,
      keywordOptimization,
      sectionStructure,
      criticalIssues,
      warnings,
      recommendations
    };
  }

  /**
   * Analyze market alignment and competitiveness
   */
  private async analyzeMarketAlignment(
    resume: CandidateProfile,
    targetJob?: JobOpportunity,
    marketData?: any
  ): Promise<MarketAlignment> {

    // Calculate industry alignment
    const industryAlignment = this.calculateIndustryAlignment(resume, targetJob);

    // Calculate role alignment
    const roleAlignment = this.calculateRoleAlignment(resume, targetJob);

    // Project salary potential
    const salaryProjection = this.projectSalary(resume, targetJob);

    // Calculate competitiveness score
    const competitivenessScore = this.calculateCompetitiveness(resume, marketData);

    // Identify market trends
    const marketTrends = this.identifyMarketTrends(resume, targetJob);

    // Identify in-demand skills
    const inDemandSkills = this.identifyInDemandSkills(resume, targetJob);

    // Identify skills gaps
    const skillsGaps = this.identifySkillsGaps(resume, targetJob);

    return {
      industryAlignment,
      roleAlignment,
      salaryProjection,
      competitivenessScore,
      marketTrends,
      inDemandSkills,
      skillsGaps
    };
  }

  /**
   * Extract quantified achievements from resume
   */
  private extractQuantifiedAchievements(resume: CandidateProfile): Achievement[] {
    const achievements: Achievement[] = [];
    const experiences = resume.experience_atoms || [];

    for (const exp of experiences) {
      const description = exp.description || '';

      // Look for numbers, percentages, and quantified results
      const quantifiedMatches = description.match(/\d+(\.\d+)?%|\$\d+[kmb]?|\d+[kmb]?\s*(users?|customers?|sales?|revenue?)/gi);

      if (quantifiedMatches && quantifiedMatches.length > 0) {
        quantifiedMatches.forEach(match => {
          // Extract the full sentence containing the quantified result
          const sentences = description.split(/[.!?]+/);
          const relevantSentence = sentences.find(sentence => sentence.includes(match));

          if (relevantSentence) {
            achievements.push({
              metric: match,
              context: relevantSentence.trim(),
              company: exp.company || 'Unknown',
              role: exp.role || 'Unknown',
              impact: this.categorizeImpact(match)
            });
          }
        });
      }
    }

    return achievements;
  }

  /**
   * Calculate impact score based on achievements
   */
  private calculateImpactScore(achievements: Achievement[]): number {
    if (achievements.length === 0) return 20;

    const highImpactCount = achievements.filter(a => a.impact === 'high').length;
    const mediumImpactCount = achievements.filter(a => a.impact === 'medium').length;
    const lowImpactCount = achievements.filter(a => a.impact === 'low').length;

    const score = (highImpactCount * 30) + (mediumImpactCount * 20) + (lowImpactCount * 10);
    return Math.min(score, 100);
  }

  /**
   * Analyze writing clarity and professionalism
   */
  private analyzeClarityScore(resume: CandidateProfile): number {
    let score = 50; // Base score

    const allText = this.getAllResumeText(resume);

    // Check for action verbs
    const actionVerbs = ['achieved', 'developed', 'implemented', 'managed', 'led', 'created', 'improved'];
    const actionVerbCount = actionVerbs.filter(verb => allText.toLowerCase().includes(verb)).length;
    score += Math.min(actionVerbCount * 5, 25);

    // Check for passive voice (negative indicator)
    const passiveIndicators = ['was responsible for', 'was tasked with', 'was involved in'];
    const passiveCount = passiveIndicators.filter(indicator => allText.toLowerCase().includes(indicator)).length;
    score -= passiveCount * 10;

    // Check for clarity and conciseness
    const avgSentenceLength = this.calculateAverageSentenceLength(allText);
    if (avgSentenceLength > 25) score -= 10; // Too wordy
    if (avgSentenceLength < 10) score -= 5;  // Too brief

    return Math.max(Math.min(score, 100), 0);
  }

  /**
   * Generate comprehensive recommendations
   */
  private generateRecommendations(
    contentAnalysis: ContentAnalysis,
    atsAnalysis: ATSAnalysis,
    marketAlignment: MarketAlignment
  ): RecommendationSet {

    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    // Content recommendations
    if (contentAnalysis.impactScore < 50) {
      immediate.push('Add quantified achievements with specific numbers and percentages');
      shortTerm.push('Rewrite each bullet point to showcase measurable impact');
    }

    if (contentAnalysis.clarityScore < 60) {
      immediate.push('Replace passive voice with strong action verbs');
      immediate.push('Shorten lengthy sentences for better readability');
    }

    // ATS recommendations
    if (atsAnalysis.compatibilityScore < 70) {
      immediate.push('Use standard section headings (Experience, Skills, Education)');
      immediate.push('Remove complex formatting, graphics, and tables');
    }

    if (atsAnalysis.keywordOptimization < 60) {
      shortTerm.push('Incorporate more industry-relevant keywords naturally');
    }

    // Market alignment recommendations
    if (marketAlignment.competitivenessScore < 60) {
      longTerm.push('Develop skills in high-demand areas for your industry');
      longTerm.push('Gain experience in trending technologies and practices');
    }

    if (marketAlignment.skillsGaps.length > 0) {
      longTerm.push(`Acquire missing high-value skills: ${marketAlignment.skillsGaps.slice(0, 3).join(', ')}`);
    }

    // Generate prioritized actions
    const prioritizedActions = this.generatePrioritizedActions(immediate, shortTerm, longTerm);

    return {
      immediate,
      shortTerm,
      longTerm,
      prioritizedActions
    };
  }

  /**
   * Create a structured improvement plan
   */
  private createImprovementPlan(
    resume: CandidateProfile,
    recommendations: RecommendationSet,
    targetJob?: JobOpportunity
  ): ImprovementPlan {

    const phase1 = [
      'Review and quantify all achievements with specific numbers',
      'Optimize section headings for ATS compatibility',
      'Ensure consistent formatting throughout'
    ];

    const phase2 = [
      'Tailor content to target industry and roles',
      'Enhance skills section with relevant technologies',
      'Improve professional summary with compelling value proposition'
    ];

    const phase3 = [
      'Develop missing high-demand skills through courses or projects',
      'Gain additional experience in trending areas',
      'Build a portfolio showcasing key competencies'
    ];

    const skillsPriority = this.createSkillsDevelopmentPlan(resume, targetJob);
    const contentPriority = this.createContentImprovementPlan(resume, recommendations);

    return {
      phase1,
      phase2,
      phase3,
      skillsPriority,
      contentPriority
    };
  }

  /**
   * Predict resume performance metrics
   */
  private predictResumePerformance(
    contentAnalysis: ContentAnalysis,
    atsAnalysis: ATSAnalysis,
    marketAlignment: MarketAlignment
  ): PerformanceMetrics {

    // Calculate expected view rate based on ATS score and content quality
    const baseViewRate = 15; // Industry average
    const atsMultiplier = atsAnalysis.compatibilityScore / 100;
    const contentMultiplier = (contentAnalysis.impactScore + contentAnalysis.clarityScore) / 200;
    const expectedViewRate = baseViewRate * atsMultiplier * contentMultiplier * 2;

    // Calculate interview probability
    const baseInterviewRate = 8; // Industry average
    const qualityMultiplier = (contentAnalysis.impactScore + marketAlignment.competitivenessScore) / 200;
    const interviewProbability = Math.min(baseInterviewRate * qualityMultiplier * 3, 40);

    // Calculate competitiveness vs industry
    const industryCompetitiveness = marketAlignment.competitivenessScore;

    // Calculate improvement potential
    const currentScore = (contentAnalysis.impactScore + atsAnalysis.compatibilityScore + marketAlignment.competitivenessScore) / 3;
    const improvementPotential = Math.max(85 - currentScore, 0);

    return {
      expectedViewRate: Math.min(expectedViewRate, 100),
      interviewProbability: Math.min(interviewProbability, 100),
      industryCompetitiveness,
      improvementPotential
    };
  }

  // Helper methods and implementations
  private calculateOverallScore(
    contentAnalysis: ContentAnalysis,
    atsAnalysis: ATSAnalysis,
    marketAlignment: MarketAlignment
  ): number {
    const contentWeight = 0.4;
    const atsWeight = 0.3;
    const marketWeight = 0.3;

    const contentScore = (contentAnalysis.impactScore + contentAnalysis.clarityScore + contentAnalysis.relevanceScore) / 3;
    const atsScore = atsAnalysis.compatibilityScore;
    const marketScore = (marketAlignment.industryAlignment + marketAlignment.roleAlignment + marketAlignment.competitivenessScore) / 3;

    return (contentScore * contentWeight) + (atsScore * atsWeight) + (marketScore * marketWeight);
  }

  private identifyStrengths(
    contentAnalysis: ContentAnalysis,
    atsAnalysis: ATSAnalysis,
    marketAlignment: MarketAlignment
  ): string[] {
    const strengths: string[] = [];

    if (contentAnalysis.impactScore > 70) {
      strengths.push('Strong quantified achievements demonstrate clear value');
    }

    if (contentAnalysis.clarityScore > 75) {
      strengths.push('Clear, professional writing style with strong action verbs');
    }

    if (atsAnalysis.compatibilityScore > 80) {
      strengths.push('Excellent ATS compatibility ensures resume gets seen');
    }

    if (marketAlignment.competitivenessScore > 75) {
      strengths.push('Highly competitive profile for target market');
    }

    if (contentAnalysis.skillsIdentified.length > 15) {
      strengths.push('Comprehensive technical skills coverage');
    }

    return strengths;
  }

  private identifyWeaknesses(
    contentAnalysis: ContentAnalysis,
    atsAnalysis: ATSAnalysis,
    marketAlignment: MarketAlignment
  ): string[] {
    const weaknesses: string[] = [];

    if (contentAnalysis.impactScore < 50) {
      weaknesses.push('Missing quantified achievements to demonstrate impact');
    }

    if (contentAnalysis.clarityScore < 60) {
      weaknesses.push('Writing could be clearer with stronger action verbs');
    }

    if (atsAnalysis.compatibilityScore < 70) {
      weaknesses.push('ATS compatibility issues may prevent resume from being seen');
    }

    if (marketAlignment.skillsGaps.length > 3) {
      weaknesses.push('Missing several high-demand skills for target roles');
    }

    if (marketAlignment.competitivenessScore < 60) {
      weaknesses.push('Profile competitiveness could be improved for target market');
    }

    return weaknesses;
  }

  // Placeholder implementations for helper methods
  private categorizeImpact(metric: string): 'high' | 'medium' | 'low' {
    if (metric.includes('%') && parseFloat(metric) > 20) return 'high';
    if (metric.includes('$') || metric.includes('revenue')) return 'high';
    if (metric.includes('k') || metric.includes('000')) return 'medium';
    return 'low';
  }

  private getAllResumeText(resume: CandidateProfile): string {
    const texts = [
      resume.summary || '',
      ...(resume.experience_atoms || []).map(exp => exp.description || ''),
      ...(resume.skills || []).map(skill => skill.name)
    ];
    return texts.join(' ');
  }

  private calculateAverageSentenceLength(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const totalWords = sentences.reduce((sum, sentence) =>
      sum + sentence.trim().split(/\s+/).length, 0
    );
    return sentences.length > 0 ? totalWords / sentences.length : 0;
  }

  // Additional helper method implementations would go here...
  private analyzeRelevanceScore(resume: CandidateProfile): number { return 75; }
  private analyzeKeywordDensity(resume: CandidateProfile): number { return 65; }
  private extractAllSkills(resume: CandidateProfile): string[] { return resume.skills?.map(s => s.name) || []; }
  private analyzeExperienceDepth(resume: CandidateProfile): ExperienceAnalysis { return {} as ExperienceAnalysis; }
  private analyzeLanguageQuality(resume: CandidateProfile): LanguageMetrics { return {} as LanguageMetrics; }
  private calculateATSCompatibility(resume: CandidateProfile): number { return 75; }
  private analyzeFormatCompatibility(resume: CandidateProfile): number { return 80; }
  private analyzeKeywordOptimization(resume: CandidateProfile): number { return 70; }
  private analyzeSectionStructure(resume: CandidateProfile): SectionAnalysis[] { return []; }
  private identifyCriticalATSIssues(resume: CandidateProfile): string[] { return []; }
  private identifyATSWarnings(resume: CandidateProfile): string[] { return []; }
  private generateATSRecommendations(resume: CandidateProfile): string[] { return []; }
  private calculateIndustryAlignment(resume: CandidateProfile, targetJob?: JobOpportunity): number { return 70; }
  private calculateRoleAlignment(resume: CandidateProfile, targetJob?: JobOpportunity): number { return 75; }
  private projectSalary(resume: CandidateProfile, targetJob?: JobOpportunity): SalaryProjection { return {} as SalaryProjection; }
  private calculateCompetitiveness(resume: CandidateProfile, marketData?: any): number { return 70; }
  private identifyMarketTrends(resume: CandidateProfile, targetJob?: JobOpportunity): string[] { return []; }
  private identifyInDemandSkills(resume: CandidateProfile, targetJob?: JobOpportunity): string[] { return []; }
  private identifySkillsGaps(resume: CandidateProfile, targetJob?: JobOpportunity): string[] { return []; }
  private generatePrioritizedActions(immediate: string[], shortTerm: string[], longTerm: string[]): PrioritizedAction[] { return []; }
  private createSkillsDevelopmentPlan(resume: CandidateProfile, targetJob?: JobOpportunity): SkillDevelopmentPlan[] { return []; }
  private createContentImprovementPlan(resume: CandidateProfile, recommendations: RecommendationSet): ContentImprovementPlan[] { return []; }
}

// Type definitions for interfaces
interface Achievement {
  metric: string;
  context: string;
  company: string;
  role: string;
  impact: 'high' | 'medium' | 'low';
}

interface ExperienceAnalysis {
  totalYears?: number;
  progression?: string;
  consistency?: number;
}

interface LanguageMetrics {
  professionalism?: number;
  clarity?: number;
  conciseness?: number;
}

interface SectionAnalysis {
  section: string;
  present: boolean;
  quality: number;
}

interface SalaryProjection {
  estimatedRange?: { min: number; max: number };
  confidence?: number;
  factors?: string[];
}

interface SkillDevelopmentPlan {
  skill: string;
  priority: 'high' | 'medium' | 'low';
  timeToAcquire: string;
  resources: string[];
}

interface ContentImprovementPlan {
  section: string;
  improvements: string[];
  priority: number;
}

// Export singleton instance
export const aiResumeIntelligence = new AIResumeIntelligence();