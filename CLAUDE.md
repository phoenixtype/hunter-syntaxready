# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Hunter AI — Implementation Source of Truth

This document serves as the authoritative guide for feature implementations, code fixes, architecture patterns, and development standards for the Hunter AI platform.

## Quick Reference

### Essential Commands

```bash
# Development
npm run dev          # Start development server (localhost:3000)
npm run build        # Production build with type checking
npm run preview      # Preview production build locally
npm test             # Run test suite with vitest

# Code Quality
npm run lint         # ESLint validation
npm run type-check   # TypeScript validation (runs npx tsc --noEmit)

# Supabase Operations
supabase db push --linked                    # Apply migrations to linked project
supabase functions deploy --project-ref     # Deploy edge functions
supabase gen types typescript --local       # Regenerate types after schema changes
```

### Critical File Locations

```
src/
├── components/           # Reusable UI components
│   ├── ui/              # shadcn/ui base components
│   ├── auth/            # Authentication components
│   ├── payment/         # Stripe/Paystack components
│   └── admin/           # Admin-only components
├── lib/                 # Business logic & utilities
│   ├── auth.ts          # Auth utilities (checkAccess, etc.)
│   ├── stripe.ts        # Payment processing utilities
│   ├── cache.ts         # In-memory caching system
│   └── supabase.ts      # Database client & helpers
├── integrations/supabase/
│   ├── client.ts        # Supabase client configuration
│   └── types.ts         # Generated database types
└── pages/               # Route components

supabase/
├── migrations/          # Database schema changes
├── functions/           # Edge functions (Deno runtime)
└── config.toml         # Supabase configuration

docs/                    # Comprehensive documentation
├── ADMIN_GUIDE.md      # Keep updated per docs/ADMIN_MAINTENANCE.md
├── DEPLOYMENT_GUIDE.md # Production deployment procedures
└── DATABASE_SCHEMA.md  # Database design and relationships
```

### Emergency Debugging Commands

```bash
# Check production health
curl -s https://usehunter.app/api/health

# Supabase logs
supabase functions logs --project-ref <PROJECT_REF>

# Database connection test
supabase db ping --linked

# Edge function debugging
supabase functions serve <function-name> --debug
```

## Implementation Patterns

### Feature Development Workflow

**1. Planning & Analysis**
- Read relevant docs (especially `docs/SYSTEM_ARCHITECTURE.md`)
- Identify affected components, database tables, and edge functions
- Check if feature requires subscription gating (`lib/auth.ts` patterns)

**2. Database Changes** (if needed)
```bash
# Create migration
supabase migration new <descriptive_name>
# Edit the generated SQL file
# Apply locally
supabase db reset
# Push to production after testing
supabase db push --linked
```

**3. Edge Functions** (if needed)
```typescript
// Create in supabase/functions/<function-name>/index.ts
// Follow existing patterns from generate-content, parse-resume
// Include rate limiting and auth checks
// Test locally: supabase functions serve
// Deploy: supabase functions deploy <function-name> --project-ref
```

**4. Frontend Implementation**
- Use existing component patterns from `src/components/`
- Follow React Query patterns for server state
- Implement proper loading states and error handling
- Add TypeScript interfaces for new data structures

**5. Testing & Validation**
- Write component tests for critical paths
- Test subscription access controls if applicable
- Verify mobile responsiveness (Capacitor compatibility)
- Run full test suite: `npm test`

### Component Architecture Patterns

**Component Organization:**
```typescript
// ✅ Correct: Small, focused components
const UserProfileCard = ({ userId, showActions = true }) => {
  const { data: user, isLoading } = useQuery(...)
  // Single responsibility: display user profile
}

// ❌ Avoid: Monolithic components that do everything
const UserDashboard = () => {
  // 500+ lines handling profile, jobs, applications, etc.
}
```

**Prop Patterns:**
```typescript
// ✅ Use TypeScript interfaces
interface UserCardProps {
  user: User
  variant?: 'compact' | 'detailed'
  onEdit?: (user: User) => void
}

// ✅ Destructure with defaults
const UserCard = ({ user, variant = 'compact', onEdit }: UserCardProps) => {
  // Implementation
}
```

