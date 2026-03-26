import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface RecruiterSubscription {
  tier: string;
  status: string;
  current_period_end: string | null;
}

export function useRecruiterSubscription() {
  const { user, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<RecruiterSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('tier, status, current_period_end')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setSubscription(data as RecruiterSubscription);
        } else {
          setSubscription({ tier: 'free', status: 'inactive', current_period_end: null });
        }
      } catch (err) {
        console.error('[useRecruiterSubscription] Error:', err);
        setSubscription({ tier: 'free', status: 'inactive', current_period_end: null });
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [user, authLoading]);

  const isSubscribed = (subscription?.status === 'active' || subscription?.status === 'trialing') && 
    (subscription?.tier === 'pro' || subscription?.tier === 'enterprise');

  return { subscription, isSubscribed, loading };
}
