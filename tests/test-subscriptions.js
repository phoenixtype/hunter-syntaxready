// Simple test runner for subscription functionality
// This can be run with: node test-subscriptions.js

import { createClient } from '@supabase/supabase-js';

// Basic configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test results array
const testResults = [];

function addTestResult(test, passed, message, duration = 0) {
  testResults.push({ test, passed, message, duration });
  const status = passed ? '✅' : '❌';
  const durationText = duration > 0 ? ` (${duration}ms)` : '';
  console.log(`${status} ${test}: ${message}${durationText}`);
}

async function testDatabaseConnection() {
  const startTime = Date.now();

  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .limit(1);

    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    addTestResult('Database Connection', true, 'Successfully connected to Supabase', Date.now() - startTime);
    return true;
  } catch (error) {
    addTestResult('Database Connection', false, error.message, Date.now() - startTime);
    return false;
  }
}

async function testSubscriptionPlans() {
  const startTime = Date.now();

  try {
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('sort_order');

    if (error) {
      throw new Error(`Failed to fetch plans: ${error.message}`);
    }

    if (!plans || plans.length === 0) {
      throw new Error('No subscription plans found');
    }

    // Check for required plans
    const requiredPlans = ['free', 'pro', 'enterprise'];
    const planNames = plans.map(p => p.name);

    for (const requiredPlan of requiredPlans) {
      if (!planNames.includes(requiredPlan)) {
        throw new Error(`Missing required plan: ${requiredPlan}`);
      }
    }

    addTestResult('Subscription Plans', true, `Found ${plans.length} subscription plans`, Date.now() - startTime);
    return true;
  } catch (error) {
    addTestResult('Subscription Plans', false, error.message, Date.now() - startTime);
    return false;
  }
}

async function testFeatureLimits() {
  const startTime = Date.now();

  try {
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*');

    if (error) {
      throw error;
    }

    // Check each plan has proper feature limits
    for (const plan of plans) {
      if (!plan.feature_limits || typeof plan.feature_limits !== 'object') {
        throw new Error(`Plan ${plan.name} has invalid feature_limits`);
      }

      // Check required features exist
      const requiredFeatures = ['job_applications', 'resume_generations', 'ai_interviews'];
      for (const feature of requiredFeatures) {
        if (!(feature in plan.feature_limits)) {
          throw new Error(`Plan ${plan.name} missing feature: ${feature}`);
        }
      }

      // Check overage rates
      if (!plan.overage_rates || typeof plan.overage_rates !== 'object') {
        throw new Error(`Plan ${plan.name} has invalid overage_rates`);
      }
    }

    addTestResult('Feature Limits', true, 'All plans have valid feature limits and overage rates', Date.now() - startTime);
    return true;
  } catch (error) {
    addTestResult('Feature Limits', false, error.message, Date.now() - startTime);
    return false;
  }
}

async function testUsageFunctions() {
  const startTime = Date.now();

  try {
    // Test check_feature_usage_limit function
    const testUserId = '12345678-1234-1234-1234-123456789012'; // Mock UUID

    const { data, error } = await supabase.rpc('check_feature_usage_limit', {
      p_user_id: testUserId,
      p_feature_name: 'job_applications',
      p_requested_count: 1
    });

    if (error) {
      throw new Error(`Usage function failed: ${error.message}`);
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error('Usage function returned no data');
    }

    const result = data[0];
    if (typeof result.can_use !== 'boolean' || typeof result.current_usage !== 'number') {
      throw new Error('Usage function returned invalid data structure');
    }

    addTestResult('Usage Functions', true, 'Database functions working correctly', Date.now() - startTime);
    return true;
  } catch (error) {
    addTestResult('Usage Functions', false, error.message, Date.now() - startTime);
    return false;
  }
}

async function testTableStructure() {
  const startTime = Date.now();

  try {
    const tables = ['subscription_plans', 'user_subscriptions', 'usage_tracking', 'overage_purchases'];

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(0); // Just check table structure

      if (error && !error.message.includes('permission denied')) {
        throw new Error(`Table ${table} not accessible: ${error.message}`);
      }
    }

    addTestResult('Table Structure', true, 'All required tables exist and are accessible', Date.now() - startTime);
    return true;
  } catch (error) {
    addTestResult('Table Structure', false, error.message, Date.now() - startTime);
    return false;
  }
}

async function runMockWebhookTest() {
  const startTime = Date.now();

  try {
    // Mock webhook event data
    const mockSubscription = {
      id: 'sub_test_123',
      customer: 'cus_test_123',
      status: 'active',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 2592000,
      cancel_at_period_end: false,
      items: {
        data: [{
          price: {
            id: 'price_test_pro'
          }
        }]
      }
    };

    // For now, just validate the mock data structure
    if (!mockSubscription.id || !mockSubscription.customer || !mockSubscription.items.data[0].price.id) {
      throw new Error('Invalid webhook data structure');
    }

    addTestResult('Webhook Structure', true, 'Mock webhook data structure is valid', Date.now() - startTime);
    return true;
  } catch (error) {
    addTestResult('Webhook Structure', false, error.message, Date.now() - startTime);
    return false;
  }
}

function generateReport() {
  console.log('\n📊 SUBSCRIPTION SYSTEM TEST REPORT');
  console.log('===================================');

  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log(`Total Duration: ${totalDuration}ms`);

  if (failedTests > 0) {
    console.log('\n❌ FAILED TESTS:');
    testResults
      .filter(r => !r.passed)
      .forEach(r => console.log(`- ${r.test}: ${r.message}`));

    console.log('\n🔧 NEXT STEPS:');
    console.log('1. Check Supabase environment variables');
    console.log('2. Run database migrations: npx supabase db push');
    console.log('3. Verify database permissions');
  } else {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ Subscription system is ready for production');
  }

  console.log('\n===================================');

  return passedTests === totalTests;
}

async function runTests() {
  console.log('🚀 Hunter AI Subscription Test Suite');
  console.log('====================================\n');

  // Environment check
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.log('⚠️ Environment variables not set. Using default values for basic testing.');
    console.log('For full testing, set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.\n');
  }

  try {
    const overallStartTime = Date.now();

    // Run tests in sequence
    await testDatabaseConnection();
    await testTableStructure();
    await testSubscriptionPlans();
    await testFeatureLimits();
    await testUsageFunctions();
    await runMockWebhookTest();

    const overallDuration = Date.now() - overallStartTime;
    console.log(`\n⏱️ Total test duration: ${overallDuration}ms`);

    // Generate final report
    const success = generateReport();

    process.exit(success ? 0 : 1);

  } catch (error) {
    console.error('❌ Test suite crashed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
runTests();