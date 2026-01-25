/**
 * Learning System API Routes
 * Handles feedback capture, pattern management, and learning insights
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const FeedbackService = require('../services/learning/FeedbackService');
const OutcomeTracker = require('../services/learning/OutcomeTracker');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * POST /api/learning/feedback/override
 * Capture user override with optional feedback
 */
router.post(
  '/feedback/override',
  authenticate,
  apiLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        agentType,
        agentExecutionId,
        originalRecommendation,
        userChoice,
        feedbackReason,
        feedbackText,
        context
      } = req.body;

      // Validate required fields
      if (!agentType || !originalRecommendation || !userChoice || !context) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: agentType, originalRecommendation, userChoice, context'
        });
      }

      const override = {
        userId,
        agentType,
        agentExecutionId,
        originalRecommendation,
        userChoice,
        feedbackReason,
        feedbackText,
        context
      };

      const record = await FeedbackService.captureOverride(override);

      res.json({
        success: true,
        data: record,
        message: 'Override captured successfully'
      });
    } catch (error) {
      console.error('[Learning API] Override capture error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to capture override',
        details: error.message
      });
    }
  }
);

/**
 * GET /api/learning/feedback/should-prompt
 * Check if user wants feedback prompts for a specific agent type
 */
router.get(
  '/feedback/should-prompt',
  authenticate,
  apiLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { agentType } = req.query;

      if (!agentType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required query parameter: agentType'
        });
      }

      const shouldPrompt = await FeedbackService.shouldPromptForFeedback(userId, agentType);

      res.json({
        success: true,
        data: { shouldPrompt }
      });
    } catch (error) {
      console.error('[Learning API] Should prompt check error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check feedback preference'
      });
    }
  }
);

/**
 * PUT /api/learning/feedback/preference
 * Update user feedback preference
 */
router.put(
  '/feedback/preference',
  authenticate,
  apiLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { agentType, enabled } = req.body;

      if (!agentType || enabled === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: agentType, enabled'
        });
      }

      await FeedbackService.setFeedbackPreference(userId, agentType, enabled);

      res.json({
        success: true,
        message: 'Feedback preference updated'
      });
    } catch (error) {
      console.error('[Learning API] Preference update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update preference'
      });
    }
  }
);

/**
 * GET /api/learning/overrides/recent
 * Get recent overrides for the user
 */
router.get(
  '/overrides/recent',
  authenticate,
  apiLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { agentType, limit = 10 } = req.query;

      const overrides = await FeedbackService.getRecentOverrides(
        userId,
        agentType,
        parseInt(limit)
      );

      res.json({
        success: true,
        data: overrides
      });
    } catch (error) {
      console.error('[Learning API] Recent overrides error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch recent overrides'
      });
    }
  }
);

/**
 * GET /api/learning/overrides/stats
 * Get override statistics for the user
 */
router.get(
  '/overrides/stats',
  authenticate,
  apiLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { days = 30 } = req.query;

      const stats = await FeedbackService.getOverrideStats(userId, parseInt(days));

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('[Learning API] Override stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch override statistics'
      });
    }
  }
);

/**
 * GET /api/learning/patterns
 * Get learning patterns for user
 */
router.get(
  '/patterns',
  authenticate,
  apiLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { status, agentType } = req.query;

      let query = supabase
        .from('learning_patterns')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }
      if (agentType) {
        query = query.eq('agent_type', agentType);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        data: data || []
      });
    } catch (error) {
      console.error('[Learning API] Patterns retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve patterns'
      });
    }
  }
);

/**
 * POST /api/learning/patterns/:patternId/approve
 * Approve a learning pattern
 */
router.post(
  '/patterns/:patternId/approve',
  authenticate,
  apiLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { patternId } = req.params;
      const { customization } = req.body;

      // Verify pattern belongs to user
      const { data: pattern, error: fetchError } = await supabase
        .from('learning_patterns')
        .select('*')
        .eq('id', patternId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !pattern) {
        return res.status(404).json({
          success: false,
          error: 'Pattern not found'
        });
      }

      // Update pattern to active
      const { error: updateError } = await supabase
        .from('learning_patterns')
        .update({
          status: 'active',
          activated_at: new Date().toISOString(),
          customization: customization || null
        })
        .eq('id', patternId);

      if (updateError) {
        throw updateError;
      }

      res.json({
        success: true,
        message: 'Pattern approved and activated'
      });
    } catch (error) {
      console.error('[Learning API] Pattern approval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to approve pattern'
      });
    }
  }
);

/**
 * POST /api/learning/patterns/:patternId/reject
 * Reject a learning pattern
 */
router.post(
  '/patterns/:patternId/reject',
  authenticate,
  apiLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { patternId } = req.params;
      const { reason } = req.body;

      // Verify pattern belongs to user
      const { data: pattern, error: fetchError } = await supabase
        .from('learning_patterns')
        .select('*')
        .eq('id', patternId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !pattern) {
        return res.status(404).json({
          success: false,
          error: 'Pattern not found'
        });
      }

      // Update pattern to rejected
      const { error: updateError } = await supabase
        .from('learning_patterns')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: reason || null
        })
        .eq('id', patternId);

      if (updateError) {
        throw updateError;
      }

      res.json({
        success: true,
        message: 'Pattern rejected'
      });
    } catch (error) {
      console.error('[Learning API] Pattern rejection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reject pattern'
      });
    }
  }
);

