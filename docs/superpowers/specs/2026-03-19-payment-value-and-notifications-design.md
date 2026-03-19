# Hunter Payment Value Delivery & Notification System

**Date**: 2026-03-19
**Status**: Approved
**Approach**: Enhanced Old System (Preserve Paystack + Multi-Currency)

## Executive Summary

This design addresses three critical issues:
1. **Payment Value Gap**: Users pay successfully but don't see pro features (webhook writes to old table, UI reads from new table)
2. **Email Template Inconsistency**: Payment emails don't match app design system
3. **Missing Pro Engagement**: No notification system to keep pro users active and engaged

**Solution**: Enhance the existing `subscriptions` table to support advanced features while preserving all payment functionality (Paystack, multi-currency, existing integrations).

## Problem Analysis

### Root Cause: Dual Subscription Systems
- **Webhook Payment Flow**: Writes to `subscriptions` table (supports Stripe + Paystack + multi-currency)
- **Frontend UI Flow**: Reads from `user_subscriptions` table (Stripe-only, loses Paystack support)
- **Result**: Nigerian users paying via Paystack don't get pro access in UI

### Critical Requirements
- **Preserve Paystack Support**: Nigerian users pay via Paystack (₦32,000/month)
- **Maintain Multi-Currency**: USD ($19.99) and NGN (₦32,000) pricing
- **Keep Existing Integrations**: Webhook, billing portal, customer data
- **Add Advanced Features**: Usage tracking, detailed limits, smart notifications

## Architecture Overview

### Enhanced Subscription System

#### Database Schema Changes
```sql
-- Enhance existing subscriptions table (preserve all current fields)
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

-- Add usage tracking (links to enhanced subscriptions table)
CREATE TABLE IF NOT EXISTS subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  feature_name TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, feature_name, period_start)
);

-- Enhanced user preferences for notifications
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS
notification_settings JSONB DEFAULT '{
  "job_matches": {"enabled": true, "frequency": "daily"},
  "auto_applications": {"enabled": true, "frequency": "immediate"},
  "weekly_digest": {"enabled": true, "frequency": "weekly"},
  "payment_updates": {"enabled": true, "frequency": "immediate"},
  "usage_warnings": {"enabled": true, "threshold": 80}
}';
```

#### Feature Limits by Tier
```json
{
  "free": {
    "job_applications": 5,
    "resume_generations": 3,
    "ai_interviews": 2,
    "cover_letters": 5,
    "job_matches": 20,
    "company_research": 10,
    "skill_assessments": 1
  },
  "pro": {
    "job_applications": 100,
    "resume_generations": 50,
    "ai_interviews": 25,
    "cover_letters": 100,
    "job_matches": 500,
    "company_research": 200,
    "skill_assessments": 10
  },
  "enterprise": {
    "job_applications": -1,
    "resume_generations": -1,
    "ai_interviews": -1,
    "cover_letters": -1,
    "job_matches": -1,
    "company_research": -1,
    "skill_assessments": -1
  }
}
```

### Frontend Integration

#### Updated useSubscription Hook
```typescript
// Replace complex user_subscriptions query with enhanced subscriptions table
const { data: subscription } = useQuery({
  queryKey: ['subscription', user?.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (error) throw error;
    return {
      tier: data.tier,
      features: getFeatureLimits(data.tier),
      currency: data.currency,
      paymentProvider: data.payment_provider,
      // ... other fields
    };
  }
});
```

#### Pro Feature Access Control
```typescript
// Simple tier-based access (preserve existing pattern)
const canUseFeature = (feature: string) => {
  const limits = subscription?.feature_limits || {};
  const limit = limits[feature];
  return limit === -1 || (currentUsage[feature] || 0) < limit;
};
```

## Email Template System

