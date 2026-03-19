# 🎯 Usage Limits & Overage System Guide

## Overview

Hunter AI now includes a comprehensive usage tracking and subscription limit system that allows users to:

- ✅ Track feature usage across different subscription tiers
- ✅ Enforce limits based on subscription plans
- ✅ Purchase overage credits when limits are reached
- ✅ Upgrade subscriptions for unlimited access
- ✅ View detailed usage analytics

## 🏗️ Architecture

### Database Schema

**Key Tables:**
- `subscription_plans` - Available subscription tiers and limits
- `user_subscriptions` - User's active subscription details
- `usage_tracking` - Monthly usage tracking per user/feature
- `overage_purchases` - Purchased overage credits
- `usage_alerts` - Usage threshold notifications

### Features Tracked

```typescript
type FeatureName =
  | 'job_applications'      // Apply to jobs
  | 'resume_generations'    // Generate tailored resumes
  | 'ai_interviews'         // Practice interviews with AI
  | 'cover_letters'         // Generate cover letters
  | 'job_matches'           // Get job recommendations
  | 'company_research'      // Research companies
  | 'skill_assessments'     // Take skill tests
```

### Subscription Tiers

| Plan | Price | Job Applications | Resume Gen | AI Interviews | Other Features |
|------|-------|------------------|------------|---------------|----------------|
| Free | $0 | 5/month | 3/month | 2/month | Limited |
| Pro | $19.99 | 100/month | 50/month | 25/month | Enhanced |
| Enterprise | $99.99 | Unlimited | Unlimited | Unlimited | Full |

## 🚀 Implementation Guide

### 1. Basic Usage Tracking

```typescript
import { useSubscription } from '@/hooks/useSubscription';

function MyComponent() {
  const { useFeature, usageOverview } = useSubscription();

  const handleAction = async () => {
    const result = await useFeature('job_applications', 1, {
      job_id: 'job-123',
      source: 'dashboard'
    });

    if (result.success) {
      // Action was successful, usage recorded
      console.log('Feature used successfully');
    } else if (result.needsOverage) {
      // User needs to purchase overage credits
      console.log('Usage limit reached:', result.needsOverage);
    }
  };

  return (
    <div>
      <button onClick={handleAction}>Apply to Job</button>
      {/* Usage info */}
      {usageOverview && (
        <p>{usageOverview.features[0].current_usage} / {usageOverview.features[0].limit_amount} used</p>
      )}
    </div>
  );
}
```

### 2. Usage Guard Component

Automatically enforces limits and shows upgrade prompts:

```typescript
import { UsageGuard } from '@/components/subscription/UsageGuard';

function JobApplicationButton({ jobId }) {
  const handleApply = () => {
    // This will only execute if user has available usage
    applyToJob(jobId);
  };

  return (
    <UsageGuard
      featureName="job_applications"
      requiredCount={1}
      showInlineWarnings={true}
    >
      <Button onClick={handleApply}>
        Apply to Job
      </Button>
    </UsageGuard>
  );
}
```

### 3. Higher-Order Component

For wrapping existing components:

```typescript
import { withUsageLimit } from '@/components/subscription/withUsageLimit';

const LimitedJobForm = withUsageLimit(
  JobApplicationForm,
  {
    featureName: 'job_applications',
    requiredCount: 1,
    showInlineWarnings: true
  }
);
```

### 4. Usage Dashboard

Display comprehensive usage information:

```typescript
import { UsageDashboard } from '@/components/subscription/UsageDashboard';

function SettingsPage() {
  return (
    <div>
      <h1>Your Usage</h1>
      <UsageDashboard showUpgradePrompts={true} />
    </div>
  );
}
```

## 🔧 Database Functions

### Check Feature Usage

```sql
SELECT * FROM check_feature_usage_limit(
  'user-uuid',
  'job_applications',
  1
);
```

Returns:
```json
{
  "can_use": true,
  "current_usage": 3,
  "limit_amount": 5,
  "remaining_amount": 2,
  "overage_needed": 0,
  "overage_cost": 0.00,
  "subscription_plan": "free"
}
```

### Record Usage

```sql
SELECT record_feature_usage(
  'user-uuid',
  'job_applications',
  1,
  '{"job_id": "job-123"}'::jsonb
);
```

### Purchase Overage Credits

```sql
SELECT purchase_overage_credits(
  'user-uuid',
  'job_applications',
  10,
  'pi_stripe_payment_intent_id'
);
```

## 💳 Payment Integration

### Overage Quotes

```typescript
const { getOverageQuote } = useSubscription();

const quote = await getOverageQuote('job_applications', 10);
// Returns: { quantity: 10, unit_price: 2.00, total_cost: 20.00, ... }
```

### Purchase Flow

```typescript
const { purchaseOverage } = useSubscription();

// After Stripe payment succeeds
await purchaseOverage({
  featureName: 'job_applications',
  quantity: 10,
  paymentIntentId: paymentIntent.id
});
```

## 🎨 UI Components

### Usage Progress Indicator

```typescript
function UsageProgress({ feature }) {
  const percentage = (feature.current_usage / feature.limit_amount) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>{feature.display_name}</span>
        <span>{feature.current_usage} / {feature.limit_amount}</span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
}
```

