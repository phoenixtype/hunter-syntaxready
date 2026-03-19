# 🔐 Secure Environment Variables Setup

This guide shows how to properly set sensitive keys in Supabase secrets instead of local files.

## ⚠️ Security Warning

**NEVER** put live API keys in:
- `.env` files that might be committed
- Code repositories
- Client-side code
- Local configuration files

## 🎯 Setting Supabase Secrets

### Method 1: Supabase Dashboard (Recommended)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **API** → **Project Settings**
4. Scroll down to **Environment Variables** section
5. Add the following secrets:

#### Paystack Keys (Nigerian Payments)
```
Name: PAYSTACK_SECRET_KEY
Value: sk_live_2b5dfd00824e71ed66ab462c40961ad297a37b43

Name: PAYSTACK_PUBLIC_KEY
Value: pk_live_bdafefcdf2c0d55c26adc9454a28b073e93926a5
```

#### Stripe Keys (International Payments)
```
Name: STRIPE_SECRET_KEY
Value: [Your Stripe Secret Key]

Name: STRIPE_WEBHOOK_SECRET
Value: [Your Stripe Webhook Secret]
```

### Method 2: Supabase CLI

```bash
# Set Paystack secrets
npx supabase secrets set PAYSTACK_SECRET_KEY=sk_live_2b5dfd00824e71ed66ab462c40961ad297a37b43
npx supabase secrets set PAYSTACK_PUBLIC_KEY=pk_live_bdafefcdf2c0d55c26adc9454a28b073e93926a5

# Set Stripe secrets
npx supabase secrets set STRIPE_SECRET_KEY=your_stripe_secret_key
npx supabase secrets set STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

### Method 3: Edge Functions Environment

For edge functions, add to your function's `.env` file:

```bash
# supabase/functions/.env
PAYSTACK_SECRET_KEY=sk_live_2b5dfd00824e71ed66ab462c40961ad297a37b43
PAYSTACK_PUBLIC_KEY=pk_live_bdafefcdf2c0d55c26adc9454a28b073e93926a5
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

## 🌐 Client-Side Environment Variables

For **public** keys that can be exposed to the client, use Next.js environment variables:

### Vercel Deployment
1. Go to your Vercel dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add:

```
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_bdafefcdf2c0d55c26adc9454a28b073e93926a5
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

### Local Development
Create a `.env.local` file (this should be in `.gitignore`):

```bash
# .env.local (NEVER commit this file)
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_bdafefcdf2c0d55c26adc9454a28b073e93926a5
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

## 🔍 Accessing Secrets in Code

### Server-Side (API Routes, Edge Functions)
```typescript
// Access server-side secrets
const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
const stripeSecret = process.env.STRIPE_SECRET_KEY;
```

### Client-Side (React Components)
```typescript
// Access public keys only
const paystackPublic = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
const stripePublic = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
```

## ✅ Verification

To verify your secrets are set correctly:

### Check Supabase Secrets
```bash
npx supabase secrets list
```

### Check in Code
```typescript
// Add to your API route for testing
console.log('Paystack secret set:', !!process.env.PAYSTACK_SECRET_KEY);
console.log('Stripe secret set:', !!process.env.STRIPE_SECRET_KEY);
```

## 🚨 Security Checklist

- [ ] Live API keys removed from `.env.example`
- [ ] Live API keys set in Supabase secrets
- [ ] Public keys set in Vercel/deployment environment
- [ ] `.env.local` added to `.gitignore`
- [ ] No secrets hardcoded in source code
- [ ] Webhook endpoints secured with signature verification

## 🔄 Key Rotation

When rotating API keys:

1. **Generate new keys** in Paystack/Stripe dashboard
2. **Update Supabase secrets** immediately
3. **Update deployment environment** variables
4. **Test thoroughly** before revoking old keys
5. **Revoke old keys** after confirming new ones work

## 📞 Support

If you need help with environment variable setup:
- Check Supabase docs: https://supabase.com/docs/guides/cli/managing-environments
- Verify webhook signatures are working
- Test with small amounts first