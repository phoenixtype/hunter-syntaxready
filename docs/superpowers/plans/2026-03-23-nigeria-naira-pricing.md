# Nigeria Naira Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nigerian users see PPP-adjusted Naira pricing across all surfaces and check out via Paystack, with IP-based auto-detection.

**Architecture:** Vercel serverless function detects country from `x-vercel-ip-country` header (fallback: Supabase edge function). A React `GeoProvider` context exposes `{ country, isNigeria, currency }` app-wide. A centralized `pricing.ts` config drives all price display. Checkout routes to Paystack (NGN) or Stripe (USD/CAD) based on geo.

**Tech Stack:** React 18, TypeScript, Vite, Supabase (Edge Functions / Deno), Vercel Serverless Functions, Paystack, Stripe

**Spec:** `docs/superpowers/specs/2026-03-23-nigeria-naira-pricing-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `api/detect-country.ts` | Vercel serverless function — reads `x-vercel-ip-country` header, returns country code |
| `supabase/functions/detect-country/index.ts` | Fallback edge function — reads `cf-ipcountry` header, returns country code |
| `src/lib/pricing.ts` | Centralized pricing config and `getPrice()` helper for all tiers/currencies |
| `src/hooks/useGeo.tsx` | `GeoProvider` context + `useGeo()` hook — dual-layer country detection |
| `supabase/migrations/20260323000001_naira_pricing_plans.sql` | DB migration: insert starter/growth plans, update NGN prices to PPP, fix get_overage_rate |

### Modified Files
| File | Change Summary |
|------|---------------|
| `src/App.tsx` | Wrap with `GeoProvider` |
| `src/lib/subscription.ts` | Add STARTER/GROWTH to enum, make `upgradeToPro()` + `openBillingPortal()` geo-aware |
| `src/lib/paystack-client.ts` | PPP overage rates, recruiter plans in `ensureSubscriptionPlans()`, simplify detection functions |
| `src/components/ProGate.tsx` | Dynamic pricing display + Paystack checkout for Nigeria |
| `src/components/auth/SubscriptionGate.tsx` | Geo-conditional "Secure via" text |
| `src/pages/recruiter/RecruiterPricing.tsx` | NGN prices, Enterprise tier card, Paystack checkout routing |
| `src/pages/recruiter/RecruiterDashboard.tsx` | Dynamic "Starting at" pricing text |
| `src/pages/Index.tsx` | Geo-conditional trust badge |
| `src/components/subscription/SubscriptionSettings.tsx` | NGN plan prices, geo-aware billing portal |
| `src/components/subscription/OverageModal.tsx` | PPP-adjusted NGN overage rates |
| `src/components/subscription/UsageGuard.tsx` | Currency-aware formatting |
| `src/components/payment/PaystackCheckout.tsx` | Expand planName type for starter/growth, add onClose prop |
| `src/pages/Dashboard.tsx` | Make upgradeToPro() call geo-aware |
| `supabase/functions/stripe-webhook/index.ts` | Rename recruiter_starter/growth to starter/growth |
| `supabase/functions/_shared/email-templates.ts` | Update NGN price references |
| `src/tests/email-templates.test.ts` | Update NGN test expectations |
| `.env.example` | Fix NEXT_PUBLIC_ to VITE_ prefix |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260323000001_naira_pricing_plans.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Insert recruiter plan rows
INSERT INTO subscription_plans (name, display_name, price_monthly, price_yearly, price_monthly_ngn, price_yearly_ngn, feature_limits, overage_rates)
VALUES
  ('starter', 'Recruiter Starter', 79.00, 790.00, 14999, 149990,
   '{"active_job_posts": 3, "candidate_views": 100}'::jsonb,
   '{"active_job_posts": 2.00, "candidate_views": 0.50}'::jsonb),
  ('growth', 'Recruiter Growth', 199.00, 1990.00, 34999, 349990,
   '{"active_job_posts": -1, "candidate_views": -1}'::jsonb,
   '{"active_job_posts": 0, "candidate_views": 0}'::jsonb);

-- Update existing Pro plan NGN prices (PPP-adjusted from 32000 to 4999)
UPDATE subscription_plans SET price_monthly_ngn = 4999, price_yearly_ngn = 49990
WHERE name = 'pro';

-- Update overage_rates JSONB with PPP-adjusted NGN values for all plans
UPDATE subscription_plans SET overage_rates = overage_rates || '{
  "job_applications_ngn": 500,
  "resume_generations_ngn": 1250,
  "ai_interviews_ngn": 2500,
  "cover_letters_ngn": 375,
  "job_matches_ngn": 125,
  "company_research_ngn": 250,
  "skill_assessments_ngn": 3750
}'::jsonb
WHERE name IN ('free', 'pro', 'enterprise', 'starter', 'growth');

-- Fix get_overage_rate function: replace 1600x fallback with PPP ratio (250x)
-- Must DROP first because we cannot change the parameter signature with CREATE OR REPLACE
DROP FUNCTION IF EXISTS get_overage_rate(UUID, TEXT);

CREATE FUNCTION get_overage_rate(
    p_user_id UUID,
    p_feature_name TEXT
) RETURNS DECIMAL AS $$
DECLARE
    user_tier TEXT;
    user_currency TEXT;
    overage_key TEXT;
    rate DECIMAL;
BEGIN
    -- Get user's subscription info
    SELECT s.tier, s.currency INTO user_tier, user_currency
    FROM subscriptions s
    WHERE s.user_id = p_user_id AND s.status = 'active';

    -- Default to free plan and USD if no subscription
    IF user_tier IS NULL THEN
        user_tier := 'free';
        user_currency := 'usd';
    END IF;

    -- Determine the overage rate key based on currency
    overage_key := CASE
        WHEN user_currency = 'ngn' THEN p_feature_name || '_ngn'
        ELSE p_feature_name
    END;

    -- Get the overage rate
    SELECT (sp.overage_rates->>overage_key)::DECIMAL INTO rate
    FROM subscription_plans sp
    WHERE sp.name = user_tier;

    -- Fallback: PPP ratio (250x) instead of old exchange rate (1600x)
    IF rate IS NULL AND user_currency = 'ngn' THEN
        SELECT (sp.overage_rates->>p_feature_name)::DECIMAL * 250 INTO rate
        FROM subscription_plans sp
        WHERE sp.name = user_tier;
    END IF;

    RETURN COALESCE(rate, 0);
END;
$$ LANGUAGE plpgsql STABLE;
```

