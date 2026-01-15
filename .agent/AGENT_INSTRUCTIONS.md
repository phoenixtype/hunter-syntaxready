# Hunter Platform - Agent Instructions

This document provides instructions and context for working on the Hunter platform.

---

## Project Overview

Hunter is a job application and resume optimization platform built with:
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Shadcn UI
- **Backend**: Supabase (PostgreSQL + Edge Functions + Auth + Storage)
- **Hosting**: Vercel (Frontend) + Supabase (Backend)

---

## QA Checklist - MANDATORY AFTER EVERY CHANGE

**Run this checklist after completing any code changes:**

### 1. Lint Check (REQUIRED)
```bash
npm run lint
```
- **MUST have 0 errors** before committing
- Warnings are acceptable but should be minimized

### 2. TypeScript Check (REQUIRED)
```bash
npx tsc --noEmit
```
- **MUST have 0 type errors** before committing

### 3. Build Verification (REQUIRED)
```bash
npm run build
```
- **MUST complete successfully** before committing

### 4. Common Issues to Check

#### Import Validation
- [ ] All imported components/functions exist
- [ ] No circular dependencies
- [ ] All lucide-react icons are imported before use
- [ ] Toast methods used match defined methods (`toast.success`, `toast.error`, `toast.warning`, `toast.info`)

#### Runtime Safety
- [ ] No undefined references (e.g., `Clock`, `Icon` not imported)
- [ ] Error handlers use typed catch (`catch (error: any)` or proper type guards)
- [ ] Optional chaining (`?.`) used for potentially undefined objects
- [ ] No hardcoded credentials or API keys

#### CSS/Styling
- [ ] Class names are properly spaced (no `bg-red-500text-white`)
- [ ] Tailwind classes exist and are valid

#### Supabase Functions
- [ ] Error responses include proper error messages
- [ ] All catch blocks handle errors gracefully
- [ ] Database queries have proper error handling

---

## Code Style Guidelines

### Toast Usage
```typescript
// Correct usage - all methods defined in use-toast.ts
toast.success("Title", { description: "..." });
toast.error("Title", { description: "..." });
toast.warning("Title", { description: "..." });
toast.info("Title", { description: "..." });
```

### Error Handling in Edge Functions
```typescript
// Always type catch blocks
try {
  // code
} catch (error: any) {
  console.error("Context:", error);
  return new Response(JSON.stringify({ error: error?.message || String(error) }), {
    status: 500,
    headers: { "Content-Type": "application/json" }
  });
}
```

### Regex Patterns
- Don't escape forward slashes inside character classes: `[/-]` not `[\/-]`

---

## Critical Files

| File | Purpose |
|------|---------|
| `src/hooks/use-toast.ts` | Toast notification system with `success`, `error`, `warning`, `info` |
| `src/integrations/supabase/types.ts` | Auto-generated Supabase types - regenerate with `npx supabase gen types` |

---

## Pre-Commit Checklist

Before committing any changes, verify:

1. `npm run lint` - 0 errors
2. `npx tsc --noEmit` - 0 errors
3. `npm run build` - successful
4. No `console.log` in production code (use only in development)
5. No hardcoded secrets or API keys
6. All new components have proper TypeScript types
7. Error boundaries around async operations

---

## Known Patterns

### Feature Gating (If applicable)
Ensure checks are made against user tier/subscription before enabling premium features.

---

## Issue Debugging - WHEN USER REPORTS A BUG

**When a user reports an issue, IMMEDIATELY run these diagnostic commands:**

### 1. Database Health Check
```bash
# Check for long-running queries
supabase inspect db long-running-queries --linked

# Check for blocking queries
supabase inspect db blocking --linked

# Check database stats and cache hit rate
supabase inspect db db-stats --linked

# Check for unused indexes (performance)
supabase inspect db index-stats --linked
```

### 2. Edge Function Debugging

#### List all functions and their status
```bash
supabase functions list
```

#### Test a specific function locally
```bash
supabase functions serve <function-name> --env-file supabase/.env.local
```

#### Deploy a function after fixing
```bash
supabase functions deploy <function-name>
```

### 3. Common Edge Functions to Check

| Function | Purpose | Check When |
|----------|---------|------------|
| `parse-resume` | Resume parsing logic | Resume upload/parsing fails |
| `crawl-jobs` | Job crawling/scraping | Job listings not updating |
| `generate-content` | AI Content generation | content generation fails |
| `interview-coach` | Interview prep AI | Interview tips missing/error |

### 4. Database Query Debugging

```bash
# Check recent errors in critical tables (adjust table names as needed)
supabase db query "SELECT * FROM jobs WHERE created_at > NOW() - INTERVAL '1 hour'"
```

### 5. Frontend Error Patterns

When user reports a frontend error, check:

1. **ReferenceError: X is not defined** → Missing import in the component
   - Search for the component: `grep -r "X" src/`
   - Add missing import from lucide-react or the correct module

2. **TypeError: Cannot read property of undefined** → Missing null check
   - Add optional chaining (`?.`)
   - Check if data is loaded before rendering

