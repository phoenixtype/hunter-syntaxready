# Rate Limit Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin dashboard feature for managing rate limits with global test mode, function overrides, and user exemptions.

**Architecture:** Override-based system that preserves existing hardcoded rate limits while adding database-driven overrides. Rate limiter checks override table first, falls back to defaults. Single admin page with three control sections.

**Tech Stack:** React + TypeScript + Tailwind CSS + shadcn/ui components, Supabase database with RLS, existing admin panel architecture

---

## File Structure

**Database:**
- Create: `supabase/migrations/20260320000001_rate_limit_overrides.sql`
- Modify: `src/integrations/supabase/types.ts` (regenerated types)

**Backend:**
- Modify: `supabase/functions/_shared/rate-limiter.ts` (enhanced with override logic)
- Create: `supabase/functions/_shared/rate-limit-config.ts` (configuration helpers)

**Frontend:**
- Create: `src/pages/admin/RateLimitsPage.tsx` (main admin page)
- Create: `src/components/admin/GlobalTestModeCard.tsx` (test mode controls)
- Create: `src/components/admin/FunctionOverridesTable.tsx` (function-specific limits)
- Create: `src/components/admin/UserExemptionsPanel.tsx` (user exemption management)
- Create: `src/hooks/useRateLimitConfig.tsx` (data fetching hook)
- Modify: `src/components/admin/AdminSidebar.tsx` (add rate limits nav)
- Modify: `src/App.tsx` (add rate limits route)

**Tests:**
- Create: `src/pages/admin/RateLimitsPage.test.tsx`
- Create: `src/components/admin/GlobalTestModeCard.test.tsx`
- Create: `src/hooks/useRateLimitConfig.test.tsx`

---

## Task 1: Database Schema Setup

**Files:**
- Create: `supabase/migrations/20260320000001_rate_limit_overrides.sql`
- Modify: `src/integrations/supabase/types.ts`
- Modify: `docs/ADMIN_GUIDE.md:640`

- [ ] **Step 1: Create migration file**

Create migration with complete schema:

```sql
-- Rate Limit Overrides System
CREATE TABLE IF NOT EXISTS rate_limit_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  global_test_mode_enabled BOOLEAN DEFAULT false,
  global_test_mode_multiplier NUMERIC(4,1) DEFAULT 10.0,
  global_test_mode_expires_at TIMESTAMPTZ,
  global_test_mode_enabled_by UUID REFERENCES auth.users(id),
  global_test_mode_enabled_at TIMESTAMPTZ,
  function_overrides JSONB DEFAULT '{}',
  exempted_users UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO rate_limit_overrides DEFAULT VALUES;
ALTER TABLE rate_limit_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin access only" ON rate_limit_overrides
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM platform_admins
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE INDEX idx_rate_limit_overrides_test_mode
ON rate_limit_overrides(global_test_mode_enabled, global_test_mode_expires_at);

-- Database functions for configuration management
CREATE OR REPLACE FUNCTION toggle_test_mode(
  p_enabled BOOLEAN,
  p_multiplier NUMERIC DEFAULT 10.0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expires_at TIMESTAMPTZ;
BEGIN
  -- Only allow admins
  IF NOT EXISTS (
    SELECT 1 FROM platform_admins
    WHERE user_id = auth.uid() AND active = true
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  expires_at := CASE WHEN p_enabled THEN NOW() + INTERVAL '6 hours' ELSE NULL END;

  UPDATE rate_limit_overrides SET
    global_test_mode_enabled = p_enabled,
    global_test_mode_multiplier = p_multiplier,
    global_test_mode_expires_at = expires_at,
    global_test_mode_enabled_by = auth.uid(),
    global_test_mode_enabled_at = CASE WHEN p_enabled THEN NOW() ELSE NULL END,
    updated_at = NOW();

  INSERT INTO platform_logs (actor_id, action, entity_type, metadata)
  VALUES (auth.uid(), CASE WHEN p_enabled THEN 'test_mode_enabled' ELSE 'test_mode_disabled' END, 'rate_limit_config', jsonb_build_object('multiplier', p_multiplier, 'expires_at', expires_at));

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION update_function_override(
  p_function_name TEXT,
  p_limits JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_overrides JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid() AND active = true) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT function_overrides INTO current_overrides FROM rate_limit_overrides;

  IF p_limits IS NULL THEN
    current_overrides := current_overrides - p_function_name;
  ELSE
    current_overrides := current_overrides || jsonb_build_object(p_function_name, p_limits);
  END IF;

  UPDATE rate_limit_overrides SET function_overrides = current_overrides, updated_at = NOW();

  INSERT INTO platform_logs (actor_id, action, entity_type, metadata)
  VALUES (auth.uid(), 'function_override_updated', 'rate_limit_config', jsonb_build_object('function_name', p_function_name));

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION update_user_exemptions(
  p_exempted_users UUID[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid() AND active = true) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE rate_limit_overrides SET exempted_users = p_exempted_users, updated_at = NOW();

  INSERT INTO platform_logs (actor_id, action, entity_type, metadata)
  VALUES (auth.uid(), 'user_exemptions_updated', 'rate_limit_config', jsonb_build_object('count', array_length(p_exempted_users, 1)));

  RETURN true;
END;
$$;
```

