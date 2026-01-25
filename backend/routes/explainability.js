/**
 * AI Explainability API Routes
 * Handles explanation generation, retrieval, and statistics
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const ExplanationService = require('../services/explainability/ExplanationService');

/**
 * POST /api/explainability/explanations
 * Create a new explanation for an agent decision
 */
router.post(
  '/explanations',
  authenticate,
  apiLimiter,
  async (req, res) => {
    try {
      const {
        agentExecutionId,
        agentType,
        recommendation,
        confidence,
        factors,
        alternatives,
        metadata
      } = req.body;

      // Validate required fields
      if (!agentExecutionId || !agentType || !recommendation || !factors) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: agentExecutionId, agentType, recommendation, factors'
        });
      }

      const explanation = await ExplanationService.createExplanation({
        agentExecutionId,
        agentType,
        recommendation,
        confidence,
        factors,
        alternatives,
        metadata
      });

      res.json({
        success: true,
        data: explanation,
        message: 'Explanation created successfully'
      });
    } catch (error) {
      console.error('[Explainability API] Create explanation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create explanation',
        details: error.message
      });
    }
  }
);

/**
 * GET /api/explainability/explanations/:executionId
 * Get explanation by agent execution ID
 */
router.get(
  '/explanations/:executionId',
  authenticate,
  apiLimiter,
  async (req, res) => {
    try {
      const { executionId } = req.params;

      const explanation = await ExplanationService.getExplanationByExecutionId(executionId);

      if (!explanation) {
        return res.status(404).json({
          success: false,
          error: 'Explanation not found'
        });
      }

      res.json({
        success: true,
        data: explanation
      });
    } catch (error) {
      console.error('[Explainability API] Get explanation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve explanation'
      });
    }
  }
);

/**
 * GET /api/explainability/explanations/recent
 * Get recent explanations
 */
router.get(
  '/explanations/recent',
  authenticate,
  apiLimiter,
  async (req, res) => {
    try {
      const { agentType, limit = 10 } = req.query;

      const explanations = await ExplanationService.getRecentExplanations(
        agentType,
        parseInt(limit)
      );

      res.json({
        success: true,
        data: explanations
      });
    } catch (error) {
      console.error('[Explainability API] Get recent explanations error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve explanations'
      });
    }
  }
);

/**
 * GET /api/explainability/stats
 * Get explanation statistics
 */
router.get(
  '/stats',
  authenticate,
  apiLimiter,
  async (req, res) => {
    try {
      const { days = 30 } = req.query;

      const stats = await ExplanationService.getExplanationStats(parseInt(days));

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('[Explainability API] Get stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve statistics'
      });
    }
  }
);

/**
 * POST /api/explainability/explanations/:executionId/summary
 * Generate natural language summary for an explanation
 */
router.post(
  '/explanations/:executionId/summary',
  authenticate,
  apiLimiter,
  async (req, res) => {
    try {
      const { executionId } = req.params;

      const explanation = await ExplanationService.getExplanationByExecutionId(executionId);

      if (!explanation) {
        return res.status(404).json({
          success: false,
          error: 'Explanation not found'
        });
      }

      const summary = ExplanationService.generateSummary(explanation);

      res.json({
        success: true,
        data: { summary }
      });
    } catch (error) {
      console.error('[Explainability API] Generate summary error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate summary'
      });
    }
  }
);

module.exports = router;