**Component File Structure:**
```
ComponentName/
├── index.ts           # Export only
├── ComponentName.tsx  # Main component
├── ComponentName.test.tsx  # Tests
└── types.ts          # Component-specific types
```

### State Management Patterns

**React Query for Server State:**
```typescript
// ✅ Use consistent query key patterns
const useUserProfile = (userId: string) => {
  return useQuery({
    queryKey: ['user', 'profile', userId],
    queryFn: () => getUserProfile(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// ✅ Invalidate patterns
const updateUserMutation = useMutation({
  mutationFn: updateUser,
  onSuccess: (data) => {
    queryClient.invalidateQueries(['user', 'profile', data.id])
    queryClient.invalidateQueries(['users']) // Invalidate list views
  }
})
```

**Local State Guidelines:**
```typescript
// ✅ Use useState for simple component state
const [isOpen, setIsOpen] = useState(false)

// ✅ Use useReducer for complex state transitions
const [formState, dispatch] = useReducer(formReducer, initialState)

// ❌ Avoid Zustand/Redux for server state (use React Query instead)
```

### API Integration Patterns

**Edge Function Structure:**
```typescript
// Standard edge function pattern
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Get Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! }
        }
      }
    )

    // 2. Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    // 3. Check subscription access if needed
    const hasAccess = await checkAccess(supabase, user.id, 'feature_name')
    if (!hasAccess) {
      return new Response('Subscription required', { status: 403, headers: corsHeaders })
    }

    // 4. Main logic
    const result = await processRequest(data)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response('Internal Server Error', { status: 500, headers: corsHeaders })
  }
})
```

**Frontend API Calls:**
```typescript
// ✅ Use React Query with proper error handling
const useProcessData = () => {
  return useMutation({
    mutationFn: async (data: ProcessRequest) => {
      const { data: result, error } = await supabase.functions.invoke('process-data', {
        body: data
      })
      if (error) throw new Error(error.message)
      return result
    },
    onError: (error) => {
      toast.error(`Processing failed: ${error.message}`)
    }
  })
}
```

## Code Architecture & Standards

### Project Structure Logic

**Component Organization Philosophy:**
- `components/ui/` - Pure UI components from shadcn/ui (no business logic)
- `components/auth/` - Authentication-specific components
- `components/payment/` - Payment and subscription components
- `components/[feature]/` - Feature-specific components (resume, recruiter, etc.)
- `components/admin/` - Admin-only components (separate access controls)

**Business Logic Separation:**
- `lib/` - Pure business logic, utilities, and API wrappers
- `hooks/` - Custom React hooks that combine UI state with business logic
- `integrations/` - Third-party service integrations (Supabase, Stripe)

**Where to Put New Code:**
- **New UI Component**: `src/components/[feature]/ComponentName/`
- **Business Logic**: `src/lib/[feature].ts`
- **Database Function**: `src/lib/supabase/[feature].ts`
- **Custom Hook**: `src/hooks/use[FeatureName].ts`
- **Edge Function**: `supabase/functions/[feature-name]/index.ts`

### TypeScript Patterns

**Strict Type Usage:**
```typescript
// ✅ Use strict types from database
type UserProfile = Database['public']['Tables']['profiles']['Row']
type UserProfileInsert = Database['public']['Tables']['profiles']['Insert']

// ✅ Create specific interfaces for components
interface UserCardProps {
  profile: UserProfile
  isEditable?: boolean
}

// ❌ Never use 'any'
const processData = (data: any) => { /* ❌ */ }

// ✅ Use unknown and type guards instead
const processData = (data: unknown) => {
  if (isValidData(data)) {
    // TypeScript now knows data is ValidData type
  }
}
```

