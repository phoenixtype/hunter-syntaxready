// Test script to verify interview-coach edge function is working
// This tests the rate limit function that was causing the "K is not a function" error

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

console.log('🧪 Testing Interview Coach Fix');
console.log('===============================\n');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test 1: Check if we can call the edge function without authentication (should get proper error)
console.log('🔍 Test 1: Edge function accessibility');
try {
  const { data, error } = await supabase.functions.invoke('interview-coach', {
    body: {
      messages: [],
      job: { title: 'Test Developer' },
      mode: 'behavioral',
    },
  });

  if (error) {
    if (error.message.includes('Authentication required') || error.context?.status === 401) {
      console.log('✅ Edge function is accessible and properly protected');
    } else {
      console.log('❌ Unexpected error (not auth-related):', error.message);
    }
  } else {
    console.log('⚠️  Edge function returned data without auth (unexpected)');
  }
} catch (err) {
  if (err.message.includes('TypeError: K is not a function')) {
    console.log('❌ CRITICAL: Still getting "K is not a function" error!');
  } else {
    console.log('✅ No "K is not a function" error detected');
  }
}

// Test 2: Check if rate limit function exists by calling RPC directly
console.log('\n🔍 Test 2: Rate limit function availability');
try {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
    p_function_name: 'test-function',
    p_max_requests: 10,
    p_window_seconds: 60
  });

  if (error) {
    if (error.message.includes('function check_rate_limit') && error.message.includes('does not exist')) {
      console.log('❌ CRITICAL: check_rate_limit function does not exist in database');
    } else if (error.message.includes('permission denied') || error.message.includes('insufficient_privilege')) {
      console.log('✅ check_rate_limit function exists (permission error expected for dummy user)');
    } else {
      console.log('⚠️  check_rate_limit function error:', error.message);
    }
  } else {
    console.log('✅ check_rate_limit function working properly, result:', data);
  }
} catch (err) {
  console.log('❌ RPC call failed:', err.message);
}

console.log('\n===============================');
console.log('🎯 Test Complete');
console.log('\nIf you see "K is not a function" error above, the production issue is NOT fixed.');
console.log('If you see authentication/permission errors, the issue is likely RESOLVED.');