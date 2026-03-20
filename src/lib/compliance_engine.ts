import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "./activity_logger";

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ComplianceCheck {
    allowed: boolean;
    risk: RiskLevel;
    reason: string;
}

const SAFE_MODE_LIMIT = 5;
const AGGRESSIVE_MODE_LIMIT = 20;

// In-memory cache for rate limiting (reset hourly)
const rateLimitCache = new Map<string, { count: number; hour: number }>();

// Clean up old cache entries every hour
setInterval(() => {
    const currentHour = new Date().getHours();
    for (const [key, value] of rateLimitCache.entries()) {
        if (value.hour !== currentHour) {
            rateLimitCache.delete(key);
        }
    }
}, 60 * 60 * 1000); // 1 hour

// High-performance in-memory + database rate limiting
const checkRateLimitOptimized = async (userId: string, action: string, safeMode: boolean): Promise<{ allowed: boolean; current: number; limit: number }> => {
    const currentHour = new Date().getHours();
    const cacheKey = `${userId}:${action}:${currentHour}`;
    const limit = safeMode ? SAFE_MODE_LIMIT : AGGRESSIVE_MODE_LIMIT;

    // 1. Check in-memory cache first (ultra-fast)
    let cached = rateLimitCache.get(cacheKey);

    if (!cached) {
        // 2. Load from database if not in cache
        try {
            const hourBucket = getCurrentHourBucket();
            const { data } = await supabase
                .from('rate_limits')
                .select('request_count')
                .eq('user_id', userId)
                .eq('function_name', action)
                .eq('window_start', hourBucket.toISOString())
                .maybeSingle();

            const dbCount = data?.request_count || 0;
            cached = { count: dbCount, hour: currentHour };
            rateLimitCache.set(cacheKey, cached);
        } catch (error) {
            console.error('[RateLimit] Database check failed:', error);
            // Conservative fallback
            return { allowed: false, current: 999, limit };
        }
    }

    // 3. Increment counter
    cached.count++;
    rateLimitCache.set(cacheKey, cached);

    // 4. Update database asynchronously (non-blocking)
    updateRateLimitAsync(userId, action, cached.count);

    return {
        allowed: cached.count <= limit,
        current: cached.count,
        limit
    };
};

// Async database update (doesn't block the rate limit check)
const updateRateLimitAsync = async (userId: string, action: string, newCount: number) => {
    try {
        const hourBucket = getCurrentHourBucket();
        await (supabase.rpc as any)('upsert_rate_limit', {
            p_user_id: userId,
            p_function_name: action,
            p_request_count: newCount,
            p_window_start: hourBucket.toISOString()
        });
    } catch (error) {
        console.warn('[RateLimit] Async database update failed:', error);
        // Non-critical - in-memory cache still works
    }
};

// Get current hour bucket for rate limiting
function getCurrentHourBucket(): Date {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return now;
}

// Check if action is compliant
export const checkCompliance = async (
    action: 'APPLY' | 'SCRAPE', 
    safeMode: boolean = true,
    targetUrl?: string,
    userId?: string
): Promise<ComplianceCheck> => {
    
    // 1. Check Blacklisted Domains — known scam aggregators and credential-harvesting sites
    const BLOCKED_DOMAINS = [
        'jobs2careers.com', 'nexxt.com', 'jooble.org',
        'jobs-search.org', 'free-job-alerts.com', 'totaljobs.biz',
        'careerbuilder.com.br', 'work-from-home-now.com',
    ];
    const BLOCKED_PATTERNS = ['scam', 'fraud', 'phish', 'pay-to-apply', 'get-rich-fast'];

    if (targetUrl) {
        const urlLower = targetUrl.toLowerCase();
        const isDomainBlocked = BLOCKED_DOMAINS.some(d => urlLower.includes(d));
        const isPatternBlocked = BLOCKED_PATTERNS.some(p => urlLower.includes(p));
        if (isDomainBlocked || isPatternBlocked) {
            return { allowed: false, risk: 'CRITICAL', reason: 'Target domain is flagged as unsafe or a known scam site.' };
        }
    }

    // 2. Check Rate Limits with optimized in-memory + database approach
    if (action === 'APPLY' && userId) {
        try {
            const rateLimit = await checkRateLimitOptimized(userId, action, safeMode);

            if (!rateLimit.allowed) {
                logActivity(
                    'Compliance',
                    'Block',
                    `Rate limit exceeded (${rateLimit.current}/${rateLimit.limit}). Action blocked.`,
                    'warning',
                    userId
                );

                return {
                    allowed: false,
                    risk: 'HIGH',
                    reason: `Hourly application limit reached (${rateLimit.limit}). Cooling down to prevent bans.`
                };
            }
        } catch (err) {
            console.error('Error checking compliance:', err);
            // Fail closed on error — block action to prevent abuse
            return {
                allowed: false,
                risk: 'HIGH',
                reason: 'Compliance check failed. Please try again shortly.'
            };
        }
    }

    return {
        allowed: true,
        risk: 'LOW',
        reason: 'Action is within safe operating parameters.'
    };
};

