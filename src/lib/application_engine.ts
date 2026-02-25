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
 * Apply to a job: compliance check → record in DB → redirect user to external job URL.
 * This is NOT a simulated/mocked flow — it logs a real application and opens the job page.
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
    
    // 2. Record the compliance action
    if (userId) {
        await recordCompliantAction('APPLY', userId);
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

    update({ status: 'filling_form', progress: 25, logs: [...state.logs, "Preparing your application..."] });

    // 3. Record application in database
    if (userId) {
        try {
            update({ status: 'submitting', progress: 50, logs: [...state.logs, "Recording application..."] });
            
            await supabase
                .from('application_history')
                .insert({
                    user_id: userId,
                    job_id: job.id,
                    job_title: job.title,
                    company: job.company,
                    job_url: job.url,
                    status: 'applied',
                    metadata: {
                        source: job.source,
                        salary_range: job.salary_range
                    }
                });
        } catch (err) {
            console.error('Failed to record application:', err);
        }
    }

    // 4. Open the job URL for the user to complete the actual application
    if (job.url) {
        update({ progress: 75, logs: [...state.logs, "Opening job page in new tab..."] });
        window.open(job.url, '_blank', 'noopener,noreferrer');
    }

    logActivity('Application', 'Completed', `Recorded application to ${job.company}`, 'success', userId);
    update({ status: 'applied', progress: 100, logs: [...state.logs, "Application recorded! Complete the application on the employer's site."] });
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

        return (data as unknown as ApplicationRecord[]) || [];
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
    try {
        await supabase
            .from('application_history')
            .update({ status, notes })
            .eq('id', applicationId);
    } catch (err) {
        console.error('Error updating application status:', err);
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
