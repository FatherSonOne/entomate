/**
 * Webhook Routes
 *
 * Handles inbound webhooks that trigger workflows
 */

const express = require('express');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const { supabase } = require('../config/supabase');
const WorkflowExecutor = require('../services/workflow/WorkflowExecutor');
const log = require('../utils/log');

// Webhook executor instance
const workflowExecutor = new WorkflowExecutor();

/**
 * Handle incoming webhook requests
 * Supports: GET, POST, PUT, PATCH, DELETE
 *
 * Path format: /hooks/:webhookPath
 * OR: /hooks/:webhookId (UUID format)
 */
router.all('/:webhookIdentifier', async (req, res) => {
  const { webhookIdentifier } = req.params;
  const startTime = Date.now();

  log.info(`[Webhooks] Received ${req.method} request for: ${webhookIdentifier}`);

  try {
    // Find webhook by path or ID
    let webhook;

    // Check if it's a UUID (webhook ID)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(webhookIdentifier);

    if (isUUID) {
      const { data, error } = await supabase
        .from('webhooks')
        .select('*, workflows(*)')
        .eq('id', webhookIdentifier)
        .eq('enabled', true)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Webhook not found' });
      }
      webhook = data;
    } else {
      // Find by path
      const { data, error } = await supabase
        .from('webhooks')
        .select('*, workflows(*)')
        .eq('path', webhookIdentifier)
        .eq('enabled', true)
        .single();

      if (error || !data) {
        // Try with leading slash
        const { data: data2, error: error2 } = await supabase
          .from('webhooks')
          .select('*, workflows(*)')
          .eq('path', `/${webhookIdentifier}`)
          .eq('enabled', true)
          .single();

        if (error2 || !data2) {
          return res.status(404).json({ error: 'Webhook not found' });
        }
        webhook = data2;
      } else {
        webhook = data;
      }
    }

    // Check HTTP method
    if (webhook.method !== 'ANY' && webhook.method !== req.method) {
      return res.status(405).json({
        error: 'Method not allowed',
        expected: webhook.method,
        received: req.method
      });
    }

    // Validate authentication
    const authResult = await validateAuthentication(webhook.authentication, req);
    if (!authResult.valid) {
      return res.status(401).json({ error: authResult.error || 'Unauthorized' });
    }

    // Get the workflow
    const workflow = webhook.workflows;
    if (!workflow || !workflow.active) {
      return res.status(503).json({ error: 'Workflow is not active' });
    }

    // Prepare trigger data
    const triggerData = {
      headers: sanitizeHeaders(req.headers),
      query: req.query,
      body: req.body,
      method: req.method,
      path: req.path,
      ip: req.ip,
      timestamp: new Date().toISOString(),
      webhookId: webhook.id
    };

    // Update webhook stats. Compare-and-set so two hits at once cannot both
    // write the same count (audit finding 18); retry a few times on a clash.
    let seen = webhook.trigger_count || 0;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: bumped } = await supabase
        .from('webhooks')
        .update({ trigger_count: seen + 1, last_triggered_at: new Date().toISOString() })
        .eq('id', webhook.id)
        .eq('trigger_count', seen)
        .select('id');
      if (bumped && bumped.length) break;
      const { data: fresh } = await supabase.from('webhooks').select('trigger_count').eq('id', webhook.id).maybeSingle();
      if (!fresh) break;
      seen = fresh.trigger_count || 0;
    }

    // Execute workflow based on response mode
    if (webhook.response_mode === 'immediate') {
      // Fire and forget - return immediately
      const executionId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Start execution in background
      workflowExecutor.execute(workflow, triggerData, {
        executionId,
        mode: 'production',
        triggeredBy: 'webhook'
      }).catch(err => {
        log.error(`[Webhooks] Background execution failed:`, { error: err.message || err });
      });

      return res.status(200).json({
        success: true,
        message: 'Webhook received',
        executionId,
        processingTime: Date.now() - startTime
      });

    } else if (webhook.response_mode === 'last_node') {
      // Wait for workflow to complete
      const result = await workflowExecutor.execute(workflow, triggerData, {
        mode: 'production',
        triggeredBy: 'webhook'
      });

      // Check if there's a custom response from RespondWebhook node
      if (result.context?.webhookResponse) {
        const wr = result.context.webhookResponse;
        for (const [key, value] of Object.entries(wr.headers || {})) {
          res.setHeader(key, value);
        }
        return res.status(wr.statusCode || 200).json(wr.body);
      }

      // Return workflow output
      return res.status(result.success ? 200 : 500).json({
        success: result.success,
        executionId: result.executionId,
        output: result.output,
        error: result.error,
        processingTime: Date.now() - startTime
      });

    } else if (webhook.response_mode === 'custom') {
      // Start execution in background
      workflowExecutor.execute(workflow, triggerData, {
        mode: 'production',
        triggeredBy: 'webhook'
      }).catch(err => {
        log.error(`[Webhooks] Background execution failed:`, { error: err.message || err });
      });

      // Return custom response
      const customResponse = webhook.response_data || { success: true };
      return res.status(200).json(customResponse);
    }

    // Default response
    return res.status(200).json({
      success: true,
      message: 'Webhook processed'
    });

  } catch (error) {
    log.error('[Webhooks] Error:', { error: error.message || error });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Constant-time string compare. False when either side is missing or empty,
 * so a webhook with no configured secret never matches (audit finding 10).
 */
function safeEqual(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string' || !actual || !expected) return false;
  const a = crypto.createHash('sha256').update(actual).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b) && actual.length === expected.length;
}

