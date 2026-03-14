import { supabase } from "@/integrations/supabase/client";

export enum SubscriptionTier {
    FREE = 'free',
    PRO = 'pro',
    ENTERPRISE = 'enterprise'
}

export type Feature = 'autopilot' | 'deep_intelligence' | 'unlimited_applications' | 'negotiation_coach' | 'sms_notifications';

export interface UserSubscription {
    tier: SubscriptionTier;
    features: Feature[];
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string;
}

const TIER_FEATURES: Record<SubscriptionTier, Feature[]> = {
    [SubscriptionTier.FREE]: [],
    [SubscriptionTier.PRO]: ['autopilot', 'deep_intelligence', 'unlimited_applications', 'negotiation_coach', 'sms_notifications'],
    [SubscriptionTier.ENTERPRISE]: ['autopilot', 'deep_intelligence', 'unlimited_applications', 'negotiation_coach', 'sms_notifications']
};

const FREE_SUBSCRIPTION: UserSubscription = {
    tier: SubscriptionTier.FREE,
    features: [],
};

export const getSubscription = async (): Promise<UserSubscription> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return FREE_SUBSCRIPTION;

        // Query by user_id only — trust the `tier` column set by the webhook.
        // Previously filtered by status which would hide valid pro rows with status
        // 'incomplete', 'past_due', or any future Stripe status we haven't enumerated.
        const { data: subData, error } = await supabase
            .from('subscriptions')
            .select('tier, stripe_customer_id, stripe_subscription_id, cancel_at_period_end, current_period_end, status')
            .eq('user_id', session.user.id)
            .maybeSingle();

        if (error) {
            console.error('[getSubscription] DB error:', error.message);
            return FREE_SUBSCRIPTION;
        }

        // A canceled subscription has tier='free' written by the webhook,
        // so we read tier directly — no status filtering needed.
        const tier = (subData?.tier as SubscriptionTier) ?? SubscriptionTier.FREE;

        return {
            tier,
            features: TIER_FEATURES[tier],
            stripeCustomerId: subData?.stripe_customer_id ?? undefined,
            stripeSubscriptionId: subData?.stripe_subscription_id ?? undefined,
            cancelAtPeriodEnd: subData?.cancel_at_period_end ?? false,
            currentPeriodEnd: subData?.current_period_end ?? undefined,
        };
    } catch (err) {
        console.error('[getSubscription] Unexpected error:', err);
        return FREE_SUBSCRIPTION;
    }
};

/**
 * Check if a subscription includes a specific feature.
 */
export const checkAccess = (feature: Feature, subscription?: UserSubscription | null): boolean => {
    if (!subscription) return false;
    return subscription.features.includes(feature);
};

export const upgradeToPro = async (): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const { data, error } = await supabase.functions.invoke('create-checkout', {
        headers: { Authorization: `Bearer ${session.access_token}` }
    });

    if (error || !data?.url) {
        throw new Error(error?.message || "Failed to create checkout session");
    }

    window.location.href = data.url;
};

export const openBillingPortal = async (): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const { data, error } = await supabase.functions.invoke('create-portal', {
        headers: { Authorization: `Bearer ${session.access_token}` }
    });

    if (error || !data?.url) {
        throw new Error(error?.message || "Failed to open billing portal");
    }

    window.location.href = data.url;
};
