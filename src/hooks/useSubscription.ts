import { useQuery } from "@tanstack/react-query";
import { getSubscription, UserSubscription, SubscriptionTier, checkAccess, Feature } from "@/lib/subscription";

export const useSubscription = () => {
    return {
        subscription,
        isLoading,
        error,
        refetch,
        canAccess,
        isPro: subscription?.tier === SubscriptionTier.PRO || subscription?.tier === SubscriptionTier.ENTERPRISE
    };
};
