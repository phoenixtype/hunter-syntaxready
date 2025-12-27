
import { logActivity } from "./activity_logger";

export interface FeedbackAction {
    jobId: string;
    action: 'DISMISS' | 'APPLY' | 'VIEW' | 'SAVE';
    timestamp: number;
    jobMetadata: {
        skills: string[];
        company: string;
        source: string;
    }
}

export interface MatchingWeights {
    skillWeight: number;
    cultureWeight: number;
    freshnessWeight: number;
    bannedCompanies: string[];
    preferredSkills: string[];
}

// Default Weights
let currentWeights: MatchingWeights = {
    skillWeight: 0.6,
    cultureWeight: 0.2,
    freshnessWeight: 0.2,
    bannedCompanies: [],
    preferredSkills: []
};

// Mock "Memory"
const interactionHistory: FeedbackAction[] = [];

export const recordFeedback = async (action: FeedbackAction): Promise<void> => {
    interactionHistory.push(action);
    console.log(`[Learning Agent] Recorded ${action.action} for job ${action.jobId}`);
    
    // Trust Agent Logging
    logActivity(
        'Learning', 
        'Feedback Recorded', 
        `User ${action.action} on ${action.jobMetadata.company}. Adjusting weights...`, 
        'info'
    );

    // Immediate Reinforcement Learning (Simple Heuristic)
    if (action.action === 'DISMISS') {
        currentWeights.bannedCompanies.push(action.jobMetadata.company);
    } else if (action.action === 'APPLY') {
        action.jobMetadata.skills.forEach(skill => {
            if (!currentWeights.preferredSkills.includes(skill)) {
                currentWeights.preferredSkills.push(skill);
            }
        });
    }

    // Simulate async weight adjustment (Gradient Descent would go here in real life)
    await new Promise(resolve => setTimeout(resolve, 500));
};

export const getOptimizedWeights = (): MatchingWeights => {
    // Return a copy to avoid mutation reference issues
    return { ...currentWeights };
};
