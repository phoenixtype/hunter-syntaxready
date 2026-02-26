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

    // 2. Check Rate Limits from database
    if (action === 'APPLY' && userId) {
        try {
            const hourBucket = getCurrentHourBucket();
            
            const { data, error } = await supabase
                .from('compliance_metrics')
                .select('action_count')
                .eq('user_id', userId)
                .eq('action_type', action)
                .eq('hour_bucket', hourBucket.toISOString())
                .maybeSingle();

            const currentCount = data?.action_count || 0;
            const limit = safeMode ? SAFE_MODE_LIMIT : AGGRESSIVE_MODE_LIMIT;
            
            if (currentCount >= limit) {
                logActivity(
                    'Compliance', 
                    'Block', 
                    `Rate limit exceeded (${currentCount}/${limit}). Action blocked.`, 
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

// Record a compliant action
export const recordCompliantAction = async (
    action: 'APPLY' | 'SCRAPE',
    userId?: string
): Promise<void> => {
    if (!userId) return;

    const hourBucket = getCurrentHourBucket();

    try {
        // Try to update existing record
        const { data: existing } = await supabase
            .from('compliance_metrics')
            .select('id, action_count')
            .eq('user_id', userId)
            .eq('action_type', action)
            .eq('hour_bucket', hourBucket.toISOString())
            .maybeSingle();

        if (existing) {
            await supabase
                .from('compliance_metrics')
                .update({ action_count: existing.action_count + 1 })
                .eq('id', existing.id);
        } else {
            await supabase
                .from('compliance_metrics')
                .insert({
                    user_id: userId,
                    action_type: action,
                    hour_bucket: hourBucket.toISOString(),
                    action_count: 1
                });
        }
    } catch (err) {
        console.error('Error recording compliant action:', err);
    }
};

// Get remaining applications for current hour
export const getRemainingApplications = async (
    userId: string,
    safeMode: boolean = true
): Promise<number> => {
    try {
        const hourBucket = getCurrentHourBucket();
        const limit = safeMode ? SAFE_MODE_LIMIT : AGGRESSIVE_MODE_LIMIT;
        
        const { data } = await supabase
            .from('compliance_metrics')
            .select('action_count')
            .eq('user_id', userId)
            .eq('action_type', 'APPLY')
            .eq('hour_bucket', hourBucket.toISOString())
            .maybeSingle();

        const used = data?.action_count || 0;
        return Math.max(0, limit - used);
    } catch (err) {
        console.error('Error getting remaining applications:', err);
        return safeMode ? SAFE_MODE_LIMIT : AGGRESSIVE_MODE_LIMIT;
    }
};

// Get compliance metrics for display
export const getComplianceMetrics = async (userId: string): Promise<{
    applicationsThisHour: number;
    limit: number;
    nextReset: Date;
}> => {
    try {
        const hourBucket = getCurrentHourBucket();
        const nextReset = new Date(hourBucket);
        nextReset.setHours(nextReset.getHours() + 1);
        
        const { data } = await supabase
            .from('compliance_metrics')
            .select('action_count')
            .eq('user_id', userId)
            .eq('action_type', 'APPLY')
            .eq('hour_bucket', hourBucket.toISOString())
            .maybeSingle();

        return {
            applicationsThisHour: data?.action_count || 0,
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
