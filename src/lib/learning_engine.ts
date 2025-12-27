import { supabase } from "@/integrations/supabase/client";
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

// Cache for current session
let currentWeights: MatchingWeights = {
    skillWeight: 0.6,
    cultureWeight: 0.2,
    freshnessWeight: 0.2,
    bannedCompanies: [],
    preferredSkills: []
};

let currentUserId: string | null = null;

// Initialize learning engine for a user
export const initializeLearningEngine = async (userId: string): Promise<void> => {
    currentUserId = userId;
    
    try {
        // Fetch existing weights from database
        const { data, error } = await supabase
            .from('learning_weights')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (data && !error) {
            currentWeights = {
                skillWeight: Number(data.skill_weight) || 0.6,
                cultureWeight: Number(data.culture_weight) || 0.2,
                freshnessWeight: Number(data.freshness_weight) || 0.2,
                bannedCompanies: data.banned_companies || [],
                preferredSkills: data.preferred_skills || []
            };
            console.log('Loaded learning weights from database');
        } else {
            // Create initial weights record
            await supabase
                .from('learning_weights')
                .insert({
                    user_id: userId,
                    skill_weight: currentWeights.skillWeight,
                    culture_weight: currentWeights.cultureWeight,
                    freshness_weight: currentWeights.freshnessWeight,
                    banned_companies: [],
                    preferred_skills: []
                });
        }
    } catch (err) {
        console.error('Error initializing learning engine:', err);
    }
};

// Record user feedback
export const recordFeedback = async (action: FeedbackAction): Promise<void> => {
    console.log(`[Learning Agent] Recorded ${action.action} for job ${action.jobId}`);
    
    // Log activity
    logActivity(
        'Learning', 
        'Feedback Recorded', 
        `User ${action.action} on ${action.jobMetadata.company}. Adjusting weights...`, 
        'info',
        currentUserId || undefined
    );

    // Update weights based on feedback
    if (action.action === 'DISMISS') {
        if (!currentWeights.bannedCompanies.includes(action.jobMetadata.company)) {
            currentWeights.bannedCompanies.push(action.jobMetadata.company);
        }
    } else if (action.action === 'APPLY') {
        action.jobMetadata.skills.forEach(skill => {
            if (!currentWeights.preferredSkills.includes(skill)) {
                currentWeights.preferredSkills.push(skill);
            }
        });
    }

    // Persist to database
    if (currentUserId) {
        try {
            // Save feedback action
            await supabase
                .from('feedback_actions')
                .insert({
                    user_id: currentUserId,
                    job_id: action.jobId,
                    action: action.action,
                    job_metadata: action.jobMetadata
                });

            // Update weights
            await supabase
                .from('learning_weights')
                .upsert({
                    user_id: currentUserId,
                    skill_weight: currentWeights.skillWeight,
                    culture_weight: currentWeights.cultureWeight,
                    freshness_weight: currentWeights.freshnessWeight,
                    banned_companies: currentWeights.bannedCompanies,
                    preferred_skills: currentWeights.preferredSkills
                }, { onConflict: 'user_id' });

        } catch (err) {
            console.error('Error persisting feedback:', err);
        }
    }
};

// Get optimized weights
export const getOptimizedWeights = (): MatchingWeights => {
    return { ...currentWeights };
};

// Check if a company is banned
export const isCompanyBanned = (company: string): boolean => {
    return currentWeights.bannedCompanies.includes(company);
};

// Check if a skill is preferred
export const isSkillPreferred = (skill: string): boolean => {
    return currentWeights.preferredSkills.includes(skill);
};
