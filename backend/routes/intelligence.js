/**
 * Intelligence API Routes
 * Provides endpoints for "Today's Intelligence" morning briefing
 */

const express = require('express');
const router = express.Router();
const intelligenceService = require('../services/intelligenceService');
const log = require('../utils/log');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/intelligence');

/**
 * GET /api/intelligence/today
 * Get today's intelligence briefing
 * Returns aggregated data from meetings, action_items, and shared-hub
 */
router.get('/today', async (req, res) => {
  try {
    const { timezone } = req.query;
    const userId = req.user?.id; // From auth middleware if authenticated

    log.info('[Intelligence] Fetching today\'s briefing...');

    const result = await intelligenceService.getTodaysBriefing({
      userId,
      timezone: timezone || 'UTC'
    });

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to generate briefing',
        details: result.error
      });
    }

    log.info('[Intelligence] Briefing generated successfully');

    res.json(result.briefing);
  } catch (error) {
    log.error('[Intelligence] Error fetching briefing:', { error: error.message || error });
    res.status(500).json({
      error: 'Failed to fetch today\'s intelligence',
      details: error.message
    });
  }
});

/**
 * GET /api/intelligence/meetings
 * Get today's meetings with context
 */
router.get('/meetings', async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const result = await intelligenceService.getTodaysMeetings(todayStart, todayEnd);

    res.json(result);
  } catch (error) {
    log.error('[Intelligence] Error fetching meetings:', { error: error.message || error });
    res.status(500).json({
      error: 'Failed to fetch meetings',
      details: error.message
    });
  }
});

/**
 * GET /api/intelligence/overdue
 * Get overdue action items
 */
router.get('/overdue', async (req, res) => {
  try {
    const result = await intelligenceService.getOverdueActionItems();

    res.json(result);
  } catch (error) {
    log.error('[Intelligence] Error fetching overdue items:', { error: error.message || error });
    res.status(500).json({
      error: 'Failed to fetch overdue items',
      details: error.message
    });
  }
});

/**
 * GET /api/intelligence/deals
 * Get deals requiring attention with AI-scored urgency
 */
router.get('/deals', async (req, res) => {
  try {
    const result = await intelligenceService.getDealsRequiringAttention();

    res.json(result);
  } catch (error) {
    log.error('[Intelligence] Error fetching deals:', { error: error.message || error });
    res.status(500).json({
      error: 'Failed to fetch deals',
      details: error.message
    });
  }
});

/**
 * GET /api/intelligence/contacts/recent
 * Get contacts synced from Logos CRM in last 24h
 */
router.get('/contacts/recent', async (req, res) => {
  try {
    const result = await intelligenceService.getRecentContacts();

    res.json(result);
  } catch (error) {
    log.error('[Intelligence] Error fetching recent contacts:', { error: error.message || error });
    res.status(500).json({
      error: 'Failed to fetch recent contacts',
      details: error.message
    });
  }
});

/**
 * GET /api/intelligence/deadlines
 * Get upcoming deadlines
 */
router.get('/deadlines', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const result = await intelligenceService.getUpcomingDeadlines(parseInt(days));

    res.json(result);
  } catch (error) {
    log.error('[Intelligence] Error fetching deadlines:', { error: error.message || error });
    res.status(500).json({
      error: 'Failed to fetch deadlines',
      details: error.message
    });
  }
});

/**
 * GET /api/intelligence/sentiment
 * Get meeting sentiment summary
 */
router.get('/sentiment', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const result = await intelligenceService.getMeetingSentimentSummary(parseInt(days));

    res.json(result);
  } catch (error) {
    log.error('[Intelligence] Error fetching sentiment:', { error: error.message || error });
    res.status(500).json({
      error: 'Failed to fetch sentiment summary',
      details: error.message
    });
  }
});

/**
 * POST /api/intelligence/briefing/viewed
 * Mark the briefing as viewed (for tracking engagement)
 */
router.post('/briefing/viewed', async (req, res) => {
  try {
    const userId = req.user?.id;
    const result = await intelligenceService.markBriefingViewed(userId);

    res.json(result);
  } catch (error) {
    log.error('[Intelligence] Error marking briefing viewed:', { error: error.message || error });
    res.status(500).json({
      error: 'Failed to mark briefing as viewed',
      details: error.message
    });
  }
});

// ============================================================
// ENHANCED INTELLIGENCE DASHBOARD ENDPOINTS
// ============================================================

