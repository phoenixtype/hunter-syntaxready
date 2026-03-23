# Nigeria Naira Pricing Design

## Overview

Nigerian users should see pricing in Naira (NGN) with purchasing-power-adjusted prices across all pricing surfaces (job seeker and recruiter). Detection is automatic via IP geolocation with no user action required.

## Problem

All pricing in the app is currently displayed in USD/CAD regardless of the user's location. Nigerian users — a key market — see prices that are unaffordable relative to local income levels. The existing Paystack integration and NGN infrastructure (conversion utilities, PaystackCheckout component, NGN overage rates) are already built but not wired into the pricing UI.

## Pricing Structure

### Job Seeker

| Plan | International (USD) | Nigeria (NGN) |
|------|-------------------|---------------|
| Pro | $19.99/mo | ₦4,999/mo |

### Recruiter

| Plan | International (CAD) | Nigeria (NGN) |
|------|-------------------|---------------|
| Starter | $79/mo | ₦14,999/mo |
| Growth | $199/mo | ₦34,999/mo |
| Enterprise | Contact us | Contact us |

Pricing is based on purchasing power parity research:
- Average Nigerian monthly salary: ₦275,000–339,000 (~$170–220 USD)
- Job seeker Pro at ₦4,999 = ~1.5–1.8% of average salary (comparable to Netflix Nigeria)
- Recruiter tiers align with local competitors (Jobberman: ₦11,000–₦90,000)

## Country Detection (Dual-Layer)

### Primary: Vercel Edge Middleware

A `middleware.ts` at the project root reads the `x-vercel-ip-country` header (provided free by Vercel on all requests) and sets a `hunter-country` cookie with the ISO country code (e.g., `NG`).

### Fallback: Supabase Edge Function

If the `hunter-country` cookie is absent (non-Vercel environment, local dev, or header missing), a `detect-country` Supabase edge function reads the request IP from headers (`x-forwarded-for`, `cf-connecting-ip`, `x-real-ip`) and returns `{ country_code: "NG" }`. The result is cached in a cookie client-side for 24 hours.

### React Context: GeoProvider

A `GeoProvider` context wraps the app and exposes:

```ts
interface GeoContextValue {
  country: string        // ISO country code, e.g. "NG", "US"
  isNigeria: boolean     // convenience flag
  currency: 'USD' | 'NGN'
}
```

Detection flow:
1. Check `hunter-country` cookie (set by Vercel middleware)
2. If missing, call `detect-country` edge function
3. Cache result in cookie for 24 hours
4. Default to non-Nigeria (USD) if all detection fails

## Checkout Routing

### Job Seeker Pro
- **Nigeria:** `PaystackCheckout` component with ₦4,999/mo amount
- **Elsewhere:** Existing Stripe `create-checkout` edge function

### Recruiter Starter/Growth
- **Nigeria:** `PaystackCheckout` with ₦14,999 or ₦34,999
- **Elsewhere:** Existing Stripe checkout with CAD price IDs

### Recruiter Enterprise
- **Both regions:** "Contact Us" button — opens `mailto:` link, no checkout flow

### Payment Provider Detection
The `detectPaymentProvider()` function in `paystack-client.ts` is wired to the `GeoContext` instead of requiring manual country input. The `isNigeria` flag from context drives which checkout component renders.

### Subscription Storage
The existing `subscriptions` table already has `payment_provider` (`stripe`/`paystack`) and `currency` (`usd`/`ngn`) columns. No database migrations needed.

## New Files

### `middleware.ts` (project root)
Vercel edge middleware that:
- Reads `x-vercel-ip-country` from request headers
- Sets `hunter-country` cookie with the country code
- Passes through all requests without blocking

### `src/lib/pricing.ts`
Centralized pricing config for all tiers and currencies:
- Job Seeker Pro: USD and NGN amounts
- Recruiter Starter/Growth/Enterprise: USD/CAD and NGN amounts
- Helper function: `getPrice(plan, currency)` returns formatted price string
- Paystack plan codes for NGN checkout

### `src/contexts/GeoContext.tsx`
- `GeoProvider` component (wraps app)
- `useGeo()` hook for consuming components
- Dual-layer detection logic (cookie → edge function → fallback)
- Cookie caching for 24 hours

### `supabase/functions/detect-country/index.ts`
- Public endpoint, no auth required
- Reads IP from request headers
- Returns `{ country_code: string }`
- Rate limited by IP to prevent abuse

## Modified Files

### `src/components/ProGate.tsx`
- Import `useGeo()` hook
- Replace hardcoded "$19.99/mo" with dynamic price from `pricing.ts`
- Switch payment badge from "Secure via Stripe" to "Secure via Paystack" for Nigeria
- Route to `PaystackCheckout` or Stripe based on `isNigeria`

### `src/pages/recruiter/RecruiterPricing.tsx`
- Import `useGeo()` hook
- Replace hardcoded CAD prices with dynamic prices
- Add Enterprise tier card: "Custom" pricing, feature list (dedicated account manager, custom integrations, SLA, priority support), "Contact Us" CTA
- Route Nigerian users to Paystack checkout for Starter/Growth

### `src/pages/recruiter/RecruiterDashboard.tsx`
- Replace "Starting at $79/mo" with dynamic text based on currency

### `src/components/subscription/SubscriptionSettings.tsx`
- Show NGN or USD prices on plan cards based on `useGeo()`

### `src/components/subscription/OverageModal.tsx`
- Use NGN overage rates from `paystack-client.ts` when `isNigeria`

### `src/components/payment/PaystackCheckout.tsx`
- Accept recruiter plan amounts (currently only handles job seeker plans)
- Support Starter (₦14,999) and Growth (₦34,999) tiers

### `src/lib/paystack-client.ts`
- Add recruiter plan NGN prices and Paystack plan codes
- Wire `detectPaymentProvider()` to accept geo context data

### `src/App.tsx` (or root layout)
- Wrap app with `GeoProvider`

## Database Changes

None. The existing `subscriptions` table already supports:
- `payment_provider`: `'stripe' | 'paystack'`
- `currency`: `'usd' | 'ngn'`

## Testing Strategy

- **Unit tests:** `pricing.ts` helper functions, `GeoContext` with mocked cookies
- **Component tests:** `ProGate`, `RecruiterPricing` render correct prices for each currency
- **Integration tests:** Checkout routing sends to correct provider based on geo
- **Manual testing:** Use Vercel preview deployments with VPN to verify Nigerian IP detection
- **Local dev:** Default to USD (no Vercel headers, no edge function needed for dev)

## Edge Cases

- **VPN users:** If a non-Nigerian user connects via Nigerian VPN, they see NGN pricing and Paystack checkout. This is acceptable — they can still pay.
- **Nigerian users abroad:** Will see international pricing. Acceptable trade-off; detection is by current location, not nationality.
- **Cookie blocked/cleared:** Falls back to edge function on each visit, slight latency on first load.
- **Both detection methods fail:** Default to USD/international pricing (safe fallback).
