import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

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
}

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get current subscription from enhanced subscriptions table
  const {
    data: currentSubscription,
    isLoading: subscriptionLoading,
    error: subscriptionError
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
      return data as EnhancedSubscription | null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get feature usage for current month
  const {
    data: featureUsage,
    isLoading: usageLoading
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

      return data.reduce((acc, item) => {
        acc[item.feature_name] = item.usage_count;
        return acc;
      }, {} as Record<string, number>);
    },
    enabled: !!user?.id,
    staleTime: 1 * 60 * 1000, // 1 minute
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
    onError: (error: any) => {
      toast.error('Failed to record usage', {
        description: error.message
      });
    }
  });

  // Check if user can access a feature
  const canAccess = (featureName: string): boolean => {
    if (!currentSubscription) return false;

    const limit = currentSubscription.feature_limits[featureName];
    if (limit === -1) return true; // Unlimited

    const usage = featureUsage?.[featureName] || 0;
    return usage < limit;
  };

  // Check if user is pro
  const isPro = currentSubscription?.tier === 'pro' ||
                currentSubscription?.tier === 'enterprise';

  // Get remaining usage for a feature
  const getRemainingUsage = (featureName: string): number => {
    if (!currentSubscription) return 0;

    const limit = currentSubscription.feature_limits[featureName];
    if (limit === -1) return Infinity;

    const usage = featureUsage?.[featureName] || 0;
    return Math.max(0, limit - usage);
  };

  return {
    // Data
    currentSubscription,
    featureUsage,

    // Loading states
    subscriptionLoading,
    usageLoading,
    isLoading: subscriptionLoading || usageLoading,

    // Errors
    subscriptionError,

    // Subscription info
    isPro,
    canAccess,
    getRemainingUsage,

    // Actions
    recordUsage: recordUsageMutation.mutateAsync,
    recordingUsage: recordUsageMutation.isPending,
  };
}
