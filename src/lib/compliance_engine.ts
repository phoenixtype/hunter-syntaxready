
import { logActivity } from "./activity_logger";

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ComplianceCheck {
    allowed: boolean;
    risk: RiskLevel;
    reason: string;
}

interface ActivityCounter {
    applicationsLastHour: number;
    lastApplicationTime: number;
}

// In-memory counter (would be DB in prod)
const metrics: ActivityCounter = {
    applicationsLastHour: 0,
    lastApplicationTime: Date.now()
};

const SAFE_MODE_LIMIT = 5;
const AGGRESSIVE_MODE_LIMIT = 20;

export const checkCompliance = async (
    action: 'APPLY' | 'SCRAPE', 
    safeMode: boolean = true,
    targetUrl?: string
): Promise<ComplianceCheck> => {
    
    // 1. Check Rate Limits
    if (action === 'APPLY') {
        // Reset counter if hour passed
        const now = Date.now();
        if (now - metrics.lastApplicationTime > 3600000) {
            metrics.applicationsLastHour = 0;
            metrics.lastApplicationTime = now;
        }

        const limit = safeMode ? SAFE_MODE_LIMIT : AGGRESSIVE_MODE_LIMIT;
        
        if (metrics.applicationsLastHour >= limit) {
            logActivity('Compliance', 'Block', `Rate limit exceeded (${metrics.applicationsLastHour}/${limit}). Action blocked.`, 'warning');
            return {
                allowed: false,
                risk: 'HIGH',
                reason: `Hourly application limit reached (${limit}). Cooling down to prevent bans.`
            };
        }
    }

    // 2. Check Blacklisted Domains (Mock)
    if (targetUrl && (targetUrl.includes('bad-site.com') || targetUrl.includes('scam'))) {
        return {
            allowed: false,
            risk: 'CRITICAL',
            reason: 'Target domain is flagged as unsafe or fraudulent.'
        };
    }

    return {
        allowed: true,
        risk: 'LOW',
        reason: 'Action is within safe operating parameters.'
    };
};

export const recordCompliantAction = (action: 'APPLY' | 'SCRAPE') => {
    if (action === 'APPLY') {
        metrics.applicationsLastHour++;
        metrics.lastApplicationTime = Date.now();
    }
};
