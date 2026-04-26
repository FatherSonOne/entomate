const log = require('../utils/log');

const REQUIRED_IN_PRODUCTION = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SESSION_SECRET',
];

const REQUIRED_ALWAYS = [
  'SUPABASE_URL',
];

const OPTIONAL_WARNINGS = [
  { key: 'OPENAI_API_KEY', alt: 'GEMINI_API_KEY', message: 'No AI provider configured (OPENAI_API_KEY or GEMINI_API_KEY)' },
  { key: 'SENTRY_DSN', message: 'Error tracking disabled (no SENTRY_DSN)' },
  { key: 'SLACK_BOT_TOKEN', message: 'Slack integration disabled (no SLACK_BOT_TOKEN)' },
  { key: 'RECALL_API_KEY', message: 'Recall.ai bot launches will fail (no RECALL_API_KEY)' },
  { key: 'RECALL_WEBHOOK_SIGNING_SECRET', message: 'Recall webhooks will be rejected at the route — set the Svix whsec_… secret from the Recall dashboard' },
];

function validateEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing = [];

  // Check always-required vars
  for (const key of REQUIRED_ALWAYS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  // Check production-required vars
  if (isProduction) {
    for (const key of REQUIRED_IN_PRODUCTION) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }

    // SESSION_SECRET length check
    if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
      log.error('[ENV] SESSION_SECRET must be at least 32 characters in production');
      process.exit(1);
    }
  }

  if (missing.length > 0) {
    log.error(`[ENV] Missing required environment variables: ${missing.join(', ')}`);
    if (isProduction) {
      process.exit(1);
    }
  }

  // Warn on optional vars
  for (const opt of OPTIONAL_WARNINGS) {
    if (!process.env[opt.key] && (!opt.alt || !process.env[opt.alt])) {
      log.warn(`[ENV] Warning: ${opt.message}`);
    }
  }

  // Print startup summary (redacted)
  const summary = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    SUPABASE_URL: process.env.SUPABASE_URL ? '***configured***' : 'missing',
    AI_PROVIDER: process.env.OPENAI_API_KEY ? 'OpenAI' : process.env.GEMINI_API_KEY ? 'Gemini' : 'none',
    SENTRY: process.env.SENTRY_DSN ? 'enabled' : 'disabled',
    SLACK: process.env.SLACK_BOT_TOKEN ? 'enabled' : 'disabled',
  };
  log.info('[ENV] Startup config:', JSON.stringify(summary));
}

module.exports = { validateEnv };
