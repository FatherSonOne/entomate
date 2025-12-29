/**
 * Webhook Routes
 *
 * Handles inbound webhooks that trigger workflows
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const WorkflowExecutor = require('../services/workflow/WorkflowExecutor');

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

  console.log(`[Webhooks] Received ${req.method} request for: ${webhookIdentifier}`);

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

    // Update webhook stats
    await supabase
      .from('webhooks')
      .update({
        trigger_count: webhook.trigger_count + 1,
        last_triggered_at: new Date().toISOString()
      })
      .eq('id', webhook.id);

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
        console.error(`[Webhooks] Background execution failed:`, err);
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
        console.error(`[Webhooks] Background execution failed:`, err);
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
    console.error('[Webhooks] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Validate webhook authentication
 */
async function validateAuthentication(authConfig, req) {
  if (!authConfig || authConfig.type === 'none') {
    return { valid: true };
  }

  switch (authConfig.type) {
    case 'header':
      // Check for required header
      const headerName = authConfig.name?.toLowerCase();
      const expectedValue = authConfig.value;
      const actualValue = req.headers[headerName];

      if (!actualValue || actualValue !== expectedValue) {
        return { valid: false, error: 'Invalid authentication header' };
      }
      return { valid: true };

    case 'basic':
      // Basic authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        return { valid: false, error: 'Basic authentication required' };
      }

      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
      const [username, password] = credentials.split(':');

      if (username !== authConfig.username || password !== authConfig.password) {
        return { valid: false, error: 'Invalid credentials' };
      }
      return { valid: true };

    case 'bearer':
      // Bearer token
      const bearerHeader = req.headers.authorization;
      if (!bearerHeader || !bearerHeader.startsWith('Bearer ')) {
        return { valid: false, error: 'Bearer token required' };
      }

      const token = bearerHeader.split(' ')[1];
      if (token !== authConfig.token) {
        return { valid: false, error: 'Invalid token' };
      }
      return { valid: true };

    case 'api_key':
      // API key (header or query)
      const keyLocation = authConfig.in || 'header';
      const keyName = authConfig.name || 'X-API-Key';
      let apiKey;

      if (keyLocation === 'header') {
        apiKey = req.headers[keyName.toLowerCase()];
      } else if (keyLocation === 'query') {
        apiKey = req.query[keyName];
      }

      if (!apiKey || apiKey !== authConfig.value) {
        return { valid: false, error: 'Invalid API key' };
      }
      return { valid: true };

    case 'jwt':
      // JWT validation (simplified)
      const jwtHeader = req.headers.authorization;
      if (!jwtHeader || !jwtHeader.startsWith('Bearer ')) {
        return { valid: false, error: 'JWT token required' };
      }

      try {
        const jwt = require('jsonwebtoken');
        const jwtToken = jwtHeader.split(' ')[1];
        jwt.verify(jwtToken, authConfig.secret);
        return { valid: true };
      } catch (err) {
        return { valid: false, error: 'Invalid JWT token' };
      }

    case 'hmac':
      // HMAC signature validation
      const signatureHeader = req.headers[authConfig.signatureHeader?.toLowerCase() || 'x-signature'];
      if (!signatureHeader) {
        return { valid: false, error: 'Signature header required' };
      }

      const crypto = require('crypto');
      const body = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac(authConfig.algorithm || 'sha256', authConfig.secret)
        .update(body)
        .digest('hex');

      // Handle different signature formats
      const actualSig = signatureHeader.replace(/^sha256=/, '');
      if (actualSig !== expectedSignature) {
        return { valid: false, error: 'Invalid signature' };
      }
      return { valid: true };

    default:
      return { valid: true };
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
router.get('/test/:webhookIdentifier', async (req, res) => {
  const { webhookIdentifier } = req.params;

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
