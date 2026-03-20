# Usage Warning Integration System

## Overview

The Usage Warning Integration system automatically monitors feature usage against subscription limits and triggers smart warnings when users approach their quotas. This prevents unexpected limit hits and provides a better user experience.

## Architecture

```
Feature Usage → Usage Tracker → Warning Check → Notification Queue → Email Delivery
```

### Components

1. **Usage Tracker** (`supabase/functions/_shared/usage-tracker.ts`)
   - Monitors feature usage vs limits in real-time
   - Calculates usage percentages and threshold checks
   - Prevents duplicate warnings within 30-day periods

2. **Warning Check Edge Function** (`supabase/functions/check-usage-warnings/index.ts`)
   - Triggered automatically on feature usage
   - Non-blocking integration (usage recording continues even if warnings fail)
   - Schedules notifications via the queue system

3. **Frontend Integration** (`src/hooks/useSubscription.ts`)
   - Seamlessly integrated into the `recordUsage` mutation
   - Automatically triggers warning checks after usage recording
   - Graceful error handling for warning failures

4. **Notification System Integration**
   - Uses existing notification queue from Task 8
   - Respects user notification preferences
   - Configurable warning thresholds (default: 80%)

## Key Features

### Smart Threshold Detection
- Triggers warnings when crossing the configured threshold (default 80%)
- Only warns once per billing period to avoid spam
- Supports custom thresholds per user via notification preferences

### Non-Blocking Operation
- Usage recording works even if warning system fails
- Warnings are processed asynchronously
- No impact on core application performance

### User Preferences Integration
```json
{
  "usage_warnings": {
    "enabled": true,
    "threshold": 80
  }
}
```

### Duplicate Prevention
- Tracks warning history via `notification_history` table
- Prevents multiple warnings for the same feature within 30 days
- Uses email subject pattern matching for feature identification

## Database Schema

### Notification Queue Entry
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "type": "usage_warning",
  "priority": "medium",
  "data": {
    "feature": "job_searches",
    "usage": 8,
    "limit": 10,
    "percentage": 80
  }
}
```

### Usage Tracking
- Leverages existing `subscription_usage` table
- Real-time usage calculations
- Monthly period tracking

## API Reference

### Edge Function: `check-usage-warnings`
```typescript
// Request
{
  userId: string,
  featureName: string,
  newUsage: number
}

// Response
{
  success: boolean,
  warning: boolean
}
```

### Shared Function: `checkUsageWarnings`
```typescript
checkUsageWarnings(
  userId: string,
  featureName: string,
  newUsage: number
): Promise<UsageWarningCheck | null>
```

### Frontend Hook Integration
```typescript
const { recordUsage } = useSubscription();

// Automatically triggers usage warnings
await recordUsage({
  featureName: 'job_searches',
  count: 1
});
```

## Testing

### System Verification
1. ✅ Edge function deployment
2. ✅ Non-blocking integration
3. ✅ Notification queue integration
4. ✅ User preferences respect
5. ✅ Threshold calculation accuracy
6. ✅ Duplicate prevention logic

### Test Coverage
- Unit tests for threshold calculations
- Integration tests for warning triggers
- End-to-end notification flow validation
- Error handling verification

## Configuration

### Default Settings
- Warning threshold: 80%
- Warning frequency: Once per 30 days per feature
- Priority: Medium
- Notification type: `usage_warning`

### User Customization
Users can configure:
- Enable/disable usage warnings
- Custom threshold percentage (1-99%)
- Notification preferences via frontend UI

## Deployment Status

- ✅ Edge function deployed (`check-usage-warnings`)
- ✅ Shared utilities available
- ✅ Database migrations applied
- ✅ Frontend integration complete
- ✅ Testing verified

## Future Enhancements

1. **Progressive Warnings**
   - Multiple thresholds (50%, 80%, 95%)
   - Escalating notification priority

2. **Usage Analytics**
   - Historical usage trend analysis
   - Predictive limit reaching

3. **Smart Recommendations**
   - Upgrade suggestions based on usage patterns
   - Feature optimization tips

## Related Documentation

- [Task 8: Notification Preferences & Queue System](../docs/superpowers/plans/2026-03-19-payment-value-and-notifications.md)
- [Subscription System Architecture](./subscription-system.md)
- [Notification Processing Engine](./notification-engine.md)

---

*Last updated: March 19, 2026*
*System Status: ✅ PRODUCTION READY*