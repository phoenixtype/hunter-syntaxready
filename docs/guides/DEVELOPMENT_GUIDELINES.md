# Development Guidelines - Business Operations Platform

This document provides comprehensive guidelines for developing the Business Operations Platform, following bulletproof-react principles adapted for our AI-powered business automation application.

## Core Principles

### 1. **Accessibility First**
- Every feature should be accessible from day one
- Use semantic HTML and ARIA labels
- Support keyboard navigation and screen readers
- Test with accessibility tools (axe-core, Lighthouse)

### 2. **Maintainability**
- Write self-documenting code with clear naming
- Prefer composition over inheritance
- Keep functions and components small and focused
- Use TypeScript for type safety

### 3. **Security & Performance**
- Sanitize all user inputs
- Use proper authentication and authorization
- Implement proper error boundaries
- Optimize bundle size and loading performance

### 4. **Scalability**
- Design for team growth and codebase expansion  
- Use consistent patterns across the application
- Implement proper separation of concerns
- Plan for feature independence

---

## Project Structure

### Root-Level Organization

```
src/
├── app/                    # Application layer
│   ├── App.tsx            # Main app component
│   ├── router.tsx         # Route configuration
│   └── providers.tsx      # Global providers setup
├── components/            # Shared UI components
│   ├── ui/               # Base UI components (shadcn/ui)
│   ├── forms/            # Reusable form components
│   └── layouts/          # Layout components
├── features/             # Feature-based modules
│   ├── auth/            # Authentication feature
│   ├── business/        # Business profile management
│   ├── communication/   # AI communication features
│   ├── scheduling/      # Appointment scheduling
│   ├── workflows/       # Workflow automation
│   └── analytics/       # Business analytics
├── hooks/               # Shared custom hooks
├── lib/                 # Utility libraries and configurations
├── stores/              # Global state management
├── types/               # Shared TypeScript definitions
└── utils/               # Shared utility functions
```

### Feature Module Structure

Each feature in `src/features/` should follow this internal structure:

```
src/features/communication/
├── api/                 # API calls and data fetching
│   ├── types.ts        # API response types
│   ├── queries.ts      # React Query queries
│   └── mutations.ts    # React Query mutations
├── components/         # Feature-specific components
│   ├── ChatInterface.tsx
│   ├── MessageList.tsx
│   └── AISettings.tsx
├── hooks/              # Feature-specific hooks
│   ├── useAIChat.ts
│   └── useCommunicationStats.ts
├── stores/             # Feature-specific state
│   └── communicationStore.ts
├── types/              # Feature-specific types
│   └── communication.types.ts
├── utils/              # Feature-specific utilities
│   └── messageFormatter.ts
└── index.ts            # Public API exports
```

**Note**: Only include folders that are necessary for your feature. Not every feature needs all directories.

---

## Code Organization Guidelines

### 1. **Unidirectional Import Flow**

```
shared code → features → app layer
```

- **Shared modules** (components, hooks, lib, utils) can be imported anywhere
- **Features** should only import from shared modules, not from other features
- **App layer** composes and orchestrates features

### 2. **Import Best Practices**

```typescript
// ✅ Direct imports (better for tree-shaking)
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks/useAuth'

// ❌ Avoid barrel imports (hurts performance)
import { Button, Card, Dialog } from '@/components/ui'
```

### 3. **Component Architecture**

#### Component Categories

**1. UI Components (`src/components/ui/`)**
- Pure presentational components
- No business logic or API calls
- Highly reusable across features
- Based on shadcn/ui design system

```typescript
// Example: Button component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export const Button = ({ variant = 'default', size = 'default', ...props }: ButtonProps) => {
  return (
    <button
      className={cn(buttonVariants({ variant, size }))}
      {...props}
    />
  )
}
```

**2. Feature Components (`src/features/*/components/`)**
- Contain business logic
- Can make API calls through hooks
- Use UI components for presentation
- Feature-specific functionality

