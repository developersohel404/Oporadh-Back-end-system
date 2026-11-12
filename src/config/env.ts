import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .default('5000')
    .transform((v) => Number(v)),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  COOKIE_SECRET: z.string().min(8),

  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('OPORADH <onboarding@resend.dev>'),

  // ImgBB
  IMGBB_API_KEY: z.string().min(1),

  APP_URL: z.string().default('http://localhost:5000'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  EMAIL_VERIFY_EXPIRES_HOURS: z.string().default('24').transform(Number),
  PASSWORD_RESET_EXPIRES_HOURS: z.string().default('1').transform(Number),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
