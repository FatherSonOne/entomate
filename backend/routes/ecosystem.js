/**
 * Ecosystem Bridge API Routes
 *
 * Manages cross-app connections, config, events, and convenience endpoints
 * for the Ecosystem Bridge (Pulse + Logos Vision integration).
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');
const { getEcosystemBridge } = require('../services/ecosystemBridge');
const log = require('../utils/log');

const router = express.Router();

// ── Status ──

/**
 * GET /api/ecosystem/status
 * Returns connected apps, feature flags, and event stats
 */
router.get('/status', async (req, res) => {
  try {
    const bridge = await getEcosystemBridge();
    const status = bridge.getStatus();
    const stats = await bridge.getEventStats();

    res.json({ success: true, ...status, stats });
  } catch (error) {
    log.error('[Ecosystem] Status error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to get ecosystem status' });
  }
});

// ── Config Management ──

/**
 * POST /api/ecosystem/config
 * Save or update ecosystem config for an app
 */
router.post('/config', async (req, res) => {
  try {
    const { appName, displayName, apiUrl, serviceToken, inboundToken, enabled, features } = req.body;

    if (!appName || !apiUrl || !serviceToken) {
      return res.status(400).json({ error: 'appName, apiUrl, and serviceToken are required' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Generate inbound token if not provided
    const finalInboundToken = inboundToken || uuidv4();

    const { data, error } = await supabaseAdmin
      .from('ecosystem_config')
      .upsert({
        app_name: appName,
        display_name: displayName || appName,
        api_url: apiUrl,
        service_token: serviceToken,
        inbound_token: finalInboundToken,
        enabled: enabled !== false,
        features: features || {}
      }, { onConflict: 'app_name' })
      .select()
      .single();

    if (error) throw error;

    // Reload bridge config
    const bridge = await getEcosystemBridge();
    await bridge.reload();

    res.json({
      success: true,
      config: {
        appName: data.app_name,
        displayName: data.display_name,
        apiUrl: data.api_url,
        enabled: data.enabled,
        features: data.features,
        inboundToken: data.inbound_token  // Return so user can configure the other app
      }
    });
  } catch (error) {
    log.error('[Ecosystem] Config save error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to save ecosystem config' });
  }
});

/**
 * GET /api/ecosystem/config
 * Get all ecosystem configs (tokens masked)
 */
router.get('/config', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.json({ success: true, configs: [] });
    }

    const { data, error } = await supabaseAdmin
      .from('ecosystem_config')
      .select('*')
      .order('app_name');

    if (error) throw error;

    // Mask tokens for frontend display
    const configs = (data || []).map(cfg => ({
      ...cfg,
      service_token: cfg.service_token ? `${cfg.service_token.substring(0, 8)}...` : null,
      inbound_token: cfg.inbound_token ? `${cfg.inbound_token.substring(0, 8)}...` : null
    }));

    res.json({ success: true, configs });
  } catch (error) {
    log.error('[Ecosystem] Config list error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to list configs' });
  }
});

/**
 * DELETE /api/ecosystem/config/:appName
 * Disconnect an app
 */
router.delete('/config/:appName', async (req, res) => {
  try {
    const { appName } = req.params;

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { error } = await supabaseAdmin
      .from('ecosystem_config')
      .delete()
      .eq('app_name', appName);

    if (error) throw error;

    // Reload bridge config
    const bridge = await getEcosystemBridge();
    await bridge.reload();

    res.json({ success: true, message: `${appName} disconnected` });
  } catch (error) {
    log.error('[Ecosystem] Config delete error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to disconnect app' });
  }
});

// ── Connection Testing ──

/**
 * POST /api/ecosystem/test/:appName
 * Test connection to a specific app
 */
router.post('/test/:appName', async (req, res) => {
  try {
    const { appName } = req.params;
    const bridge = await getEcosystemBridge();

    const result = await bridge.testConnection(appName);
    res.json({ success: result.success, ...result });
  } catch (error) {
    log.error('[Ecosystem] Test connection error:', error.message);
    res.status(500).json({ success: false, error: 'Connection test failed' });
  }
});

// ── Events ──

/**
 * GET /api/ecosystem/events
 * Recent sync events for the UI
 */
router.get('/events', async (req, res) => {
  try {
    const { limit = 20, direction, status } = req.query;
    const bridge = await getEcosystemBridge();

    const events = await bridge.getRecentEvents({
      limit: Math.min(parseInt(limit) || 20, 100),
      direction,
      status
    });

    res.json({ success: true, events });
  } catch (error) {
    log.error('[Ecosystem] Events list error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to list events' });
  }
});

/**
 * POST /api/ecosystem/retry/:eventId
 * Retry a failed event
 */
router.post('/retry/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const bridge = await getEcosystemBridge();

    const result = await bridge.retryEvent(eventId);
    res.json(result);
  } catch (error) {
    log.error('[Ecosystem] Retry error:', error.message);
    res.status(500).json({ success: false, error: 'Retry failed' });
  }
});

// ── Convenience: Pulse ──

/**
 * POST /api/ecosystem/pulse
 * Convenience endpoint for posting to Pulse via the bridge
 * Used by agent actions and other services
 */
router.post('/pulse', async (req, res) => {
  try {
    const { channel, message, title, urgency, metadata } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const bridge = await getEcosystemBridge();

    if (!bridge.isConnected('pulse')) {
      return res.status(503).json({ success: false, error: 'Pulse is not connected' });
    }

    const result = await bridge.postToPulse({ channel, message, title, urgency, metadata });
    res.json(result);
  } catch (error) {
    log.error('[Ecosystem] Pulse post error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to post to Pulse' });
  }
});

// ── Sync Status for Meetings ──

/**
 * GET /api/ecosystem/sync-status/:meetingId
 * Get sync status for a specific meeting (Pulse + LV)
 */
router.get('/sync-status/:meetingId', async (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!supabaseAdmin) {
      return res.json({ pulse: null, logosVision: null });
    }

    // Find events related to this meeting
    const { data: events } = await supabaseAdmin
      .from('ecosystem_events')
      .select('target_app, event_type, status, created_at, error_message, id')
      .eq('entity_id', meetingId)
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false });

    const pulseEvents = (events || []).filter(e => e.target_app === 'pulse');
    const lvEvents = (events || []).filter(e => e.target_app === 'logos_vision');

    res.json({
      success: true,
      pulse: pulseEvents.length > 0 ? {
        status: pulseEvents[0].status,
        lastSync: pulseEvents[0].created_at,
        error: pulseEvents[0].error_message,
        eventId: pulseEvents[0].id
      } : null,
      logosVision: lvEvents.length > 0 ? {
        status: lvEvents[0].status,
        lastSync: lvEvents[0].created_at,
        error: lvEvents[0].error_message,
        eventId: lvEvents[0].id,
        eventCount: lvEvents.length  // Multiple events (activity + tasks)
      } : null
    });
  } catch (error) {
    log.error('[Ecosystem] Sync status error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to get sync status' });
  }
});

module.exports = router;
