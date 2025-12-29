/**
 * Health Check Routes
 * Week 8: Production Deployment
 *
 * Provides health check endpoints for:
 * - Load balancer health checks (/health)
 * - Readiness probe (/health/ready)
 * - Liveness probe (/health/live)
 * - Detailed status (/health/status)
 */

const express = require('express');
const router = express.Router();
const os = require('os');
const logger = require('../services/logger');

// Track server start time
const startTime = Date.now();

// Check database connection
async function checkDatabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return { status: 'not_configured', latency: 0 };
  }

  const start = Date.now();
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { error } = await supabase
      .from('meetings')
      .select('count', { count: 'exact', head: true });

    return {
      status: error ? 'error' : 'healthy',
      latency: Date.now() - start,
      error: error?.message
    };
  } catch (error) {
    return {
      status: 'error',
      latency: Date.now() - start,
      error: error.message
    };
  }
}

// Check AI service
async function checkAI() {
  const start = Date.now();
  try {
    const ai = require('../config/ai');

    if (!ai.isConfigured()) {
      return { status: 'not_configured', latency: 0 };
    }

    return {
      status: 'healthy',
      latency: Date.now() - start,
      provider: ai.getProviderName()
    };
  } catch (error) {
    return {
      status: 'error',
      latency: Date.now() - start,
      error: error.message
    };
  }
}

// Check CRM service
async function checkCRM() {
  const start = Date.now();
  try {
    const crmService = require('../services/crmService');
    const result = await crmService.checkConnection();

    return {
      status: result.connected ? 'healthy' : 'not_configured',
      latency: Date.now() - start,
      provider: result.provider
    };
  } catch (error) {
    return {
      status: 'error',
      latency: Date.now() - start,
      error: error.message
    };
  }
}

// Check Chat service
async function checkChat() {
  const start = Date.now();
  try {
    const chatService = require('../services/chatService');
    const result = await chatService.checkConnection();

    return {
      status: result.connected ? 'healthy' : 'not_configured',
      latency: Date.now() - start,
      provider: result.provider
    };
  } catch (error) {
    return {
      status: 'error',
      latency: Date.now() - start,
      error: error.message
    };
  }
}

/**
 * GET /health
 * Simple health check for load balancers
 * Returns 200 if server is running
 */
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /health/live
 * Liveness probe - is the process alive?
 * Kubernetes uses this to restart unhealthy containers
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /health/ready
 * Readiness probe - is the server ready to accept traffic?
 * Checks database connectivity
 */
router.get('/ready', async (req, res) => {
  try {
    const db = await checkDatabase();

    if (db.status === 'healthy' || db.status === 'not_configured') {
      res.status(200).json({
        status: 'ready',
        database: db.status,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        database: db.status,
        error: db.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/status
 * Detailed health status of all services
 */
router.get('/status', async (req, res) => {
  const [database, ai, crm, chat] = await Promise.all([
    checkDatabase(),
    checkAI(),
    checkCRM(),
    checkChat()
  ]);

  const services = { database, ai, crm, chat };

  // Determine overall health
  const criticalServices = [database];
  const isHealthy = criticalServices.every(
    s => s.status === 'healthy' || s.status === 'not_configured'
  );

  // Calculate total latency
  const totalLatency = Object.values(services).reduce(
    (sum, s) => sum + (s.latency || 0), 0
  );

  const status = {
    status: isHealthy ? 'healthy' : 'degraded',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    services,
    system: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: {
        total: Math.round(os.totalmem() / 1024 / 1024) + 'MB',
        free: Math.round(os.freemem() / 1024 / 1024) + 'MB',
        used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024) + 'MB'
      },
      loadAvg: os.loadavg().map(l => l.toFixed(2))
    },
    performance: {
      totalLatency: totalLatency + 'ms'
    }
  };

  // Log health check
  logger.debug('Health check', { status: status.status, latency: totalLatency });

  res.status(isHealthy ? 200 : 503).json(status);
});

/**
 * GET /health/metrics
 * Prometheus-style metrics endpoint
 */
router.get('/metrics', (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const memUsage = process.memoryUsage();

  // Simple Prometheus format
  const metrics = `
# HELP entomate_uptime_seconds Server uptime in seconds
# TYPE entomate_uptime_seconds gauge
entomate_uptime_seconds ${uptime}

# HELP entomate_memory_heap_used_bytes Heap memory used
# TYPE entomate_memory_heap_used_bytes gauge
entomate_memory_heap_used_bytes ${memUsage.heapUsed}

# HELP entomate_memory_heap_total_bytes Total heap memory
# TYPE entomate_memory_heap_total_bytes gauge
entomate_memory_heap_total_bytes ${memUsage.heapTotal}

# HELP entomate_memory_rss_bytes Resident set size
# TYPE entomate_memory_rss_bytes gauge
entomate_memory_rss_bytes ${memUsage.rss}

# HELP nodejs_version_info Node.js version
# TYPE nodejs_version_info gauge
nodejs_version_info{version="${process.version}"} 1
`.trim();

  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

module.exports = router;
