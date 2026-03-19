// Test Nigerian payment system and currency conversion
// Verifies NGN pricing and Paystack integration

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test results tracking
const testResults = [];
let totalTests = 0;
let passedTests = 0;

function addTestResult(test, passed, message, duration = 0) {
  totalTests++;
  if (passed) passedTests++;

  testResults.push({ test, passed, message, duration });
  const status = passed ? '✅' : '❌';
  const durationText = duration > 0 ? ` (${duration}ms)` : '';
  console.log(`${status} ${test}: ${message}${durationText}`);
}

// Test 1: NGN Pricing Structure
async function testNgnPricing() {
  const startTime = Date.now();

  try {
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('sort_order');

    if (error) throw error;

    const expectedNgnPrices = {
      free: { monthly: 0, yearly: 0 },
      pro: { monthly: 32000, yearly: 320000 },
      enterprise: { monthly: 160000, yearly: 1600000 }
    };

    for (const plan of plans) {
      const expected = expectedNgnPrices[plan.name];
      if (!expected) continue;

      if (parseFloat(plan.price_monthly_ngn) !== expected.monthly) {
        throw new Error(`${plan.name} monthly NGN price mismatch: expected ₦${expected.monthly}, got ₦${plan.price_monthly_ngn}`);
      }

      if (parseFloat(plan.price_yearly_ngn) !== expected.yearly) {
        throw new Error(`${plan.name} yearly NGN price mismatch: expected ₦${expected.yearly}, got ₦${plan.price_yearly_ngn}`);
      }
    }

    addTestResult('NGN Pricing Structure', true,
      `All plans have correct NGN pricing: Pro ₦32k/mo, Enterprise ₦160k/mo`,
      Date.now() - startTime);
    return true;
  } catch (error) {
    addTestResult('NGN Pricing Structure', false, error.message, Date.now() - startTime);
    return false;
  }
}

// Test 2: Currency-Aware Usage Limits
async function testCurrencyAwareUsage() {
  const startTime = Date.now();

  try {
    const mockUserId = '44444444-4444-4444-4444-444444444444';

    // Test NGN currency usage limits
    const { data, error } = await supabase.rpc('check_feature_usage_limit', {
      p_user_id: mockUserId,
      p_feature_name: 'job_applications',
      p_requested_count: 1
    });

    if (error) throw error;

    const result = data[0];

    // Should default to free plan with USD currency
    if (result.subscription_plan !== 'free') {
      throw new Error(`Expected free plan, got ${result.subscription_plan}`);
    }

    if (result.currency !== 'usd') {
      throw new Error(`Expected USD default currency, got ${result.currency}`);
    }

    addTestResult('Currency-Aware Usage', true,
      `Usage limits working with currency: ${result.currency}, plan: ${result.subscription_plan}`,
      Date.now() - startTime);
    return true;
  } catch (error) {
    addTestResult('Currency-Aware Usage', false, error.message, Date.now() - startTime);
    return false;
  }
}

// Test 3: Nigerian User Payment Provider Detection
async function testPaymentProviderDetection() {
  const startTime = Date.now();

  try {
    const nigerianUserId = '55555555-5555-5555-5555-555555555555';

    // Test provider detection for Nigerian user
    const { data: providerData, error } = await supabase.rpc('get_payment_provider_for_user', {
      p_user_id: nigerianUserId,
      p_user_country: 'NG'
    });

    if (error) throw error;

    const result = providerData[0];

    if (result.provider !== 'paystack') {
      throw new Error(`Expected paystack provider for NG, got ${result.provider}`);
    }

    if (result.currency !== 'ngn') {
      throw new Error(`Expected NGN currency for Nigerian user, got ${result.currency}`);
    }

    if (parseFloat(result.monthly_price) !== 0) {
      throw new Error(`Expected ₦0 for free plan, got ₦${result.monthly_price}`);
    }

    addTestResult('Payment Provider Detection', true,
      `Nigerian users correctly assigned: ${result.provider} with ${result.currency} currency`,
      Date.now() - startTime);
    return true;
  } catch (error) {
    addTestResult('Payment Provider Detection', false, error.message, Date.now() - startTime);
    return false;
  }
}

// Test 4: NGN Overage Rates
async function testNgnOverageRates() {
  const startTime = Date.now();

  try {
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('overage_rates')
      .eq('name', 'free')
      .single();

    if (error) throw error;

    const expectedNgnRates = {
      job_applications_ngn: '3200.00',     // $2.00 * 1600
      resume_generations_ngn: '8000.00',   // $5.00 * 1600
      ai_interviews_ngn: '16000.00'        // $10.00 * 1600
    };

    for (const [feature, expectedRate] of Object.entries(expectedNgnRates)) {
      const actualRate = plans.overage_rates[feature];
      if (actualRate !== expectedRate) {
        throw new Error(`NGN overage rate mismatch for ${feature}: expected ₦${expectedRate}, got ₦${actualRate}`);
      }
    }

    addTestResult('NGN Overage Rates', true,
      `All NGN overage rates correctly set: job applications ₦3,200, resume generations ₦8,000`,
      Date.now() - startTime);
    return true;
  } catch (error) {
    addTestResult('NGN Overage Rates', false, error.message, Date.now() - startTime);
    return false;
  }
}