### Overage Modal

```typescript
import { OverageModal } from '@/components/subscription/OverageModal';

function MyComponent() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button onClick={() => setShowModal(true)}>
        Buy More Credits
      </Button>

      <OverageModal
        featureName="job_applications"
        open={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
```

## 🔄 Integration Examples

### Adding Limits to Existing Features

1. **Job Applications:**
```typescript
// Before applying
const canApply = await canUseFeature('job_applications');
if (!canApply) {
  showUpgradeModal();
  return;
}

// Apply logic here
await submitApplication(jobId);

// Record usage
await recordUsage('job_applications', 1, { job_id: jobId });
```

2. **Resume Generation:**
```typescript
const result = await useFeature('resume_generations', 1, {
  template_id: templateId,
  job_id: jobId
});

if (result.success) {
  generateResume();
} else {
  showOverageModal('resume_generations');
}
```

### Conditional Feature Display

```typescript
function FeatureCard({ featureName, children }) {
  const { usageOverview } = useSubscription();
  const feature = usageOverview?.features.find(f => f.feature_name === featureName);

  if (!feature?.can_use) {
    return (
      <Card className="opacity-50">
        <CardContent className="text-center py-8">
          <Lock className="mx-auto mb-2" />
          <p>Feature limit reached</p>
          <Button size="sm" onClick={() => showUpgradeModal()}>
            Upgrade Plan
          </Button>
        </CardContent>
      </Card>
    );
  }

  return children;
}
```

## 📊 Analytics & Monitoring

### Usage Analytics

```typescript
const { usageOverview } = useSubscription();

// Get usage for specific feature
const applicationUsage = usageOverview?.features.find(
  f => f.feature_name === 'job_applications'
);

console.log({
  current: applicationUsage.current_usage,
  limit: applicationUsage.limit_amount,
  remaining: applicationUsage.remaining_amount,
  percentage: applicationUsage.usage_percentage
});
```

### Billing Period

```typescript
const billingStart = new Date(usageOverview.billing_period_start);
const billingEnd = new Date(usageOverview.billing_period_end);
const daysRemaining = Math.ceil((billingEnd - new Date()) / (1000 * 60 * 60 * 24));
```

## ⚠️ Best Practices

### 1. Always Check Before Usage

```typescript
// ❌ Don't do this
await recordUsage('job_applications'); // Might exceed limit

// ✅ Do this
const result = await useFeature('job_applications');
if (result.success) {
  // Proceed with action
}
```

### 2. Provide Clear Feedback

```typescript
// Show usage status
const feature = usageOverview.features.find(f => f.feature_name === 'job_applications');

if (feature.usage_percentage >= 80) {
  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        You're using {Math.round(feature.usage_percentage)}% of your monthly job applications.
        <Button variant="link">Purchase more credits</Button>
      </AlertDescription>
    </Alert>
  );
}
```

### 3. Handle Errors Gracefully

```typescript
try {
  await useFeature('job_applications');
} catch (error) {
  if (error.message.includes('limit exceeded')) {
    showOverageModal();
  } else {
    toast.error('Something went wrong');
  }
}
```

### 4. Cache Usage Data

The `useSubscription` hook automatically caches usage data for 1 minute to avoid excessive queries.

## 🔐 Security Considerations

- ✅ All usage checks are server-side validated
- ✅ Rate limiting prevents abuse
- ✅ Overage purchases require payment confirmation
- ✅ Usage records include metadata for audit trails
- ✅ Row-level security ensures users only see their own data

## 🚀 Deployment Checklist

1. **Database Migration:**
   ```bash
   # Run the usage limits migration
   supabase db push
   ```

2. **Environment Variables:**
   ```bash
   STRIPE_SECRET_KEY=sk_...
   STRIPE_PUBLISHABLE_KEY=pk_...
   ```

3. **Webhook Setup:**
   Configure Stripe webhooks for payment events

4. **Monitoring:**
   Set up alerts for usage anomalies

## 🤝 Support & Troubleshooting

### Common Issues

**Q: User can't use feature despite having remaining usage**
- Check if usage cache is stale (refresh browser)
- Verify subscription status in database
- Check for pending overage purchases

**Q: Usage not updating after action**
- Ensure `recordUsage` is called after successful action
- Check network connectivity
- Verify database permissions

**Q: Overage purchase not reflecting**
- Check Stripe webhook delivery
- Verify payment intent status
- Check overage_purchases table

### Debug Queries

```sql
-- Check user's current subscription
SELECT * FROM user_subscriptions
WHERE user_id = 'user-uuid' AND status = 'active';

-- Check usage for current month
SELECT * FROM usage_tracking
WHERE user_id = 'user-uuid'
AND period_start >= DATE_TRUNC('month', CURRENT_DATE);

-- Check available overage credits
SELECT * FROM overage_purchases
WHERE user_id = 'user-uuid'
AND status = 'succeeded'
AND used_count < quantity;
```

This system provides a robust foundation for monetizing your app while providing a great user experience with clear usage tracking and flexible overage options.