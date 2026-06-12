/**
 * Application configuration. Loads env and exports config object.
 * Validated at startup with Zod.
 */

import dotenv from 'dotenv';
import { logger } from '../lib/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');

// Load .env first, then mode-specific file (.env.development or .env.production)
dotenv.config({ path: path.join(backendRoot, '.env') });
const mode = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.join(backendRoot, `.env.${mode}`) });

const isProduction = process.env.NODE_ENV === 'production';

const configSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535),
  host: z.string().optional(),
  isProduction: z.boolean(),
  dbUrl: z.string().optional(),
  isDbConfigured: z.boolean(),
  geminiApiKey: z.string().optional(),
  geminiModel: z.string().default('gemini-2.5-flash'),
  jwtSecret: z.string().nullable().refine((v) => !isProduction || (v != null && v.length > 0), {
    message: 'JWT_SECRET must be set in production',
  }),
  corsOrigin: isProduction
    ? z.string().min(1, 'CORS_ORIGIN must be set to an explicit origin in production')
    : z.union([z.string(), z.boolean(), z.undefined()]),
  frontendOrigin: isProduction
    ? z.string().min(1, 'FRONTEND_ORIGIN must be set in production')
    : z.string().optional(),
  googleClientId: z.string().optional(),
  facebookAppId: z.string().optional(),
  twitterClientId: z.string().optional(),
  twitterClientSecret: z.string().optional(),
  twitterRedirectUri: z.string().optional(),
  mcpSecret: z.string().optional(),
  mcpUserId: z.string().optional(),
  appBaseUrl: z.string().optional(),
  resendApiKey: z.string().optional(),
  redisUrl: z.string().optional(),
  isRedisConfigured: z.boolean(),
  eventTransport: z.enum(['redis', 'sqs']).optional(),
  awsRegion: z.string().optional(),
  awsS3Bucket: z.string().optional(),
  eventQueueUrl: z.string().url().optional(),
  voiceQueueUrl: z.string().url().optional(),
  bodyDbUrl: z.string().optional(),
  energyDbUrl: z.string().optional(),
  goalsDbUrl: z.string().optional(),
  bodyServiceUrl: z.string().url().optional(),
  energyServiceUrl: z.string().url().optional(),
  goalsServiceUrl: z.string().url().optional(),
  separateWorkers: z.boolean().optional(),
  voiceExecuteOnServer: z.boolean().optional(),
  voiceStreaming: z.boolean().optional(),
  geminiLiveModel: z.string().optional(),
  skipSchemaInit: z.boolean().optional(),
  lemonSqueezyApiKey: z.string().optional(),
  lemonSqueezyStoreId: z.string().optional(),
  lemonSqueezyWebhookSecret: z.string().optional(),
  lemonSqueezyVariantIdMonthly: z.string().optional(),
  lemonSqueezyVariantIdYearly: z.string().optional(),
  whatsappAccessToken: z.string().optional(),
  whatsappPhoneNumberId: z.string().optional(),
  whatsappVerifyToken: z.string().optional(),
  whatsappBusinessAccountId: z.string().optional(),
});

const PORT = process.env.PORT;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? null : 'dev-secret-change-in-production');
if (JWT_SECRET === 'dev-secret-change-in-production') {
  logger.warn('JWT_SECRET is using development default; set a real secret for production');
}
// Clean up CORS origins — trim whitespace and trailing slashes to prevent subtle mismatches
const rawCorsOrigin = process.env.CORS_ORIGIN?.trim().replace(/\/+$/, '');
const FRONTEND_ORIGIN = (process.env.FRONTEND_ORIGIN?.trim().replace(/\/+$/, '')) || rawCorsOrigin;
const CORS_ORIGIN: string | string[] | boolean = (() => {
  if (rawCorsOrigin != null && rawCorsOrigin !== '') {
    // Support comma-separated origins (e.g. "https://app.example.com,https://staging.example.com")
    if (rawCorsOrigin.includes(',')) {
      return rawCorsOrigin.split(',').map(o => o.trim().replace(/\/+$/, ''));
    }
    return rawCorsOrigin;
  }
  return isProduction ? (FRONTEND_ORIGIN ?? true) : true;
})();
if (isProduction && (CORS_ORIGIN === true || CORS_ORIGIN === 'true')) {
  throw new Error('CORS_ORIGIN must be an explicit origin in production, not true');
}
if (isProduction && !rawCorsOrigin) {
  throw new Error('CORS_ORIGIN must be explicitly set in production for security.');
}

