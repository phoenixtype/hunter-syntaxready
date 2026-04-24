/**
 * Automated Job Discovery Service
 *
 * Runs once daily to fetch broad job listings that cover all user needs,
 * minimizing API calls while maximizing job coverage.
 */

import { supabase } from '@/integrations/supabase/client';
import { queueJobCrawl } from './function-queue';

export interface AutomatedCrawlResult {
  success: boolean;
  jobsFound: number;
  jobsInserted: number;
  duplicates: number;
  executionTime: number;
  queries: string[];
  error?: string;
}

class AutomatedJobDiscoveryService {
  private isRunning = false;
  private lastRunDate: string | null = null;

  /**
   * Comprehensive job categories for broad daily crawl
   */
  private readonly BROAD_JOB_CATEGORIES = [
    // Software Development
    'software engineer',
    'frontend developer',
    'backend developer',
    'fullstack developer',

    // Data & Analytics
    'data scientist',
    'data analyst',

    // DevOps & Infrastructure
    'devops engineer',
    'cloud engineer',

    // Product & Design
    'product manager',
    'ux designer',

    // Mobile Development
    'mobile developer',
    'react native developer',

    // AI & Machine Learning
    'machine learning engineer',
    'ai engineer',

    // Remote opportunities
    'remote software',
    'remote developer',

    // Entry level opportunities
    'junior developer',
    'entry level software'
  ];