3. **toast.X is not a function** → Toast method not defined
   - Check `src/hooks/use-toast.ts` for available methods
   - Add missing method if needed

### 6. Automated Monitoring Script

When actively debugging, start background monitoring:
```bash
# Create and run monitor
cat > /tmp/monitor.sh << 'EOF'
while true; do
  echo "=== $(date) ==="
  supabase inspect db long-running-queries --linked 2>&1 | tail -n +4
  supabase inspect db blocking --linked 2>&1 | tail -n +4
  sleep 30
done
EOF
chmod +x /tmp/monitor.sh
/tmp/monitor.sh &
```

### 7. Issue Resolution Workflow

1. **Identify**: Run diagnostic commands above
2. **Locate**: Find the relevant file/function
3. **Fix**: Apply the fix with proper error handling
4. **Test**: Run `npm run lint && npx tsc --noEmit && npm run build`
5. **Deploy**:
   - Frontend: `git push origin dev` (auto-deploys)
   - Functions: `supabase functions deploy <function-name>`
6. **Verify**: Ask user to test again

---

## Proactive UI/Button/CTA Testing - MANDATORY AFTER CODE CHANGES

**After making changes to any component, run these checks to prevent runtime errors:**

### 1. Static Analysis Commands

```bash
# Find all onClick handlers in modified files
grep -n "onClick=" src/pages/*.tsx src/components/*.tsx

# Find all Button components and their handlers
grep -n "<Button.*onClick" src/pages/*.tsx

# Find all form submissions
grep -n "onSubmit=" src/pages/*.tsx src/components/**/*.tsx

# Check for undefined function references
grep -n "onClick={[a-zA-Z]*}" src/pages/*.tsx | grep -v "onClick={()=>"
```

### 2. Import Verification for UI Components

```bash
# Verify all lucide-react icons are imported
grep -h "from \"lucide-react\"" src/pages/*.tsx | sort -u

# Find icon usage without imports (potential runtime errors)
grep -rn "<[A-Z][a-zA-Z]*Icon" src/pages --include="*.tsx" | head -20

# Check toast usage matches available methods
grep -rn "toast\." src/pages --include="*.tsx" | grep -v "toast.success\|toast.error\|toast.warning\|toast.info"
```

### 3. Critical Pages & Their CTAs to Verify

| Page | File | Critical Buttons/CTAs |
|------|------|----------------------|
| **Dashboard** | `src/pages/Dashboard.tsx` | Main actions, Navigation |
| **Landing** | `src/pages/Index.tsx` | Sign up, Log in, Main CTAs |
| **Login** | `src/pages/Login.tsx` | Submit, Forgot Password |
| **Sign Up** | `src/pages/SignUp.tsx` | Submit, Google Auth |
| **Onboarding** | `src/pages/Onboarding.tsx` | Complete profile steps |

### 4. Handler Function Validation Script

Run this to find potentially broken handlers:
```bash
# Find onClick handlers that reference undefined functions
for file in src/pages/*.tsx src/components/**/*.tsx; do
  # Extract function names from onClick handlers
  handlers=$(grep -oP 'onClick=\{(?!.*=>)([a-zA-Z_][a-zA-Z0-9_]*)\}' "$file" 2>/dev/null | sed 's/onClick={//;s/}//')
  for handler in $handlers; do
    # Check if function is defined in the file
    if ! grep -q "const $handler\|function $handler\|$handler =" "$file" 2>/dev/null; then
      echo "POTENTIAL ISSUE: $file - Handler '$handler' may not be defined"
    fi
  done
done
```

### 5. Component Dependency Check

After modifying a component, verify its dependencies:
```bash
# Check imports vs usage for a specific file
FILE="src/pages/Dashboard.tsx"

# List all imports
grep "^import" "$FILE"

# Find used components (capital case JSX)
grep -oP "<[A-Z][a-zA-Z0-9]*" "$FILE" | sort -u

# Find used functions from hooks
grep -oP "use[A-Z][a-zA-Z]*" "$FILE" | sort -u
```

### 6. Runtime Error Prevention Checklist

Before committing UI changes, verify:

- [ ] **Icons**: All `<IconName />` have corresponding import from lucide-react
- [ ] **Handlers**: All `onClick={handlerName}` functions are defined
- [ ] **Toast**: Only use `toast.success`, `toast.error`, `toast.warning`, `toast.info`
- [ ] **State**: All `useState` variables used in JSX are defined
- [ ] **Props**: All component props match their TypeScript interfaces
- [ ] **Async**: All async handlers have try/catch with proper error handling
- [ ] **Conditional**: All conditional renders check for null/undefined with `?.` or `&&`

### 7. Quick Validation One-Liner

Run this after any UI change:
```bash
npm run lint && npx tsc --noEmit && npm run build && echo "✅ All checks passed"
```

---

## Deployment

- **Dev Branch**: Auto-deploys to staging
- **Main Branch**: Auto-deploys to production
- **Supabase Functions**: Deploy via `supabase functions deploy <function-name>`

---

## Contact

For questions about this codebase, refer to:
- `.agent/KNOWLEDGE_BASE.md` - Full technical documentation
