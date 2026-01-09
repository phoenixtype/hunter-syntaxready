import { z } from "zod";

// Common weak passwords to reject (OWASP recommended)
const COMMON_WEAK_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456', '12345678', '123456789',
  'qwerty', 'abc123', 'monkey', 'master', 'dragon', 'letmein', 'login',
  'admin', 'welcome', 'shadow', 'sunshine', 'princess', 'football',
  'iloveyou', 'trustno1', 'passw0rd', 'password!', 'hunter2'
]);

/**
 * SECURITY: Check password strength and entropy
 * Implements OWASP password guidelines
 */
function checkPasswordStrength(password: string): { valid: boolean; message?: string } {
  // Minimum length check (NIST recommends 8+, we use 8)
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters" };
  }

  // Maximum length (bcrypt limit is 72 bytes)
  if (password.length > 72) {
    return { valid: false, message: "Password must be less than 72 characters" };
  }

  // Check for common weak passwords
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    return { valid: false, message: "This password is too common. Please choose a stronger password" };
  }

  // Check for sequential characters (e.g., 12345, abcde)
  const sequentialPattern = /(.)\1{3,}|0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|defg/i;
  if (sequentialPattern.test(password)) {
    return { valid: false, message: "Password contains sequential or repeated characters" };
  }

  // Require character variety (at least 3 of: lowercase, uppercase, number, special)
  let varietyScore = 0;
  if (/[a-z]/.test(password)) varietyScore++;
  if (/[A-Z]/.test(password)) varietyScore++;
  if (/[0-9]/.test(password)) varietyScore++;
  if (/[^a-zA-Z0-9]/.test(password)) varietyScore++;

  if (varietyScore < 3) {
    return { 
      valid: false, 
      message: "Password must contain at least 3 of: lowercase, uppercase, number, special character" 
    };
  }

  // Calculate entropy (simplified)
  const charsetSize = 
    (/[a-z]/.test(password) ? 26 : 0) +
    (/[A-Z]/.test(password) ? 26 : 0) +
    (/[0-9]/.test(password) ? 10 : 0) +
    (/[^a-zA-Z0-9]/.test(password) ? 32 : 0);
  
  const entropy = Math.log2(Math.pow(charsetSize, password.length));
  
  // Require minimum 40 bits of entropy
  if (entropy < 40) {
    return { valid: false, message: "Password is not complex enough. Try making it longer or more varied" };
  }

  return { valid: true };
}

// Email validation schema
export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .max(255, "Email must be less than 255 characters")
  .transform(email => email.toLowerCase()); // Normalize to lowercase

// Strong password validation schema with OWASP compliance
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be less than 72 characters")
  .refine(
    (password) => {
      const result = checkPasswordStrength(password);
      return result.valid;
    },
    (password) => ({
      message: checkPasswordStrength(password).message || "Password does not meet security requirements"
    })
  );

// Simple password schema for login (we don't validate strength on login, only on signup)
export const loginPasswordSchema = z
  .string()
  .min(1, "Password is required")
  .max(72, "Password must be less than 72 characters");

// Full name validation schema
export const fullNameSchema = z
  .string()
  .trim()
  .min(1, "Full name is required")
  .max(100, "Full name must be less than 100 characters")
  .regex(/^[a-zA-Z\s\-'.]+$/, "Full name can only contain letters, spaces, hyphens, apostrophes, and periods");

// Login form schema (doesn't validate password strength - that happens at signup)
export const loginFormSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

// Sign up form schema with strong password requirements
export const signUpFormSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

// Password change schema - checks that new password is different from current
export const passwordChangeSchema = z.object({
  currentPassword: loginPasswordSchema,
  newPassword: passwordSchema,
}).refine(
  (data) => data.currentPassword !== data.newPassword,
  { message: "New password must be different from current password", path: ["newPassword"] }
);

// Job search input validation
export const jobSearchSchema = z
  .string()
  .trim()
  .max(500, "Search query too long")
  .transform((val) => val.replace(/[<>]/g, "")); // Basic XSS prevention

// Helper function to validate and get first error
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors[0]?.message || "Validation failed" };
}

/**
 * SECURITY: Get password strength indicator for UI feedback
 * Returns a score from 0-4 and descriptive text
 */
export function getPasswordStrength(password: string): { 
  score: number; 
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  color: string;
} {
  if (!password || password.length === 0) {
    return { score: 0, label: 'Very Weak', color: 'bg-destructive' };
  }

  let score = 0;
  
  // Length scoring
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  
  // Character variety
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  
  // Penalty for common patterns
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) score = 0;
  if (/(.)\1{3,}/.test(password)) score = Math.max(0, score - 2);

  // Normalize to 0-4 scale
  const normalizedScore = Math.min(4, Math.max(0, Math.floor(score / 1.5)));
  
  const labels: Array<'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong'> = 
    ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const colors = ['bg-destructive', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-green-600'];
  
  return {
    score: normalizedScore,
    label: labels[normalizedScore],
    color: colors[normalizedScore]
  };
}
