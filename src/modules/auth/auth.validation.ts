import { z } from 'zod';

// ============================================================
// REGISTER — Names দিয়ে (Backend ID resolve করবে)
// ============================================================

export const registerSchema = z
  .object({
    name: z.string().min(2).max(100),
    nickname: z.string().min(2).max(50).optional(),
    email: z.string().email(),
    password: z.string().min(8).max(100),
    age: z.number().int().min(13).max(120).optional(),

    // Location — Names (ID নয়)
    divisionName: z.string().min(2).max(100),
    districtName: z.string().min(2).max(100),
    upazilaName: z.string().min(2).max(100),

    // Union অথবা Pourashava — যেকোনো একটা
    unionName: z.string().min(1).max(100).optional(),
    pourashavaName: z.string().min(1).max(100).optional(),
  })
  .refine((data) => data.unionName || data.pourashavaName, {
    message: 'Either unionName or pourashavaName is required',
    path: ['unionName'],
  })
  .refine((data) => !(data.unionName && data.pourashavaName), {
    message: 'Provide either unionName or pourashavaName, not both',
    path: ['unionName'],
  });

// ============================================================
// LOGIN
// ============================================================

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ============================================================
// FORGOT PASSWORD
// ============================================================

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

// ============================================================
// RESET PASSWORD
// ============================================================

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8).max(100),
});

// ============================================================
// RESEND VERIFICATION
// ============================================================

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});