```typescript
// Example: Business dashboard component
export const BusinessDashboard = () => {
  const { data: business } = useBusiness()
  const { data: metrics } = useBusinessMetrics(business?.id)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Business Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <MetricsGrid metrics={metrics} />
        </CardContent>
      </Card>
    </div>
  )
}
```

**3. Layout Components (`src/components/layouts/`)**
- Structural components for page layouts
- Handle navigation and global UI elements
- Compose multiple features together

### 4. **State Management Strategy**

#### Global State (`src/stores/`)
Use for application-wide state that needs to persist across route changes:
- User authentication status
- Theme preferences
- Global notifications
- Cross-feature shared data

```typescript
// Example: Auth store
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: async (credentials) => {
    const user = await authService.login(credentials)
    set({ user, isAuthenticated: true })
  },
  logout: () => set({ user: null, isAuthenticated: false }),
}))
```

#### Local State
Use React's built-in state management for:
- Component-specific UI state
- Form data
- Temporary interactions

#### Server State
Use React Query for:
- API data fetching and caching
- Background updates
- Optimistic updates

```typescript
// Example: React Query hook
export const useBusiness = (businessId: string) => {
  return useQuery({
    queryKey: ['business', businessId],
    queryFn: () => businessApi.getById(businessId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
```

---

## API Integration Patterns

### 1. **API Layer Structure**

Each feature should have a dedicated API module:

```typescript
// src/features/business/api/business.api.ts
export const businessApi = {
  getAll: (): Promise<Business[]> => 
    supabase.from('business_profiles').select('*'),
  
  getById: (id: string): Promise<Business> =>
    supabase.from('business_profiles').select('*').eq('id', id).single(),
    
  create: (business: CreateBusinessRequest): Promise<Business> =>
    supabase.from('business_profiles').insert(business).select().single(),
    
  update: (id: string, updates: UpdateBusinessRequest): Promise<Business> =>
    supabase.from('business_profiles').update(updates).eq('id', id).select().single(),
}
```

### 2. **React Query Integration**

```typescript
// src/features/business/api/business.queries.ts
export const businessQueries = {
  all: () => ({
    queryKey: ['businesses'],
    queryFn: businessApi.getAll,
  }),
  
  detail: (id: string) => ({
    queryKey: ['business', id],
    queryFn: () => businessApi.getById(id),
    enabled: !!id,
  }),
}

// Usage in component
export const useBusinesses = () => {
  return useQuery(businessQueries.all())
}
```

### 3. **Error Handling**

```typescript
// Global error handler
export const handleApiError = (error: unknown) => {
  if (error instanceof Error) {
    toast.error(error.message)
  } else {
    toast.error('An unexpected error occurred')
  }
  
  // Log error for monitoring
  console.error('API Error:', error)
}

// Usage in mutations
export const useCreateBusiness = () => {
  return useMutation({
    mutationFn: businessApi.create,
    onError: handleApiError,
    onSuccess: () => {
      toast.success('Business created successfully')
      queryClient.invalidateQueries(['businesses'])
    },
  })
}
```

---

## TypeScript Guidelines

### 1. **Type Definitions**

**Shared Types (`src/types/`)**
```typescript
// src/types/index.ts
export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
  created_at: string
}

export interface ApiResponse<T> {
  data: T
  error?: string
  success: boolean
}
```

**Feature Types (`src/features/*/types/`)**
```typescript
// src/features/business/types/business.types.ts
export interface Business {
  id: string
  name: string
  type: BusinessType
  owner_id: string
  settings: BusinessSettings
}

export type BusinessType = 'home_services' | 'restaurant' | 'professional_services' | 'medical'
```

### 2. **Component Props**

```typescript
// Use interfaces for props
interface BusinessCardProps {
  business: Business
  onEdit?: (business: Business) => void
  showActions?: boolean
  className?: string
}

// Extend HTML attributes when needed
interface CustomInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}
```

### 3. **API Types**

```typescript
// Generate types from Supabase schema
export type DatabaseBusiness = Database['public']['Tables']['business_profiles']['Row']
export type CreateBusinessRequest = Database['public']['Tables']['business_profiles']['Insert']
export type UpdateBusinessRequest = Database['public']['Tables']['business_profiles']['Update']
```

