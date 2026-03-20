---
title: Rate Limit Admin Dashboard Feature
date: 2026-03-20
type: Feature Specification
status: Approved
---

# Rate Limit Admin Dashboard Feature

## Overview

Add a comprehensive rate limit management feature to the platform admin dashboard, allowing administrators to relax rate limits for testing purposes through global test mode, function-specific overrides, and user exemptions.

## Problem Statement

Currently, rate limits are hardcoded in each edge function (e.g., 10 requests/minute for free tier, 40 for pro tier). During development and testing, these strict limits cause friction and slow down testing workflows. Administrators need a way to dynamically adjust these limits without code changes.

## Solution Approach

**Override-Based System**: Keep existing hardcoded limits as defaults, but add a database-driven override system that the rate limiter checks first. This maintains system stability while providing flexibility for testing.

## Database Schema

### New Table: `rate_limit_overrides`

```sql
CREATE TABLE rate_limit_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Global test mode
  global_test_mode_enabled BOOLEAN DEFAULT false,
  global_test_mode_multiplier NUMERIC(4,1) DEFAULT 10.0,
  global_test_mode_expires_at TIMESTAMPTZ,
  global_test_mode_enabled_by UUID REFERENCES auth.users(id),
  global_test_mode_enabled_at TIMESTAMPTZ,

  -- Per-function overrides
  function_overrides JSONB DEFAULT '{}',
  -- Example: {"generate-content": {"free": {"max": 100, "window": 60}, "pro": {"max": 200, "window": 60}}}

  -- User-specific exemptions
  exempted_users UUID[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Single row for global configuration
INSERT INTO rate_limit_overrides DEFAULT VALUES;

-- RLS Policies
ALTER TABLE rate_limit_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin access only" ON rate_limit_overrides
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM platform_admins
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Indexes for performance
CREATE INDEX idx_rate_limit_overrides_test_mode ON rate_limit_overrides(global_test_mode_enabled, global_test_mode_expires_at);
```

## Backend Changes

### Enhanced Rate Limiter

Update `supabase/functions/_shared/rate-limiter.ts`:

1. **Check Order**: User exemptions → Global test mode → Function overrides → Default limits
2. **Auto-expiry**: Test mode automatically disables after 6 hours
3. **Performance**: Only queries overrides table when necessary
4. **Backwards compatibility**: Preserves existing rate limit behavior when no overrides exist

### Key Methods

```typescript
// Enhanced isAllowed method with override support
async isAllowed(functionName: string, limits: RateLimits): Promise<RateLimitResult>

// Check if user is exempted from all rate limits
private async isUserExempted(userId: string): Promise<boolean>

// Apply global test mode multiplier to default limits
private applyTestModeMultiplier(limits: RateLimits, multiplier: number): RateLimits

// Get function-specific overrides from configuration
private getFunctionOverride(functionName: string, config: any): RateLimits | null
```

## Frontend Implementation

### Admin Page: `/admin/rate-limits`

**Route**: Add to admin sidebar navigation
**Component**: `src/pages/admin/RateLimitsPage.tsx`
**Protection**: `RequireAdmin` wrapper

#### UI Sections

1. **Global Test Mode Card**
   - Toggle switch with current status
   - Multiplier selector (2x, 5x, 10x, 25x, 50x)
   - Expiry countdown timer
   - Warning banner when active
   - Enable/disable audit trail

2. **Function Overrides Table**
   - List all edge functions with current effective limits
   - Editable inputs for free/pro tier limits
   - "Reset to Default" buttons per function
   - Real-time validation

3. **User Exemptions Panel**
   - Search users by email
   - Add/remove exemption status
   - List currently exempted users
   - Admin-only exemption controls

#### Warning Systems

- **Global Banner**: Persistent warning across all admin pages when test mode active
- **Confirmation Modals**: For enabling test mode or adding exemptions
- **Visual Indicators**: Color-coded status indicators and countdown timers

## Security Features

### Access Control
- **Admin-Only Access**: All rate limit management restricted to platform admins
- **RLS Protection**: Database policies prevent non-admin access
- **Audit Logging**: All changes tracked in `platform_logs`

