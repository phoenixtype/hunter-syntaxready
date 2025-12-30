import { z } from "zod";

// Email validation schema
export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .max(255, "Email must be less than 255 characters");

// Password validation schema
export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(72, "Password must be less than 72 characters");

// Full name validation schema
export const fullNameSchema = z
  .string()
  .trim()
  .min(1, "Full name is required")
  .max(100, "Full name must be less than 100 characters")
  .regex(/^[a-zA-Z\s\-'\.]+$/, "Full name can only contain letters, spaces, hyphens, apostrophes, and periods");

// Login form schema
export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

// Sign up form schema
export const signUpFormSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

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
