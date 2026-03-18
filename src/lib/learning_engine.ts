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

// Learning engine status
let engineStatus: 'uninitialized' | 'database' | 'memory' | 'error' = 'uninitialized';
let databaseAvailable = true;

// Cache for current session (fallback to in-memory if database fails)
let currentWeights: MatchingWeights = {
    skillWeight: 0.6,
    cultureWeight: 0.2,
    freshnessWeight: 0.2,
    bannedCompanies: [],
    preferredSkills: []
};

// In-memory feedback storage (fallback)
const inMemoryFeedback: FeedbackAction[] = [];

let currentUserId: string | null = null;

// Check if database tables exist
const checkDatabaseHealth = async (): Promise<boolean> => {
    try {
        // Try to query learning_weights table
        const { error: weightsError } = await supabase
            .from('learning_weights')
            .select('user_id')
            .limit(1);

        // Try to query feedback_actions table
        const { error: feedbackError } = await supabase
            .from('feedback_actions')
            .select('id')
            .limit(1);

        // Check if errors are due to missing tables
        const tablesExist = !weightsError && !feedbackError;
        
        if (!tablesExist) {
            console.warn('[LEARNING] Database tables not found. Error details:', {
                weightsError: weightsError?.message,
                feedbackError: feedbackError?.message
            });
            console.warn('[LEARNING] Falling back to in-memory storage. To enable persistence, run complete_infrastructure.sql in Supabase.');
        }

        return tablesExist;
    } catch (err) {
        console.error('[LEARNING] Database health check failed:', err);
        return false;
    }
};

// Initialize learning engine for a user with retry and fallback
export const initializeLearningEngine = async (userId: string): Promise<void> => {
    // Reset to defaults before loading new user — prevents previous user's weights leaking
    if (currentUserId !== userId) {
        currentWeights = {
            skillWeight: 0.6,
            cultureWeight: 0.2,
            freshnessWeight: 0.2,
            bannedCompanies: [],
            preferredSkills: [],
        };
        engineStatus = 'uninitialized';
    }
    currentUserId = userId;

    // Check database health first
    databaseAvailable = await checkDatabaseHealth();
    
    if (!databaseAvailable) {
        console.warn('[LEARNING] ⚠️ Running in MEMORY-ONLY mode. Preferences will not persist across sessions.');
        engineStatus = 'memory';
        return;
    }
    
    // Try to fetch from database with retry
    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const { data, error } = await supabase
                .from('learning_weights')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (error) {
                console.error(`[LEARNING] Fetch error (attempt ${attempt}/${maxRetries}):`, error.message);
                
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    continue;
                }
                
                // Final attempt failed, fall back to memory
                console.warn('[LEARNING] Database fetch failed after retries. Using in-memory storage.');
                engineStatus = 'memory';
                return;
            }

            if (data) {
                currentWeights = {
                    skillWeight: Number(data.skill_weight) || 0.6,
                    cultureWeight: Number(data.culture_weight) || 0.2,
                    freshnessWeight: Number(data.freshness_weight) || 0.2,
                    bannedCompanies: data.banned_companies || [],
                    preferredSkills: data.preferred_skills || []
                };
                // Weight loading logic
                engineStatus = 'database';
            } else {
                // Create initial weights record
                const { error: insertError } = await supabase
                    .from('learning_weights')
                    .insert({
                        user_id: userId,
                        skill_weight: currentWeights.skillWeight,
                        culture_weight: currentWeights.cultureWeight,
                        freshness_weight: currentWeights.freshnessWeight,
                        banned_companies: [],
                        preferred_skills: []
                    });

                if (insertError) {
                    console.error('[LEARNING] Failed to create initial weights:', insertError.message);
                    engineStatus = 'memory';
                } else {
                    engineStatus = 'database';
                }
            }
            
            return; // Success
            
        } catch (err) {
            console.error(`[LEARNING] Exception (attempt ${attempt}/${maxRetries}):`, err);
            
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            } else {
                engineStatus = 'memory';
                console.warn('[LEARNING] Initialization failed. Using in-memory storage.');
            }
        }
    }
};

// Record user feedback with fallback
export const recordFeedback = async (action: FeedbackAction): Promise<void> => {
    
    // Update in-memory weights immediately (works in both modes)
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

    // Log activity
    logActivity(
        'Learning', 
        'Feedback Recorded', 
        `User ${action.action} on ${action.jobMetadata.company}. Adjusting weights...`, 
        'info',
        currentUserId || undefined
    );

    // Try to persist to database if available
    if (currentUserId && databaseAvailable && engineStatus === 'database') {
        try {
            // Save feedback action
            const { error: feedbackError } = await supabase
                .from('feedback_actions')
                .insert({
                    user_id: currentUserId,
                    job_id: action.jobId,
                    action: action.action,
                    job_metadata: action.jobMetadata
                });

            if (feedbackError) {
                console.warn('[LEARNING] Failed to save feedback to database:', feedbackError.message);
                inMemoryFeedback.push(action); // Fallback to memory
            }

            // Update weights
            const { error: weightsError } = await supabase
                .from('learning_weights')
                .upsert({
                    user_id: currentUserId,
                    skill_weight: currentWeights.skillWeight,
                    culture_weight: currentWeights.cultureWeight,
                    freshness_weight: currentWeights.freshnessWeight,
                    banned_companies: currentWeights.bannedCompanies,
                    preferred_skills: currentWeights.preferredSkills
                }, { onConflict: 'user_id' });

            if (weightsError) {
                console.warn('[LEARNING] Failed to update weights in database:', weightsError.message);
            } else {
                console.log('[LEARNING] ✅ Persisted to database');
            }

        } catch (err) {
            console.error('[LEARNING] Error persisting feedback:', err);
            inMemoryFeedback.push(action); // Fallback to memory
        }
    } else {
        // Store in memory only
        inMemoryFeedback.push(action);
        console.log('[LEARNING] 💾 Stored in memory (database unavailable)');
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

// Get engine status for debugging
export const getLearningEngineStatus = (): {
    status: typeof engineStatus;
    databaseAvailable: boolean;
    inMemoryFeedbackCount: number;
} => {
    return {
        status: engineStatus,
        databaseAvailable,
        inMemoryFeedbackCount: inMemoryFeedback.length
    };
};