**Zod Validation Patterns:**
```typescript
// ✅ Define schemas for all external data
const CreateJobSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(10),
  salary_range: z.object({
    min: z.number().positive(),
    max: z.number().positive()
  })
})

type CreateJobRequest = z.infer<typeof CreateJobSchema>

// ✅ Validate in edge functions
const body = CreateJobSchema.parse(await req.json())
```

### UI/UX Patterns

**shadcn/ui Usage:**
```typescript
// ✅ Import base components from ui folder
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'

// ✅ Extend with variants when needed
import { cn } from '@/lib/utils'

const CustomButton = ({ variant = 'default', className, ...props }) => {
  return (
    <Button
      className={cn(
        variant === 'special' && 'bg-gradient-to-r from-blue-500 to-purple-600',
        className
      )}
      {...props}
    />
  )
}
```

**Responsive Design Standards:**
```typescript
// ✅ Use Tailwind responsive prefixes consistently
<div className="
  grid
  grid-cols-1 md:grid-cols-2 lg:grid-cols-3
  gap-4 md:gap-6 lg:gap-8
  p-4 md:p-6 lg:p-8
">
  {/* Mobile-first approach */}
</div>

// ✅ Capacitor mobile considerations
import { Capacitor } from '@capacitor/core'

const isMobile = Capacitor.isNativePlatform()
const showFeature = !isMobile || featureSupportsMobile
```

### Performance Standards

**Caching Strategy:**
```typescript
// ✅ Use the existing cache system in lib/cache-manager.ts
import { cache } from '@/lib/cache-manager'

const getExpensiveData = async (key: string) => {
  return cache.get(key, async () => {
    // This function only runs on cache miss
    return await fetchExpensiveData(key)
  }, 60000) // Cache for 1 minute
}
```

**React Query Optimization:**
```typescript
// ✅ Set appropriate staleTime for different data types
const useUserData = () => useQuery({
  queryKey: ['user'],
  queryFn: fetchUser,
  staleTime: 5 * 60 * 1000, // User data: 5 minutes
})

const useJobListings = () => useQuery({
  queryKey: ['jobs'],
  queryFn: fetchJobs,
  staleTime: 30 * 1000, // Job listings: 30 seconds (frequently changing)
})
```

## Integration Guidelines

### Supabase Operations

**Database Migrations:**
```sql
-- ✅ Always include proper RLS policies
alter table profiles enable row level security;

create policy "Users can view own profile" on profiles
  for select using (auth.uid() = user_id);

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = user_id);

-- ✅ Create indexes for performance
create index idx_profiles_user_id on profiles(user_id);
create index idx_job_listings_status on job_listings(status) where status = 'active';
```

**RLS Policy Patterns:**
```sql
-- ✅ Standard user data access
create policy "policy_name" on table_name
  for select using (auth.uid() = user_id);

-- ✅ Admin access pattern
create policy "admin_access" on table_name
  for all using (
    exists (
      select 1 from platform_admins
      where user_id = auth.uid() and active = true
    )
  );

-- ✅ Subscription-gated features
create policy "pro_feature_access" on premium_features
  for select using (
    exists (
      select 1 from subscriptions
      where user_id = auth.uid()
      and status = 'active'
      and tier in ('pro', 'enterprise')
    )
  );
```

**Edge Function Deployment:**
```bash
# ✅ Deploy all functions specified in .github/workflows/deploy.yml
supabase functions deploy \
  generate-content \
  parse-resume \
  interview-coach \
  salary-insights \
  crawl-jobs \
  generate-resume \
  send-notification \
  send-auth-email \
  create-checkout \
  create-portal \
  stripe-webhook \
  match-and-apply \
  recruiter-apply \
  approve-recruiter \
  search-candidates \
  recruiter-outreach \
  --project-ref $PROJECT_REF
```

### Payment Integration

**Stripe Integration Patterns:**
```typescript
// ✅ Use existing Stripe utilities
import { createCheckoutSession } from '@/lib/stripe'

const handleUpgrade = async () => {
  const { url } = await createCheckoutSession({
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    userId: user.id,
    successUrl: `${window.location.origin}/dashboard?upgraded=true`,
    cancelUrl: `${window.location.origin}/pricing`
  })
  window.location.href = url
}
```