- [ ] **Step 2: Apply migration**

Run: `supabase db push --linked`
Expected: Migration applied successfully

- [ ] **Step 3: Regenerate types**

Run: `supabase gen types typescript --local > src/integrations/supabase/types.ts`
Expected: Types updated

- [ ] **Step 4: Commit changes**

```bash
git add supabase/migrations/20260320000001_rate_limit_overrides.sql src/integrations/supabase/types.ts
git commit -m "feat: add rate limit overrides database schema"
```

---

## Task 2: Rate Limit Configuration Hook

**Files:**
- Create: `src/hooks/useRateLimitConfig.tsx`
- Create: `src/hooks/useRateLimitConfig.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import { useRateLimitConfig } from './useRateLimitConfig';

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useRateLimitConfig', () => {
  it('should return loading state initially', () => {
    const { result } = renderHook(() => useRateLimitConfig(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test src/hooks/useRateLimitConfig.test.tsx`
Expected: FAIL with "useRateLimitConfig not found"

- [ ] **Step 3: Implement hook**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RateLimitConfig {
  id: string;
  global_test_mode_enabled: boolean;
  global_test_mode_multiplier: number;
  global_test_mode_expires_at: string | null;
  function_overrides: Record<string, any>;
  exempted_users: string[];
}

export const useRateLimitConfig = () => {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['rate-limit-config'],
    queryFn: async (): Promise<RateLimitConfig> => {
      const { data, error } = await supabase
        .from('rate_limit_overrides')
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 30000
  });

  const toggleTestMode = useMutation({
    mutationFn: async ({ enabled, multiplier = 10 }: { enabled: boolean; multiplier?: number }) => {
      const { error } = await supabase.rpc('toggle_test_mode', { p_enabled: enabled, p_multiplier: multiplier });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-limit-config'] });
      toast.success('Test mode updated');
    },
    onError: (error) => toast.error(`Failed to update test mode: ${error.message}`)
  });

  const updateFunctionOverride = useMutation({
    mutationFn: async ({ functionName, limits }: { functionName: string; limits: any }) => {
      const { error } = await supabase.rpc('update_function_override', {
        p_function_name: functionName,
        p_limits: limits
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-limit-config'] });
      toast.success('Function override updated');
    },
    onError: (error) => toast.error(`Failed to update override: ${error.message}`)
  });

  const updateUserExemptions = useMutation({
    mutationFn: async (exemptedUsers: string[]) => {
      const { error } = await supabase.rpc('update_user_exemptions', { p_exempted_users: exemptedUsers });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-limit-config'] });
      toast.success('User exemptions updated');
    },
    onError: (error) => toast.error(`Failed to update exemptions: ${error.message}`)
  });

  const isTestModeActive = config
    ? config.global_test_mode_enabled &&
      (!config.global_test_mode_expires_at || new Date(config.global_test_mode_expires_at) > new Date())
    : false;

  return {
    config,
    isLoading,
    isTestModeActive,
    toggleTestMode,
    updateFunctionOverride,
    updateUserExemptions
  };
};
```

- [ ] **Step 4: Run test**

Run: `npm test src/hooks/useRateLimitConfig.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit hook**

```bash
git add src/hooks/useRateLimitConfig.tsx src/hooks/useRateLimitConfig.test.tsx
git commit -m "feat: add useRateLimitConfig hook"
```

---

## Task 3: Enhanced Rate Limiter Backend

**Files:**
- Create: `supabase/functions/_shared/rate-limit-config.ts`
- Modify: `supabase/functions/_shared/rate-limiter.ts`

- [ ] **Step 1: Create configuration helper**

```typescript
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export class RateLimitConfigManager {
  private config: any = null;
  private lastFetch: number = 0;
  private readonly CACHE_TTL = 30000;

  constructor(private supabase: SupabaseClient) {}

  async getConfig() {
    const now = Date.now();
    if (this.config && (now - this.lastFetch) < this.CACHE_TTL) {
      return this.config;
    }

    const { data, error } = await this.supabase
      .from('rate_limit_overrides')
      .select('*')
      .single();

    if (error) {
      return { global_test_mode_enabled: false, function_overrides: {}, exempted_users: [] };
    }

    this.config = data;
    this.lastFetch = now;
    return this.config;
  }
}
```

- [ ] **Step 2: Update rate limiter**

Enhance `supabase/functions/_shared/rate-limiter.ts` with override support:

```typescript
import { RateLimitConfigManager } from './rate-limit-config.ts';

export class RateLimiter {
  private configManager: RateLimitConfigManager;

  constructor(private supabase: SupabaseClient, private userId: string) {
    this.configManager = new RateLimitConfigManager(supabase);
  }

  async isAllowed(functionName: string, limits: any) {
    const config = await this.configManager.getConfig();

    // Check exemptions
    if (config.exempted_users?.includes(this.userId)) {
      return { allowed: true };
    }

    // Apply overrides and test mode
    let finalLimits = { ...limits };
    if (config.global_test_mode_enabled) {
      finalLimits.free.max *= config.global_test_mode_multiplier;
      finalLimits.pro.max *= config.global_test_mode_multiplier;
    }

    // Continue with existing rate limit logic...
  }
}
```

- [ ] **Step 3: Commit backend changes**

```bash
git add supabase/functions/_shared/rate-limit-config.ts supabase/functions/_shared/rate-limiter.ts
git commit -m "feat: enhance rate limiter with override support"
```

---

## Task 4: Global Test Mode Component

**Files:**
- Create: `src/components/admin/GlobalTestModeCard.tsx`
- Create: `src/components/admin/GlobalTestModeCard.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { GlobalTestModeCard } from './GlobalTestModeCard';

vi.mock('@/hooks/useRateLimitConfig', () => ({
  useRateLimitConfig: () => ({ config: null, isLoading: false, toggleTestMode: { mutate: vi.fn() } })
}));

const wrapper = ({ children }: any) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('GlobalTestModeCard', () => {
  it('renders test mode card', () => {
    render(<GlobalTestModeCard />, { wrapper });
    expect(screen.getByText('Global Test Mode')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test src/components/admin/GlobalTestModeCard.test.tsx`
Expected: FAIL with "GlobalTestModeCard not found"

- [ ] **Step 3: Implement component**

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useRateLimitConfig } from '@/hooks/useRateLimitConfig';