const HMAC_ALGORITHMS = new Set(['sha256', 'sha1', 'sha512']);

/**
 * Validate webhook authentication. Fails closed: an unknown or unsupported
 * type is rejected (audit finding 10).
 */
async function validateAuthentication(authConfig, req) {
  if (!authConfig || authConfig.type === 'none') {
    return { valid: true };
  }

  switch (authConfig.type) {
    case 'header': {
      const headerName = authConfig.name?.toLowerCase();
      const actualValue = headerName ? req.headers[headerName] : undefined;
      if (!safeEqual(actualValue, authConfig.value)) {
        return { valid: false, error: 'Invalid authentication header' };
      }
      return { valid: true };
    }

    case 'basic': {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        return { valid: false, error: 'Basic authentication required' };
      }
      const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
      const sep = credentials.indexOf(':');
      const username = sep >= 0 ? credentials.slice(0, sep) : credentials;
      const password = sep >= 0 ? credentials.slice(sep + 1) : '';
      // Evaluate both so timing does not reveal which half was wrong.
      const userOk = safeEqual(username, authConfig.username);
      const passOk = safeEqual(password, authConfig.password);
      if (!userOk || !passOk) {
        return { valid: false, error: 'Invalid credentials' };
      }
      return { valid: true };
    }

    case 'bearer': {
      const bearerHeader = req.headers.authorization;
      if (!bearerHeader || !bearerHeader.startsWith('Bearer ')) {
        return { valid: false, error: 'Bearer token required' };
      }
      if (!safeEqual(bearerHeader.slice(7), authConfig.token)) {
        return { valid: false, error: 'Invalid token' };
      }
      return { valid: true };
    }

    case 'api_key': {
      const keyLocation = authConfig.in || 'header';
      const keyName = authConfig.name || 'X-API-Key';
      let apiKey;
      if (keyLocation === 'header') {
        apiKey = req.headers[keyName.toLowerCase()];
      } else if (keyLocation === 'query') {
        apiKey = req.query[keyName];
      }
      if (!safeEqual(apiKey, authConfig.value)) {
        return { valid: false, error: 'Invalid API key' };
      }
      return { valid: true };
    }

    case 'hmac': {
      // HMAC over the exact bytes that were sent (req.rawBody from server.js),
      // not a re-serialised body, so GitHub/Stripe-style signatures match.
      const headerName = (authConfig.signatureHeader || 'x-signature').toLowerCase();
      const signatureHeader = req.headers[headerName];
      if (!signatureHeader) {
        return { valid: false, error: 'Signature header required' };
      }
      const algorithm = (authConfig.algorithm || 'sha256').toLowerCase();
      if (!HMAC_ALGORITHMS.has(algorithm) || !authConfig.secret) {
        return { valid: false, error: 'Webhook signature is not configured correctly' };
      }
      const raw = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(JSON.stringify(req.body ?? {}));
      const mac = crypto.createHmac(algorithm, authConfig.secret).update(raw);
      const digest = mac.digest();
      const sent = String(signatureHeader).trim().replace(/^(sha1|sha256|sha512)=/i, '');
      const ok = safeEqual(sent.toLowerCase(), digest.toString('hex')) || safeEqual(sent, digest.toString('base64'));
      if (!ok) {
        return { valid: false, error: 'Invalid signature' };
      }
      return { valid: true };
    }

    case 'jwt':
      // Not supported (no JWT library is installed); rejected rather than
      // pretending to check. Use hmac or bearer instead.
      return { valid: false, error: 'JWT webhook authentication is not supported; use hmac or bearer' };

    default:
      return { valid: false, error: 'Unknown webhook authentication type' };
  }
}

/**
 * Sanitize headers for storage (remove sensitive ones)
 */
function sanitizeHeaders(headers) {
  const sanitized = { ...headers };
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

  for (const header of sensitiveHeaders) {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Test endpoint to verify webhook setup
 */
router.get('/test/:webhookIdentifier', authenticate, async (req, res) => {
  const { webhookIdentifier } = req.params;
  // Interpolated into a PostgREST .or() filter below, so allow only path characters.
  if (!/^[A-Za-z0-9/_-]{1,200}$/.test(webhookIdentifier)) {
    return res.status(400).json({ found: false, message: 'Invalid webhook identifier' });
  }

  try {
    let query = supabase
      .from('webhooks')
      .select('id, path, method, enabled, authentication, workflows(id, name, active)')
      .eq('enabled', true);

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(webhookIdentifier);

    if (isUUID) {
      query = query.eq('id', webhookIdentifier);
    } else {
      query = query.or(`path.eq.${webhookIdentifier},path.eq./${webhookIdentifier}`);
    }

    const { data: webhook, error } = await query.single();

    if (error || !webhook) {
      return res.status(404).json({
        found: false,
        message: 'Webhook not found or disabled'
      });
    }

    return res.json({
      found: true,
      webhook: {
        id: webhook.id,
        path: webhook.path,
        method: webhook.method,
        requiresAuth: webhook.authentication?.type !== 'none',
        workflow: {
          id: webhook.workflows?.id,
          name: webhook.workflows?.name,
          active: webhook.workflows?.active
        }
      }
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;

module.exports._validateAuthentication = validateAuthentication; // for tests
