# Nigeria Naira Pricing Design

## Overview

Nigerian users should see pricing in Naira (NGN) with purchasing-power-adjusted prices across all pricing surfaces (job seeker and recruiter). Detection is automatic via IP geolocation with no user action required.

## Problem

All pricing in the app is currently displayed in USD/CAD regardless of the user's location. Nigerian users — a key market — see prices that are unaffordable relative to local income levels. The existing Paystack integration and NGN infrastructure (conversion utilities, PaystackCheckout component, NGN overage rates) are already built but not wired into the pricing UI.

## Pricing Structure

### Job Seeker

| Plan | International (USD) | Nigeria (NGN) | Annual (NGN) |
|------|-------------------|---------------|--------------|
| Pro | $19.99/mo | ₦4,999/mo | ₦49,990/yr (2 months free) |

### Recruiter

| Plan | International (CAD) | Nigeria (NGN) | Annual (NGN) |
|------|-------------------|---------------|--------------|
| Starter | $79/mo | ₦14,999/mo | ₦149,990/yr (2 months free) |
| Growth | $199/mo | ₦34,999/mo | ₦349,990/yr (2 months free) |
| Enterprise | Contact us | Contact us | Contact us |

Note: Annual pricing UI (monthly/yearly toggle) is out of scope for this iteration. Annual prices are defined here for completeness and will be used when annual billing is implemented in a follow-up. This iteration is monthly-only.

### PPP-adjusted Overage Rates (NGN)

Overage rates must also be PPP-adjusted (not the existing 1600x exchange-rate conversion):

| Feature | USD Rate | NGN Rate (PPP) |
|---------|----------|----------------|
| Job Applications | $2.00 | ₦500 |
| Resume Generations | $5.00 | ₦1,250 |
| AI Interviews | $10.00 | ₦2,500 |
| Cover Letters | $1.50 | ₦375 |
| Job Matches | $0.50 | ₦125 |
| Company Research | $1.00 | ₦250 |
| Skill Assessments | $15.00 | ₦3,750 |

PPP ratio: ~₦250 per $1 USD (matching the subscription pricing ratio of ₦4,999 / $19.99).

### Pricing Justification

Based on purchasing power parity research:
- Average Nigerian monthly salary: ₦275,000–339,000 (~$170–220 USD)
- Job seeker Pro at ₦4,999 = ~1.5–1.8% of average salary (comparable to Netflix Nigeria)
- Recruiter tiers align with local competitors (Jobberman: ₦11,000–₦90,000)

## Country Detection

### Primary: Vercel Serverless Function

This is a Vite SPA (not Next.js), so Vercel edge middleware (`middleware.ts`) is not supported. Instead, create a Vercel serverless function at `api/detect-country.ts` that:
- Reads the `x-vercel-ip-country` header from the incoming request
- Returns `{ country_code: "NG" }` (or whatever country)
- Called once on app load if no cached cookie exists

### Fallback: Supabase Edge Function

If the Vercel serverless function fails or is unavailable (e.g., non-Vercel environment), the `GeoProvider` falls back to a Supabase edge function (`detect-country`) that:
- Reads request IP from headers (`x-forwarded-for`, `cf-connecting-ip`, `x-real-ip`)
- Uses Deno's built-in capabilities to determine country from IP
- Returns `{ country_code: string }`
- Public endpoint, no auth required
- Rate limited: 10 requests per IP per minute using in-memory Map with TTL (edge function is lightweight, no DB needed for rate limiting)
- Returns ONLY `{ country_code }` — no other IP metadata (privacy constraint)

### React Context: GeoProvider

Placed in `src/hooks/useGeo.tsx` (following existing project conventions — no `src/contexts/` directory exists).

```ts
interface GeoContextValue {
  country: string          // ISO country code, e.g. "NG", "US"
  isNigeria: boolean       // convenience flag
  currency: 'NGN' | 'USD'  // NGN for Nigeria, USD for everyone else
  isLoading: boolean       // true while detection is in progress
}
```

Note on currency: The context exposes only `'NGN' | 'USD'`. Recruiter international pricing displays as CAD in the UI (hardcoded label on the pricing page) but is stored as `'usd'` in the database — Stripe handles CAD currency via its own price objects. The `subscriptions.currency` DB column has a CHECK constraint allowing only `'usd'` and `'ngn'`, and we do not change this. CAD is a display label, not a stored currency.

