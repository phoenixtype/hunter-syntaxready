
import { logActivity } from "./activity_logger";

export enum SubscriptionTier {
    FREE = 'free',
    PRO = 'pro',
    ENTERPRISE = 'enterprise'
}

export type Feature = 'autopilot' | 'deep_intelligence' | 'unlimited_applications' | 'negotiation_coach';

interface UserSubscription {
    tier: SubscriptionTier;
    features: Feature[];
    usage: {
        applications_this_month: number;
        applications_limit: number;
    }
}

// Mock Database State
let currentSubscription: UserSubscription = {
    tier: SubscriptionTier.FREE,
    features: [], // Free tier has basic features by default not listed here
    usage: {
        applications_this_month: 12,
        applications_limit: 20
    }
};

export const getSubscription = async (): Promise<UserSubscription> => {
    return { ...currentSubscription };
};

export const checkAccess = (feature: Feature): boolean => {
    if (currentSubscription.tier === SubscriptionTier.PRO || currentSubscription.tier === SubscriptionTier.ENTERPRISE) {
        return true;
    }
    // Free tier logic
    return false;
};

export const upgradeToPro = async (): Promise<boolean> => {
    console.log("[Monetization Agent] Initiating Stripe Checkout Session...");
    
    // Simulate payment flow
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    currentSubscription = {
        tier: SubscriptionTier.PRO,
        features: ['autopilot', 'deep_intelligence', 'unlimited_applications', 'negotiation_coach'],
        usage: {
            applications_this_month: currentSubscription.usage.applications_this_month,
            applications_limit: 9999
        }
    };
    
    console.log("[Monetization Agent] Upgrade Successful. Welcome to Pro.");
    
    // Trust Agent Logging
    logActivity('Monetization', 'Subscription Upgrade', 'User upgraded to PRO tier. Unlocked all agents.', 'success');
             
    return true;
};