- [ ] **Step 2: Apply migration locally**

Run: `supabase db reset`
Expected: Migration applies without errors, `subscription_plans` has 5 rows (free, pro, enterprise, starter, growth).

- [ ] **Step 3: Verify data**

Run: `supabase db query "SELECT name, price_monthly_ngn, price_yearly_ngn FROM subscription_plans ORDER BY name;"`
Expected:
```
enterprise | (existing) | (existing)
free       | (existing) | (existing)
growth     | 34999      | 349990
pro        | 4999       | 49990
starter    | 14999      | 149990
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260323000001_naira_pricing_plans.sql
git commit -m "feat(db): add recruiter plans and PPP-adjusted NGN pricing"
```

---

## Task 2: Centralized Pricing Config

**Files:**
- Create: `src/lib/pricing.ts`

- [ ] **Step 1: Create pricing.ts**

```typescript
export type PlanName = 'pro' | 'starter' | 'growth' | 'enterprise';
export type Currency = 'NGN' | 'USD';

interface PlanPricing {
  monthly: number;
  label: string;        // e.g. "$19.99/mo" or "₦4,999/mo"
  displayCurrency: string; // "USD", "CAD", "NGN"
}

const PLANS: Record<PlanName, Record<Currency, PlanPricing>> = {
  pro: {
    USD: { monthly: 19.99, label: '$19.99/mo', displayCurrency: 'USD' },
    NGN: { monthly: 4999, label: '₦4,999/mo', displayCurrency: 'NGN' },
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors from `pricing.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pricing.ts
git commit -m "feat: add centralized pricing config with NGN PPP rates"
```

---

## Task 3: Country Detection — Vercel Serverless Function

**Files:**
- Create: `api/detect-country.ts`

- [ ] **Step 0: Install @vercel/node types**

Run: `npm install -D @vercel/node`
Expected: Package installs successfully.

- [ ] **Step 1: Create api directory and serverless function**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const country = req.headers['x-vercel-ip-country'] as string || '';

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ country_code: country.toUpperCase() || 'US' });
}
```

