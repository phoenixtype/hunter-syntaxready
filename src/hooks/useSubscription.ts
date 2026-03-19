import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  SubscriptionPlan,
  UserSubscription,
  FeatureName,
  FeatureUsageCheck,
  UsageOverview,
  OverageQuote,
  FEATURE_DISPLAY_NAMES,
  FeatureUsageRequest,
} from '@/types/subscription';

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get available subscription plans
  const {
    data: plans,
    isLoading: plansLoading,
    error: plansError
  } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return data as SubscriptionPlan[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Get user's current subscription
  const {
    data: currentSubscription,
    isLoading: subscriptionLoading,
    error: subscriptionError
  } = useQuery({
    queryKey: ['user-subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as UserSubscription | null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get usage overview
  const {
    data: usageOverview,
    isLoading: usageLoading,
    error: usageError
  } = useQuery({
    queryKey: ['usage-overview', user?.id, currentSubscription?.plan_id],
    queryFn: async () => {
      if (!user?.id) return null;

      const currentPlan = currentSubscription?.subscription_plans ||
        plans?.find(p => p.name === 'free');

      if (!currentPlan) return null;

      const features: FeatureName[] = [
        'job_applications',
        'resume_generations',
        'ai_interviews',
        'cover_letters',
        'job_matches',
        'company_research',
        'skill_assessments'
      ];

      const usagePromises = features.map(async (feature) => {
        const { data, error } = await supabase
          .rpc('check_feature_usage_limit', {
            p_user_id: user.id,
            p_feature_name: feature,
            p_requested_count: 0
          });

        if (error) throw error;

        const result = data[0] as FeatureUsageCheck;
        const usagePercentage = result.limit_amount === -1
          ? 0
          : Math.min(100, (result.current_usage / result.limit_amount) * 100);

        return {
          feature_name: feature,
          display_name: FEATURE_DISPLAY_NAMES[feature],
          current_usage: result.current_usage,
          limit_amount: result.limit_amount,
          remaining_amount: result.remaining_amount,
          usage_percentage: usagePercentage,
          overage_credits: 0, // Will be calculated separately
          can_use: result.can_use,
        };
      });

      const featureUsage = await Promise.all(usagePromises);

      // Calculate billing period
      const periodStart = currentSubscription?.current_period_start ||
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const periodEnd = currentSubscription?.current_period_end ||
        new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString();

      return {
        plan_name: currentPlan.name,
        plan_display_name: currentPlan.display_name,
        features: featureUsage,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
      } as UsageOverview;
    },
    enabled: !!user?.id && !!plans,
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  // Check if user can use a feature
  const checkFeatureUsage = async (request: FeatureUsageRequest): Promise<FeatureUsageCheck> => {
    const { data, error } = await supabase
      .rpc('check_feature_usage_limit', {
        p_user_id: request.user_id,
        p_feature_name: request.feature_name,
        p_requested_count: request.requested_count || 1
      });

    if (error) throw error;
    return data[0] as FeatureUsageCheck;
  };

  // Record feature usage
  const recordUsageMutation = useMutation({
    mutationFn: async ({
      featureName,
      count = 1,
      metadata = {}
    }: {
      featureName: FeatureName;
      count?: number;
      metadata?: Record<string, any>
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .rpc('record_feature_usage', {
          p_user_id: user.id,
          p_feature_name: featureName,
          p_usage_count: count,
          p_metadata: metadata
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate usage queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['usage-overview'] });
    },
    onError: (error: any) => {
      toast.error('Failed to record usage', {
        description: error.message
      });
    }
  });

  // Purchase overage credits
  const purchaseOverageMutation = useMutation({
    mutationFn: async ({
      featureName,
      quantity,
      paymentIntentId
    }: {
      featureName: FeatureName;
      quantity: number;
      paymentIntentId: string;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .rpc('purchase_overage_credits', {
          p_user_id: user.id,
          p_feature_name: featureName,
          p_quantity: quantity,
          p_payment_intent_id: paymentIntentId
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usage-overview'] });
      toast.success('Overage credits purchased successfully!');
    },
    onError: (error: any) => {
      toast.error('Failed to purchase overage credits', {
        description: error.message
      });
    }
  });

  // Get overage quote
  const getOverageQuote = async (
    featureName: FeatureName,
    quantity: number
  ): Promise<OverageQuote> => {
    const currentPlan = currentSubscription?.subscription_plans ||
      plans?.find(p => p.name === 'free');

    if (!currentPlan) throw new Error('No subscription plan found');

    const unitPrice = currentPlan.overage_rates[featureName] || 0;
    const totalCost = quantity * unitPrice;

    return {
      feature_name: featureName,
      quantity,
      unit_price: unitPrice,
      total_cost: totalCost,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
    };
  };

  // Utility function to check if user can perform action
  const canUseFeature = async (featureName: FeatureName, count = 1): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const check = await checkFeatureUsage({
        user_id: user.id,
        feature_name: featureName,
        requested_count: count
      });
      return check.can_use;
    } catch (error) {
      console.error('Error checking feature usage:', error);
      return false;
    }
  };

  // Use feature with automatic usage recording
  const useFeature = async (
    featureName: FeatureName,
    count = 1,
    metadata = {}
  ): Promise<{ success: boolean; needsOverage?: FeatureUsageCheck }> => {
    if (!user?.id) return { success: false };

    try {
      // Check if user can use the feature
      const check = await checkFeatureUsage({
        user_id: user.id,
        feature_name: featureName,
        requested_count: count
      });

      if (check.can_use) {
        // Record the usage
        await recordUsageMutation.mutateAsync({ featureName, count, metadata });
        return { success: true };
      } else {
        // Return overage information
        return { success: false, needsOverage: check };
      }
    } catch (error) {
      console.error('Error using feature:', error);
      return { success: false };
    }
  };

  // Helper function to check if user is on Pro tier
  const isPro = currentSubscription?.subscription_plans?.name === 'pro' ||
                currentSubscription?.subscription_plans?.name === 'enterprise';

  // Helper function to check access to specific features
  const canAccess = (featureName: string): boolean => {
    if (!user?.id) return false;

    // Map feature names to our FeatureName type
    const featureMap: Record<string, FeatureName> = {
      'negotiation_coach': 'ai_interviews',
      'cover_letters': 'cover_letters',
      'job_applications': 'job_applications',
      'resume_generations': 'resume_generations',
      'company_research': 'company_research',
      'skill_assessments': 'skill_assessments'
    };

    const mappedFeature = featureMap[featureName];
    if (!mappedFeature) return false;

    // For Pro/Enterprise features, check subscription tier
    if (featureName === 'negotiation_coach') {
      return isPro;
    }

    // For other features, check if they have usage remaining
    const featureUsage = usageOverview?.features?.find(f => f.feature_name === mappedFeature);
    return featureUsage?.can_use ?? false;
  };

  return {
    // Data
    plans,
    currentSubscription,
    usageOverview,

    // Loading states
    plansLoading,
    subscriptionLoading,
    usageLoading,
    isLoading: plansLoading || subscriptionLoading || usageLoading,

    // Errors
    plansError,
    subscriptionError,
    usageError,

    // Subscription info
    isPro,
    canAccess,

    // Actions
    checkFeatureUsage,
    recordUsage: recordUsageMutation.mutateAsync,
    purchaseOverage: purchaseOverageMutation.mutateAsync,
    getOverageQuote,
    canUseFeature,
    useFeature,

    // Mutation states
    recordingUsage: recordUsageMutation.isPending,
    purchasingOverage: purchaseOverageMutation.isPending,
  };
}
