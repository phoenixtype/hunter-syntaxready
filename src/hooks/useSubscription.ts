import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { FeatureName, UsageOverview, OverageQuote, SubscriptionPlan } from '@/types/subscription';

interface EnhancedSubscription {
  id: string;
  user_id: string;
  tier: 'free' | 'pro' | 'enterprise';
  status: string;
  feature_limits: Record<string, number>;
  currency: 'usd' | 'ngn';
  payment_provider: 'stripe' | 'paystack';
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  paystack_subscription_code?: string;
  paystack_customer_code?: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
  subscription_plans?: SubscriptionPlan;
}

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get current subscription from enhanced subscriptions table
  const {
    data: currentSubscription,
    isLoading: subscriptionLoading,
    error: subscriptionError,
    refetch: refetchSubscription
  } = useQuery({
    queryKey: ['enhanced-subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as unknown as EnhancedSubscription | null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Get feature usage for current month
  const {
    data: featureUsage,
    isLoading: usageLoading,
    error: usageError
  } = useQuery({
    queryKey: ['feature-usage', user?.id],
    queryFn: async () => {
      if (!user?.id) return {};

      const { data, error } = await supabase
        .from('subscription_usage')
        .select('feature_name, usage_count')
        .eq('user_id', user.id)
        .eq('period_start', new Date().toISOString().slice(0, 7) + '-01');

      if (error) throw error;

      return data.reduce((acc: Record<string, number>, item: { feature_name: string; usage_count: number | null }) => {
        acc[item.feature_name] = item.usage_count ?? 0;
        return acc;
      }, {} as Record<string, number>);
    },
    enabled: !!user?.id,
    staleTime: 1 * 60 * 1000,
  });

  // Get subscription plans
  const {
    data: plans,
    isLoading: plansLoading
  } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return data as unknown as SubscriptionPlan[];
    },
    staleTime: 30 * 60 * 1000,
  });

  // Record usage mutation
  const recordUsageMutation = useMutation({
    mutationFn: async ({ featureName, count = 1 }: {
      featureName: string;
      count?: number;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase.rpc('record_feature_usage', {
        p_user_id: user.id,
        p_feature_name: featureName,
        p_usage_count: count
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-usage'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to record usage', {
        description: error.message
      });
    }
  });

  // Check if user can access a feature
  const canAccess = (featureName: string): boolean => {
    if (!currentSubscription) return false;

    const limit = currentSubscription.feature_limits?.[featureName];
    if (limit === undefined) return false;
    if (limit === -1) return true;

    const usage = featureUsage?.[featureName] || 0;
    return usage < limit;
  };

  // Check if user is pro
  const isPro = currentSubscription?.tier === 'pro' ||
                currentSubscription?.tier === 'enterprise';

  // Get remaining usage for a feature
  const getRemainingUsage = (featureName: string): number => {
    if (!currentSubscription) return 0;

    const limit = currentSubscription.feature_limits?.[featureName];
    if (limit === undefined) return 0;
    if (limit === -1) return Infinity;

    const usage = featureUsage?.[featureName] || 0;
    return Math.max(0, limit - usage);
  };

  // Build usage overview
  const usageOverview: UsageOverview | null = currentSubscription ? {
    plan_name: currentSubscription.tier,
    plan_display_name: currentSubscription.tier.charAt(0).toUpperCase() + currentSubscription.tier.slice(1),
    features: Object.entries(currentSubscription.feature_limits || {}).map(([name, limit]) => {
      const usage = featureUsage?.[name] || 0;
      const remaining = limit === -1 ? Infinity : Math.max(0, (limit as number) - usage);
      const percentage = limit === -1 ? 0 : (limit as number) > 0 ? Math.round((usage / (limit as number)) * 100) : 0;
      return {
        feature_name: name as FeatureName,
        display_name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        current_usage: usage,
        limit_amount: limit as number,
        remaining_amount: remaining === Infinity ? 999999 : remaining,
        usage_percentage: percentage,
        overage_credits: 0,
        can_use: limit === -1 || usage < (limit as number),
      };
    }),
    billing_period_start: currentSubscription.current_period_start || new Date().toISOString(),
    billing_period_end: currentSubscription.current_period_end || new Date().toISOString(),
  } : null;

  // Overage helpers (stubs for now)
  const getOverageQuote = async (featureName: FeatureName, quantity: number): Promise<OverageQuote> => {
    const { data, error } = await supabase.rpc('get_overage_rate', {
      p_user_id: user?.id || '',
      p_feature_name: featureName,
    });
    const unitPrice = (error || !data) ? 0.5 : Number(data);
    return {
      feature_name: featureName,
      quantity,
      unit_price: unitPrice,
      total_cost: unitPrice * quantity,
      expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
    };
  };

  const purchaseOverage = async ({ featureName, quantity, paymentIntentId }: {
    featureName: FeatureName;
    quantity: number;
    paymentIntentId: string;
  }) => {
    const { error } = await supabase.rpc('purchase_overage_credits', {
      p_user_id: user?.id || '',
      p_feature_name: featureName,
      p_quantity: quantity,
      p_payment_intent_id: paymentIntentId,
    });
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['feature-usage'] });
  };

  // Refetch helper that returns subscription data shape for consumers
  const refetch = async () => {
    const result = await refetchSubscription();
    return { data: result.data };
  };

  return {
    // Data
    currentSubscription,
    featureUsage,
    plans,
    usageOverview,

    // Loading states
    subscriptionLoading,
    usageLoading,
    plansLoading,
    isLoading: subscriptionLoading || usageLoading,

    // Errors
    subscriptionError,
    usageError,

    // Subscription info
    isPro,
    canAccess,
    getRemainingUsage,

    // Actions
    recordUsage: recordUsageMutation.mutateAsync,
    recordingUsage: recordUsageMutation.isPending,
    refetch,
    getOverageQuote,
    purchaseOverage,
  };
}