- [ ] **Step 2: Verify vercel.json already excludes /api/ from SPA rewrites**

Read `vercel.json` and confirm the rewrite rule `/((?!api/).*)` exists (it does — line 3). No changes needed.

- [ ] **Step 3: Commit**

```bash
git add api/detect-country.ts
git commit -m "feat: add Vercel serverless function for country detection"
```

---

## Task 4: Country Detection — Supabase Edge Function (Fallback)

**Files:**
- Create: `supabase/functions/detect-country/index.ts`

- [ ] **Step 1: Create edge function**

```typescript
import { corsHeaders } from '../_shared/cors.ts'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 10;
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const ip = getClientIp(req);

  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Primary: Cloudflare header (Supabase runs behind CF)
  const countryCode = req.headers.get('cf-ipcountry')?.toUpperCase() || '';

  return new Response(
    JSON.stringify({ country_code: countryCode || 'US' }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
});
```

- [ ] **Step 2: Test locally**

Run: `supabase functions serve detect-country --no-verify-jwt`
Then in another terminal: `curl -H "cf-ipcountry: NG" http://localhost:54321/functions/v1/detect-country`
Expected: `{"country_code":"NG"}`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/detect-country/index.ts
git commit -m "feat: add detect-country edge function as geo fallback"
```

---

## Task 5: GeoProvider Context + useGeo Hook

**Files:**
- Create: `src/hooks/useGeo.tsx`
- Modify: `src/App.tsx:142` (wrap with GeoProvider)

- [ ] **Step 1: Create useGeo.tsx**

```tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Currency = 'NGN' | 'USD';

interface GeoContextValue {
  country: string;
  isNigeria: boolean;
  currency: Currency;
  isLoading: boolean;
}

const GeoContext = createContext<GeoContextValue>({
  country: '',
  isNigeria: false,
  currency: 'USD',
  isLoading: true,
});

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

async function detectCountry(): Promise<string> {
  // 1. Check cached cookie
  const cached = getCookie('hunter-country');
  if (cached) return cached;

  // 2. Try Vercel serverless function
  try {
    const res = await fetch('/api/detect-country');
    if (res.ok) {
      const { country_code } = await res.json();
      if (country_code) {
        setCookie('hunter-country', country_code, 1);
        return country_code;
      }
    }
  } catch {
    // Vercel function unavailable, try fallback
  }

  // 3. Fallback: Supabase edge function
  try {
    const { data, error } = await supabase.functions.invoke('detect-country');
    if (!error && data?.country_code) {
      setCookie('hunter-country', data.country_code, 1);
      return data.country_code;
    }
  } catch {
    // Both detection methods failed
  }

  // 4. Default
  return 'US';
}

export function GeoProvider({ children }: { children: ReactNode }) {
  const [country, setCountry] = useState<string>(() => getCookie('hunter-country') || '');
  const [isLoading, setIsLoading] = useState(!getCookie('hunter-country'));

  useEffect(() => {
    if (country) return; // Already resolved from cookie
    detectCountry().then((code) => {
      setCountry(code);
      setIsLoading(false);
    });
  }, [country]);

  const isNigeria = country === 'NG';
  const currency: Currency = isNigeria ? 'NGN' : 'USD';

  return (
    <GeoContext.Provider value={{ country, isNigeria, currency, isLoading }}>
      {children}
    </GeoContext.Provider>
  );
}

