/**
 * Notification Queue Management System
 * Handles queuing, batching, and processing of notifications with retry logic
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildPaymentConfirmationEmail,
  buildJobAlertEmail,
  buildUsageWarningEmail
} from "./email-templates.ts";

// ─── Types ────────────────────────────────────────────────────────────────

export interface NotificationData {
  // Payment confirmation data
  paymentConfirmation?: {
    tier: string;
    amount: number;
    currency: 'usd' | 'ngn';
    paymentProvider: 'stripe' | 'paystack';
    userName: string;
  };

  // Job alert data
  jobAlert?: {
    userName: string;
    jobs: Array<{
      title: string;
      company: string;
      location: string;
      salary?: string;
      url: string;
    }>;
    totalMatches: number;
  };

  // Usage warning data
  usageWarning?: {
    userName: string;
    featureName: string;
    usagePercent: number;
    remaining: number;
    limit: number;
    resetDate: string;
  };

  // Weekly digest data (for future)
  weeklyDigest?: {
    userName: string;
    applicationsCount: number;
    newJobsCount: number;
    interviewsCount?: number;
  };
}

export interface QueuedNotification {
  id: string;
  user_id: string;
  type: 'payment' | 'job_alert' | 'usage_warning' | 'weekly_digest';
  priority: 'high' | 'medium' | 'low';
  scheduled_for: string;
  data: NotificationData;
  attempts: number;
  max_attempts: number;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  error_message?: string;
  created_at: string;
  sent_at?: string;
}

export interface UserNotificationPrefs {
  job_matches?: { enabled: boolean; frequency: string; time?: string; timezone?: string };
  auto_applications?: { enabled: boolean; frequency: string };
  weekly_digest?: { enabled: boolean; frequency: string; day?: string; time?: string };
  payment_updates?: { enabled: boolean; frequency: string };
  usage_warnings?: { enabled: boolean; threshold?: number };
}

// ─── Notification Queue Manager ──────────────────────────────────────────

export class NotificationQueueManager {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Queue a notification for processing
   */
  async queueNotification(
    userId: string,
    type: 'payment' | 'job_alert' | 'usage_warning' | 'weekly_digest',
    data: NotificationData,
    options: {
      priority?: 'high' | 'medium' | 'low';
      scheduledFor?: Date;
      maxAttempts?: number;
    } = {}
  ): Promise<{ success: boolean; notificationId?: string; error?: string }> {
    try {
      // Check if user wants this type of notification
      const prefs = await this.getUserNotificationPreferences(userId);
      if (!this.shouldSendNotification(type, prefs)) {
        console.log(`[QUEUE] Skipping ${type} notification for user ${userId} - disabled in preferences`);
        return { success: true }; // Silent success
      }

      const { data: notification, error } = await this.supabase
        .from('notification_queue')
        .insert({
          user_id: userId,
          type,
          priority: options.priority || 'medium',
          scheduled_for: options.scheduledFor?.toISOString() || new Date().toISOString(),
          data,
          max_attempts: options.maxAttempts || 3
        })
        .select('id')
        .single();

      if (error) {
        console.error('[QUEUE] Failed to queue notification:', error);
        return { success: false, error: error.message };
      }

      console.log(`[QUEUE] Queued ${type} notification ${notification.id} for user ${userId}`);
      return { success: true, notificationId: notification.id };

    } catch (error) {
      console.error('[QUEUE] Unexpected error queuing notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get pending notifications ready for processing
   */
  async getPendingNotifications(
    limit: number = 50,
    priority?: 'high' | 'medium' | 'low'
  ): Promise<QueuedNotification[]> {
    try {
      let query = this.supabase
        .from('notification_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString())
        .lt('attempts', 3) // max_attempts default
        .order('priority', { ascending: false }) // high priority first
        .order('scheduled_for', { ascending: true }) // oldest first
        .limit(limit);

      if (priority) {
        query = query.eq('priority', priority);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[QUEUE] Failed to get pending notifications:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      console.error('[QUEUE] Unexpected error getting pending notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as being processed (increment attempts)
   */
  async markAsProcessing(notificationId: string): Promise<boolean> {
    try {
      // First get current attempts, then increment
      const { data: current } = await this.supabase
        .from('notification_queue')
        .select('attempts')
        .eq('id', notificationId)
        .single();

      const { error } = await this.supabase
        .from('notification_queue')
        .update({
          attempts: (current?.attempts ?? 0) + 1
        })
        .eq('id', notificationId);

      if (error) {
        console.error('[QUEUE] Failed to mark notification as processing:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[QUEUE] Unexpected error marking as processing:', error);
      return false;
    }
  }

  /**
   * Mark notification as successfully sent
   */
  async markAsSent(notificationId: string, recipientEmail: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notification_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) {
        console.error('[QUEUE] Failed to mark notification as sent:', error);
        return false;
      }

      // Also log to notification history
      await this.logNotificationHistory(notificationId, recipientEmail);

      return true;
    } catch (error) {
      console.error('[QUEUE] Unexpected error marking as sent:', error);
      return false;
    }
  }

  /**
   * Mark notification as failed
   */
  async markAsFailed(notificationId: string, errorMessage: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notification_queue')
        .update({
          status: 'failed',
          error_message: errorMessage
        })
        .eq('id', notificationId);

      if (error) {
        console.error('[QUEUE] Failed to mark notification as failed:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[QUEUE] Unexpected error marking as failed:', error);
      return false;
    }
  }

  /**
   * Get user notification preferences
   */
  private async getUserNotificationPreferences(userId: string): Promise<UserNotificationPrefs> {
    try {
      const { data } = await this.supabase.rpc('get_notification_preferences', {
        p_user_id: userId
      });

      return data || {};
    } catch (error) {
      console.error('[QUEUE] Error getting user preferences:', error);
      return {};
    }
  }

  /**
   * Check if notification should be sent based on user preferences
   */
  private shouldSendNotification(
    type: string,
    prefs: UserNotificationPrefs
  ): boolean {
    switch (type) {
      case 'payment':
        return prefs.payment_updates?.enabled !== false;
      case 'job_alert':
        return prefs.job_matches?.enabled !== false;
      case 'usage_warning':
        return prefs.usage_warnings?.enabled !== false;
      case 'weekly_digest':
        return prefs.weekly_digest?.enabled !== false;
      default:
        return true; // Default to sending if unknown type
    }
  }

  /**
   * Log notification to history for analytics
   */
  private async logNotificationHistory(notificationId: string, recipientEmail: string): Promise<void> {
    try {
      // Get notification details for logging
      const { data: notification } = await this.supabase
        .from('notification_queue')
        .select('user_id, type, data')
        .eq('id', notificationId)
        .single();

      if (!notification) return;

      // Generate subject for logging
      let emailSubject = 'Hunter Notification';

      if (notification.type === 'payment' && notification.data.paymentConfirmation) {
        const { subject } = buildPaymentConfirmationEmail(notification.data.paymentConfirmation);
        emailSubject = subject;
      } else if (notification.type === 'job_alert' && notification.data.jobAlert) {
        const { subject } = buildJobAlertEmail(notification.data.jobAlert);
        emailSubject = subject;
      } else if (notification.type === 'usage_warning' && notification.data.usageWarning) {
        const { subject } = buildUsageWarningEmail(notification.data.usageWarning);
        emailSubject = subject;
      }

      await this.supabase
        .from('notification_history')
        .insert({
          user_id: notification.user_id,
          type: notification.type,
          email_subject: emailSubject,
          sent_to: recipientEmail,
          sent_at: new Date().toISOString()
        });

    } catch (error) {
      console.error('[QUEUE] Error logging notification history:', error);
    }
  }

  /**
   * Clean up old notifications (older than 30 days)
   */
  async cleanupOldNotifications(): Promise<{ cleaned: number }> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await this.supabase
        .from('notification_queue')
        .delete()
        .lt('created_at', thirtyDaysAgo.toISOString())
        .neq('status', 'pending');

      if (error) {
        console.error('[QUEUE] Failed to cleanup old notifications:', error);
        return { cleaned: 0 };
      }

      const cleaned = Array.isArray(data) ? (data as unknown[]).length : 0;
      console.log(`[QUEUE] Cleaned up ${cleaned} old notifications`);
      return { cleaned };

    } catch (error) {
      console.error('[QUEUE] Unexpected error during cleanup:', error);
      return { cleaned: 0 };
    }
  }
}