# Payment Value Delivery & Notification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix payment value disconnect and build comprehensive notification system while preserving all payment integrations (Paystack + Stripe).

**Architecture:** Enhance existing `subscriptions` table with feature limits, create usage tracking system, build unified email templates, and implement smart notification engine with user preferences.

**Tech Stack:** Supabase (PostgreSQL), TypeScript, React Query, Resend API, Stripe/Paystack webhooks

---

## File Structure Overview

**Database:**
- `supabase/migrations/20260319000014_enhance_subscriptions_system.sql` - Main migration
- `supabase/migrations/20260319000015_notification_preferences.sql` - User preferences

**Frontend Subscription System:**
- `src/hooks/useSubscription.ts` - Enhanced to use old table with new features
- `src/lib/subscription.ts` - Update feature access logic
- `src/components/SubscriptionBilling.tsx` - Update UI components

**Email System:**
- `supabase/functions/_shared/email-templates.ts` - Unified template system
- `supabase/functions/stripe-webhook/index.ts` - Updated payment confirmation emails
- `supabase/functions/send-notification/index.ts` - Enhanced notification function

**Notification Engine:**
- `supabase/functions/_shared/notification-queue.ts` - Queue management
- `supabase/functions/process-notifications/index.ts` - Batch processor
- `src/components/NotificationSettings.tsx` - User preferences UI

**Usage Tracking:**
- `supabase/functions/_shared/usage-tracker.ts` - Usage recording utilities
- `src/hooks/useFeatureUsage.ts` - Frontend usage tracking

**Tests:**
- `src/tests/subscription-enhanced.test.ts` - Enhanced subscription tests
- `src/tests/email-templates.test.ts` - Email template tests
- `src/tests/notification-system.test.ts` - Notification system tests

---

## Task 1: Backup and Analyze Current Subscription Data

**Files:**
- Create: `supabase/migrations/20260320000001_backup_subscription_data.sql`

- [ ] **Step 1: Create data backup migration**

```sql
-- Backup current subscription data before changes
CREATE TABLE IF NOT EXISTS subscriptions_backup AS
SELECT * FROM subscriptions;

CREATE TABLE IF NOT EXISTS user_subscriptions_backup AS
SELECT * FROM user_subscriptions;

-- Analyze current data to understand migration needs
SELECT
  'subscriptions' as table_name,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN tier = 'pro' THEN 1 END) as pro_users,
  COUNT(CASE WHEN tier = 'free' THEN 1 END) as free_users
FROM subscriptions
UNION ALL
SELECT
  'user_subscriptions' as table_name,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subs,
  0 as free_users
FROM user_subscriptions;
```

- [ ] **Step 2: Apply backup migration**

Run: `npx supabase db push --linked`
Expected: SUCCESS - Backup tables created

- [ ] **Step 3: Check current data state**

Run: Query the analysis to see which table has active users
Expected: Understand data distribution between tables

- [ ] **Step 4: Commit backup migration**

```bash
git add supabase/migrations/20260320000001_backup_subscription_data.sql
git commit -m "feat: backup subscription data before migration

- Create backup tables for both subscription systems
- Add data analysis query to understand current state
- Prepare for safe migration to unified system"
```

---

## Task 2: Enhance Subscriptions Table with Feature Limits

**Files:**
- Create: `supabase/migrations/20260320000002_enhance_subscriptions_system.sql`

- [ ] **Step 1: Write the enhanced subscription migration**

```sql
-- Enhance existing subscriptions table with advanced features
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS
feature_limits JSONB DEFAULT '{
  "job_applications": -1,
  "resume_generations": -1,
  "ai_interviews": -1,
  "cover_letters": -1,
  "job_matches": -1,
  "company_research": -1,
  "skill_assessments": -1
}';

-- Create usage tracking table (linking to subscriptions, not user_subscriptions)
CREATE TABLE IF NOT EXISTS subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, feature_name, period_start)
);

-- Migrate any pro users from user_subscriptions to subscriptions if needed
INSERT INTO subscriptions (user_id, tier, status, feature_limits, created_at, updated_at)
SELECT
  us.user_id,
  CASE
    WHEN sp.name = 'pro' THEN 'pro'
    WHEN sp.name = 'enterprise' THEN 'enterprise'
    ELSE 'free'
  END as tier,
  us.status,
  CASE
    WHEN sp.name = 'free' THEN '{
      "job_applications": 5,
      "resume_generations": 3,
      "ai_interviews": 2,
      "cover_letters": 5,
      "job_matches": 20,
      "company_research": 10,
      "skill_assessments": 1
    }'::jsonb
    WHEN sp.name = 'pro' THEN '{
      "job_applications": 100,
      "resume_generations": 50,
      "ai_interviews": 25,
      "cover_letters": 100,
      "job_matches": 500,
      "company_research": 200,
      "skill_assessments": 10
    }'::jsonb
    ELSE '{
      "job_applications": -1,
      "resume_generations": -1,
      "ai_interviews": -1,
      "cover_letters": -1,
      "job_matches": -1,
      "company_research": -1,
      "skill_assessments": -1
    }'::jsonb
  END as feature_limits,
  us.created_at,
  us.updated_at
FROM user_subscriptions us
JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE us.status = 'active'
ON CONFLICT (user_id) DO UPDATE SET
  tier = EXCLUDED.tier,
  status = EXCLUDED.status,
  feature_limits = EXCLUDED.feature_limits;

-- Update existing subscriptions with proper feature limits
UPDATE subscriptions SET feature_limits = '{
  "job_applications": 5,
  "resume_generations": 3,
  "ai_interviews": 2,
  "cover_letters": 5,
  "job_matches": 20,
  "company_research": 10,
  "skill_assessments": 1
}' WHERE tier = 'free' AND feature_limits = '{
  "job_applications": -1,
  "resume_generations": -1,
  "ai_interviews": -1,
  "cover_letters": -1,
  "job_matches": -1,
  "company_research": -1,
  "skill_assessments": -1
}';

UPDATE subscriptions SET feature_limits = '{
  "job_applications": 100,
  "resume_generations": 50,
  "ai_interviews": 25,
  "cover_letters": 100,
  "job_matches": 500,
  "company_research": 200,
  "skill_assessments": 10
}' WHERE tier = 'pro';

UPDATE subscriptions SET feature_limits = '{
  "job_applications": -1,
  "resume_generations": -1,
  "ai_interviews": -1,
  "cover_letters": -1,
  "job_matches": -1,
  "company_research": -1,
  "skill_assessments": -1
}' WHERE tier = 'enterprise';

-- Create usage tracking functions
CREATE OR REPLACE FUNCTION get_feature_usage(
  p_user_id UUID,
  p_feature_name TEXT
) RETURNS INTEGER AS $$
DECLARE
  usage_count INTEGER := 0;
BEGIN
  SELECT COALESCE(usage_count, 0) INTO usage_count
  FROM subscription_usage
  WHERE user_id = p_user_id
  AND feature_name = p_feature_name
  AND period_start = DATE_TRUNC('month', CURRENT_DATE)::DATE;

  RETURN usage_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_feature_usage(
  p_user_id UUID,
  p_feature_name TEXT,
  p_count INTEGER DEFAULT 1
) RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO subscription_usage (
    user_id,
    feature_name,
    usage_count,
    period_start,
    period_end
  ) VALUES (
    p_user_id,
    p_feature_name,
    p_count,
    DATE_TRUNC('month', CURRENT_DATE)::DATE,
    (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE
  )
  ON CONFLICT (user_id, feature_name, period_start)
  DO UPDATE SET
    usage_count = subscription_usage.usage_count + p_count,
    updated_at = NOW();

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" ON subscription_usage
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can insert usage" ON subscription_usage
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscription_usage_user_feature
  ON subscription_usage (user_id, feature_name);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_period
  ON subscription_usage (period_start);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON subscription_usage TO authenticated;
GRANT ALL ON subscription_usage TO service_role;
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push --linked`
Expected: SUCCESS - "Applied migration 20260319000014_enhance_subscriptions_system.sql"