export function useGeo() {
  return useContext(GeoContext);
}
```

- [ ] **Step 2: Wrap App with GeoProvider**

In `src/App.tsx`, add import and wrap inside `<AuthProvider>`:

```tsx
// Add import at top:
import { GeoProvider } from "@/hooks/useGeo";

// At line 142, wrap AuthProvider's children with GeoProvider:
<AuthProvider>
  <GeoProvider>
    <AppInitializer />
    {/* ... rest of children ... */}
    <BottomNavigation />
  </GeoProvider>
</AuthProvider>
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new type errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useGeo.tsx src/App.tsx
git commit -m "feat: add GeoProvider context with dual-layer country detection"
```

---

## Task 6: Update Subscription Types & Routing

**Files:**
- Modify: `src/lib/subscription.ts:3-7` (enum), `src/lib/subscription.ts:20-24` (TIER_FEATURES), `src/lib/subscription.ts:76-90` (upgradeToPro), `src/lib/subscription.ts:92-105` (openBillingPortal)

- [ ] **Step 1: Add STARTER and GROWTH to SubscriptionTier enum**

At `src/lib/subscription.ts:3-7`, add to the enum:

```typescript
export enum SubscriptionTier {
  FREE = 'free',
  PRO = 'pro',
  STARTER = 'starter',
  GROWTH = 'growth',
  ENTERPRISE = 'enterprise',
}
```

- [ ] **Step 2: Add STARTER/GROWTH to TIER_FEATURES map**

At `src/lib/subscription.ts:20-24`, add entries:

```typescript
[SubscriptionTier.STARTER]: ['active_job_posts', 'candidate_views'],
[SubscriptionTier.GROWTH]: ['active_job_posts', 'candidate_views'],
```

- [ ] **Step 3: Make upgradeToPro() geo-aware**

At `src/lib/subscription.ts:76-90`, modify `upgradeToPro` to accept a `paymentProvider` parameter. When provider is `'paystack'`, skip the Stripe edge function call and return a signal for the caller to show PaystackCheckout instead:

```typescript
export async function upgradeToPro(paymentProvider: 'stripe' | 'paystack' = 'stripe') {
  if (paymentProvider === 'paystack') {
    // Return a signal — caller shows PaystackCheckout component
    return { provider: 'paystack' as const };
  }

  // Existing Stripe flow
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { priceId: import.meta.env.VITE_STRIPE_PRO_PRICE_ID }
  });
  if (error) throw error;
  if (data?.url) {
    window.location.href = data.url;
  }
  return { provider: 'stripe' as const };
}
```

- [ ] **Step 4: Make openBillingPortal() geo-aware**

At `src/lib/subscription.ts:92-105`, check the subscription's `payment_provider` before routing:

```typescript
export async function openBillingPortal() {
  const subscription = await getSubscription();

  if (subscription?.payment_provider === 'paystack') {
    // Paystack doesn't have a customer portal — navigate to settings page
    window.location.href = '/settings?tab=billing';
    return;
  }

  // Existing Stripe portal flow
  const { data, error } = await supabase.functions.invoke('create-portal');
  if (error) throw error;
  if (data?.url) {
    window.location.href = data.url;
  }
}
```

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/subscription.ts
git commit -m "feat: add starter/growth tiers and geo-aware checkout routing"
```

---

## Task 7: Update Paystack Client

**Files:**
- Modify: `src/lib/paystack-client.ts:134-178` (ensureSubscriptionPlans), `src/lib/paystack-client.ts:185-202` (detection functions), `src/lib/paystack-client.ts:221-240` (OVERAGE_RATES)

- [ ] **Step 1: Update OVERAGE_RATES.ngn to PPP values**