### Safeguards
- **Auto-Expiry**: Test mode auto-disables after 6 hours
- **Visual Warnings**: Persistent banners and status indicators
- **Email Notifications**: Alerts sent when test mode toggled
- **Change Audit**: All modifications logged with admin user and timestamp

### Validation
- **Reasonable Limits**: Prevent setting extremely high limits that could cause system issues
- **Multiplier Bounds**: Test mode multiplier limited to sensible range (2x-50x)
- **User Validation**: Exempted users must exist and be valid

## Implementation Plan

### Phase 1: Database Foundation
1. Create `rate_limit_overrides` table with RLS policies
2. Add database functions for rate limit configuration
3. Create audit logging for rate limit changes

### Phase 2: Backend Enhancement
1. Update shared rate limiter with override logic
2. Add helper functions for configuration management
3. Update all edge functions to use enhanced rate limiter

### Phase 3: Admin UI
1. Create rate limits admin page with three sections
2. Add sidebar navigation link
3. Implement warning banner system
4. Add email notification service

### Phase 4: Testing & Documentation
1. Test all override scenarios
2. Verify security controls
3. Update admin guide documentation
4. Create troubleshooting guide

## API Changes

### New Database Functions

```sql
-- Get current rate limit configuration
CREATE FUNCTION get_rate_limit_config() RETURNS rate_limit_overrides

-- Enable/disable global test mode
CREATE FUNCTION toggle_test_mode(enabled BOOLEAN, multiplier NUMERIC, admin_id UUID) RETURNS BOOLEAN

-- Set function-specific overrides
CREATE FUNCTION set_function_override(func_name TEXT, limits JSONB) RETURNS BOOLEAN

-- Add/remove user exemptions
CREATE FUNCTION toggle_user_exemption(user_id UUID, exempted BOOLEAN) RETURNS BOOLEAN
```

## Testing Strategy

### Unit Tests
- Rate limiter override logic
- Database function behavior
- Admin UI component interactions

### Integration Tests
- End-to-end rate limit flows
- Admin dashboard functionality
- Email notification delivery

### Security Tests
- Non-admin access attempts
- SQL injection resistance
- Privilege escalation attempts

## Monitoring & Alerts

### Metrics to Track
- Test mode activation frequency and duration
- Override usage patterns
- Rate limit hit rates before/after overrides

### Alert Conditions
- Test mode enabled for > 4 hours
- Unusual rate limit override patterns
- Failed admin authentication attempts

## Migration Strategy

1. **Database Migration**: Add new table and functions
2. **Backwards Compatibility**: Existing rate limiting continues unchanged
3. **Gradual Rollout**: Enable for admin users first
4. **Documentation Update**: Update admin guide and troubleshooting docs

## Success Criteria

- [x] Admins can enable global test mode with auto-expiry
- [x] Function-specific rate limits can be overridden through UI
- [x] Users can be exempted from rate limiting
- [x] All changes are audited and logged
- [x] System remains secure with proper access controls
- [x] No performance degradation to existing rate limiting
- [x] Clear visual indicators when overrides are active

## Risk Mitigation

### Performance Risk
- **Mitigation**: Cache override configuration, only query when changes detected
- **Fallback**: Override system fails-safe to default hardcoded limits

### Security Risk
- **Mitigation**: Strict RLS policies, admin-only access, comprehensive audit logging
- **Monitoring**: Alert on unusual override patterns or access attempts

### Operational Risk
- **Mitigation**: Auto-expiry prevents forgotten test mode, visual warnings ensure awareness
- **Recovery**: Easy disable/reset mechanisms for all override types

## Future Enhancements

1. **Environment Detection**: Automatically apply different limits for dev/staging/prod
2. **Scheduled Overrides**: Allow time-based rate limit changes
3. **Usage Analytics**: Dashboard showing rate limit hit patterns
4. **Bulk Operations**: Apply overrides to multiple functions simultaneously
5. **API Endpoint**: RESTful API for programmatic rate limit management

---

*This specification provides a comprehensive, secure, and user-friendly solution for dynamic rate limit management that maintains system stability while enabling flexible testing capabilities.*