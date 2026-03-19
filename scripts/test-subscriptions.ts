#!/usr/bin/env tsx

import { config } from 'dotenv';
import { runSubscriptionTests } from '../src/tests/subscription-test-suite';

// Load environment variables
config();

/**
 * Main test runner for subscription functionality
 */
async function main() {
  console.log('🚀 Hunter AI Subscription Test Suite');
  console.log('=====================================\n');

  // Check environment setup
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase environment variables');
    console.log('Please set SUPABASE_URL and SUPABASE_ANON_KEY');
    process.exit(1);
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PUBLISHABLE_KEY) {
    console.warn('⚠️ Missing Stripe environment variables');
    console.log('Stripe tests will be skipped. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY for full testing.');
  }

  try {
    const startTime = Date.now();

    // Run all subscription tests
    const results = await runSubscriptionTests();

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Final summary
    console.log(`\n⏱️ Total test duration: ${duration}ms`);

    const passedTests = results.filter(r => r.passed).length;
    const totalTests = results.length;

    if (passedTests === totalTests) {
      console.log('🎉 All tests passed! Subscription system is ready for production.');
      process.exit(0);
    } else {
      console.log(`💥 ${totalTests - passedTests} tests failed. Please review and fix issues before deployment.`);
      process.exit(1);
    }

  } catch (error: any) {
    console.error('❌ Test suite failed to run:', error.message);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}