### Design System
**Brand Colors**: `#0d9488` (primary teal), `#10b981` (accent)
**Typography**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto`
**Layout**: Card-based with 16px border radius, responsive 600px max-width

### Email Types

#### 1. Payment Confirmation
**Triggers**: Stripe webhook `checkout.session.completed`, Paystack payment verification
**Content**:
- Welcome message with user's tier
- Feature breakdown (visual checklist)
- Payment receipt (provider-specific formatting)
- Dashboard CTA button

#### 2. Job Match Alerts
**Triggers**: New jobs matching user criteria (daily batch)
**Content**:
- Personalized job cards (title, company, salary, tech stack)
- Match reasoning ("90% skill match")
- Quick apply CTAs

#### 3. Auto-Application Confirmations
**Triggers**: Successful job application via auto-applier
**Content**:
- Job details applied to
- Application summary (resume used, cover letter highlights)
- Next steps (interview prep suggestions)

#### 4. Weekly Digest
**Triggers**: Sunday 9 AM user timezone
**Content**:
- Applications sent count
- New job matches count
- Interview opportunities
- Usage summary with upgrade prompts

#### 5. Usage Warnings
**Triggers**: 80% of monthly limit reached
**Content**:
- Current usage vs limit
- Days remaining in billing cycle
- Upgrade suggestions with pricing

### Template Architecture

#### Base Email Layout
```typescript
function emailLayout(title: string, previewText: string, bodyContent: string) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;">
        <div style="max-width: 600px; margin: 0 auto; background: #f8fafc;">
          ${logoHeader()}
          <div style="background: #ffffff; border-radius: 16px; margin: 20px;">
            ${bodyContent}
          </div>
          ${emailFooter()}
        </div>
      </body>
    </html>
  `;
}
```

#### Payment Confirmation Template
```typescript
function buildPaymentConfirmation(userTier: string, amount: number, currency: string, paymentProvider: string) {
  const features = getFeatureList(userTier);
  const receipt = formatPaymentReceipt(amount, currency, paymentProvider);

  return emailLayout(
    `Welcome to Hunter ${userTier.toUpperCase()}!`,
    `Your ${userTier} subscription is now active`,
    `
      <div style="background: linear-gradient(135deg, #0d9488, #10b981); padding: 40px; color: white;">
        <h1>Welcome to Hunter ${userTier.toUpperCase()}!</h1>
        <p>Your AI job search agent is now active.</p>
      </div>
      <div style="padding: 32px;">
        <h3>Your new features:</h3>
        ${features.map(f => `<p>✓ ${f}</p>`).join('')}
        ${receipt}
        <div style="text-align: center; margin-top: 32px;">
          <a href="https://usehunter.app/dashboard"
             style="background: #0d9488; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none;">
            Open Dashboard →
          </a>
        </div>
      </div>
    `
  );
}
```

## Notification System Architecture

### Notification Engine

#### Trigger Types
1. **Immediate**: Payment confirmations, auto-application results
2. **Scheduled**: Daily job matches (9 AM user timezone)
3. **Threshold**: Usage warnings (80%, 95%, 100%)
4. **Periodic**: Weekly digests (Sunday 9 AM)

#### Queue System
```typescript
interface NotificationJob {
  id: string;
  userId: string;
  type: 'payment' | 'job_alert' | 'usage_warning' | 'weekly_digest';
  priority: 'high' | 'medium' | 'low';
  scheduledFor: Date;
  data: Record<string, any>;
  attempts: number;
}
```

#### Processing Logic
```typescript
// High priority: Process immediately
if (priority === 'high') {
  await sendEmail(notification);
}

// Medium priority: Batch by user preferences
if (priority === 'medium') {
  await addToBatch(userId, notification);
}

// Low priority: Weekly digest only
if (priority === 'low') {
  await addToDigest(userId, notification);
}
```

### User Preference Controls

#### Notification Settings Schema
```json
{
  "job_matches": {
    "enabled": true,
    "frequency": "daily", // daily, weekly, never
    "time": "09:00",
    "timezone": "Africa/Lagos"
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
    "threshold": 80 // percentage
  }
}
```

#### Settings UI Component
```typescript
// Add to dashboard settings
<NotificationPreferences
  settings={user.notification_settings}
  onUpdate={updateNotificationSettings}
/>
```

### Integration Points

#### 1. Payment Webhook Integration
```typescript
// stripe-webhook/index.ts
case 'checkout.session.completed':
  // Existing logic...

  // Add notification trigger
  await scheduleNotification({
    userId,
    type: 'payment',
    priority: 'high',
    data: { tier, amount, currency, paymentProvider }
  });
```

