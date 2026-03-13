import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "./activity_logger";

export enum SubscriptionTier {
    FREE = 'free',
    PRO = 'pro',
    ENTERPRISE = 'enterprise'
}

export type Feature = 'autopilot' | 'deep_intelligence' | 'unlimited_applications' | 'negotiation_coach' | 'sms_notifications';

export interface UserSubscription {
    tier: SubscriptionTier;
    features: Feature[];
    usage: {
        applications_this_month: number;
        applications_limit: number;
    }
}

const TIER_FEATURES: Record<SubscriptionTier, Feature[]> = {
    [SubscriptionTier.FREE]: [],
    [SubscriptionTier.PRO]: ['autopilot', 'deep_intelligence', 'unlimited_applications', 'negotiation_coach', 'sms_notifications'],
    [SubscriptionTier.ENTERPRISE]: ['autopilot', 'deep_intelligence', 'unlimited_applications', 'negotiation_coach', 'sms_notifications']
};

export const getSubscription = async (): Promise<UserSubscription> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return {
            tier: SubscriptionTier.FREE,
            features: [],
            usage: { applications_this_month: 0, applications_limit: 20 }
        };

        const { data: subData } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', session.user.id)
            .in('status', ['active', 'trialing'])
            .maybeSingle();

        const tier = (subData?.tier as SubscriptionTier) || SubscriptionTier.FREE;

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const { count: applicationsCount } = await supabase
            .from('application_history')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', session.user.id)
            .gte('applied_at', startOfMonth.toISOString());

        const usage = {
            applications_this_month: applicationsCount || 0,
            applications_limit: tier === SubscriptionTier.FREE ? 20 : 9999
        };

        return {
            tier,
            features: TIER_FEATURES[tier],
            usage
        };
    } catch (err) {
        console.error('Failed to fetch subscription:', err);
        return {
            tier: SubscriptionTier.FREE,
            features: [],
            usage: { applications_this_month: 0, applications_limit: 20 }
        };
    }
};

/**
 * Check if the current subscription includes a specific feature.
 * Must be called with subscription data from the useSubscription hook.
 */
export const checkAccess = (feature: Feature, subscription?: UserSubscription | null): boolean => {
    if (!subscription) return false;
    return subscription.features.includes(feature);
};

export const upgradeToPro = async (): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const { data, error } = await supabase.functions.invoke('create-checkout', {
        headers: {
            Authorization: `Bearer ${session.access_token}`
        }
    });

    if (error || !data?.url) {
        throw new Error(error?.message || "Failed to create checkout session");
    }

    window.location.href = data.url;
};
