import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "./activity_logger";
import Redis from 'ioredis';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ComplianceCheck {
    allowed: boolean;
    risk: RiskLevel;
    reason: string;
}

const SAFE_MODE_LIMIT = 5;
const AGGRESSIVE_MODE_LIMIT = 20;

// Redis client for high-performance rate limiting
let redisClient: Redis | null = null;

// Initialize Redis client (lazy loading)
const getRedisClient = (): Redis => {
    if (!redisClient) {
        const redisUrl = import.meta.env.VITE_REDIS_URL || 'redis://localhost:6379';
        redisClient = new Redis(redisUrl, {
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            maxRetriesPerRequest: 3,
            lazyConnect: true
        });

        redisClient.on('error', (err) => {
            console.error('[Redis] Connection error:', err);
        });
    }
    return redisClient;
};

// Redis-based rate limiting for billion-user scale
const checkRateLimitRedis = async (userId: string, action: string): Promise<{ allowed: boolean; current: number; limit: number }> => {
    try {
        const redis = getRedisClient();
        const key = `rate_limit:${userId}:${action}:${new Date().getHours()}`;

        // Use Redis INCR for atomic increment with expiry
        const current = await redis.incr(key);

        // Set 1-hour expiry on first increment
        if (current === 1) {
            await redis.expire(key, 3600);
        }

        const limit = action === 'APPLY' ? 20 : 100; // Configurable limits

        return {
            allowed: current <= limit,
            current,
            limit
        };
    } catch (error) {
        console.error('[Redis] Rate limit check failed:', error);
        // Fallback to conservative rate limiting on Redis failure
        return { allowed: false, current: 999, limit: 1 };
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

    // 2. Check Rate Limits with Redis (high-performance, non-blocking)
    if (action === 'APPLY' && userId) {
        try {
            const rateLimit = await checkRateLimitRedis(userId, action);
            const limit = safeMode ? SAFE_MODE_LIMIT : AGGRESSIVE_MODE_LIMIT;

            if (!rateLimit.allowed || rateLimit.current > limit) {
                logActivity(
                    'Compliance',
                    'Block',
                    `Rate limit exceeded (${rateLimit.current}/${limit}). Action blocked.`,
                    'warning',
                    userId
                );

                return {
                    allowed: false,
                    risk: 'HIGH',
                    reason: `Hourly application limit reached (${limit}). Cooling down to prevent bans.`
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
            .catch((err) => {
                console.warn('[Analytics] Failed to log action to database:', err);
            });
    } catch (err) {
        console.error('Error recording compliant action:', err);
    }
};

// Get remaining applications for current hour (Redis-based)
export const getRemainingApplications = async (
    userId: string,
    safeMode: boolean = true
): Promise<number> => {
    try {
        const redis = getRedisClient();
        const key = `rate_limit:${userId}:APPLY:${new Date().getHours()}`;
        const limit = safeMode ? SAFE_MODE_LIMIT : AGGRESSIVE_MODE_LIMIT;

        const used = await redis.get(key);
        const usedCount = used ? parseInt(used, 10) : 0;

        return Math.max(0, limit - usedCount);
    } catch (err) {
        console.error('Error getting remaining applications from Redis:', err);
        return safeMode ? SAFE_MODE_LIMIT : AGGRESSIVE_MODE_LIMIT;
    }
};

// Get compliance metrics for display (Redis-based)
export const getComplianceMetrics = async (userId: string): Promise<{
    applicationsThisHour: number;
    limit: number;
    nextReset: Date;
}> => {
    try {
        const redis = getRedisClient();
        const key = `rate_limit:${userId}:APPLY:${new Date().getHours()}`;
        const hourBucket = getCurrentHourBucket();
        const nextReset = new Date(hourBucket);
        nextReset.setHours(nextReset.getHours() + 1);

        const used = await redis.get(key);
        const applicationsThisHour = used ? parseInt(used, 10) : 0;

        return {
            applicationsThisHour,
            limit: SAFE_MODE_LIMIT,
            nextReset
        };
    } catch (err) {
        console.error('Error getting compliance metrics from Redis:', err);
        return {
            applicationsThisHour: 0,
            limit: SAFE_MODE_LIMIT,
            nextReset: new Date()
        };
    }
};