**Subscription Access Checks:**
```typescript
// ✅ Use checkAccess for UI gating
import { checkAccessSync } from '@/lib/auth'

const FeatureComponent = () => {
  const hasAccess = checkAccessSync('ai_interviews')

  if (!hasAccess) {
    return <UpgradePrompt feature="ai_interviews" />
  }

  return <PremiumFeature />
}

// ✅ Use checkAccess for async operations
const handleAction = async () => {
  const hasAccess = await checkAccess(supabase, userId, 'bulk_apply')
  if (!hasAccess) {
    toast.error('This feature requires a Pro subscription')
    return
  }
  // Proceed with action
}
```

### Authentication Flow

**User Session Management:**
```typescript
// ✅ Use Supabase auth hooks
import { useUser } from '@/integrations/supabase'

const ProtectedComponent = () => {
  const { user, isLoading } = useUser()

  if (isLoading) return <LoadingSpinner />
  if (!user) return <LoginPrompt />

  return <AuthenticatedContent user={user} />
}
```

**Role-Based Access Control:**
```typescript
// ✅ Admin access pattern
const useIsAdmin = () => {
  const { user } = useUser()
  return useQuery({
    queryKey: ['user', 'admin', user?.id],
    queryFn: async () => {
      if (!user) return false
      const { data } = await supabase
        .from('platform_admins')
        .select('active')
        .eq('user_id', user.id)
        .single()
      return data?.active || false
    },
    enabled: !!user
  })
}
```

### Mobile Considerations

**Capacitor Integration:**
```typescript
// ✅ Feature detection patterns
import { Capacitor } from '@capacitor/core'

const PlatformAwareComponent = () => {
  const isNative = Capacitor.isNativePlatform()
  const platform = Capacitor.getPlatform() // 'ios', 'android', 'web'

  return (
    <div className={cn(
      'feature-base',
      isNative && 'native-adjustments',
      platform === 'ios' && 'ios-safe-area'
    )}>
      {/* Content */}
    </div>
  )
}
```

## Testing & Quality Assurance

### Testing Strategy

**Component Testing with @testing-library/react:**
```typescript
// ✅ Test user interactions, not implementation details
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UserProfileCard } from './UserProfileCard'

describe('UserProfileCard', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    })
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }

  it('displays edit button for own profile', async () => {
    render(<UserProfileCard userId="current-user" />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument()
    })
  })
})
```

**Integration Testing Patterns:**
```typescript
// ✅ Test critical user flows end-to-end
describe('Job Application Flow', () => {
  beforeEach(() => {
    // Mock Supabase responses
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: mockJobApplication, error: null })
    })
  })

  it('completes application submission', async () => {
    render(<JobApplicationForm jobId="123" />)

    // Fill form
    fireEvent.change(screen.getByLabelText(/cover letter/i), {
      target: { value: 'Test cover letter' }
    })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }))

    // Verify success
    await waitFor(() => {
      expect(screen.getByText(/application submitted/i)).toBeInTheDocument()
    })
  })
})
```

### Bug Fix Methodology

**1. Reproduce the Issue**
```bash
# Set up exact reproduction environment
npm run dev
# Follow reproduction steps from bug report
# Confirm the issue exists
```

**2. Identify Root Cause**
```typescript
// ✅ Add strategic console.logs for debugging
console.log('User data:', user)
console.log('Subscription status:', subscription)
console.log('Access check result:', hasAccess)

// ✅ Check network tab for failed requests
// ✅ Check browser console for JavaScript errors
// ✅ Check Supabase logs for edge function errors
```

**3. Implement Fix**
```typescript
// ✅ Fix at the root cause, not the symptom
// ❌ Masking the error
if (error) return null

// ✅ Handling the error properly
if (error) {
  console.error('Failed to load user data:', error)
  toast.error('Unable to load profile. Please try again.')
  return <ErrorBoundary />
}
```

