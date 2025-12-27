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

export class ComplianceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ComplianceError";
    }
}

// Simulate application (with real compliance checks)
export const simulateApplication = async (
  job: JobOpportunity, 
  onUpdate: (state: ApplicationState) => void,
  userId?: string,
  safeMode: boolean = true
) => {
    // Compliance Check
    const compliance = await checkCompliance('APPLY', safeMode, job.url, userId);
    
    if (!compliance.allowed) {
        throw new ComplianceError(compliance.reason);
    }
    
    // Record the action
    if (userId) {
        await recordCompliantAction('APPLY', userId);
    }

    let state: ApplicationState = {
        jobId: job.id,
        status: 'idle',
        progress: 0,
        logs: ["Compliance Check Passed. Initializing Agent..."]
    };

    const update = (partial: Partial<ApplicationState>) => {
        state = { ...state, ...partial };
        onUpdate(state);
    };

    logActivity('Application', 'Started', `Applying to ${job.title} at ${job.company}`, 'action', userId);

    update({ status: 'filling_form', progress: 10, logs: [...state.logs, "Navigating to career portal..."] });
    await new Promise(r => setTimeout(r, 1000));

    update({ progress: 30, logs: [...state.logs, "Auto-filling contact details..."] });
    await new Promise(r => setTimeout(r, 1000));

    update({ status: 'uploading_resume', progress: 50, logs: [...state.logs, "Uploading optimized resume..."] });
    await new Promise(r => setTimeout(r, 1500));

    update({ status: 'answering_questions', progress: 70, logs: [...state.logs, "Answering EEOC questions..."] });
    await new Promise(r => setTimeout(r, 1000));

    update({ status: 'submitting', progress: 90, logs: [...state.logs, "Final review... Submitting..."] });
    await new Promise(r => setTimeout(r, 1000));

    // Record application in database
    if (userId) {
        try {
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

    logActivity('Application', 'Completed', `Successfully applied to ${job.company}`, 'success', userId);
    update({ status: 'applied', progress: 100, logs: [...state.logs, "Application Successful!"] });
};

// Get application history
export const getApplicationHistory = async (userId: string): Promise<any[]> => {
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

        return data || [];
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