const rawConfig = {
  port: Number(PORT),
  host: process.env.HOST,
  isProduction,
  dbUrl: DATABASE_URL,
  isDbConfigured: !!DATABASE_URL,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL,
  jwtSecret: JWT_SECRET,
  corsOrigin: CORS_ORIGIN,
  frontendOrigin: FRONTEND_ORIGIN,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  facebookAppId: process.env.FACEBOOK_APP_ID,
  twitterClientId: process.env.TWITTER_CLIENT_ID,
  twitterClientSecret: process.env.TWITTER_CLIENT_SECRET,
  twitterRedirectUri: process.env.TWITTER_REDIRECT_URI,
  mcpSecret: process.env.TRACKVIBE_MCP_SECRET,
  mcpUserId: process.env.TRACKVIBE_MCP_USER_ID,
  appBaseUrl: process.env.APP_BASE_URL || process.env.FRONTEND_URL,
  resendApiKey: process.env.RESEND_API_KEY,
  redisUrl: process.env.REDIS_URL ?? process.env.REDIS_PRIVATE_URL,
  isRedisConfigured: !!(process.env.REDIS_URL ?? process.env.REDIS_PRIVATE_URL),
  eventTransport: process.env.EVENT_TRANSPORT === 'sqs' ? 'sqs' : 'redis',
  awsRegion: process.env.AWS_REGION,
  awsS3Bucket: process.env.AWS_S3_BUCKET,
  eventQueueUrl: process.env.EVENT_QUEUE_URL,
  voiceQueueUrl: process.env.VOICE_QUEUE_URL,
  bodyDbUrl: process.env.BODY_DATABASE_URL,
  energyDbUrl: process.env.ENERGY_DATABASE_URL,
  goalsDbUrl: process.env.GOALS_DATABASE_URL,
  bodyServiceUrl: process.env.BODY_SERVICE_URL,
  energyServiceUrl: process.env.ENERGY_SERVICE_URL,
  goalsServiceUrl: process.env.GOALS_SERVICE_URL,
  separateWorkers: process.env.SEPARATE_WORKERS === 'true' || process.env.SEPARATE_WORKERS === '1',
  voiceExecuteOnServer: process.env.VOICE_EXECUTE_ON_SERVER !== 'false',
  voiceStreaming: process.env.VOICE_STREAMING !== 'false',
  geminiLiveModel: process.env.GEMINI_LIVE_MODEL,
  skipSchemaInit: process.env.SKIP_SCHEMA_INIT === 'true' || process.env.SKIP_SCHEMA_INIT === '1' || isProduction,
  lemonSqueezyApiKey: process.env.LEMONSQUEEZY_API_KEY,
  lemonSqueezyStoreId: process.env.LEMONSQUEEZY_STORE_ID,
  lemonSqueezyWebhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET,
  lemonSqueezyVariantIdMonthly: process.env.LEMONSQUEEZY_VARIANT_ID_MONTHLY,
  lemonSqueezyVariantIdYearly: process.env.LEMONSQUEEZY_VARIANT_ID_YEARLY,
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'trackvibe-whatsapp-verify',
  whatsappBusinessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
};

const parsed = configSchema.safeParse(rawConfig);
if (!parsed.success) {
  const first = parsed.error.errors[0];
  throw new Error(first ? `${first.path.join('.')}: ${first.message}` : 'Invalid configuration');
}

export const config = parsed.data;

if (config.isProduction && !config.isRedisConfigured) {
  logger.warn(
    'REDIS_URL is not set in production: rate limiting, the voice job queue, and the JWT logout blocklist ' +
    'fall back to in-memory stores that are not shared across instances. Configure Redis before scaling beyond one process.',
  );
}
