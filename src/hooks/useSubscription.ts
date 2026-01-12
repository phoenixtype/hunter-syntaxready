import { useQuery } from "@tanstack/react-query";
import { getSubscription, UserSubscription, SubscriptionTier, checkAccess } from "@/lib/subscription";

export const useSubscription = () => {
    // Basic subscription query
    const { data: subscription, isLoading, error } = useQuery<UserSubscription | null>({
        queryKey: ['subscription'],
        queryFn: () => getSubscription(),
        staleTime: 1000 * 60 * 5, // 5 minutes (subscriptions don't change often)
        refetchOnWindowFocus: false
    });

    // Helper to check feature access easily
    const canAccess = (feature: string) => {
        if (!subscription) return false;
        return checkAccess(feature); // Leverages the existing lib utility but could be moved here if needed
    };

    return {
        subscription,
        isLoading,
        error,
        canAccess,
        isPro: subscription?.tier === SubscriptionTier.PRO
    };
};
