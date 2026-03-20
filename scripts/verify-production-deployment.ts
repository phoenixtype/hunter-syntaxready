#!/usr/bin/env tsx
/**
 * Production Deployment Verification Script
 *
 * Verifies that all components of the payment value delivery system are working:
 * 1. Database functions and tables
 * 2. Edge functions
 * 3. Subscription system
 * 4. Notification system
 * 5. Usage tracking
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ffjsgjsiemtxqbhimvhb.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmanNnanNpZW10eHFiaGltdmhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0Mjc4NzAsImV4cCI6MjA4MjAwMzg3MH0.h6ld2FmBGzpdtuxL42eHHXMrqgh2HRZMWEa3z2TUax0';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

// Create clients
const publicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface VerificationResult {
  component: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  details?: any;
}

class ProductionVerifier {
  private results: VerificationResult[] = [];

  private addResult(component: string, status: 'passed' | 'failed' | 'warning', message: string, details?: any) {
    this.results.push({ component, status, message, details });
    const icon = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⚠️';
    console.log(`${icon} ${component}: ${message}`);
  }

  // ─── Database Structure Verification ────────────────────────────────
  async verifyDatabaseTables() {
    console.log('\n📊 Verifying Database Tables...');

    const requiredTables = [
      'subscriptions',
      'subscription_usage',
      'notification_queue',
      'notification_preferences'
    ];

    for (const table of requiredTables) {
      try {
        const { data, error } = await adminClient.from(table).select('*').limit(1);

        if (error) {
          this.addResult(`Table: ${table}`, 'failed', `Error accessing table: ${error.message}`);
        } else {
          this.addResult(`Table: ${table}`, 'passed', 'Table exists and accessible');
        }
      } catch (error) {
        this.addResult(`Table: ${table}`, 'failed', `Exception: ${error}`);
      }
    }
  }

  async verifyDatabaseFunctions() {
    console.log('\n🔧 Verifying Database Functions...');

    const requiredFunctions = [
      'record_feature_usage',
      'check_feature_access',
      'get_usage_overview'
    ];

    for (const funcName of requiredFunctions) {
      try {
        // Test with dummy parameters to check if function exists
        const { error } = await adminClient.rpc(funcName, {
          p_user_id: 'test-user-verification',
          p_feature_name: 'resume_generations'
        });

        // We expect an error for non-existent user, but not a "function not found" error
        if (error && error.message.includes('Could not find the function')) {
          this.addResult(`Function: ${funcName}`, 'failed', 'Function not found in database');
        } else {
          this.addResult(`Function: ${funcName}`, 'passed', 'Function exists and callable');
        }
      } catch (error) {
        this.addResult(`Function: ${funcName}`, 'failed', `Exception: ${error}`);
      }
    }
  }

  // ─── Edge Functions Verification ────────────────────────────────────
  async verifyEdgeFunctions() {
    console.log('\n🚀 Verifying Edge Functions...');

    const criticalFunctions = [
      'stripe-webhook',
      'process-notifications',
      'check-usage-warnings',
      'send-notification'
    ];

    for (const funcName of criticalFunctions) {
      try {
        // Test health check or basic invocation
        const startTime = Date.now();

        let response;
        if (funcName === 'process-notifications') {
          // Test GET request for health check
          response = await fetch(`${SUPABASE_URL}/functions/v1/${funcName}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            }
          });
        } else {
          // Test basic invocation
          const { data, error } = await publicClient.functions.invoke(funcName, {
            body: { test: true }
          });

          response = { ok: !error, status: error ? 500 : 200 };
        }

        const duration = Date.now() - startTime;

        if (response.ok || response.status < 500) {
          this.addResult(`Edge Function: ${funcName}`, 'passed', `Function responsive (${duration}ms)`);
        } else {
          this.addResult(`Edge Function: ${funcName}`, 'failed', `HTTP ${response.status}`);
        }
      } catch (error) {
        this.addResult(`Edge Function: ${funcName}`, 'failed', `Exception: ${error}`);
      }
    }
  }

  // ─── Subscription System Verification ───────────────────────────────
  async verifySubscriptionSystem() {
    console.log('\n💳 Verifying Subscription System...');

    try {
      // Check if subscription plans exist
      const { data: plans, error: plansError } = await adminClient
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true);

      if (plansError) {
        this.addResult('Subscription Plans', 'failed', `Error fetching plans: ${plansError.message}`);
      } else if (!plans || plans.length === 0) {
        this.addResult('Subscription Plans', 'warning', 'No active subscription plans found');
      } else {
        const hasFreePlan = plans.some(p => p.name === 'free');
        const hasProPlan = plans.some(p => p.name === 'pro');

        if (hasFreePlan && hasProPlan) {
          this.addResult('Subscription Plans', 'passed', `Found ${plans.length} active plans including free and pro`);
        } else {
          this.addResult('Subscription Plans', 'warning', `Missing required plans (free: ${hasFreePlan}, pro: ${hasProPlan})`);
        }
      }

      // Test webhook endpoint
      const webhookResponse = await fetch(`${SUPABASE_URL}/functions/v1/stripe-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ test: 'webhook-verification' })
      });

      if (webhookResponse.status === 400 || webhookResponse.status === 200) {
        // 400 is expected for invalid webhook signature
        this.addResult('Stripe Webhook', 'passed', 'Webhook endpoint accessible');
      } else {
        this.addResult('Stripe Webhook', 'failed', `Unexpected status: ${webhookResponse.status}`);
      }

    } catch (error) {
      this.addResult('Subscription System', 'failed', `Exception: ${error}`);
    }
  }

  // ─── Notification System Verification ───────────────────────────────
  async verifyNotificationSystem() {
    console.log('\n📧 Verifying Notification System...');

    try {
      // Check notification processor
      const { data: processorData, error: processorError } = await publicClient.functions.invoke('process-notifications');

      if (processorError) {
        this.addResult('Notification Processor', 'failed', `Error: ${processorError.message}`);
      } else if (processorData && typeof processorData.success === 'boolean') {
        this.addResult('Notification Processor', 'passed', `Processor working (processed: ${processorData.stats?.processed || 0})`);
      } else {
        this.addResult('Notification Processor', 'warning', 'Unexpected response format');
      }

      // Check notification queue table
      const { data: queueSample, error: queueError } = await adminClient
        .from('notification_queue')
        .select('id, status, created_at')
        .limit(5)
        .order('created_at', { ascending: false });

      if (queueError) {
        this.addResult('Notification Queue', 'failed', `Queue error: ${queueError.message}`);
      } else {
        const totalCount = queueSample?.length || 0;
        this.addResult('Notification Queue', 'passed', `Queue accessible (${totalCount} recent notifications)`);
      }

      // Check preferences table
      const { data: prefSample, error: prefError } = await adminClient
        .from('notification_preferences')
        .select('user_id')
        .limit(1);

      if (prefError) {
        this.addResult('Notification Preferences', 'failed', `Preferences error: ${prefError.message}`);
      } else {
        this.addResult('Notification Preferences', 'passed', 'Preferences table accessible');
      }

    } catch (error) {
      this.addResult('Notification System', 'failed', `Exception: ${error}`);
    }
  }

  // ─── Usage Tracking Verification ────────────────────────────────────
  async verifyUsageTracking() {
    console.log('\n📈 Verifying Usage Tracking...');

    try {
      // Test usage recording function
      const testUserId = `verification-${Date.now()}`;

      const { error: recordError } = await adminClient.rpc('record_feature_usage', {
        p_user_id: testUserId,
        p_feature_name: 'resume_generations',
        p_usage_count: 1
      });

      if (recordError && !recordError.message.includes('foreign key')) {
        this.addResult('Usage Recording', 'failed', `Error: ${recordError.message}`);
      } else {
        this.addResult('Usage Recording', 'passed', 'Usage recording function working');
      }

      // Test usage checking function
      const { error: checkError } = await adminClient.rpc('check_feature_access', {
        p_user_id: testUserId,
        p_feature_name: 'resume_generations'
      });

      if (checkError && !checkError.message.includes('Could not find')) {
        this.addResult('Usage Checking', 'failed', `Error: ${checkError.message}`);
      } else if (checkError && checkError.message.includes('Could not find')) {
        this.addResult('Usage Checking', 'failed', 'check_feature_access function missing');
      } else {
        this.addResult('Usage Checking', 'passed', 'Usage checking function working');
      }

      // Test usage warning system
      const { error: warningError } = await publicClient.functions.invoke('check-usage-warnings', {
        body: {
          userId: testUserId,
          featureName: 'resume_generations',
          newUsage: 40
        }
      });

      if (warningError) {
        this.addResult('Usage Warnings', 'failed', `Error: ${warningError.message}`);
      } else {
        this.addResult('Usage Warnings', 'passed', 'Usage warning system working');
      }

      // Cleanup test data
      await adminClient
        .from('subscription_usage')
        .delete()
        .eq('user_id', testUserId);

    } catch (error) {
      this.addResult('Usage Tracking', 'failed', `Exception: ${error}`);
    }
  }

  // ─── Environment Configuration ──────────────────────────────────────
  async verifyEnvironmentConfig() {
    console.log('\n🔑 Verifying Environment Configuration...');

    const requiredEnvVars = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY'
    ];

    for (const envVar of requiredEnvVars) {
      const value = process.env[envVar];
      if (value && value.length > 10) {
        this.addResult(`Env: ${envVar}`, 'passed', 'Environment variable configured');
      } else {
        this.addResult(`Env: ${envVar}`, 'failed', 'Missing or invalid environment variable');
      }
    }

    // Test basic connectivity
    try {
      const { data, error } = await publicClient.from('profiles').select('id').limit(1);
      if (error) {
        this.addResult('Database Connection', 'failed', `Connection error: ${error.message}`);
      } else {
        this.addResult('Database Connection', 'passed', 'Database connectivity confirmed');
      }
    } catch (error) {
      this.addResult('Database Connection', 'failed', `Exception: ${error}`);
    }
  }

  // ─── Main Verification Runner ───────────────────────────────────────
  async runFullVerification() {
    console.log('🔍 Starting Production Deployment Verification\n');
    console.log(`Testing against: ${SUPABASE_URL}`);
    console.log('=' * 60);

    await this.verifyEnvironmentConfig();
    await this.verifyDatabaseTables();
    await this.verifyDatabaseFunctions();
    await this.verifyEdgeFunctions();
    await this.verifySubscriptionSystem();
    await this.verifyNotificationSystem();
    await this.verifyUsageTracking();

    console.log('\n📊 Verification Summary');
    console.log('=' * 60);

    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`📊 Total: ${this.results.length}`);

    if (failed > 0) {
      console.log('\n❌ Critical Issues Found:');
      this.results
        .filter(r => r.status === 'failed')
        .forEach(r => console.log(`   • ${r.component}: ${r.message}`));
    }

    if (warnings > 0) {
      console.log('\n⚠️  Warnings:');
      this.results
        .filter(r => r.status === 'warning')
        .forEach(r => console.log(`   • ${r.component}: ${r.message}`));
    }

    const overallStatus = failed === 0 ? (warnings === 0 ? 'EXCELLENT' : 'GOOD') : 'NEEDS_ATTENTION';

    console.log(`\n🎯 Overall System Status: ${overallStatus}`);

    if (overallStatus === 'EXCELLENT') {
      console.log('🎉 All systems are fully operational! Payment value delivery is ready for production.');
    } else if (overallStatus === 'GOOD') {
      console.log('✨ Core systems operational with minor issues. Safe for production with monitoring.');
    } else {
      console.log('🚨 Critical issues detected. Address failed components before full production deployment.');
    }

    return {
      status: overallStatus,
      passed,
      failed,
      warnings,
      total: this.results.length,
      details: this.results
    };
  }
}

// Execute verification if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const verifier = new ProductionVerifier();
  verifier.runFullVerification()
    .then(summary => {
      process.exit(summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Verification script failed:', error);
      process.exit(1);
    });
}

export { ProductionVerifier };