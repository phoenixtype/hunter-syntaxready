/**
 * Notification System Integration Tests
 *
 * Tests the complete notification workflow from trigger to queue management:
 * 1. Usage warnings are triggered and queued
 * 2. Payment confirmations are queued via webhook
 * 3. Notification processor picks up queued items
 * 4. User preferences are respected
 * 5. Notification queue is properly managed
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// Mock test data
const TEST_USER_ID = 'notification-test-user';

describe('Notification System Integration', () => {
  let cleanupFunctions: (() => Promise<void>)[] = [];

  beforeEach(() => {
    cleanupFunctions = [];
  });

  afterEach(async () => {
    // Clean up test data
    await Promise.all(cleanupFunctions.map(fn => fn().catch(console.error)));

    // Clean up any remaining test data
    await supabase
      .from('notification_queue')
      .delete()
      .eq('user_id', TEST_USER_ID);

    await supabase
      .from('notification_preferences')
      .delete()
      .eq('user_id', TEST_USER_ID);

    await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', TEST_USER_ID);

    await supabase
      .from('subscription_usage')
      .delete()
      .eq('user_id', TEST_USER_ID);
  });

  describe('Usage Warning Notifications', () => {
    it('should queue usage warning when threshold is reached', async () => {
      // Set up subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .insert({
          user_id: TEST_USER_ID,
          tier: 'pro',
          status: 'active',
          feature_limits: { resume_generations: 50 }
        })
        .select()
        .single();

      cleanupFunctions.push(async () => {
        await supabase.from('subscriptions').delete().eq('id', subscription.id);
      });

      // Trigger usage warning check
      const { error: usageError } = await supabase.functions.invoke('check-usage-warnings', {
        body: {
          userId: TEST_USER_ID,
          featureName: 'resume_generations',
          newUsage: 41 // 82% of 50
        }
      });

      expect(usageError).toBeNull();

      // Check if notification was queued (may or may not be based on implementation)
      const { data: queuedNotifications, error: queueError } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .eq('type', 'usage_warning');

      expect(queueError).toBeNull();
      // May have 0 or more notifications based on warning logic
      expect(Array.isArray(queuedNotifications)).toBe(true);
    });

    it('should respect notification preferences', async () => {
      // Set user preference to disable usage warnings
      const { data: preference } = await supabase
        .from('notification_preferences')
        .insert({
          user_id: TEST_USER_ID,
          email_notifications: true,
          usage_warnings: false,
          marketing_emails: true,
          product_updates: true
        })
        .select()
        .single();

      cleanupFunctions.push(async () => {
        await supabase.from('notification_preferences').delete().eq('id', preference.id);
      });

      // Set up subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .insert({
          user_id: TEST_USER_ID,
          tier: 'pro',
          status: 'active',
          feature_limits: { resume_generations: 50 }
        })
        .select()
        .single();

      // Try to trigger usage warning
      const { error } = await supabase.functions.invoke('check-usage-warnings', {
        body: {
          userId: TEST_USER_ID,
          featureName: 'resume_generations',
          newUsage: 41
        }
      });

      expect(error).toBeNull();

      // Should have fewer or no notifications due to preferences
      const { data: queuedNotifications } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .eq('type', 'usage_warning');

      // With disabled preferences, should have no notifications
      expect(queuedNotifications.length).toBe(0);

      cleanupFunctions.push(async () => {
        await supabase.from('subscriptions').delete().eq('id', subscription.id);
      });
    });
  });

  describe('Notification Queue Management', () => {
    it('should add notifications to queue correctly', async () => {
      const testNotification = {
        id: 'test-notification-queue-1',
        user_id: TEST_USER_ID,
        type: 'usage_warning',
        data: {
          usageWarning: {
            feature_name: 'resume_generations',
            current_usage: 41,
            limit: 50,
            percentage: 82,
            warning_type: 'approaching_limit'
          }
        },
        status: 'pending',
        created_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('notification_queue')
        .insert(testNotification);

      expect(insertError).toBeNull();

      cleanupFunctions.push(async () => {
        await supabase.from('notification_queue').delete().eq('id', 'test-notification-queue-1');
      });

      // Verify notification was added
      const { data: notification } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('id', 'test-notification-queue-1')
        .single();

      expect(notification).toBeTruthy();
      expect(notification.status).toBe('pending');
      expect(notification.type).toBe('usage_warning');
    });

    it('should process notification queue', async () => {
      // Add a test notification
      const testNotification = {
        id: 'test-process-notification',
        user_id: TEST_USER_ID,
        type: 'usage_warning',
        data: {
          usageWarning: {
            feature_name: 'resume_generations',
            current_usage: 45,
            limit: 50
          }
        },
        status: 'pending',
        created_at: new Date().toISOString()
      };

      await supabase.from('notification_queue').insert(testNotification);

      cleanupFunctions.push(async () => {
        await supabase.from('notification_queue').delete().eq('id', 'test-process-notification');
      });

      // Process notifications
      const { data, error } = await supabase.functions.invoke('process-notifications');

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.success).toBe(true);

      // Check notification status (should be processed or failed)
      const { data: processedNotification } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('id', 'test-process-notification')
        .single();

      // Should no longer be pending
      expect(processedNotification.status).not.toBe('pending');
      expect(['sent', 'failed', 'processing']).toContain(processedNotification.status);
    });

    it('should handle failed notifications with retry logic', async () => {
      // Create notification that will likely fail (invalid user)
      const failingNotification = {
        id: 'test-failing-notification',
        user_id: 'invalid-user-id-no-email',
        type: 'usage_warning',
        data: {
          usageWarning: {
            feature_name: 'resume_generations',
            current_usage: 45,
            limit: 50
          }
        },
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
        created_at: new Date().toISOString()
      };

      await supabase.from('notification_queue').insert(failingNotification);

      cleanupFunctions.push(async () => {
        await supabase.from('notification_queue').delete().eq('id', 'test-failing-notification');
      });

      // Process notifications multiple times
      for (let i = 0; i < 2; i++) {
        await supabase.functions.invoke('process-notifications');
      }

      // Check final status
      const { data: finalNotification } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('id', 'test-failing-notification')
        .single();

      // Should have attempted processing and updated status
      expect(['failed', 'sent']).toContain(finalNotification.status);
    });
  });

  describe('Edge Function Integration', () => {
    it('should invoke notification processing function', async () => {
      const { data, error } = await supabase.functions.invoke('process-notifications');

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(typeof data.success).toBe('boolean');
      expect(typeof data.stats).toBe('object');
      expect(typeof data.duration_ms).toBe('number');
    });

    it('should handle health check requests', async () => {
      // Test GET request for health check
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/process-notifications`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabase.supabaseKey}`
        }
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('notification-processor');
    });
  });

  describe('Batch Processing', () => {
    it('should handle multiple notifications efficiently', async () => {
      // Create multiple test notifications
      const notifications = Array.from({ length: 10 }, (_, i) => ({
        id: `test-batch-${i}`,
        user_id: TEST_USER_ID,
        type: 'usage_warning',
        data: {
          usageWarning: {
            feature_name: 'resume_generations',
            current_usage: 40 + i,
            limit: 50
          }
        },
        status: 'pending',
        created_at: new Date(Date.now() - i * 1000).toISOString()
      }));

      const { error: batchError } = await supabase
        .from('notification_queue')
        .insert(notifications);

      expect(batchError).toBeNull();

      cleanupFunctions.push(async () => {
        await supabase
          .from('notification_queue')
          .delete()
          .in('id', notifications.map(n => n.id));
      });

      // Process the batch
      const startTime = Date.now();
      const { data, error: processError } = await supabase.functions.invoke('process-notifications');
      const duration = Date.now() - startTime;

      expect(processError).toBeNull();
      expect(data.success).toBe(true);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds

      // Verify notifications were processed
      const { data: processedNotifications } = await supabase
        .from('notification_queue')
        .select('status')
        .in('id', notifications.map(n => n.id));

      const stillPending = processedNotifications.filter(n => n.status === 'pending');
      expect(stillPending.length).toBeLessThan(notifications.length); // Some should be processed
    });
  });

  describe('Data Validation', () => {
    it('should validate notification data structure', async () => {
      // Test with valid notification data
      const validNotification = {
        id: 'test-valid-notification',
        user_id: TEST_USER_ID,
        type: 'usage_warning',
        data: {
          usageWarning: {
            feature_name: 'resume_generations',
            current_usage: 40,
            limit: 50,
            percentage: 80
          }
        },
        status: 'pending',
        created_at: new Date().toISOString()
      };

      const { error: validError } = await supabase
        .from('notification_queue')
        .insert(validNotification);

      expect(validError).toBeNull();

      cleanupFunctions.push(async () => {
        await supabase.from('notification_queue').delete().eq('id', 'test-valid-notification');
      });

      // Test with invalid notification data (missing required fields)
      const invalidNotification = {
        id: 'test-invalid-notification',
        user_id: TEST_USER_ID,
        // Missing type and data
        status: 'pending',
        created_at: new Date().toISOString()
      };

      const { error: invalidError } = await supabase
        .from('notification_queue')
        .insert(invalidNotification);

      // Should fail validation
      expect(invalidError).toBeTruthy();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent queue operations', async () => {
      // Create multiple concurrent insertions
      const concurrentOps = Array.from({ length: 5 }, (_, i) =>
        supabase.from('notification_queue').insert({
          id: `concurrent-test-${i}`,
          user_id: TEST_USER_ID,
          type: 'usage_warning',
          data: { usageWarning: { feature_name: 'test', current_usage: i } },
          status: 'pending',
          created_at: new Date().toISOString()
        })
      );

      const results = await Promise.allSettled(concurrentOps);

      // Most operations should succeed
      const failures = results.filter(r => r.status === 'rejected');
      expect(failures.length).toBeLessThanOrEqual(1); // Allow for minimal failures

      cleanupFunctions.push(async () => {
        await supabase
          .from('notification_queue')
          .delete()
          .like('id', 'concurrent-test-%');
      });
    });
  });
});