/**
 * POST /api/learning/patterns/:patternId/deactivate
 * Deactivate an active learning pattern
 */
router.post(
  '/patterns/:patternId/deactivate',
  authenticate,
  apiLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { patternId } = req.params;

      // Verify pattern belongs to user
      const { data: pattern, error: fetchError } = await supabase
        .from('learning_patterns')
        .select('*')
        .eq('id', patternId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !pattern) {
        return res.status(404).json({
          success: false,
          error: 'Pattern not found'
        });
      }

      // Update pattern to deactivated
      const { error: updateError } = await supabase
        .from('learning_patterns')
        .update({
          status: 'deactivated',
          deactivated_at: new Date().toISOString()
        })
        .eq('id', patternId);

      if (updateError) {
        throw updateError;
      }

      res.json({
        success: true,
        message: 'Pattern deactivated'
      });
    } catch (error) {
      console.error('[Learning API] Pattern deactivation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to deactivate pattern'
      });
    }
  }
);

/**
 * GET /api/learning/report
 * Get learning effectiveness report
 */
router.get(
  '/report',
  authenticate,
  apiLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { period = 'month' } = req.query;

      // For now, return basic statistics
      // In Phase 5, this will be enhanced with full report generation
      const stats = await FeedbackService.getOverrideStats(userId, 30);

      // Get active patterns count
      const { data: activePatterns } = await supabase
        .from('learning_patterns')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active');

      const report = {
        period,
        overrideStats: stats,
        activePatternsCount: activePatterns?.length || 0,
        message: 'Full report generation will be implemented in Phase 5'
      };

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('[Learning API] Report generation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate report'
      });
    }
  }
);

/**
 * POST /api/learning/outcomes/:overrideId
 * Track outcome for a specific override
 */
router.post(
  '/outcomes/:overrideId',
  authenticate,
  apiLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { overrideId } = req.params;
      const outcome = req.body;

      // Validate required outcome fields
      if (!outcome || typeof outcome !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Invalid outcome data'
        });
      }

      // Verify override belongs to user
      const { data: override, error: fetchError } = await supabase
        .from('agent_overrides')
        .select('*')
        .eq('id', overrideId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !override) {
        return res.status(404).json({
          success: false,
          error: 'Override not found'
        });
      }

      // Track outcome
      const updatedOverride = await OutcomeTracker.trackOverrideOutcome(overrideId, outcome);

      res.json({
        success: true,
        data: updatedOverride,
        message: 'Outcome tracked successfully'
      });
    } catch (error) {
      console.error('[Learning API] Outcome tracking error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to track outcome',
        details: error.message
      });
    }
  }
);

/**
 * GET /api/learning/effectiveness-report
 * Get comprehensive effectiveness report with pattern performance
 */
router.get(
  '/effectiveness-report',
  authenticate,
  apiLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { days = 30 } = req.query;

      const report = await OutcomeTracker.getEffectivenessReport(userId, parseInt(days));

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('[Learning API] Effectiveness report error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate effectiveness report',
        details: error.message
      });
    }
  }
);

/**
 * GET /api/learning/patterns/:patternId/validation
 * Get validation metrics for a specific pattern
 */
router.get(
  '/patterns/:patternId/validation',
  authenticate,
  apiLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { patternId } = req.params;

      // Verify pattern belongs to user
      const { data: pattern, error: fetchError } = await supabase
        .from('learning_patterns')
        .select('*')
        .eq('id', patternId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !pattern) {
        return res.status(404).json({
          success: false,
          error: 'Pattern not found'
        });
      }

      // Return validation metrics
      const validation = pattern.validation_metrics || {
        totalOutcomes: 0,
        successfulOutcomes: 0,
        successRate: 0,
        lastUpdated: null
      };

      const response = {
        patternId: pattern.id,
        patternType: pattern.pattern_type,
        status: pattern.status,
        confidence: pattern.confidence,
        validation: validation,
        performance: {
          isValidated: validation.totalOutcomes >= 3,
          performanceLevel: validation.successRate >= 0.85 ? 'excellent' :
                           validation.successRate >= 0.7 ? 'good' :
                           validation.successRate >= 0.5 ? 'moderate' :
                           validation.totalOutcomes >= 3 ? 'poor' : 'insufficient_data',
          recommendation: validation.totalOutcomes >= 5 && validation.successRate < 0.4
            ? 'Pattern will be auto-deprecated due to low success rate'
            : validation.successRate >= 0.85 && validation.totalOutcomes >= 3
            ? 'Pattern is performing well'
            : validation.totalOutcomes < 3
            ? 'More outcome data needed for validation'
            : 'Pattern performance is acceptable'
        }
      };

      res.json({
        success: true,
        data: response
      });
    } catch (error) {
      console.error('[Learning API] Pattern validation retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve pattern validation'
      });
    }
  }
);

module.exports = router;
