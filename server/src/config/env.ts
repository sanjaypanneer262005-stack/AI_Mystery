import dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({ path: resolve(process.cwd(), '../.env') });
import { z } from 'zod';

const schema = z.object({ NODE_ENV: z.enum(['development','test','production']).default('development'), PORT: z.coerce.number().default(5000), CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'), COOKIE_SAME_SITE: z.enum(['lax','none','strict']).default('lax'), MONGODB_URI: z.string().default('mongodb://localhost:27017/ai-mystery-room'), JWT_SECRET: z.string().min(24).default('development-only-change-this-secret'), GEMINI_API_KEY: z.string().optional(), GEMINI_TEXT_MODEL: z.string().optional(), GEMINI_FAST_MODEL: z.string().optional(), GEMINI_IMAGE_MODEL: z.string().optional(), MOCK_AI: z.coerce.boolean().default(true), DAILY_CASE_LIMIT: z.coerce.number().int().positive().default(5), MAX_ACCUSATIONS: z.coerce.number().int().positive().default(2), MAX_REGENERATIONS: z.coerce.number().int().nonnegative().default(2), STORAGE_DIR: z.string().default('./storage') });
export const env = schema.parse(process.env);
if (!env.MOCK_AI && (!env.GEMINI_API_KEY || !env.GEMINI_TEXT_MODEL || !env.GEMINI_FAST_MODEL || !env.GEMINI_IMAGE_MODEL)) throw new Error('Live AI requires GEMINI_API_KEY and all Gemini model IDs.');
if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'development-only-change-this-secret') throw new Error('JWT_SECRET must be changed in production.');
