import { supabase } from "@/integrations/supabase/client";

export interface DatabaseHealthStatus {
    healthy: boolean;
    missingTables: string[];
    missingFunctions: string[];
    errors: string[];
    recommendations: string[];
}

/**
 * Check if required database infrastructure exists
 */
export const checkDatabaseHealth = async (): Promise<DatabaseHealthStatus> => {
    const status: DatabaseHealthStatus = {
        healthy: true,
        missingTables: [],
        missingFunctions: [],
        errors: [],
        recommendations: []
    };

    // Check required tables
    const requiredTables = [
        'profiles',
        'user_preferences',
        'job_listings',
        'candidate_profiles',
        'application_history',
        'agent_activity_logs',
        'learning_weights',
        'feedback_actions'
    ];

    for (const table of requiredTables) {
        try {
            const { error } = await supabase
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .from(table as any) 
                .select('*')
                .limit(1);

            if (error) {
                status.healthy = false;
                status.missingTables.push(table);
                status.errors.push(`Table '${table}' not accessible: ${error.message}`);
            }
        } catch (err) {
            status.healthy = false;
            status.missingTables.push(table);
            status.errors.push(`Failed to check table '${table}': ${err}`);
        }
    }

    // Check required RPC functions
    const requiredFunctions = ['check_rate_limit'];

    for (const func of requiredFunctions) {
        try {
            // Try to call with dummy data to see if function exists
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await supabase.rpc(func as any, { // Typecast for dynamic RPC
                p_user_id: '00000000-0000-0000-0000-000000000000',
                p_function_name: 'test',
                p_max_requests: 1,
                p_window_seconds: 60
            });

            // Function not found error is different from execution error
            if (error && error.message.includes('not found')) {
                status.healthy = false;
                status.missingFunctions.push(func);
                status.errors.push(`Function '${func}' not found`);
            }
        } catch (err) {
            // Ignore execution errors, we just want to know if it exists
        }
    }

    // Generate recommendations
    if (status.missingTables.length > 0) {
        status.recommendations.push(
            '🔧 Run the database setup migration in Supabase SQL Editor to create missing tables'
        );
    }

    if (status.missingFunctions.length > 0) {
        status.recommendations.push(
            '⚙️ Missing database functions. Ensure complete_infrastructure.sql was run successfully'
        );
    }

    if (status.healthy) {
        status.recommendations.push('✅ All database infrastructure is properly configured');
    }

    return status;
};

/**
 * Quick check if core tables exist
 */
export const quickHealthCheck = async (): Promise<boolean> => {
    try {
        const { error: profilesError } = await supabase
            .from('profiles')
            .select('id')
            .limit(1);

        const { error: prefsError } = await supabase
            .from('user_preferences')
            .select('user_id')
            .limit(1);

        return !profilesError && !prefsError;
    } catch {
        return false;
    }
};

/**
 * Log health status to console with formatting
 */
export const logHealthStatus = (status: DatabaseHealthStatus): void => {
    
    if (status.healthy) {
        // Log healthy status
    } else {
        if (status.missingTables.length > 0) {
            // Log missing tables
        }
        
        if (status.missingFunctions.length > 0) {
            // Log missing functions
        }
        
        if (status.recommendations.length > 0) {
            // Log recommendations
        }
    }
};
