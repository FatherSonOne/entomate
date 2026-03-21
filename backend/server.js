// Load environment variables FIRST (before any other imports)
const dotenv = require('dotenv');
dotenv.config();

const path = require('path');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');

// Import middleware
const { optionalAuth } = require('./middleware/auth');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

// Import services
const logger = require('./services/logger');
const errorTracking = require('./services/errorTracking');

// Initialize app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize error tracking (Sentry)
errorTracking.initialize(app);

// Trust proxy (for load balancers)
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', parseInt(process.env.TRUST_PROXY) || 1);
}

// ========================================
// MIDDLEWARE
// ========================================

// Sentry request handler (must be first)
app.use(errorTracking.requestHandler());

// Security headers
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

// CORS - Allow frontend
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : [process.env.FRONTEND_URL || 'http://localhost:5173'];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID']
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Cookie and session (for calendar OAuth)
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'entomate-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Request logging
if (process.env.NODE_ENV !== 'test') {
  // Use morgan for HTTP logging
  app.use(morgan(
    process.env.NODE_ENV === 'production' ? 'combined' : 'dev',
    {
      stream: {
        write: (message) => logger.http(message.trim())
      }
    }
  ));
}

// Rate limiting (applied to all API routes)
app.use('/api', apiLimiter);

// Optional auth - attaches user if token present
app.use(optionalAuth);

// Request ID and timing for tracking
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.startTime = Date.now();
  res.setHeader('X-Request-ID', req.requestId);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    logger.logRequest(req, res, duration);
  });

  next();
});

// ========================================
// STATIC ASSETS
// ========================================

// Logo images referenced by the landing page (../logos/ resolves to /logos/)
app.use('/logos', express.static(path.join(__dirname, '../output/logos')));

// Serve built React app static files (JS/CSS chunks etc.)
// This must come before the SPA catch-all below
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist'), {
    index: false // Don't auto-serve index.html here — we control that below
  }));
}

// ========================================
// ROOT — Landing page frontdoor
// ========================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../output/landing/index.html'));
});

// ========================================
// HEALTH CHECK ROUTES
// ========================================

// Enhanced health routes
app.use('/health', require('./routes/health'));

// Legacy health endpoint (for backwards compatibility)
app.get('/api/health', async (req, res) => {
  try {
    const crmService = require('./services/crmService');
    const chatService = require('./services/chatService');
    const ai = require('./config/ai');

    const services = {
      gemini: 'not configured',
      database: 'not configured',
      crm: 'not configured',
      chat: 'not configured'
    };

    // Test AI (OpenAI or Gemini)
    if (ai.isConfigured()) {
      services.gemini = `connected (${ai.getProviderName()})`;
    } else {
      services.gemini = 'not configured';
    }

    // Test Supabase
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY
        );
        const { error } = await supabase.from('meetings').select('count', { count: 'exact', head: true });
        services.database = error ? `error: ${error.message}` : 'connected';
      } catch (error) {
        services.database = `error: ${error.message}`;
      }
    }

    // Test CRM
    const crmStatus = await crmService.checkConnection();
    services.crm = crmStatus.connected ? `connected (${crmStatus.provider})` : crmStatus.message;

    // Test Chat
    const chatStatus = await chatService.checkConnection();
    services.chat = chatStatus.connected ? `connected (${chatStatus.provider})` : chatStatus.message;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: '1.0.0',
      services
    });
  } catch (error) {
    logger.logError(error, { context: 'health_check' });
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// ========================================
// API ROUTES
// ========================================

// Meetings
app.use('/api/meetings', require('./routes/meetings'));

// Projects
app.use('/api/projects', require('./routes/projects'));

// Tasks
app.use('/api/tasks', require('./routes/tasks'));

// Automations
app.use('/api/automations', require('./routes/automations'));

// Search
app.use('/api/search', require('./routes/search'));

// Integrations
app.use('/api/integrations', require('./routes/integrations'));

// AI Agents
app.use('/api/agents', require('./routes/agents'));

// Goals & OKRs
app.use('/api/goals', require('./routes/goals'));

// Analytics
app.use('/api/analytics', require('./routes/analytics'));

// Dashboard
app.use('/api/dashboard', require('./routes/dashboard'));

// Reports & Export
app.use('/api/reports', require('./routes/reports'));

// Calendar Integration
app.use('/api/calendar', require('./routes/calendar'));

// Workflows v2 (Node-based)
app.use('/api/workflows', require('./routes/workflows'));

// Secrets Vault
app.use('/api/secrets', require('./routes/secrets'));

// Inbound Webhooks (for workflow triggers)
app.use('/hooks', require('./routes/webhooks'));

// Learning System (AI Feedback & Pattern Detection)
app.use('/api/learning', require('./routes/learning'));

// AI Explainability Layer
app.use('/api/explainability', require('./routes/explainability'));

// ========================================
// QUICK WIN ROUTES
// ========================================

// Cross-App Search (Cmd/Ctrl+K unified search)
app.use('/api/cross-search', require('./routes/crossAppSearch'));

// Today's Intelligence Dashboard
app.use('/api/intelligence', require('./routes/intelligence'));

// Slack Notifications
app.use('/api/slack', require('./routes/slack'));

// Meeting Summary Widget
app.use('/api/meeting-summary', require('./routes/meetingSummary'));

// Workflow Templates
app.use('/api/templates', require('./routes/templates'));


// ========================================
// SPA FALLBACK (production only)
// ========================================

// Any non-API, non-logo, non-root route serves the React SPA
// Covers: /sign-in, /sign-up, /dashboard, /meetings, etc.
if (process.env.NODE_ENV === 'production') {
  app.get(/^(?!\/(api|health|hooks|logos)\/).*/, (req, res, next) => {
    const spaIndex = path.join(__dirname, '../frontend/dist/index.html');
    res.sendFile(spaIndex, (err) => {
      if (err) next(); // Fall through to 404 if dist not built
    });
  });
}

// ========================================
// ERROR HANDLING
// ========================================

// Sentry error handler (must be before other error handlers)
app.use(errorTracking.errorHandler());

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ========================================
// GRACEFUL SHUTDOWN
// ========================================

async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop workflow scheduler
  try {
    const workflowScheduler = require('./services/workflow/WorkflowScheduler');
    workflowScheduler.stopAll();
    logger.info('Workflow scheduler stopped');
  } catch (error) {
    // Ignore if not initialized
  }

  // Flush error tracking events
  await errorTracking.flush();

  logger.info('Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ========================================
// START SERVER
// ========================================

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`Entomate Backend running on http://localhost:${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);

    if (errorTracking.isEnabled()) {
      logger.info('Error tracking: enabled (Sentry)');
    }

    // Initialize legacy scheduler service
    try {
      const schedulerService = require('./services/schedulerService');
      schedulerService.initialize();
      logger.info('Scheduler service initialized');
    } catch (error) {
      logger.warn('Scheduler service not initialized:', error.message);
    }

    // Initialize workflow scheduler (v2)
    try {
      const workflowScheduler = require('./services/workflow/WorkflowScheduler');
      workflowScheduler.initialize();
      logger.info('Workflow scheduler initialized');
    } catch (error) {
      logger.warn('Workflow scheduler not initialized:', error.message);
    }
  });
}

module.exports = app;