export const GlobalTestModeCard = () => {
  const { config, isLoading, toggleTestMode } = useRateLimitConfig();

  const handleToggle = (enabled: boolean) => {
    toggleTestMode.mutate({ enabled, multiplier: 10 });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Global Test Mode</CardTitle>
      </CardHeader>
      <CardContent>
        <Switch
          checked={config?.global_test_mode_enabled || false}
          onCheckedChange={handleToggle}
          disabled={isLoading}
        />
      </CardContent>
    </Card>
  );
};
```

- [ ] **Step 4: Run test**

Run: `npm test src/components/admin/GlobalTestModeCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit component**

```bash
git add src/components/admin/GlobalTestModeCard.tsx src/components/admin/GlobalTestModeCard.test.tsx
git commit -m "feat: add GlobalTestModeCard component"
```

---

## Task 5: Function Overrides Table

**Files:**
- Create: `src/components/admin/FunctionOverridesTable.tsx`
- Create: `src/components/admin/FunctionOverridesTable.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { FunctionOverridesTable } from './FunctionOverridesTable';

const mockConfig = {
  function_overrides: { 'generate-content': { free: { max: 100, window: 60 }, pro: { max: 200, window: 60 } } }
};

vi.mock('@/hooks/useRateLimitConfig', () => ({
  useRateLimitConfig: () => ({
    config: mockConfig,
    isLoading: false,
    updateFunctionOverride: { mutate: vi.fn(), isPending: false }
  })
}));

const wrapper = ({ children }: any) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('FunctionOverridesTable', () => {
  it('renders function overrides table with edit functionality', () => {
    render(<FunctionOverridesTable />, { wrapper });
    expect(screen.getByText('Function Overrides')).toBeInTheDocument();
    expect(screen.getByText('generate-content')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test src/components/admin/FunctionOverridesTable.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement component**

```typescript
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Check, X, RotateCcw } from 'lucide-react';
import { useRateLimitConfig } from '@/hooks/useRateLimitConfig';

