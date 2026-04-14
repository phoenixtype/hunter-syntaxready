/**
 * Real-time Job Streaming Service
 *
 * Provides live job updates using Supabase Realtime subscriptions.
 * Filters incoming jobs based on user preferences and displays notifications.
 */

import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { shouldUseReducedMode } from './mobile-safety';

interface JobNotification {
  id: string;
  title: string;
  company: string;
  location: string;
  posted_at: string;
  match_score?: number;
}

interface UserJobFilters {
  target_roles: string[];
  locations: string[];
  remote_policy: string;
  skills: string[];
  excluded_companies?: string[];
}

class RealtimeJobStream {
  private channel: RealtimeChannel | null = null;
  private isActive = false;
  private userFilters: UserJobFilters | null = null;
  private lastNotificationTime = 0;
  private notificationCooldown = 5 * 60 * 1000; // 5 minutes between notifications
  private maxNotificationsPerHour = 3;
  private notificationCount = 0;
  private hourlyResetTimer: number | null = null;

  constructor() {
    this.resetHourlyNotificationCount();
  }

  /**
   * Start real-time job streaming
   */
  start(userFilters: UserJobFilters): void {
    if (this.isActive || !userFilters.target_roles?.length) return;

    // Disable on mobile devices with limited resources
    if (shouldUseReducedMode()) {
      console.log('[REALTIME_JOBS] Disabled on limited memory device');
      return;
    }

    this.userFilters = userFilters;
    this.isActive = true;

    console.log('[REALTIME_JOBS] Starting real-time job stream');

    // Subscribe to job_listings table changes
    this.channel = supabase
      .channel('job_stream')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_listings'
        },
        (payload) => this.handleNewJob(payload.new as any)
      )
      .subscribe();

    console.log('[REALTIME_JOBS] Subscribed to job updates');
  }

  /**
   * Stop real-time job streaming
   */
  stop(): void {
    if (!this.isActive) return;

    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    if (this.hourlyResetTimer) {
      clearInterval(this.hourlyResetTimer);
      this.hourlyResetTimer = null;
    }

    this.isActive = false;
    console.log('[REALTIME_JOBS] Stopped real-time job stream');
  }

  /**
   * Handle incoming new job
   */
  private handleNewJob(job: any): void {
    if (!this.userFilters || !this.shouldNotifyAboutJob(job)) return;

    const matchScore = this.calculateMatchScore(job, this.userFilters);

    if (matchScore < 0.6) return; // Only notify about decent matches

    const now = Date.now();

    // Check notification cooldown
    if (now - this.lastNotificationTime < this.notificationCooldown) return;

    // Check hourly limit
    if (this.notificationCount >= this.maxNotificationsPerHour) return;

    this.showJobNotification({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      posted_at: job.created_at,
      match_score: matchScore
    });

    this.lastNotificationTime = now;
    this.notificationCount++;

    // Dispatch event for components to refresh
    window.dispatchEvent(new CustomEvent('jobs:new-match', {
      detail: { job, matchScore }
    }));
  }

  /**
   * Determine if we should notify about this job
   */
  private shouldNotifyAboutJob(job: any): boolean {
    if (!this.userFilters || !job.title || !job.company) return false;

    const jobText = `${job.title} ${job.description || ''}`.toLowerCase();
    const jobLocation = (job.location || '').toLowerCase();
    const jobCompany = job.company.toLowerCase();

    // Check excluded companies
    if (this.userFilters.excluded_companies?.some(company =>
      jobCompany.includes(company.toLowerCase())
    )) {
      return false;
    }

    // Check target roles
    const hasTargetRole = this.userFilters.target_roles.some(role =>
      jobText.includes(role.toLowerCase())
    );
    if (!hasTargetRole) return false;

    // Check location preferences
    if (this.userFilters.remote_policy === 'remote') {
      if (!jobLocation.includes('remote')) return false;
    } else if (this.userFilters.remote_policy === 'onsite') {
      if (jobLocation.includes('remote')) return false;
    } else if (this.userFilters.locations?.length > 0) {
      const hasMatchingLocation = this.userFilters.locations.some(location =>
        jobLocation.includes(location.toLowerCase()) || jobLocation.includes('remote')
      );
      if (!hasMatchingLocation) return false;
    }

    return true;
  }

  /**
   * Calculate match score for a job
   */
  private calculateMatchScore(job: any, filters: UserJobFilters): number {
    let score = 0;
    let factors = 0;

    const jobText = `${job.title} ${job.description || ''}`.toLowerCase();
    const jobLocation = (job.location || '').toLowerCase();

    // Role match (40% weight)
    const roleMatch = filters.target_roles.some(role =>
      jobText.includes(role.toLowerCase())
    );
    if (roleMatch) score += 0.4;
    factors++;

    // Skills match (30% weight)
    if (filters.skills.length > 0) {
      const skillMatches = filters.skills.filter(skill =>
        jobText.includes(skill.toLowerCase())
      );
      score += (skillMatches.length / filters.skills.length) * 0.3;
      factors++;
    }

    // Location match (20% weight)
    let locationScore = 0.2; // Default for remote jobs
    if (filters.locations?.length > 0) {
      const hasLocationMatch = filters.locations.some(location =>
        jobLocation.includes(location.toLowerCase())
      );
      if (hasLocationMatch) locationScore = 0.2;
      else if (jobLocation.includes('remote')) locationScore = 0.15;
      else locationScore = 0.05;
    }
    score += locationScore;
    factors++;

    // Freshness bonus (10% weight)
    const hoursOld = job.created_at ?
      (Date.now() - new Date(job.created_at).getTime()) / (1000 * 60 * 60) : 24;
    const freshnessScore = Math.max(0, (24 - hoursOld) / 24) * 0.1;
    score += freshnessScore;
    factors++;

    return factors > 0 ? Math.min(1, score) : 0;
  }

  /**
   * Show job notification
   */
  private showJobNotification(notification: JobNotification): void {
    const matchPercentage = Math.round((notification.match_score || 0) * 100);

    toast.success(
      `🎯 New Job Match (${matchPercentage}%)`,
      {
        description: `${notification.title} at ${notification.company} • ${notification.location}`,
        duration: 8000,
        action: {
          label: 'View',
          onClick: () => {
            // Dispatch event to navigate to job details
            window.dispatchEvent(new CustomEvent('jobs:view-match', {
              detail: notification
            }));
          }
        }
      }
    );

    console.log(`[REALTIME_JOBS] Notified about job: ${notification.title} at ${notification.company}`);
  }

  /**
   * Update user filters
   */
  updateFilters(newFilters: UserJobFilters): void {
    this.userFilters = newFilters;
    console.log('[REALTIME_JOBS] Updated user filters');
  }

  /**
   * Reset hourly notification count
   */
  private resetHourlyNotificationCount(): void {
    this.notificationCount = 0;

    this.hourlyResetTimer = window.setInterval(() => {
      this.notificationCount = 0;
      console.log('[REALTIME_JOBS] Reset hourly notification count');
    }, 60 * 60 * 1000);
  }

  /**
   * Get streaming status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      hasFilters: !!this.userFilters,
      notificationCount: this.notificationCount,
      lastNotificationTime: this.lastNotificationTime
    };
  }
}

// Export singleton instance
export const realtimeJobStream = new RealtimeJobStream();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    realtimeJobStream.stop();
  });
}