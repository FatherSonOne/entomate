const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/analytics');
const { attachOrgIds } = require('../utils/orgContext');
const insights = require('../services/insights');

// Require authentication for all analytics routes
router.use(authenticate);
router.use(attachOrgIds); // org-owned tables below are limited to req.orgIds (audit finding 3)

/**
 * GET /api/analytics/insights?days=7|30|90
 * Follow-through (done by the due date), overdue now, meetings, decisions,
 * action items, agent calls kept, who owes what, and the last six weeks.
 * Replaced /dashboard, /trends, /team-performance, /ai-effectiveness and
 * /sentiment-trends (Insights pass, 2026-11-22).
 */
router.get('/insights', validate(schemas.insights), asyncHandler(async (req, res) => {
  const days = Number(req.query.days) || 30;
  const data = await insights.load(req.orgIds, days);
  res.json({ success: true, data });
}));

/**
 * POST /api/analytics/record
 * Record a metric event
 */
router.post('/record', validate(schemas.record), asyncHandler(async (req, res) => {
  const {
    metric_type,
    value,
    unit,
    source_type,
    source_id,
    metadata
  } = req.body;

  if (!metric_type || value === undefined) {
    return res.status(400).json({
      success: false,
      error: 'metric_type and value are required'
    });
  }

  const { data, error } = await supabase
    .from('metrics')
    .insert({
      metric_type,
      value: Number(value),
      unit,
      source_type,
      source_id,
      user_id: req.user?.id,
      team_id: req.user?.teamId,
      recorded_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;

  res.status(201).json({
    success: true,
    data
  });
}));

module.exports = router;
