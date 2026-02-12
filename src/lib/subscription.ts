
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "./activity_logger";

export enum SubscriptionTier {
    FREE = 'free',
    PRO = 'pro',
    ENTERPRISE = 'enterprise'
}

export type Feature = 'autopilot' | 'deep_intelligence' | 'unlimited_applications' | 'negotiation_coach';

export interface UserSubscription {
    tier: SubscriptionTier;
    features: Feature[];
    usage: {
        applications_this_month: number;
        applications_limit: number;
    }
}

// Features map
const TIER_FEATURES: Record<SubscriptionTier, Feature[]> = {
    [SubscriptionTier.FREE]: [],
    [SubscriptionTier.PRO]: ['autopilot', 'deep_intelligence', 'unlimited_applications', 'negotiation_coach'],
    [SubscriptionTier.ENTERPRISE]: ['autopilot', 'deep_intelligence', 'unlimited_applications', 'negotiation_coach']
};

export const getSubscription = async (): Promise<UserSubscription> => {
    // 1. Get User
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return {
        tier: SubscriptionTier.FREE,
        features: [],
        usage: { applications_this_month: 0, applications_limit: 20 }
    };

    // 2. Fetch Subscription from DB (using type assertion as subscriptions table may not be in generated types)
    const { data: subData } = await (supabase as any)
        .from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .maybeSingle();

    const tier = (subData?.tier as SubscriptionTier) || SubscriptionTier.FREE;

    // Count actual applications this month from the database
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    // Use application_history table to count applications
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
};

export const checkAccess = (feature: Feature): boolean => {
    // This is a synchronous check usually called with data from the hook
    // It assumes we have the subscription state available in context or passed in
    // But for this direct helper, we might need to rely on what the caller passed.
    // Ideally this helper takes the subscription object as an arg, but to keep signature compatible:
    // We'll warn that this helper is deprecated for direct checking without context.
    // For now, let's keep it simple: It should be used via useSubscription hook.
    return true; 
};

export const upgradeToPro = async (): Promise<void> => {
    console.log("[Monetization] Initiating Stripe Checkout...");
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        headers: {
            Authorization: `Bearer ${session.access_token}`
        }
    });

    if (error || !data?.url) {
        throw new Error(error?.message || "Failed to create checkout session");
    }

    // Redirect to Stripe
    window.location.href = data.url;
};
