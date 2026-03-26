// Paystack checkout component for Nigerian users
// Handles NGN payments and subscriptions

import { useState, useEffect } from 'react';
import { paystackClient, formatPrice, OVERAGE_RATES } from '@/lib/paystack-client';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, CheckCircle, X } from 'lucide-react';
import { toast } from 'sonner';

interface PaystackCheckoutProps {
  planName: 'pro' | 'enterprise' | 'starter' | 'growth';
  interval: 'monthly' | 'yearly';
  onSuccess?: (reference: string) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
  isOverage?: boolean;
  overageFeature?: string;
  overageQuantity?: number;
}

interface PaystackResponse {
  reference: string;
  status: string;
  trans: string;
  transaction: string;
  trxref: string;
}

declare global {
  interface Window {
    PaystackPop: {
      setup: (config: any) => {
        openIframe: () => void;
      };
    };
  }
}

export function PaystackCheckout({
  planName,
  interval,
  onSuccess,
  onError,
  onClose,
  isOverage = false,
  overageFeature,
  overageQuantity = 1
}: PaystackCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [planDetails, setPlanDetails] = useState<any>(null);
  const [amount, setAmount] = useState(0);

  const { user } = useAuth();


  // Load Paystack script
  useEffect(() => {
    if (!window.PaystackPop) {
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      script.onload = () => setScriptLoaded(true);
      script.onerror = () => {
        console.error('Failed to load Paystack script');
        toast.error('Failed to load payment system. Please disable adblockers or check connection.');
        onError?.('Failed to load payment system');
      };
      document.head.appendChild(script);
    } else {
      setScriptLoaded(true);
    }

    return () => {
      const script = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]');
      if (script) {
        document.head.removeChild(script);
      }
    };
  }, [onError]);

  // Load plan details
  useEffect(() => {
    async function loadPlanDetails() {
      try {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('name', isOverage ? 'free' : planName)
          .single();

        if (error) throw error;

        setPlanDetails(data);

        if (isOverage && overageFeature) {
          const rate = OVERAGE_RATES.ngn[overageFeature as keyof typeof OVERAGE_RATES.ngn];
          setAmount(rate * overageQuantity);
        } else {
          const price = interval === 'yearly' ? data.price_yearly_ngn : data.price_monthly_ngn;
          setAmount(price ?? 0);
        }
      } catch (error: any) {
        console.error('Failed to load plan details:', error);
        toast.error('Failed to load plan pricing details.');
        onError?.('Failed to load plan details');
      }
    }

    loadPlanDetails();
  }, [planName, interval, isOverage, overageFeature, overageQuantity, onError]);

  const handlePayment = async () => {
    if (!user || !scriptLoaded || !planDetails) {
      const msg = 'Payment system not ready. Please wait a moment.';
      toast.error(msg);
      onError?.(msg);
      return;
    }

    const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
    if (!paystackKey) {
      toast.error('Payment system is not configured. Please contact support.');
      onError?.('Paystack public key not configured');
      return;
    }

    setLoading(true);

    try {
      const reference = paystackClient.generateReference();

      const metadata = {
        user_id: user.id,
        plan_name: isOverage ? 'overage' : planName,
        interval: interval,
        feature: overageFeature,
        quantity: overageQuantity,
        custom_fields: [
          {
            display_name: 'User ID',
            variable_name: 'user_id',
            value: user.id
          }
        ]
      };

      if (isOverage && overageFeature) {
        const { error } = await supabase.rpc('purchase_overage_credits', {
          p_user_id: user.id,
          p_feature_name: overageFeature,
          p_quantity: overageQuantity,
          p_payment_intent_id: reference
        });

        if (error) throw error;
      }

      const paymentConfig = {
        key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '',
        email: user.email!,
        amount: paystackClient.convertNairaToKobo(amount),
        currency: 'NGN',
        reference: reference,
        metadata: metadata,
        callback: async function(response: PaystackResponse) {
          console.log('Payment callback received:', response);

          // Paystack inline popup only fires this callback after a successful charge.
          // Server-side verification happens in the paystack-webhook edge function.

          if (!isOverage) {
            const { error: subError } = await supabase
              .from('subscriptions')
              .upsert({
                user_id: user.id,
                tier: planName,
                status: 'active',
                payment_provider: 'paystack',
                currency: 'ngn',
                paystack_reference: response.reference,
                current_period_start: new Date().toISOString(),
                current_period_end: getNextPeriodEnd(interval).toISOString(),
                cancel_at_period_end: false
              });

            if (subError) {
              console.error('Failed to create subscription:', subError);
              onError?.('Payment successful but subscription setup failed');
              return;
            }
          } else {
            const { error: overageError } = await supabase
              .from('overage_purchases')
              .update({ status: 'succeeded' })
              .eq('stripe_payment_intent_id', reference)
              .eq('user_id', user.id);

            if (overageError) {
              console.error('Failed to update overage purchase:', overageError);
            }
          }

          onSuccess?.(response.reference);
          setLoading(false);
        },
        onClose: function() {
          console.log('Payment popup closed');
          setLoading(false);
          onClose?.();
        },
        onerror: function(error: any) {
          console.error('Payment error:', error);
          toast.error(error.message || 'Payment window closed or failed');
          onError?.(error.message || 'Payment failed');
          setLoading(false);
        }
      };

      const popup = window.PaystackPop.setup(paymentConfig);
      popup.openIframe();

    } catch (error: any) {
      console.error('Payment initialization failed:', error);
      toast.error(error.message || 'Failed to initialize payment window. Ensure popups are allowed.');
      onError?.(error.message || 'Failed to initialize payment');
      setLoading(false);
    }
  };

  const getNextPeriodEnd = (interval: string): Date => {
    const now = new Date();
    if (interval === 'yearly') {
      now.setFullYear(now.getFullYear() + 1);
    } else {
      // Per user request, non-yearly subscriptions are weekly
      now.setDate(now.getDate() + 7);
    }
    return now;
  };

  if (!planDetails || amount === 0) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading payment details...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 bg-background/60 backdrop-blur-sm overflow-y-auto pt-10 pb-10">
    <Card className="w-full max-w-md relative my-auto">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground rounded-md p-1"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <CreditCard className="h-5 w-5 mr-2" />
            {isOverage ? 'Purchase Credits' : `${planDetails.display_name}`}
          </CardTitle>
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            🇳🇬 NGN
          </Badge>
        </div>
        <CardDescription>
          {isOverage
            ? `Buy ${overageQuantity} ${overageFeature?.replace('_', ' ')} credits`
            : `${interval === 'yearly' ? 'Annual' : 'Weekly'} subscription`
          }
        </CardDescription>
      </CardHeader>
 
      <CardContent className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Amount:</span>
            <span className="text-2xl font-bold text-green-600">
              {formatPrice(amount, 'ngn')}
            </span>
          </div>
 
          {interval === 'yearly' && !isOverage && (
            <div className="mt-2 flex items-center text-sm text-green-600">
              <CheckCircle className="h-4 w-4 mr-1" />
              Save {formatPrice(amount * 12 / 10 - amount, 'ngn')} per year
            </div>
          )}
        </div>
 
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center">
            <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
            Secure payment with Paystack
          </div>
          <div className="flex items-center">
            <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
            Supports all Nigerian banks & cards
          </div>
          {!isOverage && (
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              Cancel anytime
            </div>
          )}
        </div>
 
        <Button
          onClick={handlePayment}
          disabled={loading || !scriptLoaded || !planDetails || !user}
          className="w-full bg-green-600 hover:bg-green-700"
          size="lg"
        >
          {loading || !planDetails ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <CreditCard className="h-4 w-4 mr-2" />
          )}
          {loading 
            ? 'Processing...' 
            : !planDetails 
              ? 'Loading pricing...' 
              : `Pay ${formatPrice(amount, 'ngn')}`
          }
        </Button>
 
        <div className="text-xs text-gray-500 text-center">
          By proceeding, you agree to Hunter AI's Terms of Service and Privacy Policy.
          Payments are processed securely by Paystack.
        </div>
      </CardContent>
    </Card>
    </div>
  );
}

export default PaystackCheckout;
