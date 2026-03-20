/**
 * Payment Flow Integration Tests
 *
 * Tests the complete payment workflow from webhook to database updates:
 * 1. Stripe webhook receives payment confirmation
 * 2. Enhanced subscriptions table is updated with feature limits
 * 3. Usage tracking works correctly
 * 4. Notification system is triggered
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// Mock Stripe webhook payload for Pro subscription
const MOCK_STRIPE_WEBHOOK_PRO = {
  type: 'customer.subscription.created',
  data: {
    object: {
      id: 'sub_test123456789',
      customer: 'cus_test123456789',
      status: 'active',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
      items: {
        data: [{
          price: {
            id: 'price_1T1MEPD543enPilsIsPAwvNP' // Hunter Pro price ID
          }
        }]
      }
    }
  }
};

describe('Payment Flow Integration', () => {
  let testUserId: string;
  let cleanupFunctions: (() => Promise<void>)[] = [];

  beforeEach(async () => {
    testUserId = `integration-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  });

  afterEach(async () => {
    // Clean up test data
    await Promise.all(cleanupFunctions.map(fn => fn().catch(console.error)));
    cleanupFunctions = [];

    // Clean up user-related test data
    await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', testUserId);

    await supabase
      .from('subscription_usage')
      .delete()
      .eq('user_id', testUserId);

    await supabase
      .from('notification_queue')
      .delete()
      .eq('user_id', testUserId);
  });

  describe('Database Integration', () => {
    it('should create subscription with correct feature limits', async () => {
      // Create a test subscription directly in database
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .insert({
          user_id: testUserId,
          tier: 'pro',
          status: 'active',
          feature_limits: {
            job_applications: 100,
            resume_generations: 50,
            ai_interviews: 25,
            cover_letters: 75,
            job_matches: 200,
            company_research: 100,
            skill_assessments: 20
          },
          stripe_subscription_id: 'sub_test123456789',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(subscription).toBeTruthy();
      expect(subscription.tier).toBe('pro');
      expect(subscription.feature_limits.resume_generations).toBe(50);

      // Add to cleanup
      cleanupFunctions.push(async () => {
        await supabase.from('subscriptions').delete().eq('id', subscription.id);
      });
    });

    it('should record feature usage correctly', async () => {
      // Create subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .insert({
          user_id: testUserId,
          tier: 'pro',
          status: 'active',
          feature_limits: { resume_generations: 50 }
        })
        .select()
        .single();

      // Record usage
      const { error: usageError } = await supabase.rpc('record_feature_usage', {
        p_user_id: testUserId,
        p_feature_name: 'resume_generations',
        p_usage_count: 3
      });

      expect(usageError).toBeNull();

      // Verify usage was recorded
      const { data: usage, error: fetchError } = await supabase
        .from('subscription_usage')
        .select('*')
        .eq('user_id', testUserId)
        .eq('feature_name', 'resume_generations');

      expect(fetchError).toBeNull();
      expect(usage).toHaveLength(1);
      expect(usage[0].usage_count).toBe(3);

      cleanupFunctions.push(async () => {
        await supabase.from('subscriptions').delete().eq('id', subscription.id);
        await supabase.from('subscription_usage').delete().eq('user_id', testUserId);
      });
    });

    it('should handle subscription cancellation', async () => {
      // Create active subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .insert({
          user_id: testUserId,
          tier: 'pro',
          status: 'active',
          feature_limits: { resume_generations: 50 },
          stripe_subscription_id: 'sub_cancel_test'
        })
        .select()
        .single();

      // Update to cancelled
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancel_at_period_end: true
        })
        .eq('id', subscription.id);

      expect(updateError).toBeNull();

      // Verify cancellation
      const { data: cancelledSub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('id', subscription.id)
        .single();

      expect(cancelledSub.status).toBe('cancelled');
      expect(cancelledSub.cancel_at_period_end).toBe(true);

      cleanupFunctions.push(async () => {
        await supabase.from('subscriptions').delete().eq('id', subscription.id);
      });
    });
  });

  describe('Feature Access Control', () => {
    it('should enforce feature limits correctly', async () => {
      // Create subscription with low limits
      const { data: subscription } = await supabase
        .from('subscriptions')
        .insert({
          user_id: testUserId,
          tier: 'pro',
          status: 'active',
          feature_limits: { resume_generations: 2 }
        })
        .select()
        .single();

      // Use feature up to limit
      await supabase.rpc('record_feature_usage', {
        p_user_id: testUserId,
        p_feature_name: 'resume_generations',
        p_usage_count: 2
      });

      // Check access via RPC function
      const { data: accessCheck, error } = await supabase.rpc('check_feature_access', {
        p_user_id: testUserId,
        p_feature_name: 'resume_generations'
      });

      expect(error).toBeNull();
      expect(accessCheck.can_use).toBe(false);
      expect(accessCheck.remaining_amount).toBe(0);

      cleanupFunctions.push(async () => {
        await supabase.from('subscriptions').delete().eq('id', subscription.id);
        await supabase.from('subscription_usage').delete().eq('user_id', testUserId);
      });
    });
  });

  describe('Edge Function Integration', () => {
    it('should process webhook payloads', async () => {
      // Test webhook processing
      const { data, error } = await supabase.functions.invoke('stripe-webhook', {
        body: MOCK_STRIPE_WEBHOOK_PRO,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Should not error (even if webhook signature is invalid in test)
      expect(error).toBeNull();
      expect(data).toBeTruthy();
    });

    it('should check usage warnings', async () => {
      // Set up subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .insert({
          user_id: testUserId,
          tier: 'pro',
          status: 'active',
          feature_limits: { resume_generations: 50 }
        })
        .select()
        .single();

      // Test usage warning check
      const { data, error } = await supabase.functions.invoke('check-usage-warnings', {
        body: {
          userId: testUserId,
          featureName: 'resume_generations',
          newUsage: 42 // 84% of limit
        }
      });

      expect(error).toBeNull();
      expect(data).toBeTruthy();

      cleanupFunctions.push(async () => {
        await supabase.from('subscriptions').delete().eq('id', subscription.id);
      });
    });

    it('should process notifications', async () => {
      // Test notification processing
      const { data, error } = await supabase.functions.invoke('process-notifications');

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.success).toBe(true);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistency between subscription and usage', async () => {
      // Create subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .insert({
          user_id: testUserId,
          tier: 'pro',
          status: 'active',
          feature_limits: { resume_generations: 10 }
        })
        .select()
        .single();

      // Record usage
      await supabase.rpc('record_feature_usage', {
        p_user_id: testUserId,
        p_feature_name: 'resume_generations',
        p_usage_count: 3
      });

      // Check current access
      const { data: accessCheck } = await supabase.rpc('check_feature_access', {
        p_user_id: testUserId,
        p_feature_name: 'resume_generations'
      });

      expect(accessCheck.current_usage).toBe(3);
      expect(accessCheck.limit_amount).toBe(10);
      expect(accessCheck.remaining_amount).toBe(7);
      expect(accessCheck.can_use).toBe(true);

      // Record more usage
      await supabase.rpc('record_feature_usage', {
        p_user_id: testUserId,
        p_feature_name: 'resume_generations',
        p_usage_count: 5
      });

      // Check updated access
      const { data: updatedAccess } = await supabase.rpc('check_feature_access', {
        p_user_id: testUserId,
        p_feature_name: 'resume_generations'
      });

      expect(updatedAccess.current_usage).toBe(8);
      expect(updatedAccess.remaining_amount).toBe(2);

      cleanupFunctions.push(async () => {
        await supabase.from('subscriptions').delete().eq('id', subscription.id);
        await supabase.from('subscription_usage').delete().eq('user_id', testUserId);
      });
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent operations', async () => {
      // Create subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .insert({
          user_id: testUserId,
          tier: 'pro',
          status: 'active',
          feature_limits: { resume_generations: 100 }
        })
        .select()
        .single();

      // Record multiple usage operations concurrently
      const usagePromises = Array.from({ length: 5 }, (_, i) =>
        supabase.rpc('record_feature_usage', {
          p_user_id: testUserId,
          p_feature_name: 'resume_generations',
          p_usage_count: i + 1
        })
      );

      const results = await Promise.allSettled(usagePromises);

      // All should succeed
      const failures = results.filter(r => r.status === 'rejected');
      expect(failures.length).toBe(0);

      // Verify final usage count
      const { data: usage } = await supabase
        .from('subscription_usage')
        .select('usage_count')
        .eq('user_id', testUserId)
        .eq('feature_name', 'resume_generations');

      // Should have recorded all usage (1+2+3+4+5 = 15)
      const totalUsage = usage.reduce((sum, u) => sum + u.usage_count, 0);
      expect(totalUsage).toBe(15);

      cleanupFunctions.push(async () => {
        await supabase.from('subscriptions').delete().eq('id', subscription.id);
        await supabase.from('subscription_usage').delete().eq('user_id', testUserId);
      });
    });
  });
});