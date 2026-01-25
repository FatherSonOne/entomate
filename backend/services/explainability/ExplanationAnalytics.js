/**
 * Explanation Analytics Service
 * Tracks metrics and performance for AI explanations
 */

const { supabase, supabaseAdmin } = require('../../config/supabase');
const db = supabaseAdmin || supabase;
const logger = require('../logger');

class ExplanationAnalytics {
  constructor() {
    this.metrics = {
      generationTimes: [],
      viewCount: 0,
      expansionCount: 0,
      alternativeSelectionCount: 0,
      overrideCount: 0,
      acceptanceCount: 0
    };
  }

  /**
   * Track explanation generation time
   */
  trackGenerationTime(agentType, durationMs) {
    this.metrics.generationTimes.push({
      agentType,
      duration: durationMs,
      timestamp: new Date()
    });

    // Log if generation is slow
    if (durationMs > 200) {
      logger.warn(`Slow explanation generation for ${agentType}: ${durationMs}ms`);
    }

    // Log metrics
    logger.info(`[Explainability] Generated explanation for ${agentType} in ${durationMs}ms`);

    // Keep only last 1000 measurements
    if (this.metrics.generationTimes.length > 1000) {
      this.metrics.generationTimes = this.metrics.generationTimes.slice(-1000);
    }
  }

