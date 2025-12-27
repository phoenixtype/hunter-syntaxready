
import { JobOpportunity } from "./crawler_engine";
import { checkCompliance, recordCompliantAction } from "./compliance_engine";

export type ApplicationStatus = 'idle' | 'filling_form' | 'uploading_resume' | 'answering_questions' | 'submitting' | 'applied' | 'failed';

export interface ApplicationState {
  jobId: string;
  status: ApplicationStatus;
  progress: number; // 0-100
  logs: string[];
}

export class ComplianceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ComplianceError";
    }
}

// Mock browser agent steps
export const simulateApplication = async (
  job: JobOpportunity, 
  onUpdate: (state: ApplicationState) => void
) => {
    // Phase 17: Compliance Check
    // Defaulting to Safe Mode = true for safety
    const compliance = await checkCompliance('APPLY', true, job.url);
    
    if (!compliance.allowed) {
        throw new ComplianceError(compliance.reason);
    }
    
    recordCompliantAction('APPLY');

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

  update({ status: 'applied', progress: 100, logs: [...state.logs, "Application Successful!"] });
};