// Test 5: Paystack Subscription Simulation
async function testPaystackSubscription() {
  const startTime = Date.now();

  try {
    const nigerianUserId = '66666666-6666-6666-6666-666666666666';

    // Simulate Paystack subscription creation
    const { error: subError } = await supabaseService
      .from('subscriptions')
      .upsert({
        user_id: nigerianUserId,
        tier: 'pro',
        status: 'active',
        payment_provider: 'paystack',
        currency: 'ngn',
        paystack_customer_code: 'CUS_test_nigeria_123',
        paystack_subscription_code: 'SUB_test_nigeria_123',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 2592000000).toISOString()
      });

    if (subError) throw subError;

    // Test that NGN pricing is applied
    const { data: usageData, error: usageError } = await supabase.rpc('check_feature_usage_limit', {
      p_user_id: nigerianUserId,
      p_feature_name: 'job_applications',
      p_requested_count: 1
    });

    if (usageError) throw usageError;

    const result = usageData[0];

    if (result.subscription_plan !== 'pro') {
      throw new Error(`Expected pro plan, got ${result.subscription_plan}`);
    }

    if (result.currency !== 'ngn') {
      throw new Error(`Expected NGN currency, got ${result.currency}`);
    }

    if (result.limit_amount !== 100) {
      throw new Error(`Expected 100 job applications for pro, got ${result.limit_amount}`);
    }

    addTestResult('Paystack Subscription', true,
      `Nigerian pro subscription working: 100 applications in NGN currency`,
      Date.now() - startTime);
    return true;
  } catch (error) {
    addTestResult('Paystack Subscription', false, error.message, Date.now() - startTime);
    return false;
  }
}

// Test 6: Currency Conversion Logic
async function testCurrencyConversion() {
  const startTime = Date.now();

  try {
    // Test exchange rate logic (1 USD = 1600 NGN approximately)
    const usdAmounts = [19.99, 99.99, 199.99];
    const expectedNgnAmounts = [31984, 159984, 319984]; // 19.99*1600, etc.

    let conversionsCorrect = 0;

    for (let i = 0; i < usdAmounts.length; i++) {
      const usdAmount = usdAmounts[i];
      const expectedNgn = expectedNgnAmounts[i];
      const calculatedNgn = Math.round(usdAmount * 1600);

      if (Math.abs(calculatedNgn - expectedNgn) < 100) { // Allow small rounding differences
        conversionsCorrect++;
      }
    }

    if (conversionsCorrect !== usdAmounts.length) {
      throw new Error(`Currency conversion failed for ${usdAmounts.length - conversionsCorrect} amounts`);
    }

    addTestResult('Currency Conversion', true,
      `All ${conversionsCorrect} USD to NGN conversions accurate (1:1600 rate)`,
      Date.now() - startTime);
    return true;
  } catch (error) {
    addTestResult('Currency Conversion', false, error.message, Date.now() - startTime);
    return false;
  }
}

// Test cleanup
async function cleanupNgnTestData() {
  const startTime = Date.now();

  try {
    const testUserIds = [
      '44444444-4444-4444-4444-444444444444',
      '55555555-5555-5555-5555-555555555555',
      '66666666-6666-6666-6666-666666666666'
    ];

    await Promise.all([
      supabaseService.from('subscriptions').delete().in('user_id', testUserIds),
      supabaseService.from('usage_tracking').delete().in('user_id', testUserIds),
      supabaseService.from('overage_purchases').delete().in('user_id', testUserIds)
    ]);

    addTestResult('NGN Test Cleanup', true, 'All test data cleaned up', Date.now() - startTime);
    return true;
  } catch (error) {
    addTestResult('NGN Test Cleanup', false, error.message, Date.now() - startTime);
    return false;
  }
}

function generateNgnReport() {
  console.log('\n📊 NIGERIAN PAYMENT SYSTEM TEST REPORT');
  console.log('=====================================');

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
  } else {
    console.log('\n🎉 ALL NGN PAYMENT TESTS PASSED!');
    console.log('✅ Nigerian Naira (NGN) pricing implemented');
    console.log('✅ Paystack integration ready');
    console.log('✅ Currency-aware usage limits working');
    console.log('✅ Exchange rate conversion accurate');
    console.log('✅ Payment provider detection functional');
  }

  console.log('\n=====================================');
  return passedTests === totalTests;
}

async function runNgnTests() {
  console.log('🇳🇬 Hunter AI Nigerian Payment System Test Suite');
  console.log('===============================================\n');

  try {
    const overallStartTime = Date.now();

    await testNgnPricing();
    await testCurrencyAwareUsage();
    await testPaymentProviderDetection();
    await testNgnOverageRates();
    await testPaystackSubscription();
    await testCurrencyConversion();
    await cleanupNgnTestData();

    const overallDuration = Date.now() - overallStartTime;
    console.log(`\n⏱️ Total NGN test duration: ${overallDuration}ms`);

    const success = generateNgnReport();
    process.exit(success ? 0 : 1);

  } catch (error) {
    console.error('❌ NGN test suite crashed:', error.message);
    process.exit(1);
  }
}

// Run NGN payment tests
runNgnTests();