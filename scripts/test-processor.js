#!/usr/bin/env node

/**
 * Test script for notification processor
 * Creates test notifications and triggers processing
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ffjsgjsiemtxqbhimvhb.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testNotificationProcessor() {
  try {
    console.log('🔄 Testing notification processor...\n');

    // 1. Get a test user
    const { data: users } = await supabase.auth.admin.listUsers();
    const testUser = users.users[0];

    if (!testUser) {
      console.log('❌ No users found. Please create a user first.');
      return;
    }

    console.log(`✅ Found test user: ${testUser.email} (${testUser.id})`);

    // 2. Create test notifications
    console.log('📝 Creating test notifications...');

    const testNotifications = [
      {
        user_id: testUser.id,
        type: 'payment',
        priority: 'high',
        data: {
          paymentConfirmation: {
            tier: 'pro',
            amount: 19.99,
            currency: 'usd',
            paymentProvider: 'stripe',
            userName: testUser.user_metadata?.full_name || 'Test User'
          }
        }
      },
      {
        user_id: testUser.id,
        type: 'usage_warning',
        priority: 'medium',
        data: {
          usageWarning: {
            userName: testUser.user_metadata?.full_name || 'Test User',
            featureName: 'Job Applications',
            usagePercent: 85,
            remaining: 15,
            limit: 100,
            resetDate: 'April 1, 2026'
          }
        }
      }
    ];

    const { data: createdNotifications, error: insertError } = await supabase
      .from('notification_queue')
      .insert(testNotifications)
      .select();

    if (insertError) {
      console.error('❌ Failed to create test notifications:', insertError);
      return;
    }

    console.log(`✅ Created ${createdNotifications.length} test notifications`);

    // 3. Check queue status
    const { data: queueStatus } = await supabase
      .from('notification_queue')
      .select('status')
      .eq('user_id', testUser.id);

    console.log('📊 Queue status:', queueStatus.reduce((acc, n) => {
      acc[n.status] = (acc[n.status] || 0) + 1;
      return acc;
    }, {}));

    // 4. Trigger processor
    console.log('🚀 Triggering notification processor...');

    const response = await fetch(`${SUPABASE_URL}/functions/v1/process-notifications`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Processor completed:');
      console.log(`   - Processed: ${result.stats.processed}`);
      console.log(`   - Sent: ${result.stats.sent}`);
      console.log(`   - Failed: ${result.stats.failed}`);
      console.log(`   - Duration: ${result.duration_ms}ms`);

      if (result.stats.errors.length > 0) {
        console.log('❌ Errors:');
        result.stats.errors.forEach(error => console.log(`   - ${error}`));
      }
    } else {
      console.error('❌ Processor failed:', result);
    }

    // 5. Check final queue status
    const { data: finalStatus } = await supabase
      .from('notification_queue')
      .select('status')
      .eq('user_id', testUser.id);

    console.log('📊 Final queue status:', finalStatus.reduce((acc, n) => {
      acc[n.status] = (acc[n.status] || 0) + 1;
      return acc;
    }, {}));

    // 6. Check notification history
    const { data: history } = await supabase
      .from('notification_history')
      .select('*')
      .eq('user_id', testUser.id)
      .order('sent_at', { ascending: false })
      .limit(10);

    console.log(`📜 Notification history: ${history.length} entries`);
    if (history.length > 0) {
      history.forEach(h => {
        console.log(`   - ${h.type}: ${h.email_subject} (sent to ${h.sent_to})`);
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testNotificationProcessor();