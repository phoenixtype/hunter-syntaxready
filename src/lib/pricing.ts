export type PlanName = 'pro' | 'starter' | 'growth' | 'enterprise';
export type Currency = 'NGN' | 'USD';

interface PlanPricing {
  monthly: number;
  label: string;
  displayCurrency: string;
}

const PLANS: Record<PlanName, Record<Currency, PlanPricing>> = {
  pro: {
    USD: { monthly: 19.99, label: '$19.99/wk', displayCurrency: 'USD' },
    NGN: { monthly: 4999, label: '₦4,999/wk', displayCurrency: 'NGN' },
  },
  starter: {
    USD: { monthly: 79, label: '$79/mo', displayCurrency: 'CAD' },
    NGN: { monthly: 14999, label: '₦14,999/mo', displayCurrency: 'NGN' },
  },
  growth: {
    USD: { monthly: 199, label: '$199/mo', displayCurrency: 'CAD' },
    NGN: { monthly: 34999, label: '₦34,999/mo', displayCurrency: 'NGN' },
  },
  enterprise: {
    USD: { monthly: 0, label: 'Contact us', displayCurrency: '' },
    NGN: { monthly: 0, label: 'Contact us', displayCurrency: '' },
  },
};

export const OVERAGE_RATES_NGN: Record<string, number> = {
  job_applications: 500,
  resume_generations: 1250,
  ai_interviews: 2500,
  cover_letters: 375,
  job_matches: 125,
  company_research: 250,
  skill_assessments: 3750,
};

export function getPrice(plan: PlanName, currency: Currency): PlanPricing {
  return PLANS[plan][currency];
}

export function formatPriceByCurrency(amount: number, currency: Currency): string {
  if (currency === 'NGN') {
    return `₦${new Intl.NumberFormat('en-NG').format(amount)}`;
  }
  return `$${amount.toFixed(2)}`;
}

export function getPaymentBadge(isNigeria: boolean): string {
  return isNigeria ? 'Secure payments via Paystack' : 'Secure payments via Stripe';
}

export function getStartingPrice(currency: Currency): string {
  return currency === 'NGN' ? '₦14,999/mo' : '$79/mo';
}
