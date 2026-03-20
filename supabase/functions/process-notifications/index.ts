/**
 * Notification Processing Engine
 * Processes queued notifications and sends emails using unified templates
 * Runs as a scheduled edge function with batched processing
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/rate-limiter.ts";
import { NotificationQueueManager, type QueuedNotification, type NotificationData } from "../_shared/notification-queue.ts";
import {
  buildPaymentConfirmationEmail,
  buildJobAlertEmail,
  buildUsageWarningEmail
} from "../_shared/email-templates.ts";

// ─── Configuration ────────────────────────────────────────────────────────
const BATCH_SIZE = 50; // Process up to 50 notifications per run
const MAX_RETRIES = 3;
const FROM_EMAIL = 'Hunter <notifications@usehunter.app>';

// ─── Email Generation ────────────────────────────────────────────────────
async function generateEmailContent(
  notification: QueuedNotification,
  userEmail: string
): Promise<{ subject: string; html: string } | null> {
  try {
    const data = notification.data;

    switch (notification.type) {
      case 'payment':
        if (!data.paymentConfirmation) {
          console.error(`[PROCESSOR] Missing payment data for notification ${notification.id}`);
          return null;
        }
        return buildPaymentConfirmationEmail(data.paymentConfirmation);

      case 'job_alert':
        if (!data.jobAlert) {
          console.error(`[PROCESSOR] Missing job alert data for notification ${notification.id}`);
          return null;
        }
        return buildJobAlertEmail(data.jobAlert);

      case 'usage_warning':
        if (!data.usageWarning) {
          console.error(`[PROCESSOR] Missing usage warning data for notification ${notification.id}`);
          return null;
        }
        return buildUsageWarningEmail(data.usageWarning);

      case 'weekly_digest':
        // TODO: Implement weekly digest template when ready
        console.warn(`[PROCESSOR] Weekly digest not implemented yet for notification ${notification.id}`);
        return null;

      default:
        console.error(`[PROCESSOR] Unknown notification type: ${notification.type}`);
        return null;
    }
  } catch (error) {
    console.error(`[PROCESSOR] Error generating email content for notification ${notification.id}:`, error);
    return null;
  }
}

// ─── Get User Email ──────────────────────────────────────────────────────
async function getUserEmail(supabase: any, userId: string): Promise<string | null> {
  try {
    const { data: user, error } = await supabase.auth.admin.getUserById(userId);

    if (error) {
      console.error(`[PROCESSOR] Error getting user ${userId}:`, error);
      return null;
    }

    return user?.user?.email || null;
  } catch (error) {
    console.error(`[PROCESSOR] Unexpected error getting user email for ${userId}:`, error);
    return null;
  }
}

// ─── Process Single Notification ────────────────────────────────────────
async function processNotification(
  notification: QueuedNotification,
  resend: any,
  supabase: any,
  queueManager: NotificationQueueManager
): Promise<{ success: boolean; error?: string }> {
  console.log(`[PROCESSOR] Processing notification ${notification.id} (type: ${notification.type})`);

  try {
    // Mark as being processed
    await queueManager.markAsProcessing(notification.id);

    // Get user email
    const userEmail = await getUserEmail(supabase, notification.user_id);
    if (!userEmail) {
      await queueManager.markAsFailed(notification.id, 'User email not found');
      return { success: false, error: 'User email not found' };
    }

    // Generate email content
    const emailContent = await generateEmailContent(notification, userEmail);
    if (!emailContent) {
      await queueManager.markAsFailed(notification.id, 'Failed to generate email content');
      return { success: false, error: 'Failed to generate email content' };
    }

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: FROM_EMAIL,
      to: [userEmail],
      subject: emailContent.subject,
      html: emailContent.html,
    });

    if (emailResponse.error) {
      console.error(`[PROCESSOR] Email send failed for notification ${notification.id}:`, emailResponse.error);
      await queueManager.markAsFailed(notification.id, `Email send failed: ${emailResponse.error.message}`);
      return { success: false, error: emailResponse.error.message };
    }

    // Mark as successfully sent
    await queueManager.markAsSent(notification.id, userEmail);

    console.log(`[PROCESSOR] Successfully sent ${notification.type} email to ${userEmail} (notification: ${notification.id}, email: ${emailResponse.data?.id})`);
    return { success: true };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[PROCESSOR] Error processing notification ${notification.id}:`, error);

    // Mark as failed if we've hit max retries
    if (notification.attempts >= notification.max_attempts - 1) {
      await queueManager.markAsFailed(notification.id, `Max retries exceeded: ${errorMessage}`);
    }

    return { success: false, error: errorMessage };
  }
}

// ─── Main Processing Function ────────────────────────────────────────────
async function processNotificationQueue(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  errors: string[];
}> {
  console.log(`[PROCESSOR] Starting notification processing batch (max: ${BATCH_SIZE})`);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resendKey = Deno.env.get('RESEND_API_KEY');

  if (!resendKey) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const resend = new Resend(resendKey);
  const queueManager = new NotificationQueueManager(supabase);

  const stats = { processed: 0, sent: 0, failed: 0, errors: [] as string[] };

  try {
    // Get pending notifications
    const notifications = await queueManager.getPendingNotifications(BATCH_SIZE);

    if (notifications.length === 0) {
      console.log('[PROCESSOR] No pending notifications to process');
      return stats;
    }

    console.log(`[PROCESSOR] Found ${notifications.length} pending notifications`);

    // Process notifications in batches to avoid overwhelming email service
    const CONCURRENT_BATCH = 10;

    for (let i = 0; i < notifications.length; i += CONCURRENT_BATCH) {
      const batch = notifications.slice(i, i + CONCURRENT_BATCH);

      const batchPromises = batch.map(notification =>
        processNotification(notification, resend, supabase, queueManager)
      );

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        stats.processed++;

        if (result.status === 'fulfilled' && result.value.success) {
          stats.sent++;
        } else {
          stats.failed++;
          const error = result.status === 'fulfilled'
            ? result.value.error || 'Unknown error'
            : result.reason?.message || 'Promise rejected';
          stats.errors.push(`Notification ${batch[index].id}: ${error}`);
        }
      });

      // Small delay between batches to be nice to email service
      if (i + CONCURRENT_BATCH < notifications.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Cleanup old notifications periodically
    if (Math.random() < 0.1) { // 10% chance to run cleanup
      await queueManager.cleanupOldNotifications();
    }

  } catch (error) {
    console.error('[PROCESSOR] Critical error during processing:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown critical error';
    stats.errors.push(`Critical: ${errorMessage}`);
  }

  console.log(`[PROCESSOR] Batch complete: ${stats.sent} sent, ${stats.failed} failed, ${stats.processed} total`);
  return stats;
}

// ─── Edge Function Handler ───────────────────────────────────────────────
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check for GET requests
  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'notification-processor'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Main processing (POST requests or scheduled calls)
  try {
    const startTime = Date.now();
    const stats = await processNotificationQueue();
    const duration = Date.now() - startTime;

    const response = {
      success: true,
      stats,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    };

    console.log('[PROCESSOR] Completed batch:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[PROCESSOR] Critical error:', error);

    const errorResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});