/**
 * GET /api/intelligence/dashboard
 * Get comprehensive enhanced intelligence dashboard
 * Includes: Meeting Prep, Deal Risks, Action Items, Relationship Insights
 */
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const options = {
      dealRiskFilter: req.query.riskFilter?.split(',') || ['medium', 'high', 'critical'],
      timeHorizon: {
        meetings: parseInt(req.query.meetingHours) || 24,
        risks: parseInt(req.query.riskDays) || 7
      }
    };

    log.info('[Intelligence] Fetching enhanced dashboard...');

    const result = await intelligenceService.getDashboardIntelligence(userId, options);

    res.json(result);
  } catch (error) {
    log.error('[Intelligence] Dashboard error:', { error: error.message || error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard intelligence',
      details: error.message
    });
  }
});

/**
 * GET /api/intelligence/meeting-prep/:meetingId
 * Get detailed meeting preparation intelligence for a specific meeting
 */
router.get('/meeting-prep/:meetingId', async (req, res) => {
  try {
    const { meetingId } = req.params;

    log.info('[Intelligence] Fetching meeting prep for:', meetingId);

    const prep = await intelligenceService.meetingPrepService.getMeetingPrep(meetingId);

    if (!prep) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found'
      });
    }

    res.json({
      success: true,
      data: prep
    });
  } catch (error) {
    log.error('[Intelligence] Meeting prep error:', { error: error.message || error });
    res.status(500).json({
      success: false,
      error: 'Failed to generate meeting prep',
      details: error.message
    });
  }
});

/**
 * POST /api/intelligence/meeting-prep/:meetingId/brief
 * Generate full AI meeting brief document
 */
router.post('/meeting-prep/:meetingId/brief', async (req, res) => {
  try {
    const { meetingId } = req.params;

    log.info('[Intelligence] Generating meeting brief for:', meetingId);

    const brief = await intelligenceService.meetingPrepService.generateMeetingBrief(meetingId);

    res.json({
      success: true,
      data: {
        brief,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    log.error('[Intelligence] Brief generation error:', { error: error.message || error });
    res.status(500).json({
      success: false,
      error: 'Failed to generate meeting brief',
      details: error.message
    });
  }
});

/**
 * GET /api/intelligence/deal-risks
 * Get at-risk deals with AI-powered risk scoring
 */
router.get('/deal-risks', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const options = {
      riskLevel: req.query.riskLevel?.split(','),
      limit: parseInt(req.query.limit) || 10
    };

    log.info('[Intelligence] Fetching deal risks...');

    const risks = await intelligenceService.dealRiskService.getAtRiskDeals(userId, options);

    res.json({
      success: true,
      data: risks
    });
  } catch (error) {
    log.error('[Intelligence] Deal risks error:', { error: error.message || error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deal risks',
      details: error.message
    });
  }
});

/**
 * GET /api/intelligence/action-items
 * Get comprehensive action item tracking and analytics
 */
router.get('/action-items', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    log.info('[Intelligence] Fetching action item status...');

    const status = await intelligenceService.actionItemService.getActionItemStatus(userId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    log.error('[Intelligence] Action items error:', { error: error.message || error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch action item status',
      details: error.message
    });
  }
});

/**
 * POST /api/intelligence/action-items/:itemId/nudge
 * Send intelligent nudge for an overdue/blocked action item
 */
router.post('/action-items/:itemId/nudge', validate(schemas.nudge), async (req, res) => {
  try {
    const { itemId } = req.params;
    const { channel = 'in_app' } = req.body;

    log.info('[Intelligence] Sending nudge for action item:', itemId);

    const result = await intelligenceService.actionItemService.sendNudge(itemId, channel);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    log.error('[Intelligence] Nudge error:', { error: error.message || error });
    res.status(500).json({
      success: false,
      error: 'Failed to send nudge',
      details: error.message
    });
  }
});

/**
 * GET /api/intelligence/relationships/:dealId
 * Get relationship intelligence and stakeholder analysis for a deal
 */
router.get('/relationships/:dealId', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { dealId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    log.info('[Intelligence] Fetching relationship insights for deal:', dealId);

    const insights = await intelligenceService.relationshipService.getRelationshipInsights(dealId, userId);

    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    log.error('[Intelligence] Relationships error:', { error: error.message || error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch relationship insights',
      details: error.message
    });
  }
});

module.exports = router;
