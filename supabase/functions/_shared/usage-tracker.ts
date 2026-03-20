import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface UsageWarningCheck {
  shouldWarn: boolean;
  percentage: number;
  usage: number;
  limit: number;
  feature: string;
}

export async function checkUsageWarnings(
  userId: string,
  featureName: string,
  newUsage: number
): Promise<UsageWarningCheck | null> {
  try {
    // Get user's subscription and preferences
    const [subResult, prefsResult] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('feature_limits')
        .eq('user_id', userId)
        .single(),
      supabase.rpc('get_notification_preferences', { p_user_id: userId })
    ]);

    if (subResult.error || !subResult.data) {
      console.error('[USAGE_TRACKER] Failed to get subscription:', subResult.error);
      return null;
    }

    const featureLimits = subResult.data.feature_limits;
    const notificationPrefs = prefsResult.data;

    // Check if usage warnings are enabled
    if (!notificationPrefs?.usage_warnings?.enabled) {
      return null;
    }

    const limit = featureLimits[featureName];
    if (limit === -1) return null; // Unlimited

    const percentage = (newUsage / limit) * 100;
    const threshold = notificationPrefs.usage_warnings.threshold || 80;

    // Check if we should warn (crossing threshold for first time)
    const previousPercentage = ((newUsage - 1) / limit) * 100;
    const shouldWarn = percentage >= threshold && previousPercentage < threshold;

    if (shouldWarn) {
      // Check if we already warned for this period
      const { data: existingWarning } = await supabase
        .from('notification_history')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'usage_warning')
        .gte('sent_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
        .like('email_subject', `%${featureName}%`)
        .single();

      if (existingWarning) {
        return null; // Already warned recently
      }

      return {
        shouldWarn: true,
        percentage: Math.round(percentage),
        usage: newUsage,
        limit,
        feature: featureName
      };
    }

    return null;
  } catch (error) {
    console.error('[USAGE_TRACKER] Error checking usage warnings:', error);
    return null;
  }
}

export async function scheduleUsageWarning(
  userId: string,
  warningData: UsageWarningCheck
): Promise<void> {
  try {
    // Get user name for the notification
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const userName = authUser?.user?.user_metadata?.full_name || authUser?.user?.email || 'User';

    // Calculate reset date (first day of next month)
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const resetDate = nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    await supabase.rpc('schedule_notification', {
      p_user_id: userId,
      p_type: 'usage_warning',
      p_priority: 'medium',
      p_data: {
        usageWarning: {
          userName,
          featureName: warningData.feature,
          usagePercent: warningData.percentage,
          remaining: warningData.limit - warningData.usage,
          limit: warningData.limit,
          resetDate
        }
      }
    });

    console.log(`[USAGE_TRACKER] Scheduled usage warning for user ${userId}: ${warningData.feature} at ${warningData.percentage}%`);
  } catch (error) {
    console.error('[USAGE_TRACKER] Failed to schedule usage warning:', error);
  }
}