---

## Testing Strategy

### 1. **Testing Structure**

```
src/features/business/
├── __tests__/
│   ├── components/
│   │   ├── BusinessCard.test.tsx
│   │   └── BusinessForm.test.tsx
│   ├── hooks/
│   │   └── useBusiness.test.ts
│   └── utils/
│       └── businessValidator.test.ts
└── components/
    ├── BusinessCard.tsx
    └── BusinessForm.tsx
```

### 2. **Component Testing**

```typescript
// src/features/business/__tests__/components/BusinessCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { BusinessCard } from '../components/BusinessCard'
import { mockBusiness } from '../__mocks__/business.mock'

describe('BusinessCard', () => {
  it('renders business information correctly', () => {
    render(<BusinessCard business={mockBusiness} />)
    
    expect(screen.getByText(mockBusiness.name)).toBeInTheDocument()
    expect(screen.getByText(mockBusiness.type)).toBeInTheDocument()
  })

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = jest.fn()
    render(<BusinessCard business={mockBusiness} onEdit={onEdit} showActions />)
    
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledWith(mockBusiness)
  })
})
```

### 3. **Hook Testing**

```typescript
// src/features/business/__tests__/hooks/useBusiness.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useBusiness } from '../hooks/useBusiness'
import { businessApi } from '../api/business.api'

jest.mock('../api/business.api')

describe('useBusiness', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    })
  })

  it('fetches business data successfully', async () => {
    ;(businessApi.getById as jest.Mock).mockResolvedValue(mockBusiness)

    const { result } = renderHook(() => useBusiness('123'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockBusiness)
  })
})
```

---

## Performance Guidelines

### 1. **Bundle Optimization**

**Lazy Loading**
```typescript
// Lazy load heavy components
const BusinessAnalytics = lazy(() => import('./BusinessAnalytics'))

// Use in routes
<Route 
  path="/analytics" 
  element={
    <Suspense fallback={<LoadingSpinner />}>
      <BusinessAnalytics />
    </Suspense>
  } 
/>
```

**Tree Shaking**
```typescript
// ✅ Import specific functions
import { format } from 'date-fns/format'
import { isValid } from 'date-fns/isValid'

// ❌ Import entire library
import * as dateFns from 'date-fns'
```

### 2. **React Optimization**

**Memoization**
```typescript
// Memoize expensive calculations
const expensiveValue = useMemo(() => {
  return calculateComplexMetrics(data)
}, [data])

// Memoize callback functions
const handleSubmit = useCallback((formData: FormData) => {
  onSubmit(formData)
}, [onSubmit])

// Memoize components that receive stable props
const MemoizedBusinessCard = memo(BusinessCard)
```

**Code Splitting by Route**
```typescript
// Split features by routes
const BusinessFeature = lazy(() => import('@/features/business'))
const CommunicationFeature = lazy(() => import('@/features/communication'))
```

### 3. **Data Fetching**

```typescript
// Prefetch data for likely navigation
const queryClient = useQueryClient()

const prefetchBusinessDetails = (businessId: string) => {
  queryClient.prefetchQuery({
    queryKey: ['business', businessId],
    queryFn: () => businessApi.getById(businessId),
  })
}

// Background updates
const { data } = useQuery({
  queryKey: ['business-metrics'],
  queryFn: getMetrics,
  refetchInterval: 30000, // 30 seconds
  refetchIntervalInBackground: true,
})
```

---

## Security Guidelines

### 1. **Input Validation**

```typescript
// Use Zod for input validation
import { z } from 'zod'

const CreateBusinessSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[\d\s-()]+$/),
  type: z.enum(['home_services', 'restaurant', 'professional_services']),
})

type CreateBusinessRequest = z.infer<typeof CreateBusinessSchema>

// Validate in forms
const form = useForm<CreateBusinessRequest>({
  resolver: zodResolver(CreateBusinessSchema),
})
```

### 2. **Authentication**