**4. Verify Fix**
- Test the exact reproduction case
- Test related functionality that might be affected
- Add regression test if appropriate
- Check for performance implications

### Code Review Standards

**Pre-Review Checklist:**
- [ ] TypeScript strict mode passes (`npm run type-check`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Tests pass (`npm test`)
- [ ] Feature works on mobile (if applicable)
- [ ] Subscription gating implemented correctly (if applicable)
- [ ] Admin guide updated (if admin features changed)

**Review Focus Areas:**
1. **Security**: Proper authentication, RLS policies, input validation
2. **Performance**: Efficient queries, proper caching, React Query usage
3. **User Experience**: Loading states, error handling, mobile responsiveness
4. **Maintainability**: Clear naming, proper abstractions, documentation

**Common Issues to Flag:**
```typescript
// ❌ Missing error handling
const { data } = await supabase.from('table').select()

// ✅ Proper error handling
const { data, error } = await supabase.from('table').select()
if (error) throw error

// ❌ Exposing sensitive data
return { user, password: user.password }

// ✅ Sanitizing response
return { user: { id: user.id, email: user.email, name: user.name } }
```

## Deployment & Operations

### CI/CD Pipeline

**GitHub Actions Workflow** (`.github/workflows/deploy.yml`):
1. **Database Migrations**: `supabase db push --linked`
2. **Edge Functions**: Deploy all functions to production
3. **Frontend**: Type-check → Build → Deploy to Vercel

**Pre-Deployment Checklist:**
- [ ] All tests pass locally
- [ ] Database migrations tested locally (`supabase db reset`)
- [ ] Edge functions tested locally (`supabase functions serve`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] No ESLint errors (`npm run lint`)

### Environment Management

**Local Development:**
```bash
# Required environment variables in .env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_key
```

**Production Environment Variables** (set in Supabase):
```
GEMINI_API_KEY=          # For AI features
FIRECRAWL_API_KEY=       # For job crawling
STRIPE_SECRET_KEY=       # For payments
STRIPE_PRO_PRICE_ID=     # For Pro subscriptions
STRIPE_WEBHOOK_SECRET=   # For webhook verification
```

**Staging vs Production:**
- **Staging**: `staging.usehunter.app` - Use test Stripe keys, separate Supabase project
- **Production**: `usehunter.app` - Live payments, production database

### Monitoring & Debugging

**Production Health Checks:**
```bash
# Application health
curl https://usehunter.app/api/health

# Database connectivity
supabase db ping --project-ref $PROJECT_REF

# Edge function logs
supabase functions logs --project-ref $PROJECT_REF --function-name <name>
```

**Performance Monitoring:**
- **Vercel Analytics**: Page load times, Core Web Vitals
- **Supabase Dashboard**: Database performance, connection pools
- **Custom Metrics**: Cache hit rates, API response times

**Common Production Issues:**

1. **Edge Function Timeouts**
   - Check function logs: `supabase functions logs`
   - Optimize database queries
   - Implement proper error handling

2. **Database Connection Limits**
   - Monitor connection pool in Supabase dashboard
   - Ensure proper connection cleanup
   - Consider connection pooling optimizations

3. **Stripe Webhook Failures**
   - Check webhook signature verification
   - Verify endpoint URL in Stripe dashboard
   - Check edge function logs for errors

4. **Authentication Issues**
   - Verify JWT tokens aren't expired
   - Check RLS policies in database
   - Ensure proper session management

---

## Key Reminders

1. **Admin Features**: Update `docs/ADMIN_GUIDE.md` per `docs/ADMIN_MAINTENANCE.md`
2. **Type Safety**: Regenerate types after schema changes: `supabase gen types typescript --local`
3. **Security**: All edge functions must include auth checks and subscription validation
4. **Performance**: Use the cache system in `lib/cache-manager.ts` for expensive operations
5. **Mobile**: Test Capacitor compatibility for new features
6. **Documentation**: Keep architectural decisions documented in `docs/` folder

This document should be updated as the codebase evolves and new patterns emerge.