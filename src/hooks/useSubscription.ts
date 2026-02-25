import { useQuery } from "@tanstack/react-query";
import { getSubscription, UserSubscription, SubscriptionTier, checkAccess, Feature } from "@/lib/subscription";

export const useSubscription = () => {
    const { data: subscription, isLoading, error } = useQuery<UserSubscription | null>({
        queryKey: ['subscription'],
        queryFn: () => getSubscription(),
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false
    });

    const canAccess = (feature: Feature) => {
        return checkAccess(feature, subscription);
    };

    return {
        subscription,
        isLoading,
        error,
        canAccess,
        isPro: subscription?.tier === SubscriptionTier.PRO || subscription?.tier === SubscriptionTier.ENTERPRISE
    };
};