  /**
   * Track explanation view
   */
  async trackView(executionId, userId) {
    this.metrics.viewCount++;

    try {
      await db.from('explanation_analytics').insert({
        event_type: 'view',
        execution_id: executionId,
        user_id: userId,
        metadata: {},
        created_at: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Analytics] Error tracking view:', error);
    }
  }

  /**
   * Track explanation expansion (user clicked "Show More")
   */
  async trackExpansion(executionId, userId) {
    this.metrics.expansionCount++;

    try {
      await db.from('explanation_analytics').insert({
        event_type: 'expansion',
        execution_id: executionId,
        user_id: userId,
        metadata: {},
        created_at: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Analytics] Error tracking expansion:', error);
    }
  }

  /**
   * Track alternative selection
   */
  async trackAlternativeSelection(executionId, userId, alternativeId) {
    this.metrics.alternativeSelectionCount++;

    try {
      await db.from('explanation_analytics').insert({
        event_type: 'alternative_selected',
        execution_id: executionId,
        user_id: userId,
        metadata: { alternative_id: alternativeId },
        created_at: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Analytics] Error tracking alternative selection:', error);
    }
  }

  /**
   * Track recommendation acceptance
   */
  async trackAcceptance(executionId, userId, recommendationId) {
    this.metrics.acceptanceCount++;

    try {
      await db.from('explanation_analytics').insert({
        event_type: 'acceptance',
        execution_id: executionId,
        user_id: userId,
        metadata: { recommendation_id: recommendationId },
        created_at: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Analytics] Error tracking acceptance:', error);
    }
  }

  /**
   * Track recommendation override (user chose different option)
   */
  async trackOverride(executionId, userId, originalId, selectedId) {
    this.metrics.overrideCount++;

    try {
      await db.from('explanation_analytics').insert({
        event_type: 'override',
        execution_id: executionId,
        user_id: userId,
        metadata: {
          original_recommendation: originalId,
          selected_option: selectedId
        },
        created_at: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Analytics] Error tracking override:', error);
    }
  }

  /**
   * Get generation time statistics
   */
  getGenerationStats(agentType = null) {
    let times = this.metrics.generationTimes;

    if (agentType) {
      times = times.filter(t => t.agentType === agentType);
    }

    if (times.length === 0) {
      return {
        count: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        max: 0
      };
    }

    const durations = times.map(t => t.duration).sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      count: durations.length,
      avg: Math.round(sum / durations.length),
      p50: durations[Math.floor(durations.length * 0.50)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)],
      max: durations[durations.length - 1]
    };
  }

  /**
   * Get engagement metrics
   */
  getEngagementMetrics() {
    const expansionRate = this.metrics.viewCount > 0
      ? (this.metrics.expansionCount / this.metrics.viewCount) * 100
      : 0;

    const alternativeRate = this.metrics.viewCount > 0
      ? (this.metrics.alternativeSelectionCount / this.metrics.viewCount) * 100
      : 0;

    const overrideRate = this.metrics.acceptanceCount > 0
      ? (this.metrics.overrideCount / (this.metrics.acceptanceCount + this.metrics.overrideCount)) * 100
      : 0;

    return {
      totalViews: this.metrics.viewCount,
      totalExpansions: this.metrics.expansionCount,
      totalAlternativeSelections: this.metrics.alternativeSelectionCount,
      totalAcceptances: this.metrics.acceptanceCount,
      totalOverrides: this.metrics.overrideCount,
      expansionRate: Math.round(expansionRate),
      alternativeSelectionRate: Math.round(alternativeRate),
      overrideRate: Math.round(overrideRate)
    };
  }

  /**
   * Get confidence accuracy (how often high-confidence recommendations succeed)
   */
  async getConfidenceAccuracy() {
    try {
      // Query database for confidence vs acceptance correlation
      const { data: analytics } = await db
        .from('explanation_analytics')
        .select('*')
        .in('event_type', ['acceptance', 'override'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (!analytics || analytics.length === 0) {
        return { insufficient_data: true };
      }

      // Get corresponding explanations
      const executionIds = [...new Set(analytics.map(a => a.execution_id))];

      const { data: explanations } = await db
        .from('agent_explanations')
        .select('agent_execution_id, confidence')
        .in('agent_execution_id', executionIds);

      if (!explanations || explanations.length === 0) {
        return { insufficient_data: true };
      }

      // Calculate accuracy by confidence level
      const highConfidence = { correct: 0, total: 0 };
      const mediumConfidence = { correct: 0, total: 0 };
      const lowConfidence = { correct: 0, total: 0 };

      analytics.forEach(analytic => {
        const explanation = explanations.find(e => e.agent_execution_id === analytic.execution_id);

        if (!explanation) return;

        const isAccepted = analytic.event_type === 'acceptance';
        const conf = explanation.confidence;

        if (conf >= 80) {
          highConfidence.total++;
          if (isAccepted) highConfidence.correct++;
        } else if (conf >= 60) {
          mediumConfidence.total++;
          if (isAccepted) mediumConfidence.correct++;
        } else {
          lowConfidence.total++;
          if (isAccepted) lowConfidence.correct++;
        }
      });

      return {
        highConfidence: {
          accuracy: highConfidence.total > 0
            ? Math.round((highConfidence.correct / highConfidence.total) * 100)
            : 0,
          sampleSize: highConfidence.total
        },
        mediumConfidence: {
          accuracy: mediumConfidence.total > 0
            ? Math.round((mediumConfidence.correct / mediumConfidence.total) * 100)
            : 0,
          sampleSize: mediumConfidence.total
        },
        lowConfidence: {
          accuracy: lowConfidence.total > 0
            ? Math.round((lowConfidence.correct / lowConfidence.total) * 100)
            : 0,
          sampleSize: lowConfidence.total
        }
      };
    } catch (error) {
      logger.error('[Analytics] Error calculating confidence accuracy:', error);
      return { error: error.message };
    }
  }

  /**
   * Get comprehensive analytics report
   */
  async getAnalyticsReport() {
    const generationStats = this.getGenerationStats();
    const engagementMetrics = this.getEngagementMetrics();
    const confidenceAccuracy = await this.getConfidenceAccuracy();

    return {
      performance: generationStats,
      engagement: engagementMetrics,
      quality: confidenceAccuracy,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset in-memory metrics
   */
  resetMetrics() {
    this.metrics = {
      generationTimes: [],
      viewCount: 0,
      expansionCount: 0,
      alternativeSelectionCount: 0,
      overrideCount: 0,
      acceptanceCount: 0
    };

    logger.info('[Analytics] Metrics reset');
  }
}

module.exports = new ExplanationAnalytics();
