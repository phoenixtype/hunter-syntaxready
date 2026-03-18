import { supabase } from "@/integrations/supabase/client";
import { JobOpportunity } from "./crawler_engine";
import { checkCompliance, recordCompliantAction } from "./compliance_engine";
import { logActivity } from "./activity_logger";

export type ApplicationStatus = 'idle' | 'filling_form' | 'uploading_resume' | 'answering_questions' | 'submitting' | 'applied' | 'failed';

export interface ApplicationState {
  jobId: string;
  status: ApplicationStatus;
  progress: number;
  logs: string[];
}

export interface ApplicationMetrics {
    interviews: number;
    offers: number;
}

export interface ApplicationRecord {
    id: string;
    user_id: string;
    job_id: string;
    job_title: string;
    company: string;
    job_url: string;
    status: string;
    applied_at: string;
    metadata?: {
        source?: string;
        salary_range?: string;
        [key: string]: unknown;
    };
    notes?: string;
}

export class ComplianceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ComplianceError";
    }
}

/**
 * Record a job application: compliance check → record in DB.
 * Navigation to the job URL is handled by an <a> element in the UI — NOT window.open —
 * so the browser never blocks the new tab as a popup.
 */
export const simulateApplication = async (
  job: JobOpportunity,
  onUpdate: (state: ApplicationState) => void,
  userId?: string,
  safeMode: boolean = true
) => {
    // 1. Compliance Check
    const compliance = await checkCompliance('APPLY', safeMode, job.url, userId);

    if (!compliance.allowed) {
        throw new ComplianceError(compliance.reason);
    }

    let state: ApplicationState = {
        jobId: job.id,
        status: 'idle',
        progress: 0,
        logs: ["Compliance check passed."]
    };

    const update = (partial: Partial<ApplicationState>) => {
        state = { ...state, ...partial };
        onUpdate(state);
    };

    logActivity('Application', 'Started', `Applying to ${job.title} at ${job.company}`, 'action', userId);
    update({ status: 'filling_form', progress: 40, logs: [...state.logs, "Preparing your application..."] });

    // 2. Record compliance action + application in DB in parallel
    const [complianceResult, insertResult] = await Promise.allSettled([
        userId ? recordCompliantAction('APPLY', userId) : Promise.resolve(),
        userId ? supabase.from('application_history').insert({
            user_id: userId,
            job_id: job.id,
            job_title: job.title,
            company: job.company,
            job_url: job.url,
            status: 'applied',
            metadata: {
                source: job.source,
                salary_range: job.salary_range,
                tech_stack: job.tech_stack
            }
        }) : Promise.resolve(),
    ]);
    if (complianceResult.status === 'rejected') {
        console.error('[APPLICATION] Compliance record failed:', complianceResult.reason);
    }
    if (insertResult.status === 'rejected') {
        console.error('[APPLICATION] DB insert failed:', insertResult.reason);
    }

    update({ status: 'submitting', progress: 80, logs: [...state.logs, "Application recorded!"] });

    logActivity('Application', 'Completed', `Recorded application to ${job.company}`, 'success', userId);
    update({ status: 'applied', progress: 100, logs: [...state.logs, "Application saved. Complete it on the employer's site."] });
};

// Get application history
export const getApplicationHistory = async (userId: string): Promise<ApplicationRecord[]> => {
    try {
        const { data, error } = await supabase
            .from('application_history')
            .select('*')
            .eq('user_id', userId)
            .order('applied_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('Error fetching application history:', error);
            return [];
        }

        return (data || []) as ApplicationRecord[];
    } catch (err) {
        console.error('Error fetching application history:', err);
        return [];
    }
};

// Update application status
export const updateApplicationStatus = async (
    applicationId: string,
    status: string,
    notes?: string
): Promise<void> => {
    const { error } = await supabase
        .from('application_history')
        .update({ status, notes })
        .eq('id', applicationId);

    if (error) {
        console.error('Error updating application status:', error);
        throw new Error(error.message || 'Failed to update application status');
    }
};

// Get total application count
export const getApplicationCount = async (userId: string): Promise<number> => {
    try {
        const { count, error } = await supabase
            .from('application_history')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching application count:', error);
            return 0;
        }

        return count || 0;
    } catch (err) {
        console.error('Error fetching application count:', err);
        return 0;
    }
};

// Get Magic Metrics (Interviews and Offers)
export const getApplicationMetrics = async (userId: string): Promise<ApplicationMetrics> => {
    try {
        const { data, error } = await supabase
            .from('application_history')
            .select('status')
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching application metrics:', error);
            return { interviews: 0, offers: 0 };
        }

        let interviews = 0;
        let offers = 0;

        data?.forEach((app) => {
            const status = (app.status || '').toLowerCase();
            if (status.includes('offer') || status.includes('accepted')) {
                offers++;
            } else if (status.includes('interview') || status.includes('screening') || status.includes('phone') || status.includes('onsite')) {
                interviews++;
            }
        });

        // Offers should fundamentally also count as having successfully interviewed
        return { 
            interviews: interviews + offers, 
            offers 
        };
    } catch (err) {
        console.error('Error fetching application metrics:', err);
        return { interviews: 0, offers: 0 };
    }
};