At `src/lib/paystack-client.ts:221-240`, replace the NGN overage rates:

```typescript
ngn: {
  job_applications: 500,
  resume_generations: 1250,
  ai_interviews: 2500,
  cover_letters: 375,
  job_matches: 125,
  company_research: 250,
  skill_assessments: 3750,
}
```

- [ ] **Step 2: Update ensureSubscriptionPlans() prices**

At `src/lib/paystack-client.ts:134-178`, update:
- Pro Monthly: `32000` → `4999` (in kobo: `499900`)
- Pro Yearly: `320000` → `49990` (in kobo: `4999000`)
- Enterprise Monthly: `160000` → keep or adjust
- Add Starter Monthly: `14999` (in kobo: `1499900`)
- Add Starter Yearly: `149990` (in kobo: `14999000`)
- Add Growth Monthly: `34999` (in kobo: `3499900`)
- Add Growth Yearly: `349990` (in kobo: `34999000`)

- [ ] **Step 3: Simplify detectPaymentProvider()**

At `src/lib/paystack-client.ts:185-197`, replace:

```typescript
export function detectPaymentProvider(countryCode: string): 'stripe' | 'paystack' {
  return countryCode === 'NG' ? 'paystack' : 'stripe';
}
```

- [ ] **Step 4: Simplify detectCurrency()**

At `src/lib/paystack-client.ts:200-202`, replace:

```typescript
export function detectCurrency(countryCode: string): 'usd' | 'ngn' {
  return countryCode === 'NG' ? 'ngn' : 'usd';
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/paystack-client.ts
git commit -m "feat: update paystack client with PPP rates and recruiter plans"
```

---

## Task 8: Update PaystackCheckout Component

**Files:**
- Modify: `src/components/payment/PaystackCheckout.tsx:15` (planName type)

- [ ] **Step 1: Expand planName type and add onClose prop**

At `src/components/payment/PaystackCheckout.tsx:14-22`, update the interface:

```typescript
interface PaystackCheckoutProps {
  planName: 'pro' | 'enterprise' | 'starter' | 'growth';
  interval: 'monthly' | 'yearly';
  onSuccess?: (reference: string) => void;
  onError?: (error: string) => void;
  onClose?: () => void;       // Called when user dismisses checkout
  isOverage?: boolean;
  overageFeature?: string;
  overageQuantity?: number;
}
```

Also add `onClose` handling in the component — call `props.onClose?.()` when the Paystack popup is closed without payment.

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/payment/PaystackCheckout.tsx
git commit -m "feat: expand PaystackCheckout to support recruiter plan tiers"
```

---

## Task 9: Update ProGate — Dynamic Pricing + Paystack Routing

**Files:**
- Modify: `src/components/ProGate.tsx:108` (price), `src/components/ProGate.tsx:122` (Stripe text), `src/components/ProGate.tsx:36-43` (handler)

- [ ] **Step 1: Add imports**

At top of `src/components/ProGate.tsx`, add:

```typescript
import { useGeo } from '@/hooks/useGeo';
import { getPrice, getPaymentBadge } from '@/lib/pricing';
import PaystackCheckout from '@/components/payment/PaystackCheckout';
```

- [ ] **Step 2: Use geo context and manage Paystack checkout state**

Inside the component, add:

```typescript
const { isNigeria, currency } = useGeo();
const [showPaystack, setShowPaystack] = useState(false);
const priceLabel = getPrice('pro', currency).label;
const paymentBadge = getPaymentBadge(isNigeria);
```

- [ ] **Step 3: Update handleUpgrade**

Modify the upgrade handler to check payment provider:

```typescript
const handleUpgrade = async () => {
  if (isNigeria) {
    setShowPaystack(true);
    return;
  }
  // existing Stripe flow
  await upgradeToPro('stripe');
};
```

- [ ] **Step 4: Replace hardcoded price and Stripe text**

At line 108, replace `$19.99/mo` with `{priceLabel}`.
At line 122, replace `Secure checkout via Stripe` with `{paymentBadge}`.

Add PaystackCheckout conditional render:

```tsx
{showPaystack && (
  <PaystackCheckout
    planName="pro"
    interval="monthly"
    onClose={() => setShowPaystack(false)}
  />
)}
```

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProGate.tsx
git commit -m "feat: dynamic pricing and Paystack routing in ProGate"
```

