/**
 * Background Job Service
 *
 * Automatically manages job discovery and refresh in the background.
 * Implements smart scheduling to balance fresh content with resource usage.
 */

import { queueJobCrawl } from './function-queue';
import { cachedJobEngine } from './cached-job-engine';
import { supabase } from '@/integrations/supabase/client';
import { shouldUseReducedMode } from './mobile-safety';

interface JobRefreshConfig {
  enabled: boolean;
  intervalMinutes: number;
  maxCrawlsPerHour: number;
  autoStart: boolean;
}

class BackgroundJobService {
  private intervalId: number | null = null;
  private lastCrawlTime = 0;
  private crawlCount = 0;
  private hourlyResetTimer: number | null = null;
  private isActive = false;

  private config: JobRefreshConfig = {
    enabled: true,
    intervalMinutes: 15, // Check every 15 minutes
    maxCrawlsPerHour: 3, // Limit to 3 crawls per hour to avoid rate limits
    autoStart: true
  };

  constructor() {
    this.resetHourlyCrawlCount();
  }

  /**
   * Start the background job service
   */
  start(userProfile?: any, userPreferences?: any): void {
    if (this.isActive) return;

    // Disable on mobile devices with limited memory to prevent crashes
    if (shouldUseReducedMode()) {
      console.log('[BG_JOBS] Disabled on limited memory device');
      return;
    }

    this.isActive = true;
    console.log('[BG_JOBS] Starting background job service');

    // Start the periodic check
    this.intervalId = window.setInterval(() => {
      this.checkAndRefreshJobs(userProfile, userPreferences);
    }, this.config.intervalMinutes * 60 * 1000);

    // Initial check after 30 seconds (give app time to load)
    setTimeout(() => {
      this.checkAndRefreshJobs(userProfile, userPreferences);
    }, 30000);
  }

  /**
   * Stop the background job service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.hourlyResetTimer) {
      clearInterval(this.hourlyResetTimer);
      this.hourlyResetTimer = null;
    }
    this.isActive = false;
    console.log('[BG_JOBS] Stopped background job service');
  }

  /**
   * Manually trigger a job refresh
   */
  async manualRefresh(userProfile?: any, userPreferences?: any): Promise<boolean> {
    return this.performJobCrawl(userProfile, userPreferences, true);
  }

  /**
   * Check if we should refresh jobs and do it if needed
   */
  private async checkAndRefreshJobs(userProfile?: any, userPreferences?: any): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const now = Date.now();
      const timeSinceLastCrawl = now - this.lastCrawlTime;
      const minInterval = this.config.intervalMinutes * 60 * 1000;

      // Don't crawl too frequently
      if (timeSinceLastCrawl < minInterval) return;

      // Don't exceed hourly limit
      if (this.crawlCount >= this.config.maxCrawlsPerHour) {
        console.log('[BG_JOBS] Hourly crawl limit reached');
        return;
      }

      // Check if we have fresh enough jobs already
      const hasRecentJobs = await this.hasRecentJobs();
      if (hasRecentJobs && !this.shouldForceRefresh()) {
        console.log('[BG_JOBS] Recent jobs available, skipping crawl');
        return;
      }

      await this.performJobCrawl(userProfile, userPreferences, false);

    } catch (error) {
      console.error('[BG_JOBS] Error in background refresh:', error);
    }
  }

  /**
   * Perform the actual job crawl
   */
  private async performJobCrawl(userProfile?: any, userPreferences?: any, isManual = false): Promise<boolean> {
    try {
      if (!userProfile || !userPreferences?.target_roles?.length) {
        console.log('[BG_JOBS] No profile or target roles, skipping crawl');
        return false;
      }

      console.log(`[BG_JOBS] Starting ${isManual ? 'manual' : 'automatic'} job crawl`);

      const keywords = userProfile.skills?.slice(0, 5)?.map((s: any) => s.name) || [];
      const targetRoles = userPreferences.target_roles || [];
      const locations = userPreferences.locations?.slice(0, 3) || [];

      const result = await queueJobCrawl({
        keywords,
        targetRoles,
        locations,
        remotePolicy: userPreferences.remote_policy
      });

      if (result?.success) {
        this.lastCrawlTime = Date.now();
        this.crawlCount++;

        // Clear cache to ensure fresh data is shown
        cachedJobEngine.clearAllCaches();

        // Update user's last job sync time
        if (userProfile.user_id) {
          await supabase
            .from('profiles')
            .update({ last_job_sync: new Date().toISOString() })
            .eq('user_id', userProfile.user_id);
        }

        console.log(`[BG_JOBS] Successfully found ${result.inserted || 0} new jobs`);

        // Dispatch custom event for components to refresh
        window.dispatchEvent(new CustomEvent('jobs:refreshed', {
          detail: {
            inserted: result.inserted || 0,
            isManual,
            timestamp: Date.now()
          }
        }));

        return true;
      } else {
        console.warn('[BG_JOBS] Job crawl failed:', result?.error);
        return false;
      }

    } catch (error) {
      console.error('[BG_JOBS] Job crawl error:', error);
      return false;
    }
  }

  /**
   * Check if we have recent jobs (within last 2 hours)
   */
  private async hasRecentJobs(): Promise<boolean> {
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const { count } = await supabase
        .from('job_listings')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', twoHoursAgo)
        .limit(1);

      return (count || 0) > 0;
    } catch (error) {
      console.error('[BG_JOBS] Error checking recent jobs:', error);
      return false;
    }
  }

  /**
   * Determine if we should force a refresh despite having recent jobs
   */
  private shouldForceRefresh(): boolean {
    const hoursSinceLastCrawl = (Date.now() - this.lastCrawlTime) / (1000 * 60 * 60);

    // Force refresh if it's been more than 4 hours
    return hoursSinceLastCrawl > 4;
  }

  /**
   * Reset the hourly crawl count
   */
  private resetHourlyCrawlCount(): void {
    this.crawlCount = 0;

    // Set up timer to reset count every hour
    this.hourlyResetTimer = window.setInterval(() => {
      this.crawlCount = 0;
      console.log('[BG_JOBS] Reset hourly crawl count');
    }, 60 * 60 * 1000);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<JobRefreshConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart service if interval changed
    if (newConfig.intervalMinutes && this.isActive) {
      this.stop();
      setTimeout(() => this.start(), 1000);
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      config: this.config,
      lastCrawlTime: this.lastCrawlTime,
      crawlCount: this.crawlCount,
      nextCrawlIn: Math.max(0, (this.lastCrawlTime + this.config.intervalMinutes * 60 * 1000) - Date.now())
    };
  }
}

// Export singleton instance
export const backgroundJobService = new BackgroundJobService();

// Auto-start if enabled (after a delay to ensure app is loaded)
if (typeof window !== 'undefined') {
  setTimeout(() => {
    const config = backgroundJobService.getStatus().config;
    if (config.autoStart && config.enabled) {
      // Will be started properly once user profile is available
      console.log('[BG_JOBS] Background job service ready to start');
    }
  }, 5000);
}