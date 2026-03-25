import { renderHook, waitFor } from '@testing-library/react';
import { expect, describe, it, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import React from 'react';

// Mock auth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-123',
      email: 'test@example.com'
    }
  })
}));

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn()
  }
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

// Test wrapper component
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('Enhanced Subscription Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock the enhanced subscriptions table query
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'sub-123',
                user_id: 'test-user-123',
                tier: 'pro',
                status: 'active',
                feature_limits: {
                  job_applications: 100,
                  resume_generations: 50,
                  ai_interviews: 25,
                  cover_letters: 100,
                  job_matches: 500,
                  company_research: 200,
                  skill_assessments: 10
                },
                currency: 'usd',
                payment_provider: 'stripe',
                stripe_customer_id: 'cus_123',
                stripe_subscription_id: 'sub_123',
                current_period_start: '2024-01-01T00:00:00Z',
                current_period_end: '2024-02-01T00:00:00Z',
                cancel_at_period_end: false,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z'
              },
              error: null
            })
          })
        })
      })
    });

    // Mock the subscription usage query
    const mockFromUsage = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              { feature_name: 'job_applications', usage_count: 10 },
              { feature_name: 'resume_generations', usage_count: 5 }
            ],
            error: null
          })
        })
      })
    });

    // Mock RPC for usage recording
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: null
    });

    // Mock the subscription_plans table query (.eq().order())
    const mockFromPlans = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      })
    });

    (supabase.from as any).mockImplementation((tableName: string) => {
      if (tableName === 'subscriptions') {
        return mockFrom();
      } else if (tableName === 'subscription_usage') {
        return mockFromUsage();
      } else if (tableName === 'subscription_plans') {
        return mockFromPlans();
      }
      return mockFrom(); // fallback
    });

    (supabase.rpc as any).mockImplementation(mockRpc);
  });

  it('should read from subscriptions table with feature limits', async () => {
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.currentSubscription).toBeDefined();
      expect(result.current.currentSubscription?.tier).toBe('pro');
      expect(result.current.currentSubscription?.feature_limits).toEqual({
        job_applications: 100,
        resume_generations: 50,
        ai_interviews: 25,
        cover_letters: 100,
        job_matches: 500,
        company_research: 200,
        skill_assessments: 10
      });
    });
  });

  it('should check feature access correctly', async () => {
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.canAccess('job_applications')).toBe(true);
      expect(result.current.canAccess('unlimited_feature')).toBe(false);
    });
  });

  it('should determine isPro status correctly', async () => {
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isPro).toBe(true);
    });
  });

  it('should calculate remaining usage correctly', async () => {
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.getRemainingUsage('job_applications')).toBe(90); // 100 - 10
      expect(result.current.getRemainingUsage('resume_generations')).toBe(45); // 50 - 5
    });
  });

  it('should handle unlimited features correctly', async () => {
    // Mock unlimited feature
    const mockFromUnlimited = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'sub-123',
                user_id: 'test-user-123',
                tier: 'enterprise',
                status: 'active',
                feature_limits: {
                  job_applications: -1, // unlimited
                  resume_generations: -1,
                  ai_interviews: -1,
                  cover_letters: -1,
                  job_matches: -1,
                  company_research: -1,
                  skill_assessments: -1
                },
                currency: 'usd',
                payment_provider: 'stripe',
                cancel_at_period_end: false,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z'
              },
              error: null
            })
          })
        })
      })
    });

    const mockFromPlansUnlimited = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      })
    });

    (supabase.from as any).mockImplementation((tableName: string) => {
      if (tableName === 'subscriptions') {
        return mockFromUnlimited();
      } else if (tableName === 'subscription_plans') {
        return mockFromPlansUnlimited();
      }
      return mockFromUnlimited();
    });

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.canAccess('job_applications')).toBe(true);
      expect(result.current.getRemainingUsage('job_applications')).toBe(Infinity);
    });
  });
});