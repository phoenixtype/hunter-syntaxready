import { useState } from 'react';
import { Check, Loader2, Zap, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import SEOHead from '@/components/SEOHead';
import { useGeo } from '@/hooks/useGeo';
import { getPrice } from '@/lib/pricing';
import { PaystackCheckout } from '@/components/payment/PaystackCheckout';

const STARTER_PRICE_ID = import.meta.env.VITE_STRIPE_RECRUITER_STARTER_PRICE_ID || 'price_1TCh6SD543enPilsbw1iTJ3A';
const GROWTH_PRICE_ID  = import.meta.env.VITE_STRIPE_RECRUITER_GROWTH_PRICE_ID  || 'price_1TCh6fD543enPilsmDANdgi0';

interface Plan {
  id: string;
  priceId: string;
  name: string;
  price: number;
  description: string;
  icon: React.ElementType;
  features: string[];
  limits: string[];
  highlight?: boolean;
  badge?: string;
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    priceId: STARTER_PRICE_ID,
    name: 'Starter',
    price: 79,
    description: 'Everything you need to start hiring on Hunter.',
    icon: Building2,
    features: [
      '3 active job posts',
      '100 candidate profile views / month',
      'Applicant tracking & pipeline',
      'Candidate email notifications',
      'Basic analytics',
      'Email support',
    ],
    limits: [],
  },
  {
    id: 'growth',
    priceId: GROWTH_PRICE_ID,
    name: 'Growth',
    price: 199,
    description: 'Unlimited reach with AI-powered hiring tools.',
    icon: Zap,
    highlight: true,
    badge: 'Most popular',
    features: [
      'Unlimited active job posts',
      'Unlimited candidate searches',
      'AI-powered candidate matching',
      'Automated candidate outreach',
      'Advanced analytics & reports',
      'Priority support',
    ],
    limits: [],
  },
];

const RecruiterPricing = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const { isNigeria, currency } = useGeo();
  const [paystackPlan, setPaystackPlan] = useState<'starter' | 'growth' | null>(null);
  const starterPrice = getPrice('starter', currency);
  const growthPrice = getPrice('growth', currency);

  const handleCheckout = async (plan: Plan, planName: 'starter' | 'growth') => {
    if (isNigeria) {
      setPaystackPlan(planName);
      return;
    }

    setLoading(plan.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Please sign in first'); return; }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId: plan.priceId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error || !data?.url) {
        toast.error('Could not start checkout. Please try again.');
        return;
      }

      window.location.href = data.url;
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <SEOHead title="Recruiter Plans" path="/recruiter/pricing" />
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-16">
        <div className="text-center mb-12 max-w-xl">
          <h1 className="text-3xl font-bold tracking-tight mb-3">Simple, transparent pricing</h1>
          <p className="text-muted-foreground text-base">
            Post jobs, find candidates, and hire faster — all in one place.
            Cancel anytime. {currency === 'NGN' ? 'All prices in Nigerian Naira' : 'All prices in CAD'}.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-8 ${
                  plan.highlight
                    ? 'border-primary bg-primary/5 shadow-lg'
                    : 'border-border bg-card'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    {plan.badge}
                  </span>
                )}

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                  plan.highlight ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>

                <div className="mb-1">
                  <h2 className="text-xl font-bold">{plan.name}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                </div>

                <div className="mt-4 mb-6">
                  <span className="text-4xl font-bold">
                    {plan.id === 'starter' ? starterPrice.label.replace('/mo', '') : growthPrice.label.replace('/mo', '')}
                  </span>
                  <span className="text-muted-foreground text-sm ml-1">/ month</span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full h-11 font-semibold ${plan.highlight ? '' : 'variant-outline'}`}
                  variant={plan.highlight ? 'default' : 'outline'}
                  disabled={loading === plan.id}
                  onClick={() => handleCheckout(plan, plan.id as 'starter' | 'growth')}
                >
                  {loading === plan.id
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Redirecting…</>
                    : `Get ${plan.name}`}
                </Button>
              </div>
            );
          })}

          {/* Enterprise tier */}
          <div className="relative flex flex-col rounded-2xl border border-border bg-card p-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-muted text-foreground">
              <Building2 className="w-5 h-5" />
            </div>

            <div className="mb-1">
              <h2 className="text-xl font-bold">Enterprise</h2>
              <p className="text-sm text-muted-foreground mt-1">For large organizations</p>
            </div>

            <div className="mt-4 mb-6">
              <span className="text-4xl font-bold">Custom</span>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {[
                'Everything in Growth',
                'Dedicated account manager',
                'Custom integrations',
                'SLA & priority support',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <Button asChild className="w-full h-11 font-semibold" variant="outline">
              <a href="mailto:hello@usehunter.app">Contact Us</a>
            </Button>
          </div>
        </div>

        <p className="mt-8 text-xs text-muted-foreground text-center max-w-md">
          All plans include a 14-day free trial. No credit card required to start.
          By subscribing you agree to our Terms of Service.
        </p>

        {paystackPlan && (
          <PaystackCheckout
            planName={paystackPlan}
            interval="monthly"
            onClose={() => setPaystackPlan(null)}
          />
        )}
      </div>
    </>
  );
};

export default RecruiterPricing;
