# Repository Structure Guide

This guide provides a comprehensive overview of the Business Operations Platform repository structure, ensuring consistent development practices and easy navigation for all team members.

## 📋 Table of Contents

1. [Repository Overview](#repository-overview)
2. [Directory Structure](#directory-structure)
3. [File Naming Conventions](#file-naming-conventions)
4. [Code Organization Principles](#code-organization-principles)
5. [Development Workflow](#development-workflow)
6. [Build and Deployment](#build-and-deployment)
7. [Quality Assurance](#quality-assurance)
8. [Documentation Standards](#documentation-standards)

## Repository Overview

The Business Operations Platform is a React-based web application built with modern tooling and best practices. The repository follows a feature-based architecture with clear separation of concerns.

### Key Technologies
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: Tailwind CSS + Radix UI (shadcn/ui)
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **State Management**: TanStack Query + Zustand
- **Development**: ESLint + TypeScript + Vitest

## Directory Structure

```
business-operations-platform/
├── 📁 .claude/                    # Claude Code configuration
│   ├── settings.json              # Global Claude settings
│   └── settings.local.json        # Local overrides
├── 📁 .github/                    # GitHub configuration
│   └── workflows/                 # CI/CD pipelines
├── 📁 docs/                       # All project documentation
│   ├── architecture/              # System architecture docs
│   ├── guides/                    # Development guides
│   ├── specifications/            # Feature specs and design
│   ├── tutorials/                 # Learning materials
│   └── README.md                  # Documentation index
├── 📁 public/                     # Static assets
│   ├── manifest.json              # PWA manifest
│   ├── favicon.svg                # App icon
│   └── *.png                      # Image assets
├── 📁 src/                        # Source code
│   ├── 📁 app/                    # Application layer
│   ├── 📁 components/             # Shared UI components
│   ├── 📁 config/                 # Configuration files
│   ├── 📁 features/               # Feature modules
│   ├── 📁 hooks/                  # Shared React hooks
│   ├── 📁 integrations/           # External service integrations
│   ├── 📁 lib/                    # Utility libraries
│   ├── 📁 pages/                  # Page components
│   ├── main.tsx                   # Application entry point
│   ├── index.css                  # Global styles
│   └── vite-env.d.ts             # TypeScript environment types
├── 📁 supabase/                   # Supabase configuration
│   ├── functions/                 # Edge Functions
│   ├── migrations/                # Database migrations
│   └── config.toml               # Supabase config
├── 📄 CLAUDE.md                   # Claude Code instructions
├── 📄 README.md                   # Project overview
├── 📄 package.json                # Dependencies and scripts
├── 📄 tailwind.config.ts          # Tailwind configuration
├── 📄 tsconfig.json               # TypeScript configuration
├── 📄 vite.config.ts              # Vite build configuration
└── 📄 .env.example                # Environment variable template
```

## File Naming Conventions

### General Rules
- Use **kebab-case** for directories: `user-management/`, `email-templates/`
- Use **PascalCase** for React components: `UserCard.tsx`, `EmailForm.tsx`
- Use **camelCase** for utilities and hooks: `useAuth.ts`, `formatDate.ts`
- Use **SCREAMING_SNAKE_CASE** for constants: `API_ENDPOINTS.ts`, `DEFAULT_CONFIG.ts`

### Specific Patterns

#### React Components
```
✅ Good
- UserProfile.tsx
- EmailNotificationCard.tsx
- PaymentMethodSelect.tsx

❌ Bad
- userProfile.tsx
- email-notification-card.tsx
- PaymentMethod_Select.tsx
```

#### Utilities and Helpers
```
✅ Good
- formatCurrency.ts
- validateEmail.ts
- debounceSearch.ts

❌ Bad
- FormatCurrency.ts
- validate_email.ts
- debounce-search.ts
```

#### Directories
```
✅ Good
- user-management/
- email-templates/
- payment-processing/

❌ Bad
- UserManagement/
- emailTemplates/
- payment_processing/
```

## Code Organization Principles

### 1. Feature-Based Architecture

Each business capability is organized as a self-contained feature:

```
src/features/user-management/
├── api/                           # API calls and data fetching
│   ├── types.ts                   # API response types
│   ├── queries.ts                 # React Query queries
│   └── mutations.ts               # React Query mutations
├── components/                    # Feature-specific components
│   ├── UserProfile.tsx
│   ├── UserForm.tsx
│   └── UserList.tsx
├── hooks/                         # Feature-specific hooks
│   ├── useUser.ts
│   └── useUserPreferences.ts
├── types/                         # Feature-specific types
│   └── user.types.ts
├── utils/                         # Feature-specific utilities
│   └── userValidation.ts
└── index.ts                       # Public API exports
```

### 2. Import Rules

**Unidirectional Flow**: `shared code → features → app layer`

```typescript
// ✅ Allowed imports
import { Button } from '@/components/ui/button'        // shared → feature
import { useAuth } from '@/hooks/useAuth'              // shared → feature
import { UserCard } from './components/UserCard'       // within feature

// ❌ Forbidden imports
import { OrderCard } from '@/features/orders'          // feature → feature
import { PaymentForm } from '../payments'              // feature → feature
```

### 3. Component Categories

#### UI Components (`src/components/ui/`)
- Pure presentational components
- No business logic or API calls
- Highly reusable across features
- Based on shadcn/ui design system

#### Feature Components (`src/features/*/components/`)
- Contain business logic
- Can make API calls through hooks
- Use UI components for presentation
- Feature-specific functionality

#### Page Components (`src/pages/`)
- Top-level route components
- Compose features and layouts
- Handle navigation and routing logic
- No direct business logic

### 4. State Management Strategy

```typescript
// Global State (src/lib/ or src/stores/)
// - User authentication
// - Theme preferences
// - Global notifications
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  login: async (credentials) => { /* ... */ }
}))

// Server State (feature APIs)
// - API data fetching and caching
// - Background updates
// - Optimistic updates
export const useUserProfile = (id: string) => {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => userApi.getById(id),
  })
}

// Local State (component-level)
// - UI state
// - Form data
// - Temporary interactions
const [isOpen, setIsOpen] = useState(false)
```

## Development Workflow

### 1. Environment Setup

```bash
# Clone and setup
git clone <repository-url>
cd business-operations-platform
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start development
npm run dev
```

### 2. Creating New Features

```bash
# 1. Create feature directory
mkdir -p src/features/new-feature/{api,components,hooks,types,utils}

# 2. Create index.ts for exports
touch src/features/new-feature/index.ts

# 3. Follow the established patterns
# - API calls in api/
# - Components in components/
# - Types in types/
# - Utilities in utils/
```

### 3. Adding New Components

```bash
# UI Component (shared)
touch src/components/ui/new-component.tsx

# Feature Component
touch src/features/feature-name/components/ComponentName.tsx

# Page Component
touch src/pages/NewPage.tsx
```

## Build and Deployment

### Development Commands

```bash
# Development server
npm run dev                        # Start dev server on :3000

# Type checking
npm run type-check                 # TypeScript validation

# Linting
npm run lint                       # ESLint checks

# Testing
npm test                           # Run test suite
```

### Build Commands

```bash
# Production build
npm run build                      # Build for production
npm run preview                    # Preview production build

# Build verification
npm run type-check && npm run lint && npm test && npm run build
```

### Deployment Pipeline

1. **Development**: Push to feature branch
2. **CI/CD**: GitHub Actions runs tests and builds
3. **Staging**: Deploy to staging environment for testing
4. **Production**: Deploy to production via Vercel

### Environment Configuration

```bash
# Required environment variables
VITE_SUPABASE_URL=                 # Supabase project URL
VITE_SUPABASE_ANON_KEY=            # Supabase anonymous key
VITE_STRIPE_PUBLISHABLE_KEY=       # Stripe public key

# Optional environment variables
NODE_ENV=                          # development | staging | production
```

## Quality Assurance

### 1. Code Quality Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for React and TypeScript
- **Prettier**: Consistent code formatting
- **Husky**: Pre-commit hooks for quality checks

### 2. Testing Strategy

```
src/features/user-management/
├── __tests__/
│   ├── components/
│   │   └── UserCard.test.tsx
│   ├── hooks/
│   │   └── useUser.test.ts
│   └── utils/
│       └── userValidation.test.ts
```

### 3. Performance Guidelines

- **Bundle splitting**: Lazy-loaded routes and features
- **Tree shaking**: Direct imports, no barrel exports
- **Memoization**: React.memo for stable components
- **Query optimization**: React Query with proper stale times

### 4. Security Practices

- **Input validation**: Zod schemas for all inputs
- **Authentication**: Supabase Auth with proper session management
- **Authorization**: Row Level Security (RLS) in Supabase
- **Data sanitization**: Proper HTML sanitization for user content

## Documentation Standards

### 1. Code Documentation

```typescript
/**
 * Formats currency values for display
 * @param amount - The numeric amount to format
 * @param currency - The currency code (default: 'USD')
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}
```

### 2. Component Documentation

```typescript
interface UserCardProps {
  /** User data to display */
  user: User
  /** Optional click handler */
  onClick?: (user: User) => void
  /** Show additional user details */
  showDetails?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * UserCard displays user information in a card layout
 * 
 * @example
 * ```tsx
 * <UserCard 
 *   user={currentUser} 
 *   onClick={handleUserClick}
 *   showDetails 
 * />
 * ```
 */
export const UserCard = ({ user, onClick, showDetails, className }: UserCardProps) => {
  // Implementation
}
```

### 3. API Documentation

```typescript
/**
 * User API endpoints
 */
export const userApi = {
  /**
   * Get user by ID
   * @param id - User ID
   * @returns Promise<User>
   * @throws {NotFoundError} When user doesn't exist
   */
  getById: (id: string): Promise<User> => {
    // Implementation
  }
}
```

## Common Patterns and Best Practices

### 1. Error Handling

```typescript
// Centralized error handling
const handleError = (error: unknown) => {
  if (error instanceof ApiError) {
    toast.error(error.message)
  } else {
    toast.error('An unexpected error occurred')
  }
  console.error('Error:', error)
}

// Usage in mutations
const mutation = useMutation({
  mutationFn: userApi.create,
  onError: handleError,
  onSuccess: () => toast.success('User created successfully')
})
```

### 2. Loading States

```typescript
const { data, loading, error } = useQuery({
  queryKey: ['users'],
  queryFn: userApi.getAll
})

if (loading) return <Spinner />
if (error) return <ErrorMessage error={error} />
if (!data) return <EmptyState />

return <UserList users={data} />
```

### 3. Form Handling

```typescript
const form = useForm<CreateUserRequest>({
  resolver: zodResolver(CreateUserSchema),
  defaultValues: {
    name: '',
    email: '',
  }
})

const onSubmit = (data: CreateUserRequest) => {
  mutation.mutate(data)
}
```

## Troubleshooting Common Issues

### 1. Import Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf .vite
npm run dev
```

### 2. TypeScript Errors

```bash
# Regenerate types
npm run type-check

# Update Supabase types
supabase gen types typescript --project-ref ffjsgjsiemtxqbhimvhb > src/integrations/supabase/types.ts
```

### 3. Build Issues

```bash
# Verify all dependencies
npm audit
npm run build --verbose
```

## Conclusion

This structure ensures:
- **Scalability**: Features can be developed independently
- **Maintainability**: Clear organization and consistent patterns
- **Developer Experience**: Easy to find and understand code
- **Quality**: Built-in checks and standards
- **Performance**: Optimized loading and bundle splitting

Remember to update this guide when making significant structural changes to keep it accurate and useful for all team members.