Detection flow:
1. Check `hunter-country` cookie
2. If missing, call Vercel serverless function (`/api/detect-country`)
3. If that fails, call Supabase `detect-country` edge function
4. Cache result in `hunter-country` cookie for 24 hours
5. Default to non-Nigeria (USD) if all detection fails

## Checkout Routing

### Job Seeker Pro
- **Nigeria:** `PaystackCheckout` component with ₦4,999/mo
- **Elsewhere:** Existing Stripe `create-checkout` edge function

### Recruiter Starter/Growth
- **Nigeria:** `PaystackCheckout` with ₦14,999 or ₦34,999
- **Elsewhere:** Existing Stripe checkout with CAD price IDs

### Recruiter Enterprise
- **Both regions:** "Contact Us" button — opens `mailto:hello@usehunter.app`, no checkout flow

### Critical: `upgradeToPro()` must be geo-aware

The `upgradeToPro()` function in `src/lib/subscription.ts` currently unconditionally invokes the Stripe `create-checkout` edge function. Both `ProGate.tsx` and `SubscriptionGate.tsx` call this function. It must be modified to:
- Accept a `paymentProvider` parameter (or read from GeoContext)
- Route to Paystack for Nigerian users, Stripe for others

### Critical: `openBillingPortal()` must be geo-aware

The `openBillingPortal()` function in `src/lib/subscription.ts` unconditionally opens the Stripe customer portal. Nigerian users who subscribed via Paystack cannot manage billing through Stripe. This function must be modified to:
- Check `payment_provider` on the user's subscription record
- For Paystack subscribers: redirect to a simple billing info page showing subscription status, next billing date, and a "Cancel Subscription" button that calls Paystack's cancellation API
- For Stripe subscribers: continue using the existing `create-portal` edge function

### Payment Provider Detection
The `detectPaymentProvider()` function in `paystack-client.ts` is simplified to accept a country code string (from GeoContext) instead of the current fragile string-matching on "nigeria"/"lagos". The `isNigeria` flag from context drives which checkout component renders.

The `detectCurrency()` function in `paystack-client.ts` is also updated to return `'usd' | 'ngn'` based on the country code input (matching the database CHECK constraint).

### Subscription Storage
The existing `subscriptions` table already has `payment_provider` (`stripe`/`paystack`) and `currency` (`usd`/`ngn`) columns with a CHECK constraint on currency allowing only these two values. No schema migrations needed for the subscriptions table.

## Plan Name Convention

**Canonical plan names:** `starter` and `growth` (not `recruiter_starter`/`recruiter_growth`).

The Stripe webhook currently maps recruiter plans to `recruiter_starter`/`recruiter_growth` tier values. This must be updated to use `starter`/`growth` to match the database `subscription_plans.name` column and the `PaystackCheckout` component's `planName` prop. All code paths must use these canonical names consistently:
- `subscription_plans.name`: `starter`, `growth`
- `subscriptions.tier`: `starter`, `growth`
- `PaystackCheckout planName`: `starter`, `growth`
- `SubscriptionTier` enum: `STARTER = 'starter'`, `GROWTH = 'growth'`
- Stripe webhook tier mapping: `starter`, `growth`
- Paystack webhook tier detection: `starter`, `growth`

## Database Changes

### Schema Migration: Insert recruiter plan rows and update PPP prices

The `subscription_plans` table currently only has `free`, `pro`, and `enterprise` rows. Recruiter plans (`starter`, `growth`) do not exist. A migration is required:

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

-- Update existing Pro plan NGN prices (PPP-adjusted)
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
CREATE OR REPLACE FUNCTION get_overage_rate(p_plan_name text, p_feature text, p_currency text DEFAULT 'usd')
RETURNS numeric AS $$
DECLARE
  rate numeric;
  ngn_key text;