- [ ] **Step 3: Verify migration**

Run: `npx supabase db dump --linked | grep -A 5 "feature_limits"`
Expected: Shows feature_limits column and updated rows

- [ ] **Step 4: Commit migration**

```bash
git add supabase/migrations/20260319000014_enhance_subscriptions_system.sql
git commit -m "feat: enhance subscriptions table with feature limits and usage tracking

- Add feature_limits JSONB column to subscriptions table
- Create subscription_usage table for tracking monthly usage
- Update existing tiers with proper feature limits
- Add usage tracking functions and RLS policies"
```

---

## Task 2: Frontend Subscription Hook Migration

**Files:**
- Modify: `src/hooks/useSubscription.ts`
- Test: `src/tests/subscription-enhanced.test.ts`

- [ ] **Step 1: Write failing test for enhanced subscription hook**

```typescript
// src/tests/subscription-enhanced.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { expect, describe, it } from 'vitest';
import { useSubscription } from '@/hooks/useSubscription';
import { createWrapper } from './test-utils';

describe('Enhanced Subscription Hook', () => {
  it('should read from subscriptions table with feature limits', async () => {
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.currentSubscription).toBeDefined();
      expect(result.current.currentSubscription?.tier).toBe('pro');
      expect(result.current.currentSubscription?.feature_limits).toEqual({
        job_applications: 100,
        resume_generations: 50,
        ai_interviews: 25,
        cover_letters: 100,
        job_matches: 500,
        company_research: 200,
        skill_assessments: 10
      });
    });
  });

  it('should check feature access correctly', async () => {
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.canAccess('job_applications')).toBe(true);
      expect(result.current.canAccess('unlimited_feature')).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/tests/subscription-enhanced.test.ts`
Expected: FAIL - "Cannot find module" or test failures

- [ ] **Step 3: Update useSubscription hook to use enhanced subscriptions table**

```typescript
// src/hooks/useSubscription.ts
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
        p_count: count
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/tests/subscription-enhanced.test.ts`
Expected: PASS

- [ ] **Step 5: Commit subscription hook changes**

```bash
git add src/hooks/useSubscription.ts src/tests/subscription-enhanced.test.ts
git commit -m "feat: migrate subscription hook to enhanced subscriptions table

- Read from subscriptions table instead of user_subscriptions
- Add feature limits and usage tracking support
- Preserve all payment provider support (Stripe + Paystack)
- Add comprehensive test coverage"
```

---

## Task 3: Update Feature Access Throughout App

**Files:**
- Modify: `src/pages/Dashboard.tsx:88-100`
- Modify: `src/components/JobFeed.tsx`
- Modify: `src/pages/ApplicationWizard.tsx`
- Modify: `src/pages/ResumeBuilder.tsx`

- [ ] **Step 1: Update Dashboard to use new subscription hook**

```typescript
// src/pages/Dashboard.tsx (around line 88)
const { subscription, isLoading: subLoading, canAccess, isPro } = useSubscription();
// Remove old subscription imports

// Update pro feature checks throughout component:
const showProFeatures = isPro;
const canApplyToJobs = canAccess('job_applications');
const canGenerateResumes = canAccess('resume_generations');
```

- [ ] **Step 2: Update JobFeed component**

```typescript
// src/components/JobFeed.tsx - Add usage tracking on job applications
import { useSubscription } from '@/hooks/useSubscription';

// In component:
const { canAccess, recordUsage } = useSubscription();

// When user applies to job:
const handleJobApplication = async (jobId: string) => {
  if (!canAccess('job_applications')) {
    toast.error('You\'ve reached your monthly application limit. Upgrade to Pro for unlimited applications.');
    return;
  }

  try {
    await applyToJob(jobId);
    await recordUsage('job_applications');
    toast.success('Application submitted!');
  } catch (error) {
    toast.error('Failed to apply to job');
  }
};
```

- [ ] **Step 3: Update ApplicationWizard**

```typescript
// src/pages/ApplicationWizard.tsx
import { useSubscription } from '@/hooks/useSubscription';

// Add usage checks for cover letter generation:
const { canAccess, recordUsage, getRemainingUsage } = useSubscription();

const generateCoverLetter = async () => {
  if (!canAccess('cover_letters')) {
    const remaining = getRemainingUsage('cover_letters');
    toast.error(`You've reached your monthly limit. ${remaining} cover letters remaining.`);
    return;
  }

  try {
    const coverLetter = await generateCoverLetterAPI();
    await recordUsage('cover_letters');
    setCoverLetter(coverLetter);
  } catch (error) {
    toast.error('Failed to generate cover letter');
  }
};
```

- [ ] **Step 4: Update ResumeBuilder**

```typescript
// src/pages/ResumeBuilder.tsx
import { useSubscription } from '@/hooks/useSubscription';

const { canAccess, recordUsage } = useSubscription();

const generateResume = async () => {
  if (!canAccess('resume_generations')) {
    toast.error('Monthly resume limit reached. Upgrade to Pro for 50 resumes per month.');
    return;
  }

  try {
    const resume = await generateResumeAPI();
    await recordUsage('resume_generations');
    setResume(resume);
  } catch (error) {
    toast.error('Failed to generate resume');
  }
};
```

- [ ] **Step 5: Test feature access throughout app**

Run: `npm run dev` and test:
- Dashboard shows correct pro/free status
- Job applications track usage correctly
- Cover letter generation respects limits
- Resume builder tracks usage

Expected: All features work with new subscription system

- [ ] **Step 6: Commit feature access updates**

```bash
git add src/pages/Dashboard.tsx src/components/JobFeed.tsx src/pages/ApplicationWizard.tsx src/pages/ResumeBuilder.tsx
git commit -m "feat: update feature access to use enhanced subscription system

- Dashboard uses new subscription hook with feature limits
- JobFeed tracks job application usage
- ApplicationWizard respects cover letter limits
- ResumeBuilder tracks resume generation usage"
```

---

## Task 4: Create Shared Functions Directory

**Files:**
- Create: `supabase/functions/_shared/` (directory)

- [ ] **Step 1: Create shared functions directory structure**

```bash
mkdir -p supabase/functions/_shared
touch supabase/functions/_shared/.gitkeep
```

- [ ] **Step 2: Verify directory creation**

Run: `ls -la supabase/functions/_shared/`
Expected: Directory exists with .gitkeep file

- [ ] **Step 3: Commit directory structure**

```bash
git add supabase/functions/_shared/
git commit -m "feat: create shared functions directory structure

- Add _shared directory for reusable edge function utilities
- Prepare for email templates, usage tracker, and notification queue"
```

---

## Task 5: Enhanced Email Template System

**Files:**
- Create: `supabase/functions/_shared/email-templates.ts`
- Test: `src/tests/email-templates.test.ts`

- [ ] **Step 1: Write email template test**

```typescript
// src/tests/email-templates.test.ts
import { expect, describe, it } from 'vitest';
import {
  buildPaymentConfirmationEmail,
  buildJobAlertEmail,
  buildUsageWarningEmail
} from '../supabase/functions/_shared/email-templates';

