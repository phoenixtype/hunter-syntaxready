#!/usr/bin/env node

/**
 * Create test notifications in the queue
 * This script demonstrates how to queue notifications programmatically
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ffjsgjsiemtxqbhimvhb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmanNnanNpZW10eHFiaGltdmhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDkxNjIzMTQsImV4cCI6MjAyNDczODMxNH0.oZh_Cwu7UaMQJN-_2c4eNQTfIXjNhJJ2WCFK9T_D8cw';

// Using anon key since we'll use RLS policies
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createTestNotifications() {
  try {
    console.log('🧪 Creating test notifications...\n');

    // You'll need to sign in with a real user
    const email = 'asakumasamuel@gmail.com'; // Replace with your test email
    const password = 'testpassword'; // Replace with your test password

    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.error('❌ Authentication failed:', authError.message);
      console.log('Please make sure you have a user account created and update the credentials in this script.');
      return;
    }

    console.log(`✅ Signed in as: ${user.email} (${user.id})`);

    // Create test notifications using the schedule_notification function
    const notifications = [
      {
        type: 'payment',
        priority: 'high',
        data: {
          paymentConfirmation: {
            tier: 'pro',
            amount: 19.99,
            currency: 'usd',
            paymentProvider: 'stripe',
            userName: user.user_metadata?.full_name || 'Test User'
          }
        }
      },
      {
        type: 'usage_warning',
        priority: 'medium',
        data: {
          usageWarning: {
            userName: user.user_metadata?.full_name || 'Test User',
            featureName: 'Resume Generations',
            usagePercent: 90,
            remaining: 5,
            limit: 50,
            resetDate: 'April 1, 2026'
          }
        }
      },
      {
        type: 'job_alert',
        priority: 'low',
        data: {
          jobAlert: {
            userName: user.user_metadata?.full_name || 'Test User',
            jobs: [
              {
                title: 'Senior React Developer',
                company: 'TechFlow Inc',
                location: 'San Francisco, CA',
                salary: '$140,000 - $180,000',
                url: 'https://usehunter.app/jobs/senior-react-dev'
              },
              {
                title: 'Full Stack Engineer',
                company: 'StartupXYZ',
                location: 'Remote',
                salary: '$100,000 - $140,000',
                url: 'https://usehunter.app/jobs/fullstack-eng'
              }
            ],
            totalMatches: 8
          }
        }
      }
    ];

    console.log(`📝 Creating ${notifications.length} test notifications...`);

    for (const notification of notifications) {
      const { data, error } = await supabase.rpc('schedule_notification', {
        p_user_id: user.id,
        p_type: notification.type,
        p_priority: notification.priority,
        p_data: notification.data
      });

      if (error) {
        console.error(`❌ Failed to create ${notification.type} notification:`, error);
      } else {
        console.log(`✅ Created ${notification.type} notification (${notification.priority} priority)`);
      }
    }

    // Check queue status
    const { data: queueCount, error: countError } = await supabase
      .from('notification_queue')
      .select('status', { count: 'exact' })
      .eq('user_id', user.id);

    if (countError) {
      console.error('❌ Failed to check queue status:', countError);
    } else {
      console.log(`\n📊 Queue status for your user: ${queueCount.length} notifications`);
    }

    console.log('\n🚀 Notifications created! They will be processed automatically by the cron job every 5 minutes.');
    console.log('📧 Check your email for the notifications.');

    // Sign out
    await supabase.auth.signOut();

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run if called directly
if (require.main === module) {
  createTestNotifications();
}

module.exports = { createTestNotifications };