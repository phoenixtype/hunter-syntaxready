/**
 * Environment variable validator
 * Checks for required environment variables and provides helpful error messages
 */

interface EnvValidationResult {
    valid: boolean;
    missing: string[];
    warnings: string[];
    errors: string[];
}

const REQUIRED_ENV_VARS = {
    VITE_SUPABASE_URL: {
        description: 'Supabase project URL',
        example: 'https://xxxxx.supabase.co',
        critical: true
    },
    VITE_SUPABASE_ANON_KEY: {
        description: 'Supabase anonymous key',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        critical: true
    },
    VITE_PAYSTACK_PUBLIC_KEY: {
        description: 'Paystack public key',
        example: 'pk_live_xxxxxxxxxxxxxxxxxxxxxxxx',
        critical: true
    }
};

const OPTIONAL_ENV_VARS = {
    VITE_SUPABASE_PROJECT_ID: {
        description: 'Supabase project ID',
        example: 'xxxxx',
        critical: false
    },
    VITE_SUPABASE_PUBLISHABLE_KEY: {
        description: 'Supabase publishable key (same as anon key)',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        critical: false
    }
};

/**
 * Validate environment variables
 */
export const validateEnvironment = (): EnvValidationResult => {
    const result: EnvValidationResult = {
        valid: true,
        missing: [],
        warnings: [],
        errors: []
    };

    // Check required variables
    for (const [key, config] of Object.entries(REQUIRED_ENV_VARS)) {
        const value = import.meta.env[key];
        
        if (!value || value.trim() === '') {
            result.valid = false;
            result.missing.push(key);
            result.errors.push(
                `❌ Missing required variable: ${key}\n   Description: ${config.description}\n   Example: ${config.example}`
            );
        } else {
            // Validate format
            if (key === 'VITE_SUPABASE_URL' && !value.startsWith('https://')) {
                result.warnings.push(
                    `⚠️ ${key} should start with https://`
                );
            }
            
            if (key.includes('KEY') && value.length < 20) {
                result.warnings.push(
                    `⚠️ ${key} seems too short, please verify it's correct`
                );
            }
        }
    }

    // Check optional variables
    for (const [key, config] of Object.entries(OPTIONAL_ENV_VARS)) {
        const value = import.meta.env[key];
        
        if (!value || value.trim() === '') {
            result.warnings.push(
                `⚠️ Optional variable not set: ${key}\n   Description: ${config.description}`
            );
        }
    }

    return result;
};

/**
 * Log validation results to console
 */
export const logEnvironmentStatus = (result: EnvValidationResult): void => {
    console.group('🔧 Environment Validation');
    
    if (result.valid) {
        console.log('%c✅ All required environment variables are set', 'color: green; font-weight: bold');
    } else {
        console.log('%c❌ Environment validation failed', 'color: red; font-weight: bold');
        
        if (result.errors.length > 0) {
            console.group('Errors:');
            result.errors.forEach(error => console.error(error));
            console.groupEnd();
        }
    }
    
    if (result.warnings.length > 0) {
        console.group('Warnings:');
        result.warnings.forEach(warning => console.warn(warning));
        console.groupEnd();
    }
    
    if (!result.valid) {
        console.log('\n%c📝 Setup Instructions:', 'font-weight: bold');
        console.log('1. Copy .env.example to .env');
        console.log('2. Fill in your Supabase credentials from https://supabase.com/dashboard');
        console.log('3. Restart the development server');
    }
    
    console.groupEnd();
};

/**
 * Get user-friendly error message for missing environment variables
 */
export const getEnvironmentErrorMessage = (result: EnvValidationResult): string => {
    if (result.valid) return '';
    
    return `
⚠️ Missing Required Configuration

The following environment variables are not set:
${result.missing.map(key => `  • ${key}`).join('\n')}

To fix this:
1. Create a .env file in the project root
2. Add your Supabase credentials:
   ${Object.entries(REQUIRED_ENV_VARS).map(([key, config]) => 
       `${key}=${config.example}`
   ).join('\n   ')}
3. Restart the development server

Get your credentials from: https://supabase.com/dashboard/project/_/settings/api
    `.trim();
};

/**
 * Run validation on app startup
 */
export const runStartupValidation = (): boolean => {
    const result = validateEnvironment();
    logEnvironmentStatus(result);
    
    if (!result.valid && import.meta.env.DEV) {
        // In development, show alert
        const message = getEnvironmentErrorMessage(result);
        console.error(message);
        
        // Don't block the app, just warn
        return false;
    }
    
    return result.valid;
};