  /**
   * Run the daily automated job discovery
   */
  async runDailyDiscovery(): Promise<AutomatedCrawlResult> {
    if (this.isRunning) {
      return {
        success: false,
        jobsFound: 0,
        jobsInserted: 0,
        duplicates: 0,
        executionTime: 0,
        queries: [],
        error: 'Discovery already in progress'
      };
    }

    const today = new Date().toISOString().split('T')[0];
    if (this.lastRunDate === today) {
      return {
        success: false,
        jobsFound: 0,
        jobsInserted: 0,
        duplicates: 0,
        executionTime: 0,
        queries: [],
        error: 'Daily discovery already completed today'
      };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('[AUTO_DISCOVERY] Starting daily job discovery...');

      // Get optimal queries for broad coverage
      const queries = this.generateOptimalQueries();

      let totalJobsFound = 0;
      let totalJobsInserted = 0;
      let totalDuplicates = 0;

      // Execute broad crawl with selected optimal queries
      const crawlResult = await queueJobCrawl({
        mode: 'automated_daily',
        targetRoles: queries.slice(0, 8), // Limit to 8 broad categories
        locations: ['United States', 'Remote'], // Broad location coverage
        remotePolicy: 'hybrid', // Include both remote and onsite
        keywords: ['typescript', 'react', 'python', 'aws', 'node.js'] // High-demand skills
      });

      if (crawlResult.success) {
        totalJobsFound = crawlResult.total || 0;
        totalJobsInserted = crawlResult.inserted || 0;
        totalDuplicates = totalJobsFound - totalJobsInserted;

        // Record successful run
        this.lastRunDate = today;
        await this.recordDiscoveryRun({
          date: today,
          jobsFound: totalJobsFound,
          jobsInserted: totalJobsInserted,
          queries: queries.slice(0, 8),
          success: true
        });

        console.log(`[AUTO_DISCOVERY] Daily discovery completed: ${totalJobsInserted} new jobs, ${totalDuplicates} duplicates`);
      } else {
        throw new Error(crawlResult.error || 'Discovery failed');
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        jobsFound: totalJobsFound,
        jobsInserted: totalJobsInserted,
        duplicates: totalDuplicates,
        executionTime,
        queries: queries.slice(0, 8)
      };

    } catch (error) {
      console.error('[AUTO_DISCOVERY] Failed:', error);

      await this.recordDiscoveryRun({
        date: today,
        jobsFound: 0,
        jobsInserted: 0,
        queries: [],
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        jobsFound: 0,
        jobsInserted: 0,
        duplicates: 0,
        executionTime: Date.now() - startTime,
        queries: [],
        error: error instanceof Error ? error.message : String(error)
      };

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check if daily discovery has been completed today
   */
  hasRunToday(): boolean {
    const today = new Date().toISOString().split('T')[0];
    return this.lastRunDate === today;
  }

  /**
   * Get the last run information
   */
  getLastRunInfo(): { date: string | null; hasRunToday: boolean } {
    return {
      date: this.lastRunDate,
      hasRunToday: this.hasRunToday()
    };
  }

  /**
   * Force run discovery (admin only)
   */
  async forceRunDiscovery(): Promise<AutomatedCrawlResult> {
    this.lastRunDate = null; // Reset last run date
    return this.runDailyDiscovery();
  }

  /**
   * Generate optimal queries for maximum job coverage with minimum API calls
   */
  private generateOptimalQueries(): string[] {
    // Prioritize queries by demand and coverage
    const prioritizedQueries = [
      'software engineer',      // Highest demand, broad coverage
      'frontend developer',     // Specific but high volume
      'backend developer',      // Specific but high volume
      'fullstack developer',    // Catches full-stack roles
      'data scientist',         // Growing field
      'devops engineer',        // Infrastructure roles
      'product manager',        // Non-technical but high demand
      'remote software',        // Remote-specific search
      'mobile developer',       // Mobile-specific roles
      'machine learning engineer', // AI/ML roles
      'junior developer',       // Entry-level opportunities
      'react developer',        // Framework-specific
      'python developer',       // Language-specific
      'cloud engineer',         // Cloud infrastructure
      'ux designer'            // Design roles
    ];

    return prioritizedQueries;
  }

  /**
   * Record discovery run in database for tracking
   */
  private async recordDiscoveryRun(runInfo: {
    date: string;
    jobsFound: number;
    jobsInserted: number;
    queries: string[];
    success: boolean;
    error?: string;
  }): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // This would store in a discovery_runs table if it existed
      await supabase.from('agent_activity_logs').insert({
        agent_type: 'automated_job_discovery',
        activity_type: 'daily_crawl',
        details: {
          date: runInfo.date,
          jobs_found: runInfo.jobsFound,
          jobs_inserted: runInfo.jobsInserted,
          queries: runInfo.queries,
          success: runInfo.success,
          error: runInfo.error
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.debug('[AUTO_DISCOVERY] Could not record run:', error);
      // Non-critical, continue
    }
  }
}

/**
 * Scheduled job discovery manager
 */
class ScheduledDiscoveryManager {
  private scheduledTimeout: NodeJS.Timeout | null = null;
  private discoveryService = new AutomatedJobDiscoveryService();

  /**
   * Start the scheduled discovery service
   * Runs once daily at a specified time
   */
  startScheduledDiscovery(hourUTC: number = 6): void {
    this.stopScheduledDiscovery();

    const scheduleNextRun = () => {
      const now = new Date();
      const nextRun = new Date();
      nextRun.setUTCHours(hourUTC, 0, 0, 0);

      // If the scheduled time for today has passed, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setUTCDate(nextRun.getUTCDate() + 1);
      }

      const timeUntilRun = nextRun.getTime() - now.getTime();

      console.log(`[SCHEDULED_DISCOVERY] Next automated discovery scheduled for ${nextRun.toISOString()}`);

      this.scheduledTimeout = setTimeout(async () => {
        console.log('[SCHEDULED_DISCOVERY] Running scheduled job discovery...');

        try {
          const result = await this.discoveryService.runDailyDiscovery();

          if (result.success) {
            console.log(`[SCHEDULED_DISCOVERY] Completed: ${result.jobsInserted} new jobs found`);

            // Notify users about new jobs (optional)
            this.notifyUsersAboutNewJobs(result.jobsInserted);
          } else {
            console.error('[SCHEDULED_DISCOVERY] Failed:', result.error);
          }
        } catch (error) {
          console.error('[SCHEDULED_DISCOVERY] Error during scheduled run:', error);
        }

        // Schedule the next run
        scheduleNextRun();
      }, timeUntilRun);
    };

    // Only start if we haven't run today
    if (!this.discoveryService.hasRunToday()) {
      scheduleNextRun();
    } else {
      console.log('[SCHEDULED_DISCOVERY] Already ran today, will run tomorrow');
      // Schedule for tomorrow
      scheduleNextRun();
    }
  }

  /**
   * Stop the scheduled discovery service
   */
  stopScheduledDiscovery(): void {
    if (this.scheduledTimeout) {
      clearTimeout(this.scheduledTimeout);
      this.scheduledTimeout = null;
      console.log('[SCHEDULED_DISCOVERY] Stopped');
    }
  }

  /**
   * Get discovery service instance for manual operations
   */
  getDiscoveryService(): AutomatedJobDiscoveryService {
    return this.discoveryService;
  }

  /**
   * Notify users about new jobs (optional feature)
   */
  private notifyUsersAboutNewJobs(jobCount: number): void {
    // Could trigger push notifications, emails, or in-app notifications
    // For now, just dispatch a custom event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jobs:daily-discovery-complete', {
        detail: { jobCount }
      }));
    }
  }
}

// Export singleton instances
export const automatedJobDiscovery = new AutomatedJobDiscoveryService();
export const scheduledDiscoveryManager = new ScheduledDiscoveryManager();

export { AutomatedCrawlResult };