describe('Email Templates', () => {
  it('should build payment confirmation email with correct branding', () => {
    const result = buildPaymentConfirmationEmail({
      tier: 'pro',
      amount: 19.99,
      currency: 'usd',
      paymentProvider: 'stripe',
      userName: 'John Doe'
    });

    expect(result.subject).toContain('Welcome to Hunter Pro');
    expect(result.html).toContain('#0d9488'); // Brand color
    expect(result.html).toContain('$19.99'); // Price
    expect(result.html).toContain('100 job applications'); // Feature
  });

  it('should build Paystack payment email with NGN currency', () => {
    const result = buildPaymentConfirmationEmail({
      tier: 'pro',
      amount: 32000,
      currency: 'ngn',
      paymentProvider: 'paystack',
      userName: 'John Doe'
    });

    expect(result.html).toContain('₦32,000'); // NGN formatting
    expect(result.html).toContain('Paystack'); // Provider mention
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/tests/email-templates.test.ts`
Expected: FAIL - "Cannot find module"

- [ ] **Step 3: Create email templates system**

```typescript
// supabase/functions/_shared/email-templates.ts

// Design system constants
const BRAND = {
  primary: '#0d9488',
  primaryLight: '#14b8a6',
  accent: '#10b981',
  bg: '#ffffff',
  bgSubtle: '#f0fdfa',
  bgMuted: '#f8fafc',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
};

const SITE_URL = Deno.env.get('SITE_URL') || 'https://usehunter.app';

interface PaymentEmailData {
  tier: string;
  amount: number;
  currency: 'usd' | 'ngn';
  paymentProvider: 'stripe' | 'paystack';
  userName?: string;
}

interface JobAlert {
  title: string;
  company: string;
  location?: string;
  salary_range?: string;
  tech_stack?: string[];
  url: string;
}

function formatCurrency(amount: number, currency: 'usd' | 'ngn'): string {
  if (currency === 'ngn') {
    return `₦${amount.toLocaleString('en-NG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })}`;
  }
  return `$${amount.toFixed(2)}`;
}

function emailLayout(title: string, previewText: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.bgMuted}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden;">${previewText}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.bgMuted};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background: ${BRAND.primary}; width: 36px; height: 36px; border-radius: 10px; text-align: center; vertical-align: middle;">
                    <span style="color: #ffffff; font-weight: 700; font-size: 16px; line-height: 36px;">H</span>
                  </td>
                  <td style="padding-left: 10px;">
                    <span style="font-size: 20px; font-weight: 700; color: ${BRAND.text}; letter-spacing: -0.5px;">Hunter</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td style="background: ${BRAND.bg}; border-radius: 16px; border: 1px solid ${BRAND.border}; overflow: hidden;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 24px 0; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 13px; color: ${BRAND.textMuted};">
                Sent by <a href="${SITE_URL}" style="color: ${BRAND.primary}; text-decoration: none; font-weight: 500;">Hunter AI</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: ${BRAND.textMuted};">
                <a href="${SITE_URL}/dashboard" style="color: ${BRAND.textMuted}; text-decoration: underline;">Manage preferences</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildPaymentConfirmationEmail(data: PaymentEmailData): { subject: string; html: string } {
  const { tier, amount, currency, paymentProvider, userName } = data;

  const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
  const formattedAmount = formatCurrency(amount, currency);
  const features = getFeatureList(tier);

  const body = `
    <!-- Hero Section -->
    <tr>
      <td style="background: linear-gradient(135deg, ${BRAND.primary}, ${BRAND.accent}); padding: 40px 32px; text-align: center;">
        <h1 style="margin: 0 0 8px; font-size: 26px; font-weight: 700; color: #ffffff;">Welcome to Hunter ${tierName}!</h1>
        <p style="margin: 0; font-size: 15px; color: rgba(255,255,255,0.9);">Your AI job search agent is now active.</p>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 32px;">
        <p style="margin: 0 0 24px; font-size: 15px; color: ${BRAND.textSecondary}; line-height: 1.6;">
          ${userName ? `Hi ${userName},` : 'Hi there,'}<br>
          Your ${tierName} subscription is confirmed. Here's what's now unlocked:
        </p>

        <!-- Features List -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
          ${features.map(feature =>
            `<tr><td style="padding: 8px 0; border-bottom: 1px solid ${BRAND.borderLight}; font-size: 14px; color: ${BRAND.text};">✓ &nbsp;${feature}</td></tr>`
          ).join('')}
        </table>

        <!-- Payment Receipt -->
        <div style="background: ${BRAND.bgSubtle}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: ${BRAND.text};">Payment Receipt</h3>
          <p style="margin: 0; font-size: 14px; color: ${BRAND.textSecondary};">
            Hunter ${tierName}: ${formattedAmount}/month<br>
            Payment via ${paymentProvider.charAt(0).toUpperCase() + paymentProvider.slice(1)}
          </p>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center;">
          <a href="${SITE_URL}/dashboard" style="display: inline-block; background: ${BRAND.primary}; color: #ffffff; font-size: 14px; font-weight: 600; padding: 14px 36px; border-radius: 8px; text-decoration: none;">
            Open Hunter Dashboard →
          </a>
        </div>
      </td>
    </tr>
  `;

  return {
    subject: `🚀 You're now Hunter ${tierName} — welcome!`,
    html: emailLayout(
      `Welcome to Hunter ${tierName}!`,
      `Your ${tierName} subscription is confirmed and ready to use`,
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>`
    ),
  };
}

export function buildJobAlertEmail(jobs: JobAlert[]): { subject: string; html: string } {
  const jobCards = jobs.map(job => `
    <tr>
      <td style="padding: 0 32px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid ${BRAND.border}; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="padding: 20px;">
              <h3 style="margin: 0 0 4px; font-size: 16px; font-weight: 600; color: ${BRAND.text};">${job.title}</h3>
              <p style="margin: 0 0 12px; font-size: 14px; color: ${BRAND.textSecondary};">${job.company}${job.location ? ` · ${job.location}` : ''}</p>
              ${job.salary_range ? `<p style="margin: 0 0 12px; font-size: 13px; color: ${BRAND.primary}; font-weight: 600;">${job.salary_range}</p>` : ''}
              ${job.tech_stack?.length ? `<p style="margin: 0 0 12px; font-size: 12px; color: ${BRAND.textMuted};">${job.tech_stack.slice(0, 4).join(' · ')}</p>` : ''}
              <a href="${job.url}" style="display: inline-block; font-size: 13px; font-weight: 600; color: ${BRAND.primary}; text-decoration: none;">View Job →</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  const body = `
    <!-- Hero -->
    <tr>
      <td style="background: linear-gradient(135deg, ${BRAND.primary}, ${BRAND.accent}); padding: 40px 32px; text-align: center;">
        <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #ffffff;">🎯 New Job Matches</h1>
        <p style="margin: 0; font-size: 15px; color: rgba(255,255,255,0.85);">We found ${jobs.length} role${jobs.length > 1 ? 's' : ''} matching your profile</p>
      </td>
    </tr>
    <tr><td style="height: 24px;"></td></tr>

    <!-- Jobs -->
    ${jobCards}

    <!-- CTA -->
    <tr>
      <td align="center" style="padding: 20px 32px 36px;">
        <a href="${SITE_URL}/dashboard" style="display: inline-block; background: ${BRAND.primary}; color: #ffffff; font-size: 14px; font-weight: 600; padding: 12px 32px; border-radius: 10px; text-decoration: none;">View All Jobs</a>
      </td>
    </tr>
  `;

  return {
    subject: `🎯 ${jobs.length} New Job${jobs.length > 1 ? 's' : ''} Match Your Profile`,
    html: emailLayout(
      'New Job Matches',
      `${jobs.length} new jobs match your profile on Hunter AI`,
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>`
    ),
  };
}

export function buildUsageWarningEmail(data: {
  feature: string;
  usage: number;
  limit: number;
  percentage: number;
  userName?: string;
}): { subject: string; html: string } {
  const { feature, usage, limit, percentage, userName } = data;

  const featureName = feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const remaining = limit - usage;

  const body = `
    <tr>
      <td style="padding: 40px 32px;">
        <h1 style="margin: 0 0 20px; font-size: 22px; font-weight: 700; color: ${BRAND.text};">📊 Usage Alert</h1>

        <p style="margin: 0 0 24px; font-size: 15px; color: ${BRAND.textSecondary}; line-height: 1.6;">
          ${userName ? `Hi ${userName},` : 'Hi there,'}<br>
          You've used ${usage} of your ${limit} ${featureName.toLowerCase()} this month (${Math.round(percentage)}%).
        </p>

        <!-- Usage Progress -->
        <div style="background: ${BRAND.bgSubtle}; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-weight: 600; color: ${BRAND.text};">${featureName}</span>
            <span style="font-size: 14px; color: ${BRAND.textSecondary};">${usage}/${limit}</span>
          </div>
          <div style="background: ${BRAND.border}; height: 8px; border-radius: 4px; overflow: hidden;">
            <div style="background: ${percentage >= 90 ? '#dc2626' : percentage >= 80 ? '#f59e0b' : BRAND.primary}; height: 100%; width: ${Math.min(percentage, 100)}%; border-radius: 4px;"></div>
          </div>
          <p style="margin: 12px 0 0; font-size: 13px; color: ${BRAND.textSecondary};">
            ${remaining} ${featureName.toLowerCase()} remaining this month
          </p>
        </div>

        <!-- Upgrade CTA -->
        <div style="text-align: center;">
          <a href="${SITE_URL}/dashboard?billing=true" style="display: inline-block; background: ${BRAND.primary}; color: #ffffff; font-size: 14px; font-weight: 600; padding: 14px 36px; border-radius: 8px; text-decoration: none;">
            Upgrade to Pro →
          </a>
        </div>
      </td>
    </tr>
  `;

  return {
    subject: `📊 ${Math.round(percentage)}% of your ${featureName.toLowerCase()} used`,
    html: emailLayout(
      'Usage Alert',
      `You've used ${Math.round(percentage)}% of your monthly ${featureName.toLowerCase()}`,
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>`
    ),
  };
}

function getFeatureList(tier: string): string[] {
  switch (tier) {
    case 'pro':
      return [
        '100 AI Job Applications per month',
        '50 Tailored Resume Generations',
        '25 AI Interview Practice Sessions',
        '100 AI Cover Letters',
        '500 Smart Job Matches',
        '200 Company Research Reports',
        '10 Skill Assessments'
      ];
    case 'enterprise':
      return [
        'Unlimited AI Job Applications',
        'Unlimited Resume Generations',
        'Unlimited AI Interview Practice',
        'Unlimited Cover Letters',
        'Unlimited Job Matches',
        'Unlimited Company Research',
        'Unlimited Skill Assessments',
        'Priority Support & Custom Integrations'
      ];
    default: // free
      return [
        '5 AI Job Applications per month',
        '3 Resume Generations',
        '2 AI Interview Sessions',
        '5 Cover Letters',
        '20 Job Matches',
        '10 Company Research Reports',
        '1 Skill Assessment'
      ];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/tests/email-templates.test.ts`
Expected: PASS

- [ ] **Step 5: Commit email template system**

```bash
git add supabase/functions/_shared/email-templates.ts src/tests/email-templates.test.ts
git commit -m "feat: create unified email template system

- Build payment confirmation emails with proper branding
- Support both Stripe and Paystack with currency formatting
- Add job alert and usage warning email templates
- Unified design system with Hunter branding colors
- Comprehensive test coverage"
```

---

## Task 5: Update Webhook Payment Confirmation

**Files:**
- Modify: `supabase/functions/stripe-webhook/index.ts:7-40`

- [ ] **Step 1: Update webhook to use new email templates**

```typescript
// supabase/functions/stripe-webhook/index.ts
// Replace the existing proActivatedEmail function with:

import { buildPaymentConfirmationEmail } from "../_shared/email-templates.ts";

// Remove old proActivatedEmail and paymentFailedEmail functions

async function sendTransactionalEmail(type: string, to: string, data?: any) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return;

  try {
    let email: { subject: string; html: string } | null = null;

    if (type === 'pro_activated' && data) {
      email = buildPaymentConfirmationEmail({
        tier: data.tier || 'pro',
        amount: data.amount || 19.99,
        currency: data.currency || 'usd',
        paymentProvider: data.paymentProvider || 'stripe',
        userName: data.userName
      });
    } else if (type === 'payment_failed') {
      // Keep existing payment failed template for now
      email = paymentFailedEmail();
    }

    if (!email) return;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: email.subject,
        html: email.html
      }),
    });

    console.log(`[WEBHOOK] Email sent: ${type} → ${to}`);
  } catch (err) {
    console.warn('[WEBHOOK] Non-critical email send failed:', err);
  }
}

// In the checkout.session.completed case (around line 220):
if (authUser?.user?.email) {
  sendTransactionalEmail('pro_activated', authUser.user.email, {
    tier,
    amount: session.amount_total / 100, // Convert from cents
    currency: session.currency === 'ngn' ? 'ngn' : 'usd',
    paymentProvider: 'stripe',
    userName: authUser.user.user_metadata?.full_name
  });
}
```

- [ ] **Step 2: Test webhook with new email template**

Create test webhook:
```bash
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

Test payment:
```bash
stripe checkout sessions create \
  --success-url="https://usehunter.app/dashboard" \
  --line-items='[{"price": "price_1234", "quantity": 1}]'
```

Expected: Receives payment confirmation with new template

- [ ] **Step 3: Commit webhook updates**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "feat: update webhook to use enhanced payment confirmation emails

- Use new email template system with proper branding
- Support both Stripe and Paystack email formatting
- Pass payment details (amount, currency, provider) to template
- Maintain backward compatibility with existing webhooks"
```

---

## Task 6: Notification Preferences Migration

**Files:**
- Create: `supabase/migrations/20260319000015_notification_preferences.sql`

- [ ] **Step 1: Create notification preferences migration**

```sql
-- Add notification settings to user preferences
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS
notification_settings JSONB DEFAULT '{
  "job_matches": {
    "enabled": true,
    "frequency": "daily",
    "time": "09:00",
    "timezone": "UTC"
  },
  "auto_applications": {
    "enabled": true,
    "frequency": "immediate"
  },
  "weekly_digest": {
    "enabled": true,
    "frequency": "weekly",
    "day": "sunday",
    "time": "09:00"
  },
  "payment_updates": {
    "enabled": true,
    "frequency": "immediate"
  },
  "usage_warnings": {
    "enabled": true,
    "threshold": 80
  }
}';

-- Create notification queue table
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'payment', 'job_alert', 'usage_warning', 'weekly_digest'
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Create processed notifications log
CREATE TABLE IF NOT EXISTS notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  email_subject TEXT,
  sent_to TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  unsubscribed_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_scheduled
  ON notification_queue (user_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status_scheduled
  ON notification_queue (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_history_user_type
  ON notification_history (user_id, type);
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at
  ON notification_history (sent_at);

-- RLS policies
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notification_queue
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view own notification history" ON notification_history
  FOR SELECT USING (user_id = auth.uid());

-- Service role can manage all notifications
CREATE POLICY "Service role can manage notifications" ON notification_queue
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage notification history" ON notification_history
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON notification_queue TO authenticated;
GRANT SELECT ON notification_history TO authenticated;
GRANT ALL ON notification_queue TO service_role;
GRANT ALL ON notification_history TO service_role;

-- Function to schedule notification
CREATE OR REPLACE FUNCTION schedule_notification(
  p_user_id UUID,
  p_type TEXT,
  p_priority TEXT DEFAULT 'medium',
  p_data JSONB DEFAULT '{}',
  p_scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notification_queue (
    user_id,
    type,
    priority,
    data,
    scheduled_for
  ) VALUES (
    p_user_id,
    p_type,
    p_priority,
    p_data,
    p_scheduled_for
  ) RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user notification preferences
CREATE OR REPLACE FUNCTION get_notification_preferences(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  prefs JSONB;
BEGIN
  SELECT notification_settings INTO prefs
  FROM user_preferences
  WHERE user_id = p_user_id;

  -- Return default preferences if none set
  IF prefs IS NULL THEN
    prefs := '{
      "job_matches": {"enabled": true, "frequency": "daily", "time": "09:00", "timezone": "UTC"},
      "auto_applications": {"enabled": true, "frequency": "immediate"},
      "weekly_digest": {"enabled": true, "frequency": "weekly", "day": "sunday", "time": "09:00"},
      "payment_updates": {"enabled": true, "frequency": "immediate"},
      "usage_warnings": {"enabled": true, "threshold": 80}
    }'::JSONB;
  END IF;

  RETURN prefs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push --linked`
Expected: SUCCESS - Applied notification preferences migration

- [ ] **Step 3: Verify migration**

Run: `npx supabase db dump --linked | grep -A 5 "notification_settings"`
Expected: Shows notification_settings column and tables

- [ ] **Step 4: Commit notification preferences migration**

```bash
git add supabase/migrations/20260319000015_notification_preferences.sql
git commit -m "feat: add notification preferences and queue system

- Add notification_settings JSONB column to user_preferences
- Create notification_queue table for batched processing
- Add notification_history for tracking sent emails
- Include helper functions for scheduling and preferences
- Set up RLS policies and proper indexing"
```

---

## Task 7: Usage Warning Integration

**Files:**
- Create: `supabase/functions/_shared/usage-tracker.ts`
- Modify: `src/hooks/useSubscription.ts:280-290`

- [ ] **Step 1: Create usage tracker with warning thresholds**

```typescript
// supabase/functions/_shared/usage-tracker.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface UsageWarningCheck {
  shouldWarn: boolean;
  percentage: number;
  usage: number;
  limit: number;
  feature: string;
}

export async function checkUsageWarnings(
  userId: string,
  featureName: string,
  newUsage: number
): Promise<UsageWarningCheck | null> {
  try {
    // Get user's subscription and preferences
    const [subResult, prefsResult] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('feature_limits')
        .eq('user_id', userId)
        .single(),
      supabase.rpc('get_notification_preferences', { p_user_id: userId })
    ]);

    if (subResult.error || !subResult.data) {
      console.error('[USAGE_TRACKER] Failed to get subscription:', subResult.error);
      return null;
    }

    const featureLimits = subResult.data.feature_limits;
    const notificationPrefs = prefsResult.data;

    // Check if usage warnings are enabled
    if (!notificationPrefs?.usage_warnings?.enabled) {
      return null;
    }

    const limit = featureLimits[featureName];
    if (limit === -1) return null; // Unlimited

    const percentage = (newUsage / limit) * 100;
    const threshold = notificationPrefs.usage_warnings.threshold || 80;

    // Check if we should warn (crossing threshold for first time)
    const previousPercentage = ((newUsage - 1) / limit) * 100;
    const shouldWarn = percentage >= threshold && previousPercentage < threshold;

    if (shouldWarn) {
      // Check if we already warned for this period
      const { data: existingWarning } = await supabase
        .from('notification_history')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'usage_warning')
        .gte('sent_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
        .like('email_subject', `%${featureName}%`)
        .single();

      if (existingWarning) {
        return null; // Already warned recently
      }

      return {
        shouldWarn: true,
        percentage: Math.round(percentage),
        usage: newUsage,
        limit,
        feature: featureName
      };
    }

    return null;
  } catch (error) {
    console.error('[USAGE_TRACKER] Error checking usage warnings:', error);
    return null;
  }
}

export async function scheduleUsageWarning(
  userId: string,
  warningData: UsageWarningCheck
): Promise<void> {
  try {
    await supabase.rpc('schedule_notification', {
      p_user_id: userId,
      p_type: 'usage_warning',
      p_priority: 'medium',
      p_data: {
        feature: warningData.feature,
        usage: warningData.usage,
        limit: warningData.limit,
        percentage: warningData.percentage
      }
    });

    console.log(`[USAGE_TRACKER] Scheduled usage warning for user ${userId}: ${warningData.feature} at ${warningData.percentage}%`);
  } catch (error) {
    console.error('[USAGE_TRACKER] Failed to schedule usage warning:', error);
  }
}
```

- [ ] **Step 2: Update useSubscription hook to trigger warnings**

```typescript
// src/hooks/useSubscription.ts - Update recordUsageMutation
const recordUsageMutation = useMutation({
  mutationFn: async ({ featureName, count = 1 }: {
    featureName: string;
    count?: number;
  }) => {
    if (!user?.id) throw new Error('User not authenticated');

    const { error } = await supabase.rpc('record_feature_usage', {
      p_user_id: user.id,
      p_feature_name: featureName,
      p_count: count
    });

    if (error) throw error;

    // Check for usage warnings (call edge function)
    try {
      const { data: currentUsage } = await supabase.rpc('get_feature_usage', {
        p_user_id: user.id,
        p_feature_name: featureName
      });

      if (currentUsage) {
        await supabase.functions.invoke('check-usage-warnings', {
          body: {
            userId: user.id,
            featureName,
            newUsage: currentUsage
          }
        });
      }
    } catch (warningError) {
      console.warn('Failed to check usage warnings:', warningError);
      // Non-blocking - don't throw
    }
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
```

- [ ] **Step 3: Create usage warning edge function**

```typescript
// supabase/functions/check-usage-warnings/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkUsageWarnings, scheduleUsageWarning } from "../_shared/usage-tracker.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    });
  }

  try {
    const { userId, featureName, newUsage } = await req.json();

    if (!userId || !featureName || typeof newUsage !== 'number') {
      return new Response('Missing required parameters', { status: 400 });
    }

    const warningCheck = await checkUsageWarnings(userId, featureName, newUsage);

    if (warningCheck?.shouldWarn) {
      await scheduleUsageWarning(userId, warningCheck);
    }

    return new Response(JSON.stringify({
      success: true,
      warning: warningCheck ? true : false
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[CHECK_USAGE_WARNINGS] Error:', error);
    return new Response('Internal server error', { status: 500 });
  }
});
```

- [ ] **Step 4: Deploy edge function**

Run: `npx supabase functions deploy check-usage-warnings --project-ref ffjsgjsiemtxqbhimvhb`
Expected: Function deployed successfully

- [ ] **Step 5: Test usage warning system**

Test with curl:
```bash
curl -X POST http://localhost:54321/functions/v1/check-usage-warnings \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid", "featureName": "job_applications", "newUsage": 4}'
```

Expected: Returns success and schedules warning if threshold reached

- [ ] **Step 6: Commit usage tracking system**

```bash
git add supabase/functions/_shared/usage-tracker.ts src/hooks/useSubscription.ts supabase/functions/check-usage-warnings/index.ts
git commit -m "feat: add usage warning system with threshold notifications

- Create usage tracker to monitor feature usage vs limits
- Trigger warnings when users hit 80% threshold
- Schedule notifications via queue system
- Non-blocking integration with subscription hook
- Deploy edge function for usage warning checks"
```

---

## Task 8: Notification Processing Engine

**Files:**
- Create: `supabase/functions/process-notifications/index.ts`
- Create: `supabase/functions/_shared/notification-queue.ts`

- [ ] **Step 1: Create notification queue management**

```typescript
// supabase/functions/_shared/notification-queue.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildPaymentConfirmationEmail,
  buildJobAlertEmail,
  buildUsageWarningEmail
} from "./email-templates.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM = 'Hunter <notifications@usehunter.app>';

interface QueuedNotification {
  id: string;
  user_id: string;
  type: string;
  priority: string;
  data: any;
  attempts: number;
  max_attempts: number;
}

export async function getQueuedNotifications(limit: number = 50): Promise<QueuedNotification[]> {
  const { data, error } = await supabase
    .from('notification_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('priority', { ascending: false }) // high, medium, low
    .order('scheduled_for', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[QUEUE] Failed to get notifications:', error);
    return [];
  }

  return data || [];
}

export async function processNotification(notification: QueuedNotification): Promise<boolean> {
  try {
    // Get user email
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(notification.user_id);

    if (authError || !authUser?.user?.email) {
      console.error('[QUEUE] No email for user:', notification.user_id);
      await markNotificationFailed(notification.id, 'No email address found');
      return false;
    }

    // Check user notification preferences
    const { data: prefs } = await supabase.rpc('get_notification_preferences', {
      p_user_id: notification.user_id
    });

    if (!shouldSendNotification(notification.type, prefs)) {
      console.log('[QUEUE] User has disabled notifications for:', notification.type);
      await markNotificationCancelled(notification.id);
      return true; // Successfully skipped
    }

    // Build email based on type
    const email = await buildNotificationEmail(notification.type, notification.data);
    if (!email) {
      await markNotificationFailed(notification.id, 'Failed to build email template');
      return false;
    }

    // Send email
    const success = await sendEmail(authUser.user.email, email.subject, email.html);

    if (success) {
      await markNotificationSent(notification.id, authUser.user.email, email.subject);
      return true;
    } else {
      await incrementNotificationAttempt(notification.id);
      return false;
    }

  } catch (error) {
    console.error('[QUEUE] Error processing notification:', error);
    await incrementNotificationAttempt(notification.id);
    return false;
  }
}

async function buildNotificationEmail(type: string, data: any): Promise<{ subject: string; html: string } | null> {
  switch (type) {
    case 'payment':
      return buildPaymentConfirmationEmail(data);

    case 'job_alert':
      return buildJobAlertEmail(data.jobs || []);

    case 'usage_warning':
      return buildUsageWarningEmail(data);

    case 'weekly_digest':
      // TODO: Implement weekly digest email
      return null;

    default:
      console.warn('[QUEUE] Unknown notification type:', type);
      return null;
  }
}

function shouldSendNotification(type: string, preferences: any): boolean {
  if (!preferences) return true; // Default allow

  switch (type) {
    case 'payment':
      return preferences.payment_updates?.enabled !== false;

    case 'job_alert':
      return preferences.job_matches?.enabled !== false;

    case 'usage_warning':
      return preferences.usage_warnings?.enabled !== false;

    case 'weekly_digest':
      return preferences.weekly_digest?.enabled !== false;

    default:
      return true;
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('[QUEUE] No Resend API key configured');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        html
      })
    });

    if (response.ok) {
      console.log('[QUEUE] Email sent successfully:', subject);
      return true;
    } else {
      const errorData = await response.text();
      console.error('[QUEUE] Email send failed:', response.status, errorData);
      return false;
    }
  } catch (error) {
    console.error('[QUEUE] Email send error:', error);
    return false;
  }
}

async function markNotificationSent(id: string, email: string, subject: string): Promise<void> {
  const now = new Date().toISOString();

  await Promise.all([
    // Update queue status
    supabase
      .from('notification_queue')
      .update({ status: 'sent', sent_at: now })
      .eq('id', id),

    // Add to history
    supabase
      .from('notification_history')
      .insert({
        user_id: (await supabase.from('notification_queue').select('user_id').eq('id', id).single()).data?.user_id,
        type: (await supabase.from('notification_queue').select('type').eq('id', id).single()).data?.type,
        email_subject: subject,
        sent_to: email,
        sent_at: now
      })
  ]);
}

async function markNotificationFailed(id: string, errorMessage: string): Promise<void> {
  await supabase
    .from('notification_queue')
    .update({
      status: 'failed',
      error_message: errorMessage
    })
    .eq('id', id);
}

async function markNotificationCancelled(id: string): Promise<void> {
  await supabase
    .from('notification_queue')
    .update({ status: 'cancelled' })
    .eq('id', id);
}

async function incrementNotificationAttempt(id: string): Promise<void> {
  // Get current attempts
  const { data } = await supabase
    .from('notification_queue')
    .select('attempts, max_attempts')
    .eq('id', id)
    .single();

  if (data) {
    const newAttempts = data.attempts + 1;
    const status = newAttempts >= data.max_attempts ? 'failed' : 'pending';

    await supabase
      .from('notification_queue')
      .update({
        attempts: newAttempts,
        status,
        error_message: newAttempts >= data.max_attempts ? 'Max attempts exceeded' : null
      })
      .eq('id', id);
  }
}
```

- [ ] **Step 2: Create notification processor edge function**

```typescript
// supabase/functions/process-notifications/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getQueuedNotifications, processNotification } from "../_shared/notification-queue.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    });
  }

  try {
    const batchSize = 50;
    console.log(`[PROCESSOR] Starting notification batch processing (max ${batchSize})`);

    const notifications = await getQueuedNotifications(batchSize);

    if (notifications.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No notifications to process',
        processed: 0
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[PROCESSOR] Processing ${notifications.length} notifications`);

    let processed = 0;
    let failed = 0;

    // Process notifications concurrently but with limit
    const concurrencyLimit = 10;
    const chunks = [];
    for (let i = 0; i < notifications.length; i += concurrencyLimit) {
      chunks.push(notifications.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (notification) => {
        const success = await processNotification(notification);
        if (success) {
          processed++;
        } else {
          failed++;
        }
      });

      await Promise.all(promises);
    }

    console.log(`[PROCESSOR] Batch complete: ${processed} processed, ${failed} failed`);

    return new Response(JSON.stringify({
      success: true,
      processed,
      failed,
      total: notifications.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[PROCESSOR] Batch processing error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

- [ ] **Step 3: Deploy notification processor**

Run: `npx supabase functions deploy process-notifications --project-ref ffjsgjsiemtxqbhimvhb`
Expected: Function deployed successfully

- [ ] **Step 4: Test notification processing**

Manually add test notification to queue:
```sql
INSERT INTO notification_queue (user_id, type, priority, data) VALUES
('user-uuid', 'usage_warning', 'medium', '{"feature": "job_applications", "usage": 4, "limit": 5, "percentage": 80}');
```

Test processing:
```bash
curl -X POST http://localhost:54321/functions/v1/process-notifications
```

Expected: Processes notification and sends email

- [ ] **Step 5: Set up cron job for regular processing**

```sql
-- Add to Supabase cron jobs or use GitHub Actions
-- This would run every 5 minutes to process queued notifications
SELECT cron.schedule(
  'process-notifications',
  '*/5 * * * *',
  'SELECT net.http_post(url:=''https://your-project.supabase.co/functions/v1/process-notifications'', headers:=''{}'') as request_id;'
);
```

- [ ] **Step 6: Commit notification processing engine**

```bash
git add supabase/functions/_shared/notification-queue.ts supabase/functions/process-notifications/index.ts
git commit -m "feat: implement notification processing engine

- Create notification queue management with batching
- Process different notification types with proper templates
- Respect user preferences for each notification type
- Handle email sending with retry logic and error handling
- Support concurrent processing with rate limiting
- Track notification history for analytics"
```

---

## Task 9: Frontend Notification Settings UI

**Files:**
- Create: `src/components/NotificationSettings.tsx`
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Write notification settings test**

```typescript
// src/tests/notification-settings.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { expect, describe, it, vi } from 'vitest';
import { NotificationSettings } from '@/components/NotificationSettings';
import { createWrapper } from './test-utils';

describe('NotificationSettings', () => {
  const mockSettings = {
    job_matches: { enabled: true, frequency: 'daily' },
    auto_applications: { enabled: true, frequency: 'immediate' },
    weekly_digest: { enabled: false, frequency: 'weekly' },
    payment_updates: { enabled: true, frequency: 'immediate' },
    usage_warnings: { enabled: true, threshold: 80 }
  };

  it('should render notification preferences correctly', () => {
    render(
      <NotificationSettings
        settings={mockSettings}
        onUpdate={() => {}}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Job Matches')).toBeInTheDocument();
    expect(screen.getByText('Daily email digest')).toBeInTheDocument();
    expect(screen.getByDisplayValue('80')).toBeInTheDocument();
  });

  it('should toggle notification preferences', () => {
    const mockOnUpdate = vi.fn();

    render(
      <NotificationSettings
        settings={mockSettings}
        onUpdate={mockOnUpdate}
      />,
      { wrapper: createWrapper() }
    );

    const weeklyToggle = screen.getByLabelText(/weekly digest/i);
    fireEvent.click(weeklyToggle);

    expect(mockOnUpdate).toHaveBeenCalledWith({
      ...mockSettings,
      weekly_digest: { enabled: true, frequency: 'weekly' }
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/tests/notification-settings.test.tsx`
Expected: FAIL - "Cannot find module"

- [ ] **Step 3: Create NotificationSettings component**

```tsx
// src/components/NotificationSettings.tsx
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail, Clock, Zap, TrendingUp } from 'lucide-react';

interface NotificationSetting {
  enabled: boolean;
  frequency?: string;
  time?: string;
  timezone?: string;
  threshold?: number;
  day?: string;
}

interface NotificationSettingsProps {
  settings: {
    job_matches: NotificationSetting;
    auto_applications: NotificationSetting;
    weekly_digest: NotificationSetting;
    payment_updates: NotificationSetting;
    usage_warnings: NotificationSetting;
  };
  onUpdate: (settings: any) => void;
  loading?: boolean;
}

const NOTIFICATION_TYPES = [
  {
    key: 'job_matches',
    title: 'Job Matches',
    description: 'New jobs that match your preferences',
    icon: <Zap className="w-4 h-4" />,
    hasFrequency: true,
    hasTime: true,
    frequencies: [
      { value: 'immediate', label: 'Immediate' },
      { value: 'daily', label: 'Daily digest' },
      { value: 'weekly', label: 'Weekly digest' },
      { value: 'never', label: 'Never' }
    ]
  },
  {
    key: 'auto_applications',
    title: 'Auto Applications',
    description: 'When jobs are automatically applied to for you',
    icon: <Mail className="w-4 h-4" />,
    hasFrequency: true,
    frequencies: [
      { value: 'immediate', label: 'Immediate' },
      { value: 'daily', label: 'Daily summary' },
      { value: 'never', label: 'Never' }
    ]
  },
  {
    key: 'weekly_digest',
    title: 'Weekly Digest',
    description: 'Summary of your job search activity',
    icon: <TrendingUp className="w-4 h-4" />,
    hasFrequency: false,
    hasDay: true,
    hasTime: true
  },
  {
    key: 'payment_updates',
    title: 'Payment Updates',
    description: 'Billing and subscription notifications',
    icon: <Bell className="w-4 h-4" />,
    hasFrequency: false
  },
  {
    key: 'usage_warnings',
    title: 'Usage Warnings',
    description: 'Alerts when approaching monthly limits',
    icon: <Clock className="w-4 h-4" />,
    hasThreshold: true
  }
];

export function NotificationSettings({ settings, onUpdate, loading = false }: NotificationSettingsProps) {
  const updateSetting = (key: string, updates: Partial<NotificationSetting>) => {
    const newSettings = {
      ...settings,
      [key]: {
        ...settings[key as keyof typeof settings],
        ...updates
      }
    };
    onUpdate(newSettings);
  };

  const toggleEnabled = (key: string) => {
    const current = settings[key as keyof typeof settings];
    updateSetting(key, { enabled: !current.enabled });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Email Notifications
        </CardTitle>
        <CardDescription>
          Control when and how you receive updates about your job search
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {NOTIFICATION_TYPES.map((type) => {
          const setting = settings[type.key as keyof typeof settings];

          return (
            <div key={type.key} className="flex items-start justify-between py-4 border-b border-gray-100 last:border-0">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 bg-gray-50 rounded-lg">
                  {type.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">{type.title}</Label>
                    {setting?.enabled && <Badge variant="secondary" className="text-xs">On</Badge>}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{type.description}</p>

                  {/* Frequency Settings */}
                  {setting?.enabled && type.hasFrequency && (
                    <div className="mt-3 flex items-center gap-2">
                      <Label className="text-xs text-gray-500">Frequency:</Label>
                      <Select
                        value={setting.frequency || 'daily'}
                        onValueChange={(value) => updateSetting(type.key, { frequency: value })}
                        disabled={loading}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {type.frequencies?.map((freq) => (
                            <SelectItem key={freq.value} value={freq.value} className="text-xs">
                              {freq.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Time Settings */}
                  {setting?.enabled && type.hasTime && setting.frequency !== 'immediate' && (
                    <div className="mt-2 flex items-center gap-2">
                      <Label className="text-xs text-gray-500">Time:</Label>
                      <Input
                        type="time"
                        value={setting.time || '09:00'}
                        onChange={(e) => updateSetting(type.key, { time: e.target.value })}
                        className="w-24 h-8 text-xs"
                        disabled={loading}
                      />
                    </div>
                  )}

                  {/* Day Settings for Weekly Digest */}
                  {setting?.enabled && type.hasDay && (
                    <div className="mt-2 flex items-center gap-2">
                      <Label className="text-xs text-gray-500">Day:</Label>
                      <Select
                        value={setting.day || 'sunday'}
                        onValueChange={(value) => updateSetting(type.key, { day: value })}
                        disabled={loading}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sunday">Sunday</SelectItem>
                          <SelectItem value="monday">Monday</SelectItem>
                          <SelectItem value="tuesday">Tuesday</SelectItem>
                          <SelectItem value="wednesday">Wednesday</SelectItem>
                          <SelectItem value="thursday">Thursday</SelectItem>
                          <SelectItem value="friday">Friday</SelectItem>
                          <SelectItem value="saturday">Saturday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Threshold for Usage Warnings */}
                  {setting?.enabled && type.hasThreshold && (
                    <div className="mt-2 flex items-center gap-2">
                      <Label className="text-xs text-gray-500">Alert at:</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="50"
                          max="95"
                          step="5"
                          value={setting.threshold || 80}
                          onChange={(e) => updateSetting(type.key, { threshold: parseInt(e.target.value) })}
                          className="w-16 h-8 text-xs text-center"
                          disabled={loading}
                        />
                        <span className="text-xs text-gray-500">%</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Switch
                checked={setting?.enabled || false}
                onCheckedChange={() => toggleEnabled(type.key)}
                disabled={loading}
                aria-label={`Toggle ${type.title} notifications`}
              />
            </div>
          );
        })}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <div className="flex gap-2">
            <Bell className="w-4 h-4 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">Email Preferences</p>
              <p className="text-xs text-blue-600 mt-1">
                You can unsubscribe from any email type by clicking the unsubscribe link in our emails.
                Payment and security emails cannot be disabled.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default NotificationSettings;
```

- [ ] **Step 4: Add to Settings page**

```tsx
// src/pages/Settings.tsx - Add NotificationSettings section
import NotificationSettings from '@/components/NotificationSettings';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Add to Settings component:
const queryClient = useQueryClient();

// Get notification preferences
const { data: notificationSettings, isLoading: notificationLoading } = useQuery({
  queryKey: ['notification-settings', user?.id],
  queryFn: async () => {
    if (!user?.id) return null;

    const { data, error } = await supabase.rpc('get_notification_preferences', {
      p_user_id: user.id
    });

    if (error) throw error;
    return data;
  },
  enabled: !!user?.id
});

// Update notification preferences
const updateNotificationMutation = useMutation({
  mutationFn: async (settings: any) => {
    if (!user?.id) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('user_preferences')
      .update({ notification_settings: settings })
      .eq('user_id', user.id);

    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    toast.success('Notification preferences updated');
  },
  onError: (error: any) => {
    toast.error('Failed to update preferences', {
      description: error.message
    });
  }
});

// Add to Settings JSX:
<NotificationSettings
  settings={notificationSettings || {}}
  onUpdate={(settings) => updateNotificationMutation.mutate(settings)}
  loading={notificationLoading || updateNotificationMutation.isPending}
/>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test src/tests/notification-settings.test.tsx`
Expected: PASS

- [ ] **Step 6: Test notification settings UI**

Run: `npm run dev` and navigate to Settings page
Expected:
- Shows notification preferences with toggles
- Can change frequency and time settings
- Saves preferences to database

- [ ] **Step 7: Commit notification settings UI**

```bash
git add src/components/NotificationSettings.tsx src/pages/Settings.tsx src/tests/notification-settings.test.tsx
git commit -m "feat: add notification settings UI with comprehensive controls

- Create NotificationSettings component with toggles and options
- Support frequency, time, and threshold configurations
- Integrate with Settings page and user preferences system
- Add proper loading states and error handling
- Include comprehensive test coverage"
```

---

## Task 10: Integration Testing & Deployment

**Files:**
- Create: `src/tests/integration/payment-flow.test.ts`
- Create: `src/tests/integration/notification-system.test.ts`

- [ ] **Step 1: Write payment flow integration test**

```typescript
// src/tests/integration/payment-flow.test.ts
import { supabase } from '@/integrations/supabase/client';
import { createTestUser, cleanupTestUser } from '../test-utils';

describe('Payment Flow Integration', () => {
  let testUserId: string;

  beforeAll(async () => {
    testUserId = await createTestUser();
  });

  afterAll(async () => {
    await cleanupTestUser(testUserId);
  });

  it('should grant pro access after successful payment webhook', async () => {
    // Simulate webhook updating subscription
    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: testUserId,
        tier: 'pro',
        status: 'active',
        stripe_customer_id: 'cus_test123',
        stripe_subscription_id: 'sub_test123',
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });

    expect(error).toBeNull();

    // Check that user can access pro features
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier, feature_limits')
      .eq('user_id', testUserId)
      .single();

    expect(subscription?.tier).toBe('pro');
    expect(subscription?.feature_limits.job_applications).toBe(100);
  });

  it('should track feature usage correctly', async () => {
    // Record usage
    const { error } = await supabase.rpc('record_feature_usage', {
      p_user_id: testUserId,
      p_feature_name: 'job_applications',
      p_count: 5
    });

    expect(error).toBeNull();

    // Check usage was recorded
    const { data: usage } = await supabase.rpc('get_feature_usage', {
      p_user_id: testUserId,
      p_feature_name: 'job_applications'
    });

    expect(usage).toBe(5);
  });
});
```

- [ ] **Step 2: Write notification system integration test**

```typescript
// src/tests/integration/notification-system.test.ts
import { supabase } from '@/integrations/supabase/client';
import { createTestUser, cleanupTestUser } from '../test-utils';

describe('Notification System Integration', () => {
  let testUserId: string;

  beforeAll(async () => {
    testUserId = await createTestUser();
  });

  afterAll(async () => {
    await cleanupTestUser(testUserId);
  });

  it('should schedule notification correctly', async () => {
    const { data: notificationId, error } = await supabase.rpc('schedule_notification', {
      p_user_id: testUserId,
      p_type: 'usage_warning',
      p_priority: 'medium',
      p_data: {
        feature: 'job_applications',
        usage: 4,
        limit: 5,
        percentage: 80
      }
    });

    expect(error).toBeNull();
    expect(notificationId).toBeDefined();

    // Check notification was added to queue
    const { data: notifications } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('user_id', testUserId);

    expect(notifications).toHaveLength(1);
    expect(notifications![0].type).toBe('usage_warning');
  });

  it('should respect user notification preferences', async () => {
    // Disable usage warnings
    await supabase
      .from('user_preferences')
      .upsert({
        user_id: testUserId,
        notification_settings: {
          usage_warnings: { enabled: false }
        }
      });

    // Get preferences
    const { data: prefs } = await supabase.rpc('get_notification_preferences', {
      p_user_id: testUserId
    });

    expect(prefs.usage_warnings.enabled).toBe(false);
  });
});
```

- [ ] **Step 3: Run integration tests**

Run: `npm test src/tests/integration/`
Expected: All tests pass

- [ ] **Step 4: Deploy all edge functions**

```bash
# Deploy all new functions
npx supabase functions deploy check-usage-warnings --project-ref ffjsgjsiemtxqbhimvhb
npx supabase functions deploy process-notifications --project-ref ffjsgjsiemtxqbhimvhb

# Verify deployments
npx supabase functions list --project-ref ffjsgjsiemtxqbhimvhb
```

Expected: All functions deployed and listed

- [ ] **Step 5: Set up production cron jobs**

```sql
-- Set up notification processing cron job in Supabase
SELECT cron.schedule(
  'process-notifications',
  '*/5 * * * *',
  'SELECT net.http_post(
    url:=''https://ffjsgjsiemtxqbhimvhb.supabase.co/functions/v1/process-notifications'',
    headers:=''{"Content-Type": "application/json"}''::jsonb
  ) as request_id;'
);
```

- [ ] **Step 6: Test production payment flow**

Test Stripe integration:
1. Create test payment session
2. Complete payment in test mode
3. Verify webhook triggers correctly
4. Check user gains pro access immediately
5. Verify payment confirmation email sent with new template

Expected: Complete payment flow works end-to-end

- [ ] **Step 7: Commit integration tests and deployment**

```bash
git add src/tests/integration/
git commit -m "feat: add integration tests and production deployment

- Complete payment flow integration tests with webhook simulation
- Notification system tests with user preference validation
- Deploy all edge functions to production environment
- Set up cron jobs for automatic notification processing
- Verify end-to-end payment and notification workflows"
```

---

## Plan Summary

This implementation plan addresses all three critical issues:

1. **Payment Value Gap**: Enhanced `subscriptions` table preserves Paystack support while adding feature limits
2. **Email Template System**: Unified templates with Hunter branding for all notification types
3. **Smart Notifications**: Queue-based system with user preferences and usage warnings

**Key Deliverables:**
- ✅ Enhanced subscription system with preserved payment integrations
- ✅ Unified email template system with proper branding
- ✅ Smart notification engine with user preferences
- ✅ Usage tracking with automatic warning system
- ✅ Comprehensive test coverage and integration tests
- ✅ Production deployment with monitoring

**Success Metrics:**
- 100% of paid users get immediate pro access
- 0% payment integration breakage (Stripe + Paystack preserved)
- 25% email open rate for enhanced templates
- 20% reduction in churn via engagement notifications

**Next Steps After Completion:**
1. Monitor email deliverability and engagement metrics
2. A/B testing for notification timing optimization
3. Advanced features like ML-powered job matching notifications
4. Analytics dashboard for notification effectiveness

Total estimated implementation time: **3-4 weeks** for complete rollout with all features and comprehensive testing.