```typescript
// Protected routes
export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}

// Role-based access
export const RequireRole = ({ 
  role, 
  children 
}: { 
  role: UserRole
  children: React.ReactNode 
}) => {
  const { user } = useAuth()
  const { userRole } = useUserRole(user?.id)

  if (userRole !== role) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}
```

### 3. **Data Sanitization**

```typescript
// Sanitize user input
import DOMPurify from 'isomorphic-dompurify'

export const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: [],
  })
}
```

---

## Error Handling

### 1. **Error Boundaries**

```typescript
// Global error boundary
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error boundary caught an error:', error, errorInfo)
    // Send to error reporting service
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />
    }

    return this.props.children
  }
}
```

### 2. **API Error Handling**

```typescript
// Centralized error handling
export const createApiError = (error: unknown): ApiError => {
  if (error instanceof Error) {
    return {
      message: error.message,
      status: 'unknown',
      code: 'UNKNOWN_ERROR',
    }
  }

  // Handle different error types
  if (typeof error === 'object' && error !== null) {
    const apiError = error as any
    return {
      message: apiError.message || 'An error occurred',
      status: apiError.status || 'unknown',
      code: apiError.code || 'UNKNOWN_ERROR',
    }
  }

  return {
    message: 'An unexpected error occurred',
    status: 'unknown',
    code: 'UNKNOWN_ERROR',
  }
}
```

---

## Accessibility Guidelines

### 1. **Semantic HTML**

```typescript
// Use proper semantic elements
export const BusinessCard = ({ business }: BusinessCardProps) => {
  return (
    <article className="business-card">
      <header>
        <h2>{business.name}</h2>
        <p>{business.type}</p>
      </header>
      <main>
        <p>{business.description}</p>
      </main>
      <footer>
        <button type="button">Contact</button>
      </footer>
    </article>
  )
}
```

### 2. **ARIA Labels**

```typescript
// Provide context for screen readers
export const DeleteButton = ({ onDelete, itemName }: DeleteButtonProps) => {
  return (
    <button
      type="button"
      onClick={onDelete}
      aria-label={`Delete ${itemName}`}
      className="text-red-600 hover:text-red-800"
    >
      <TrashIcon aria-hidden="true" />
    </button>
  )
}
```

### 3. **Keyboard Navigation**

```typescript
// Handle keyboard interactions
export const Modal = ({ isOpen, onClose, children }: ModalProps) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  // Focus management
  const modalRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus()
    }
  }, [isOpen])

  return (
    <div
      ref={modalRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      className="modal"
    >
      {children}
    </div>
  )
}
```

---

## Deployment Guidelines

### 1. **Build Configuration**

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
  },
  define: {
    __VERSION__: JSON.stringify(process.env.npm_package_version),
  },
})
```

### 2. **Environment Configuration**

```typescript
// src/lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'staging', 'production']),
})

export const env = envSchema.parse(import.meta.env)
```

### 3. **Production Optimization**

```typescript
// Conditional loading for development tools
if (process.env.NODE_ENV === 'development') {
  import('@tanstack/react-query-devtools').then(({ ReactQueryDevtools }) => {
    // Add devtools to development builds only
  })
}

// Feature flags
export const FEATURE_FLAGS = {
  AI_CHAT: env.NODE_ENV === 'production' || env.VITE_ENABLE_AI_CHAT === 'true',
  ADVANCED_ANALYTICS: env.NODE_ENV !== 'development',
} as const
```

---

## Summary

These guidelines provide a foundation for building a scalable, maintainable, and secure business operations platform. Key takeaways:

1. **Follow the unidirectional flow**: shared → features → app
2. **Keep features independent** - no cross-feature imports
3. **Use TypeScript strictly** for type safety
4. **Test components and hooks** comprehensively  
5. **Optimize for performance** from the start
6. **Secure by default** - validate inputs and sanitize outputs
7. **Design for accessibility** - semantic HTML and ARIA support
8. **Structure for team growth** - consistent patterns and documentation

Remember: These are guidelines, not rigid rules. Adapt them to fit your team's needs and the specific requirements of the business operations platform.