#### 2. Job Crawler Integration
```typescript
// crawl-jobs/index.ts
const newJobs = await crawlJobs();
const matchingUsers = await findUsersForJobs(newJobs);

for (const [userId, jobs] of matchingUsers) {
  await scheduleNotification({
    userId,
    type: 'job_alert',
    priority: 'medium',
    data: { jobs: jobs.slice(0, 5) } // Top 5 matches
  });
}
```

#### 3. Auto-Applier Integration
```typescript
// match-and-apply/index.ts
const applicationResult = await applyToJob(userId, jobId);

await scheduleNotification({
  userId,
  type: 'auto_application',
  priority: 'high',
  data: { jobId, status: applicationResult.status, jobTitle, company }
});
```

#### 4. Usage Tracking Integration
```typescript
// Record usage and check thresholds
async function recordUsage(userId: string, feature: string) {
  const usage = await incrementUsage(userId, feature);
  const limits = await getFeatureLimits(userId);
  const percentage = (usage / limits[feature]) * 100;

  if (percentage >= 80 && !alreadyWarned) {
    await scheduleNotification({
      userId,
      type: 'usage_warning',
      priority: 'medium',
      data: { feature, usage, limit: limits[feature], percentage }
    });
  }
}
```

## Implementation Plan

### Phase 1: Critical Payment Fix (Week 1)
1. **Database Migration**:
   - Add `feature_limits` column to `subscriptions` table
   - Populate pro/enterprise feature limits
   - Create usage tracking table

2. **Frontend Updates**:
   - Update `useSubscription` hook to read from `subscriptions` table
   - Remove `user_subscriptions` table dependencies
   - Test all pro feature access controls

3. **Validation**:
   - Verify existing pro users see features immediately
   - Test new Stripe payments (USD)
   - Test new Paystack payments (NGN)

### Phase 2: Enhanced Email System (Week 2)
1. **Template Development**:
   - Create base email layout with design system
   - Build payment confirmation template
   - Update webhook to use new template

2. **Email Service Enhancement**:
   - Extend `send-notification` function with new templates
   - Add currency-aware formatting
   - Add payment provider detection

3. **Testing**:
   - Send test emails for both Stripe and Paystack
   - Verify design consistency across email clients

### Phase 3: Notification Engine (Week 3-4)
1. **Core Engine**:
   - Build notification queue system
   - Implement user preference controls
   - Create batch processing logic

2. **Integration**:
   - Connect to job crawler for match alerts
   - Connect to auto-applier for confirmations
   - Add usage warning triggers

3. **User Experience**:
   - Add notification settings to dashboard
   - Create unsubscribe/preference management
   - Implement timezone-aware scheduling

### Phase 4: Advanced Features (Week 5)
1. **Smart Notifications**:
   - ML-powered job match scoring
   - Personalized send time optimization
   - A/B testing for email content

2. **Analytics**:
   - Email open/click tracking
   - User engagement metrics
   - Notification effectiveness analysis

## Success Metrics

### Immediate (Week 1)
- ✅ 100% of paid users see pro features after payment
- ✅ 0% payment integration breakage (Stripe + Paystack)
- ✅ All existing pro users retain access

### Short-term (Month 1)
- 📈 40% increase in pro feature usage post-payment
- 📧 25% email open rate for payment confirmations
- 📧 15% click-through rate to dashboard

### Long-term (Month 3)
- 🔄 20% reduction in churn rate via engagement emails
- 📊 30% increase in pro conversion via usage warnings
- ⭐ 4.5+ user satisfaction score for email communications

## Risk Mitigation

### Technical Risks
- **Data Loss**: Comprehensive backup before migration
- **Payment Breakage**: Gradual rollout with rollback plan
- **Email Deliverability**: Multiple provider setup (Resend + backup)

### Business Risks
- **User Confusion**: Clear communication about system improvements
- **Revenue Impact**: Payment testing in staging environment first
- **Support Load**: FAQ updates and support team briefing

## Conclusion

This design preserves all existing payment functionality while adding the advanced features needed for user engagement and retention. The phased approach ensures minimal risk while delivering immediate value to users who have paid but aren't receiving pro benefits.

Key benefits:
- **Immediate Fix**: Paying users get value right away
- **Enhanced Engagement**: Smart notifications keep users active
- **Future-Proof**: Extensible architecture for advanced features
- **Zero Loss**: All payment integrations preserved (Paystack, multi-currency)