---

## Task 10: Update SubscriptionGate

**Files:**
- Modify: `src/components/auth/SubscriptionGate.tsx:113`

- [ ] **Step 1: Add imports and geo context**

```typescript
import { useGeo } from '@/hooks/useGeo';
import { getPaymentBadge } from '@/lib/pricing';
// Inside component:
const { isNigeria } = useGeo();
```

- [ ] **Step 2: Replace Stripe text**

At line 113, replace `Cancel anytime • Secure checkout via Stripe` with:

```tsx
Cancel anytime • {getPaymentBadge(isNigeria)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/SubscriptionGate.tsx
git commit -m "feat: geo-conditional payment badge in SubscriptionGate"
```

---

## Task 10b: Update Dashboard — Geo-Aware Upgrade

**Files:**
- Modify: `src/pages/Dashboard.tsx:216` (upgradeToPro call)

- [ ] **Step 1: Add imports and geo-aware upgrade**

```typescript
import { useGeo } from '@/hooks/useGeo';
import PaystackCheckout from '@/components/payment/PaystackCheckout';
// Inside component:
const { isNigeria } = useGeo();
const [showPaystack, setShowPaystack] = useState(false);
```

At line 216, update the `upgradeToPro()` call to check `isNigeria`:

```typescript
onClick={() => {
  if (isNigeria) {
    setShowPaystack(true);
  } else {
    upgradeToPro('stripe');
  }
}}
```

Add PaystackCheckout conditional render near the button:

```tsx
{showPaystack && (
  <PaystackCheckout
    planName="pro"
    interval="monthly"
    onClose={() => setShowPaystack(false)}
  />
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: geo-aware upgrade prompt on Dashboard"
```

---

## Task 11: Update RecruiterPricing — NGN Prices + Enterprise Tier

**Files:**
- Modify: `src/pages/recruiter/RecruiterPricing.tsx:8-9` (price IDs stay), `src/pages/recruiter/RecruiterPricing.tsx:29,46` (prices), `src/pages/recruiter/RecruiterPricing.tsx:66-88` (checkout handler)

- [ ] **Step 1: Add imports**

```typescript
import { useGeo } from '@/hooks/useGeo';
import { getPrice } from '@/lib/pricing';
import PaystackCheckout from '@/components/payment/PaystackCheckout';
```

- [ ] **Step 2: Use geo context**

Inside component:

```typescript
const { isNigeria, currency } = useGeo();
const [paystackPlan, setPaystackPlan] = useState<'starter' | 'growth' | null>(null);
const starterPrice = getPrice('starter', currency);
const growthPrice = getPrice('growth', currency);
```

- [ ] **Step 3: Replace hardcoded prices**

Replace `$79` with `{starterPrice.label}` and `$199` with `{growthPrice.label}`.
Replace "All prices in CAD" with:

```tsx
{currency === 'NGN' ? 'All prices in Nigerian Naira' : 'All prices in CAD'}
```

- [ ] **Step 4: Update checkout handler for geo-routing**

```typescript
const handleCheckout = async (priceId: string, planName: 'starter' | 'growth') => {
  if (isNigeria) {
    setPaystackPlan(planName);
    return;
  }
  // Existing Stripe checkout flow
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { priceId }
  });
  if (error) throw error;
  if (data?.url) window.location.href = data.url;
};
```

- [ ] **Step 5: Add Enterprise tier card**

After the Growth card, add an Enterprise card:

```tsx
<Card className="border-2 border-muted">
  <CardHeader>
    <CardTitle>Enterprise</CardTitle>
    <div className="text-3xl font-bold">Custom</div>
    <p className="text-muted-foreground">For large organizations</p>
  </CardHeader>
  <CardContent>
    <ul className="space-y-2 mb-6">
      <li>Everything in Growth</li>
      <li>Dedicated account manager</li>
      <li>Custom integrations</li>
      <li>SLA & priority support</li>
    </ul>
    <Button asChild className="w-full" variant="outline">
      <a href="mailto:hello@usehunter.app">Contact Us</a>
    </Button>
  </CardContent>
</Card>
```

- [ ] **Step 6: Add PaystackCheckout conditional**

```tsx
{paystackPlan && (
  <PaystackCheckout
    planName={paystackPlan}
    interval="monthly"
    onClose={() => setPaystackPlan(null)}
  />
)}
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/recruiter/RecruiterPricing.tsx
git commit -m "feat: NGN pricing, Enterprise tier, and Paystack routing for recruiter"
```

---

## Task 12: Update RecruiterDashboard

**Files:**
- Modify: `src/pages/recruiter/RecruiterDashboard.tsx`

- [ ] **Step 1: Add imports and dynamic pricing text**

```typescript
import { useGeo } from '@/hooks/useGeo';
import { getStartingPrice } from '@/lib/pricing';
// Inside component:
const { currency } = useGeo();
```

Replace any "Starting at $79/mo" text with `Starting at ${getStartingPrice(currency)}`.

- [ ] **Step 2: Commit**

```bash
git add src/pages/recruiter/RecruiterDashboard.tsx
git commit -m "feat: dynamic recruiter pricing text on dashboard"
```

---

## Task 13: Update Index Page Trust Badges

**Files:**
- Modify: `src/pages/Index.tsx:43`

- [ ] **Step 1: Make trust badge dynamic**

