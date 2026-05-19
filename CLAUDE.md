# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Business Operations Platform - An AI-powered business automation platform built with React 18, TypeScript, Tailwind CSS, and Supabase. The platform automates customer communication, scheduling, and workflow management for service businesses.

## Development Commands

### Core Development
```bash
# Start development server (runs on localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Run linting
npm run lint

# Run tests
npm test
```

### Environment Setup
```bash
# Copy environment template and configure
cp .env.example .env
# Edit .env with your Supabase credentials and API keys
```

### Supabase Operations
```bash
# Navigate to supabase directory for CLI commands
cd supabase

# Link to existing project (use project ref: ffjsgjsiemtxqbhimvhb)
supabase link --project-ref ffjsgjsiemtxqbhimvhb

# Push database changes
supabase db push

# Deploy edge functions
supabase functions deploy --project-ref ffjsgjsiemtxqbhimvhb

# Generate TypeScript types from database schema
supabase gen types typescript --project-ref ffjsgjsiemtxqbhimvhb > src/integrations/supabase/types.ts
```

## Architecture & Code Organization

### High-Level Structure
- **Feature-based architecture**: Each business capability is a self-contained feature module
- **Unidirectional import flow**: `shared code → features → app layer`
- **No cross-feature imports**: Features can only import from shared modules, not other features
- **React Query**: All server state management through TanStack Query
- **Supabase**: Backend (PostgreSQL, Auth, Edge Functions, Storage)

### Key Directories
```
src/
├── app/                    # Application layer (routing, providers, global setup)
├── components/            # Shared UI components (shadcn/ui based)
├── features/             # Feature modules (auth, business, communication, scheduling)
├── hooks/                # Shared custom hooks
├── integrations/         # External service integrations (Supabase)
├── lib/                  # Utility libraries and configurations
└── pages/                # Route components
```

### Feature Module Pattern
Each feature in `src/features/` follows this structure:
```
src/features/[feature-name]/
├── api/                 # API calls, queries, mutations
├── components/         # Feature-specific components
├── hooks/              # Feature-specific hooks
├── types/              # Feature-specific TypeScript types
├── utils/              # Feature-specific utilities
└── index.ts            # Public API exports
```

### Import Patterns
```typescript
// ✅ Correct - direct imports for better tree-shaking
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

// ❌ Avoid - barrel imports hurt performance
import { Button, Card, Dialog } from '@/components/ui'
```

## Technology Stack

### Frontend Core
- **React 18** with TypeScript and Vite
- **Tailwind CSS** for styling
- **Radix UI** + shadcn/ui for base components
- **Framer Motion** for animations
- **React Hook Form** + Zod for form handling

### State Management
- **TanStack Query (React Query)** for server state
- **Zustand** for client state when needed
- **Built-in React state** for component-local state

### Backend Integration
- **Supabase** as primary backend
  - PostgreSQL database with Row Level Security (RLS)
  - Authentication and authorization
  - Edge Functions for serverless logic
  - Real-time subscriptions
  - File storage

### Key Integrations
- **Stripe** for subscription billing
- **Gemini API** for AI features (via Edge Functions)
- **Firecrawl** for job scraping

## Important Configuration

### Path Aliases
- `@/` resolves to `src/` directory
- Import all internal modules using `@/` prefix

### Environment Variables
Required for development:
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key
- `VITE_STRIPE_PUBLISHABLE_KEY`: Stripe public key
- `VITE_OPENAI_API_KEY`: OpenAI API key (if using direct integration)

### TypeScript Configuration
- Strict mode enabled
- Path mapping configured for `@/` alias
- Database types auto-generated from Supabase schema

## Key Patterns & Conventions

### API Integration
- All API calls go through feature-specific API modules
- React Query used for all server state management
- Supabase client configured with localStorage fallback for Safari private mode
- Edge Functions handle AI API calls with rate limiting and auth

### Component Architecture
```typescript
// UI Components (src/components/ui/): Pure presentational
// Feature Components (src/features/*/components/): Business logic + UI
// Layout Components (src/components/layouts/): Structural/navigation

// Example feature component pattern:
export const BusinessDashboard = () => {
  const { data: business } = useBusiness()
  const { data: metrics } = useBusinessMetrics(business?.id)
  
  return (
    <Card>
      <CardContent>
        <MetricsGrid metrics={metrics} />
      </CardContent>
    </Card>
  )
}
```

### Error Handling
- Global error boundary in app provider
- Centralized API error handling
- React Query error boundaries for data fetching errors
- Detailed error reporting system in index.html

### Authentication Flow
- Supabase Auth with email/password and social providers
- Protected routes using `ProtectedRoute` component
- Auth state managed through `AuthLoader` component
- Session persistence with localStorage fallback

## Database Schema Context

### Key Tables
- `users`: User accounts and profiles
- `business_profiles`: Business information and settings
- `subscriptions`: Stripe subscription data
- `job_listings`: Job postings and opportunities
- `application_history`: Job application tracking
- `user_preferences`: User-specific settings
- `rate_limits` & `rate_limit_buckets`: API rate limiting

### Supabase Configuration
- Project reference: `ffjsgjsiemtxqbhimvhb` (Canada Central)
- Row Level Security (RLS) enabled on all tables
- Edge Functions deployed for AI features and webhooks
- Real-time subscriptions for live updates

## Performance Considerations

### Bundle Optimization
- Manual chunks disabled for optimal Vite tree-shaking
- React and React-DOM pre-optimized
- SWC used for faster compilation
- Lazy loading for heavy components

### Data Fetching
- React Query with 5-minute stale time for business data
- Background refetch enabled for real-time updates
- Optimistic updates for better UX
- Prefetching for likely user navigation paths

## Security Implementation

- Input validation with Zod schemas
- HTML sanitization with DOMPurify
- CSRF protection through Supabase RLS
- Secure environment variable handling
- Authentication state properly validated on both client and server

## Documentation Structure

All project documentation is organized in `/docs/`:
- `/docs/guides/` - Development guidelines and procedures
- `/docs/specifications/` - Feature specs and design system
- `/docs/architecture/` - System architecture documents
- `/docs/tutorials/` - Learning materials and tutorials

## Migration Notes

This codebase was recently rebranded from "Hunter" to "Business Operations Platform". Some legacy references may still exist in:
- Supabase client diagnostic code (`__HUNTER_STEP__`)
- Internal development tooling
- Git history and commit messages

When working with the codebase, use "Business Operations Platform" branding and avoid introducing new "Hunter" references.