BEGIN
  IF p_currency = 'ngn' THEN
    ngn_key := p_feature || '_ngn';
    SELECT (overage_rates->>ngn_key)::numeric INTO rate
    FROM subscription_plans WHERE name = p_plan_name;
    IF rate IS NOT NULL THEN RETURN rate; END IF;
    -- PPP fallback: use 250x ratio instead of old 1600x exchange rate
    SELECT (overage_rates->>p_feature)::numeric * 250 INTO rate
    FROM subscription_plans WHERE name = p_plan_name;
    RETURN COALESCE(rate, 0);
  ELSE
    SELECT (overage_rates->>p_feature)::numeric INTO rate
    FROM subscription_plans WHERE name = p_plan_name;
    RETURN COALESCE(rate, 0);
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;
```

This ensures the `PaystackCheckout` component (which reads from `subscription_plans`) and the `pricing.ts` display config are in sync.

## New Files

### `api/detect-country.ts` (Vercel serverless function)
- Reads `x-vercel-ip-country` header
- Returns `{ country_code: string }`
- Lightweight, no dependencies

### `src/lib/pricing.ts`
Centralized pricing config for display purposes:
- Job Seeker Pro: USD and NGN monthly amounts
- Recruiter Starter/Growth/Enterprise: CAD label and NGN amounts
- PPP-adjusted overage rates for NGN
- Helper function: `getPrice(plan, currency)` returns formatted price string
- Note: This is the display source of truth. `PaystackCheckout` reads checkout amounts from `subscription_plans` table — both must be kept in sync via the migration above.

### `src/hooks/useGeo.tsx`
- `GeoProvider` component (wraps app)
- `useGeo()` hook for consuming components
- Dual-layer detection logic (cookie → Vercel function → Supabase edge function → fallback)
- Cookie caching for 24 hours

### `supabase/functions/detect-country/index.ts`
- Public endpoint, no auth required
- Reads country from `cf-ipcountry` header (Supabase edge functions run behind Cloudflare). If header is absent, falls back to reading `x-forwarded-for` and using a lightweight geo-IP lookup.
- Returns only `{ country_code: string }` (minimal data, privacy-conscious)
- In-memory rate limiting: 10 requests per IP per minute

### `supabase/migrations/YYYYMMDD_naira_pricing_plans.sql`
- INSERT starter/growth plan rows
- UPDATE pro plan NGN prices to PPP values
- UPDATE overage_rates JSONB with PPP-adjusted NGN values

## Modified Files

### `src/lib/subscription.ts`
- **Critical:** `upgradeToPro()` must detect payment provider and route to Paystack for Nigerian users instead of always calling Stripe `create-checkout`
- **Critical:** `openBillingPortal()` must check `payment_provider` on the subscription and route Paystack users to a billing info page instead of Stripe portal
- **Critical:** Add `STARTER = 'starter'` and `GROWTH = 'growth'` to the `SubscriptionTier` enum and add corresponding entries to the `TIER_FEATURES` map

### `src/components/ProGate.tsx`
- Import `useGeo()` hook
- Replace hardcoded "$19.99/mo" with dynamic price from `pricing.ts`
- Switch payment badge from "Secure via Stripe" to "Secure via Paystack" for Nigeria
- Route to `PaystackCheckout` or Stripe based on `isNigeria`

### `src/components/auth/SubscriptionGate.tsx`
- Replace "Cancel anytime . Secure checkout via Stripe" with geo-conditional text

### `src/pages/recruiter/RecruiterPricing.tsx`
- Import `useGeo()` hook
- Replace hardcoded CAD prices with dynamic prices from `pricing.ts`
- Stripe price IDs (`STARTER_PRICE_ID`, `GROWTH_PRICE_ID`) remain hardcoded for international Stripe checkout; Nigerian path bypasses them via `PaystackCheckout`
- Add Enterprise tier card: "Custom" pricing, feature list (dedicated account manager, custom integrations, SLA, priority support), "Contact Us" CTA with `mailto:hello@usehunter.app`
- Route Nigerian users to Paystack checkout for Starter/Growth

### `src/pages/recruiter/RecruiterDashboard.tsx`
- Replace "Starting at $79/mo" with dynamic text based on currency

### `src/pages/Index.tsx`
- Update `TRUST_BADGES` array: "Secure payments via Stripe" becomes geo-conditional ("Secure payments via Paystack" for Nigeria)

### `src/components/subscription/SubscriptionSettings.tsx`
- Show NGN or USD/CAD prices on plan cards based on `useGeo()`
- Billing portal button must route correctly for Paystack subscribers (see `openBillingPortal()` changes)

### `src/components/subscription/OverageModal.tsx`
- Use PPP-adjusted NGN overage rates when `isNigeria`

### `src/components/subscription/UsageGuard.tsx`
- Replace hardcoded `$` prefix for overage costs with currency-aware formatting

### `src/components/payment/PaystackCheckout.tsx`
- Expand `planName` type from `'pro' | 'enterprise'` to include `'starter' | 'growth'`
- Accept recruiter plan amounts: Starter (₦14,999) and Growth (₦34,999)

### `src/lib/paystack-client.ts`
- Update `ensureSubscriptionPlans()` from ₦32,000 to ₦4,999 for Pro, add Starter (₦14,999) and Growth (₦34,999) Paystack plan creation
- Update `OVERAGE_RATES.ngn` to use PPP-adjusted rates (500, 1250, 2500, etc.)
- Simplify `detectPaymentProvider(country: string)` to accept ISO country code instead of fragile string matching
- Update `detectCurrency(country: string)` to return `'usd' | 'ngn'` based on country code
- Clean up env var usage: frontend-accessible functions must use `import.meta.env.VITE_PAYSTACK_PUBLIC_KEY` (not `process.env`). Server-only functions (API calls needing secret key) should be clearly separated or moved to edge functions.

### `src/App.tsx` (or root layout)
- Wrap app with `GeoProvider`

### `src/tests/email-templates.test.ts`
- Update NGN price expectations from 32,000 to 4,999

### `supabase/functions/stripe-webhook/index.ts`
- Update tier mapping: change `recruiter_starter`/`recruiter_growth` to `starter`/`growth` to match canonical plan names

### `supabase/functions/_shared/email-templates.ts`
- Update any hardcoded NGN price references from 32,000 to 4,999

### `.env.example`
- Fix `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` to `VITE_PAYSTACK_PUBLIC_KEY` (Vite convention)

## Prerequisites / Companion Tasks

### Paystack Webhook Deployment (required for end-to-end flow)

The existing `src/webhooks/paystack-webhooks.ts` is a Node.js file that is not deployed anywhere. For Paystack subscriptions to work end-to-end (confirming payments, handling renewals and cancellations), this must be deployed as either:
- A Vercel serverless function at `api/paystack-webhook.ts`, or
- A Supabase edge function at `supabase/functions/paystack-webhook/index.ts` (requires porting from Node.js to Deno)

The webhook's tier-detection logic (`handleSubscriptionCreate`) currently only recognizes "pro" and "enterprise" plan names. It must be extended to detect `starter` and `growth` plan names (e.g., "Hunter AI Starter Monthly (NGN)"), otherwise recruiter subscribers will be silently assigned `tier = 'free'`.

This is a **prerequisite** for launching Paystack checkout to real users. It can be implemented in parallel with the pricing UI work but must be complete before going live.

### Known Limitation: Client-side subscription creation

The `PaystackCheckout` component directly upserts into the `subscriptions` table from the client after Paystack popup success. This bypasses webhook verification and is a security concern (client callbacks can be spoofed). This is an existing issue, not introduced by this spec, but expanding Paystack to recruiter plans increases the surface area. Recommend moving to webhook-only subscription creation in a follow-up.

## Testing Strategy

- **Unit tests:** `pricing.ts` helper functions, `useGeo` with mocked cookies
- **Component tests:** `ProGate`, `RecruiterPricing` render correct prices for each currency
- **Integration tests:** Checkout routing sends to correct provider based on geo
- **Edge function tests:** `detect-country` IP extraction logic, rate limiter behavior, fallback when headers absent
- **Manual testing:** Use Vercel preview deployments with VPN to verify Nigerian IP detection
- **Local dev:** Default to USD (no Vercel headers, edge function not called in dev by default)

## Edge Cases

- **VPN users:** If a non-Nigerian user connects via Nigerian VPN, they see NGN pricing and Paystack checkout. Acceptable — they can still pay.
- **Nigerian users abroad:** Will see international pricing. Acceptable trade-off; detection is by current location, not nationality.
- **Cookie blocked/cleared:** Falls back to edge function on each visit, slight latency on first load.
- **Both detection methods fail:** Default to USD/international pricing (safe fallback).