// Record a compliant action (Redis-based for performance)
export const recordCompliantAction = async (
    action: 'APPLY' | 'SCRAPE',
    userId?: string
): Promise<void> => {
    if (!userId) return;

    try {
        // Redis automatically handles the increment via checkRateLimitRedis
        // No additional action needed since the rate limit check already incremented the counter

        // Optional: Log to database asynchronously for analytics (non-blocking)
        const hourBucket = getCurrentHourBucket();
        supabase
            .from('compliance_metrics')
            .upsert({
                user_id: userId,
                action_type: action,
                hour_bucket: hourBucket.toISOString(),
                action_count: 1
            }, {
                onConflict: 'user_id,action_type,hour_bucket',
                count: 'exact'
            })
            .then(() => {
                // Non-blocking database logging for analytics
            })
            .catch((err: any) => {
                console.warn('[Analytics] Failed to log action to database:', err);
            }) as any;
    } catch (err) {
        console.error('Error recording compliant action:', err);
    }
};

// Get remaining applications for current hour (optimized cache + database)
export const getRemainingApplications = async (
    userId: string,
    safeMode: boolean = true
): Promise<number> => {
    try {
        const currentHour = new Date().getHours();
        const cacheKey = `${userId}:APPLY:${currentHour}`;
        const limit = safeMode ? SAFE_MODE_LIMIT : AGGRESSIVE_MODE_LIMIT;

        // Check cache first
        const cached = rateLimitCache.get(cacheKey);
        if (cached) {
            return Math.max(0, limit - cached.count);
        }

        // Fall back to database
        const hourBucket = getCurrentHourBucket();
        const { data } = await supabase
            .from('rate_limits')
            .select('request_count')
            .eq('user_id', userId)
            .eq('function_name', 'APPLY')
            .eq('window_start', hourBucket.toISOString())
            .maybeSingle();

        const used = data?.request_count || 0;
        return Math.max(0, limit - used);
    } catch (err) {
        console.error('Error getting remaining applications:', err);
        return safeMode ? SAFE_MODE_LIMIT : AGGRESSIVE_MODE_LIMIT;
    }
};

// Get compliance metrics for display (optimized cache + database)
export const getComplianceMetrics = async (userId: string): Promise<{
    applicationsThisHour: number;
    limit: number;
    nextReset: Date;
}> => {
    try {
        const currentHour = new Date().getHours();
        const cacheKey = `${userId}:APPLY:${currentHour}`;
        const hourBucket = getCurrentHourBucket();
        const nextReset = new Date(hourBucket);
        nextReset.setHours(nextReset.getHours() + 1);

        // Check cache first
        const cached = rateLimitCache.get(cacheKey);
        if (cached) {
            return {
                applicationsThisHour: cached.count,
                limit: SAFE_MODE_LIMIT,
                nextReset
            };
        }

        // Fall back to database
        const { data } = await supabase
            .from('rate_limits')
            .select('request_count')
            .eq('user_id', userId)
            .eq('function_name', 'APPLY')
            .eq('window_start', hourBucket.toISOString())
            .maybeSingle();

        const applicationsThisHour = data?.request_count || 0;

        return {
            applicationsThisHour,
            limit: SAFE_MODE_LIMIT,
            nextReset
        };
    } catch (err) {
        console.error('Error getting compliance metrics:', err);
        return {
            applicationsThisHour: 0,
            limit: SAFE_MODE_LIMIT,
            nextReset: new Date()
        };
    }
};