const DEFAULT_LIMITS = {
  'generate-content': { free: { max: 10, window: 60 }, pro: { max: 40, window: 60 } },
  'parse-resume': { free: { max: 5, window: 60 }, pro: { max: 20, window: 60 } },
  'interview-coach': { free: { max: 3, window: 60 }, pro: { max: 15, window: 60 } },
  'salary-insights': { free: { max: 5, window: 60 }, pro: { max: 20, window: 60 } },
  'crawl-jobs': { free: { max: 2, window: 300 }, pro: { max: 10, window: 300 } },
  'generate-resume': { free: { max: 3, window: 60 }, pro: { max: 15, window: 60 } }
};

export const FunctionOverridesTable = () => {
  const { config, updateFunctionOverride } = useRateLimitConfig();
  const [editingFunction, setEditingFunction] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState({ freeMax: '', freeWindow: '', proMax: '', proWindow: '' });

  const startEditing = (functionName: string) => {
    const override = config?.function_overrides[functionName];
    const currentLimits = override || DEFAULT_LIMITS[functionName];
    setEditingValues({
      freeMax: currentLimits.free.max.toString(),
      freeWindow: currentLimits.free.window.toString(),
      proMax: currentLimits.pro.max.toString(),
      proWindow: currentLimits.pro.window.toString()
    });
    setEditingFunction(functionName);
  };

  const saveOverride = () => {
    if (!editingFunction) return;
    const limits = {
      free: { max: parseInt(editingValues.freeMax), window: parseInt(editingValues.freeWindow) },
      pro: { max: parseInt(editingValues.proMax), window: parseInt(editingValues.proWindow) }
    };
    updateFunctionOverride.mutate({ functionName: editingFunction, limits });
    setEditingFunction(null);
  };

  const resetToDefault = (functionName: string) => {
    updateFunctionOverride.mutate({ functionName, limits: null });
  };

  const getCurrentLimits = (functionName: string) => {
    return config?.function_overrides[functionName] || DEFAULT_LIMITS[functionName];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Function Overrides</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Function</TableHead>
              <TableHead>Free Tier</TableHead>
              <TableHead>Pro Tier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(DEFAULT_LIMITS).map(([name]) => {
              const limits = getCurrentLimits(name);
              const hasOverride = !!config?.function_overrides[name];
              const isEditing = editingFunction === name;

              return (
                <TableRow key={name}>
                  <TableCell>{name}</TableCell>
                  <TableCell>
                    {isEditing ? (
                      <div className="flex gap-1">
                        <Input value={editingValues.freeMax} onChange={(e) => setEditingValues(prev => ({ ...prev, freeMax: e.target.value }))} className="w-16 h-7" />
                        <Input value={editingValues.freeWindow} onChange={(e) => setEditingValues(prev => ({ ...prev, freeWindow: e.target.value }))} className="w-16 h-7" />
                      </div>
                    ) : (
                      `${limits.free.max}/${limits.free.window}s`
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <div className="flex gap-1">
                        <Input value={editingValues.proMax} onChange={(e) => setEditingValues(prev => ({ ...prev, proMax: e.target.value }))} className="w-16 h-7" />
                        <Input value={editingValues.proWindow} onChange={(e) => setEditingValues(prev => ({ ...prev, proWindow: e.target.value }))} className="w-16 h-7" />
                      </div>
                    ) : (
                      `${limits.pro.max}/${limits.pro.window}s`
                    )}
                  </TableCell>
                  <TableCell>
                    {hasOverride ? <Badge variant="outline">Override</Badge> : <Badge variant="secondary">Default</Badge>}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={saveOverride}><Check className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingFunction(null)}><X className="h-3 w-3" /></Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => startEditing(name)}><Edit className="h-3 w-3" /></Button>
                        {hasOverride && <Button size="sm" variant="ghost" onClick={() => resetToDefault(name)}><RotateCcw className="h-3 w-3" /></Button>}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
```

- [ ] **Step 2: Commit component**

```bash
git add src/components/admin/FunctionOverridesTable.tsx
git commit -m "feat: add FunctionOverridesTable component"
```

---

## Task 6: User Exemptions Panel

**Files:**
- Create: `src/components/admin/UserExemptionsPanel.tsx`
- Create: `src/components/admin/UserExemptionsPanel.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { UserExemptionsPanel } from './UserExemptionsPanel';

vi.mock('@/hooks/useRateLimitConfig', () => ({
  useRateLimitConfig: () => ({
    config: { exempted_users: [] },
    isLoading: false,
    updateUserExemptions: { mutate: vi.fn(), isPending: false }
  })
}));

const wrapper = ({ children }: any) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('UserExemptionsPanel', () => {
  it('renders user exemptions panel with search functionality', () => {
    render(<UserExemptionsPanel />, { wrapper });
    expect(screen.getByText('User Exemptions')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search user by email...')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test src/components/admin/UserExemptionsPanel.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement component**

```typescript
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserX, UserCheck, Mail, Trash2, Plus } from 'lucide-react';
import { useRateLimitConfig } from '@/hooks/useRateLimitConfig';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface User {
  id: string;
  email: string;
  full_name?: string;
}

export const UserExemptionsPanel = () => {
  const { config, updateUserExemptions } = useRateLimitConfig();
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { data: exemptedUsersDetails } = useQuery({
    queryKey: ['exempted-users', config?.exempted_users],
    queryFn: async (): Promise<User[]> => {
      if (!config?.exempted_users?.length) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, user:auth.users!inner(email)')
        .in('id', config.exempted_users);
      if (error) return [];
      return data.map(p => ({ id: p.id, email: (p.user as any).email, full_name: p.full_name || undefined }));
    },
    enabled: !!config?.exempted_users?.length
  });

  const searchUsers = async () => {
    if (!searchEmail.trim()) return;
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, user:auth.users!inner(email)')
        .ilike('user.email', `%${searchEmail}%`)
        .limit(5);
      if (!error) {
        setSearchResults(data.map(p => ({ id: p.id, email: (p.user as any).email, full_name: p.full_name || undefined })));
      }
    } finally {
      setIsSearching(false);
    }
  };

  const addExemption = (userId: string) => {
    const current = config?.exempted_users || [];
    if (!current.includes(userId)) {
      updateUserExemptions.mutate([...current, userId]);
      setSearchEmail('');
      setSearchResults([]);
    }
  };

  const removeExemption = (userId: string) => {
    const current = config?.exempted_users || [];
    updateUserExemptions.mutate(current.filter(id => id !== userId));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserX className="h-5 w-5" />
            User Exemptions
          </div>
          <Button size="sm" onClick={() => setSearchEmail('')}>
            <Plus className="h-4 w-4 mr-1" />
            Add User
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <UserCheck className="h-4 w-4" />
          <AlertDescription>
            Exempted users bypass all rate limits completely. Use for admin accounts or testing.
          </AlertDescription>
        </Alert>

        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search by email address..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
            />
            <Button onClick={searchUsers} disabled={isSearching || !searchEmail.trim()} size="sm">
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Search Results:</div>
              {searchResults.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{user.email}</div>
                      {user.full_name && <div className="text-xs text-muted-foreground">{user.full_name}</div>}
                    </div>
                  </div>
                  {config?.exempted_users?.includes(user.id) ? (
                    <Badge variant="secondary">Already Exempted</Badge>
                  ) : (
                    <Button size="sm" onClick={() => addExemption(user.id)}>Add Exemption</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Exempted Users ({exemptedUsersDetails?.length || 0})</div>
          {exemptedUsersDetails?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserX className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No users are currently exempted from rate limits.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {exemptedUsersDetails?.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <UserCheck className="h-4 w-4 text-green-600" />
                    <div>
                      <div className="font-medium">{user.email}</div>
                      {user.full_name && <div className="text-sm text-muted-foreground">{user.full_name}</div>}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => removeExemption(user.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
```

- [ ] **Step 2: Commit component**

```bash
git add src/components/admin/UserExemptionsPanel.tsx
git commit -m "feat: add UserExemptionsPanel component"
```

---

## Task 7: Main Admin Page

**Files:**
- Create: `src/pages/admin/RateLimitsPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/admin/AdminSidebar.tsx`

- [ ] **Step 1: Create main page**

```typescript
import { GlobalTestModeCard } from '@/components/admin/GlobalTestModeCard';
import { FunctionOverridesTable } from '@/components/admin/FunctionOverridesTable';
import { UserExemptionsPanel } from '@/components/admin/UserExemptionsPanel';

export const RateLimitsPage = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Rate Limit Management</h1>
      <GlobalTestModeCard />
      <FunctionOverridesTable />
      <UserExemptionsPanel />
    </div>
  );
};
```

- [ ] **Step 2: Add route to App.tsx**

Add route for `/admin/rate-limits` with `RequireAdmin` protection.

- [ ] **Step 3: Add sidebar navigation**

Add "Rate Limits" to admin sidebar navigation.

- [ ] **Step 4: Commit integration**

```bash
git add src/pages/admin/RateLimitsPage.tsx src/App.tsx src/components/admin/AdminSidebar.tsx
git commit -m "feat: integrate rate limits page into admin dashboard"
```

---

## Task 8: Update Edge Functions

**Files:**
- Modify: `supabase/functions/generate-content/index.ts`
- Modify: `supabase/functions/interview-coach/index.ts`

- [ ] **Step 1: Update generate-content function**

Replace rate limiting section with enhanced version:

```typescript
const { RateLimiter } = await import('../_shared/rate-limiter.ts');
const limiter = new RateLimiter(supabase, user.id);
const { allowed, error: limitError } = await limiter.isAllowed('generate-content', {
  free: { max: 10, window: 60 },
  pro:  { max: 40, window: 60 },
});
```

- [ ] **Step 2: Update other edge functions**

Apply similar changes to other functions that use rate limiting.

- [ ] **Step 3: Test functions**

Run: `supabase functions serve generate-content`
Expected: Function works with enhanced rate limiting

- [ ] **Step 4: Commit edge function updates**

```bash
git add supabase/functions/generate-content/index.ts supabase/functions/interview-coach/index.ts
git commit -m "feat: update edge functions with enhanced rate limiter"
```

---

## Task 9: Final Testing and Documentation

**Files:**
- Modify: `docs/ADMIN_GUIDE.md`
- Create: `docs/TROUBLESHOOTING_RATE_LIMITS.md`

- [ ] **Step 1: Test complete feature**

1. Navigate to `/admin/rate-limits`
2. Test all three sections work correctly
3. Verify rate limiting works with overrides

- [ ] **Step 2: Add documentation**

Update admin guide with rate limits section and create troubleshooting guide.

- [ ] **Step 3: Final commit**

```bash
git add docs/ADMIN_GUIDE.md docs/TROUBLESHOOTING_RATE_LIMITS.md
git commit -m "docs: add rate limits admin documentation"
```

---

**Plan complete and ready for execution!**