The `TRUST_BADGES` array is a static constant. Since `useGeo()` is a hook (can't use in constant), move it inline or make the component read from geo:

```typescript
import { useGeo } from '@/hooks/useGeo';
import { getPaymentBadge } from '@/lib/pricing';

// Inside component:
const { isNigeria } = useGeo();
const trustBadges = ["Cancel anytime", getPaymentBadge(isNigeria), "Built for serious job seekers"];
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Index.tsx
git commit -m "feat: geo-conditional trust badge on landing page"
```

---

## Task 14: Update Subscription Settings, OverageModal, UsageGuard

**Files:**
- Modify: `src/components/subscription/SubscriptionSettings.tsx:78-82`
- Modify: `src/components/subscription/OverageModal.tsx:102-108`
- Modify: `src/components/subscription/UsageGuard.tsx:268`

- [ ] **Step 1: SubscriptionSettings — Add NGN price display**

Import `useGeo` and use currency to format plan prices:

```typescript
import { useGeo } from '@/hooks/useGeo';
// Inside component:
const { currency, isNigeria } = useGeo();
```

Update `formatPrice` function (lines 78-82) to use currency-aware formatting. When `isNigeria`, display the `price_monthly_ngn` from the plan data.

- [ ] **Step 2: OverageModal — Use PPP-adjusted rates**

Import `useGeo` and `OVERAGE_RATES_NGN` from pricing:

```typescript
import { useGeo } from '@/hooks/useGeo';
import { OVERAGE_RATES_NGN, formatPriceByCurrency } from '@/lib/pricing';
```

Update `formatCurrency` function (lines 102-108) to check currency:

```typescript
const formatCurrency = (amount: number) => {
  if (currency === 'NGN') {
    return `₦${new Intl.NumberFormat('en-NG').format(amount)}`;
  }
  return `$${amount.toFixed(2)}`;
};
```

- [ ] **Step 3: UsageGuard — Replace hardcoded $ prefix**

At line 268, replace:

```typescript
// From:
`$${usageCheck.overage_cost.toFixed(2)}`
// To:
formatPriceByCurrency(usageCheck.overage_cost, currency)
```

Import `useGeo` and `formatPriceByCurrency` at top.

- [ ] **Step 4: Commit**

```bash
git add src/components/subscription/SubscriptionSettings.tsx src/components/subscription/OverageModal.tsx src/components/subscription/UsageGuard.tsx
git commit -m "feat: currency-aware pricing in subscription settings and overage UI"
```

---

## Task 15: Update Stripe Webhook Tier Mapping

**Files:**
- Modify: `supabase/functions/stripe-webhook/index.ts:124-132`

- [ ] **Step 1: Update tier names**

At lines 129-130, change:

```typescript
// From:
if (priceId === starterPriceId) return 'recruiter_starter';
if (priceId === growthPriceId) return 'recruiter_growth';
// To:
if (priceId === starterPriceId) return 'starter';
if (priceId === growthPriceId) return 'growth';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "fix: use canonical tier names starter/growth in Stripe webhook"
```

---

## Task 16: Update Email Templates & Tests

**Files:**
- Modify: `supabase/functions/_shared/email-templates.ts` (if NGN price hardcoded)
- Modify: `src/tests/email-templates.test.ts:54`

- [ ] **Step 1: Check email template for hardcoded prices**

Read `supabase/functions/_shared/email-templates.ts` and update any hardcoded 32,000 NGN references. The `formatCurrency` function (lines 59-64) is dynamic and should work with the new amounts automatically. Only update if there are hardcoded values.

- [ ] **Step 2: Update test expectations**

At `src/tests/email-templates.test.ts:54`, change:

```typescript
// From:
amount: 32000  // and expect '32,000'
// To:
amount: 4999   // and expect '4,999'
```

- [ ] **Step 3: Run tests**

Run: `npm test -- --run src/tests/email-templates.test.ts`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/email-templates.ts src/tests/email-templates.test.ts
git commit -m "fix: update NGN price in email templates from 32000 to 4999"
```

---

## Task 17: Fix .env.example

**Files:**
- Modify: `.env.example:13`

- [ ] **Step 1: Fix Paystack key name**

Change `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` to `VITE_PAYSTACK_PUBLIC_KEY`.

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "fix: use VITE_ prefix for Paystack public key in env example"
```

---

## Task 18: Build Verification & Type Check

- [ ] **Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No errors (or only pre-existing ones).

- [ ] **Step 3: Run tests**

Run: `npm test -- --run`
Expected: All tests pass.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`
Verify:
- Landing page shows "Secure payments via Stripe" (default USD)
- ProGate shows "$19.99/mo"
- RecruiterPricing shows 3 tiers (Starter $79, Growth $199, Enterprise Contact Us)
- Set cookie manually in browser: `document.cookie = "hunter-country=NG; path=/"`
- Refresh: pricing switches to ₦4,999/mo, ₦14,999/mo, ₦34,999/mo
- Trust badge changes to "Secure payments via Paystack"
- Clear cookie: `document.cookie = "hunter-country=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"`

---

## Task 19: Deploy

- [ ] **Step 1: Push migration to production**

Run: `supabase db push --linked`
Expected: Migration applies successfully.

- [ ] **Step 2: Deploy detect-country edge function**

Run: `supabase functions deploy detect-country --project-ref ffjsgjsiemtxqbhimvhb --no-verify-jwt`
Expected: Deployed successfully.

- [ ] **Step 3: Deploy updated stripe-webhook**

Run: `supabase functions deploy stripe-webhook --project-ref ffjsgjsiemtxqbhimvhb --no-verify-jwt`
Expected: Deployed successfully.

- [ ] **Step 4: Push to trigger Vercel deployment**

The Vercel serverless function (`api/detect-country.ts`) deploys automatically with the frontend push.

- [ ] **Step 5: Verify production**

Test with Nigerian VPN or by setting cookie: confirm ₦ pricing appears on all surfaces.
