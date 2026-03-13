import { useQuery } from "@tanstack/react-query";
import { getSubscription, UserSubscription, SubscriptionTier, checkAccess, Feature } from "@/lib/subscription";
import { useAuth } from "./useAuth";

export const useSubscription = () => {
    const { user } = useAuth();

    const { data: subscription, isLoading, error, refetch } = useQuery<UserSubscription>({
        queryKey: ["subscription", user?.id],
        queryFn: getSubscription,
        enabled: !!user,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: true, // pick up plan changes from Stripe portal
    });

    const canAccess = (feature: Feature): boolean => checkAccess(feature, subscription);

    return {
        subscription,
        isLoading,
        error,
        refetch,
        canAccess,
        isPro: subscription?.tier === SubscriptionTier.PRO || subscription?.tier === SubscriptionTier.ENTERPRISE,
    };
};
