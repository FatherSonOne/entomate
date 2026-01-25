/**
 * Outcome Tracker Service
 * Tracks outcomes of AI recommendations and overrides to measure pattern effectiveness
 */

const { createClient } = require('@supabase/supabase-js');

class OutcomeTracker {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }

  /**
   * Track outcome for an override
   * @param {string} overrideId - Override record ID
   * @param {Object} outcome - Outcome data
   * @returns {Object} Updated override record
   */
  async trackOverrideOutcome(overrideId, outcome) {
    try {
      const {
        success,
        completedOnTime,
        quality,
        userSatisfaction,
        metrics = {}
      } = outcome;

      // Calculate overall success
      const outcomeSuccess = this.calculateOutcomeSuccess(outcome);

      // Update override with outcome
      const { data, error } = await this.supabase
        .from('agent_overrides')
        .update({
          outcome_success: outcomeSuccess,
          outcome_metrics: {
            success,
            completedOnTime,
            quality,
            userSatisfaction,
            ...metrics
          },
          outcome_tracked_at: new Date().toISOString()
        })
        .eq('id', overrideId)
        .select()
        .single();

      if (error) {
        console.error('[OutcomeTracker] Error updating override:', error);
        throw error;
      }

      console.log(`[OutcomeTracker] Tracked outcome for override ${overrideId}: ${outcomeSuccess ? 'success' : 'failure'}`);

      // Find and update associated patterns
      await this.updatePatternsFromOutcome(overrideId, outcomeSuccess);

      return data;
    } catch (error) {
      console.error('[OutcomeTracker] trackOverrideOutcome error:', error);
      throw error;
    }
  }

  /**
   * Calculate overall success from outcome metrics
   * @param {Object} outcome - Outcome data
   * @returns {boolean} Overall success
   */
  calculateOutcomeSuccess(outcome) {
    const {
      success,
      completedOnTime,
      quality,
      userSatisfaction
    } = outcome;

    // If explicit success is provided, use it
    if (success !== undefined) {
      return success;
    }

    // Otherwise, calculate from metrics
    let successCount = 0;
    let totalMetrics = 0;

    if (completedOnTime !== undefined) {
      successCount += completedOnTime ? 1 : 0;
      totalMetrics++;
    }

    if (quality !== undefined) {
      successCount += quality >= 4 ? 1 : 0; // Assume 1-5 scale
      totalMetrics++;
    }

    if (userSatisfaction !== undefined) {
      successCount += userSatisfaction >= 4 ? 1 : 0; // Assume 1-5 scale
      totalMetrics++;
    }

    // Success if majority of metrics are positive
    return totalMetrics > 0 && (successCount / totalMetrics) >= 0.5;
  }

  /**
   * Update patterns based on outcome
   * @param {string} overrideId - Override record ID
   * @param {boolean} outcomeSuccess - Whether outcome was successful
   */
  async updatePatternsFromOutcome(overrideId, outcomeSuccess) {
    try {
      // Find patterns that reference this override
      const { data: patterns, error } = await this.supabase
        .from('learning_patterns')
        .select('*')
        .contains('pattern_data->>supportingOverrides', [overrideId])
        .eq('status', 'active');

      if (error) {
        console.error('[OutcomeTracker] Error fetching patterns:', error);
        return;
      }

      if (!patterns || patterns.length === 0) {
        return;
      }

      console.log(`[OutcomeTracker] Updating ${patterns.length} patterns based on outcome`);

      // Update each pattern's validation metrics
      for (const pattern of patterns) {
        await this.updatePatternValidation(pattern.id, outcomeSuccess);
      }
    } catch (error) {
      console.error('[OutcomeTracker] updatePatternsFromOutcome error:', error);
    }
  }

  /**
   * Update pattern validation metrics
   * @param {string} patternId - Pattern ID
   * @param {boolean} outcomeSuccess - Whether outcome was successful
   */
  async updatePatternValidation(patternId, outcomeSuccess) {
    try {
      // Get current pattern
      const { data: pattern, error: fetchError } = await this.supabase
        .from('learning_patterns')
        .select('*')
        .eq('id', patternId)
        .single();

      if (fetchError || !pattern) {
        console.error('[OutcomeTracker] Pattern not found:', patternId);
        return;
      }

      // Get or initialize validation metrics
      const validation = pattern.validation_metrics || {
        totalOutcomes: 0,
        successfulOutcomes: 0,
        successRate: 0,
        lastUpdated: new Date().toISOString()
      };

      // Update metrics
      validation.totalOutcomes += 1;
      if (outcomeSuccess) {
        validation.successfulOutcomes += 1;
      }
      validation.successRate = validation.successfulOutcomes / validation.totalOutcomes;
      validation.lastUpdated = new Date().toISOString();

      // Re-calculate confidence with validation data
      let newConfidence = pattern.confidence;

      // Boost confidence if high success rate
      if (validation.successRate >= 0.85 && validation.totalOutcomes >= 3) {
        newConfidence = Math.min(100, Math.round(newConfidence * 1.2));
      }
      // Reduce confidence if low success rate
      else if (validation.successRate < 0.5 && validation.totalOutcomes >= 3) {
        newConfidence = Math.round(newConfidence * 0.7);
      }

      // Check if pattern should be deprecated
      if (validation.totalOutcomes >= 5 && validation.successRate < 0.4) {
        await this.deprecatePattern(patternId, 'Low success rate after validation');
        return;
      }

      // Update pattern
      const { error: updateError } = await this.supabase
        .from('learning_patterns')
        .update({
          validation_metrics: validation,
          confidence: newConfidence
        })
        .eq('id', patternId);

      if (updateError) {
        console.error('[OutcomeTracker] Error updating pattern:', updateError);
        return;
      }

      console.log(`[OutcomeTracker] Updated pattern ${patternId}: confidence ${pattern.confidence} → ${newConfidence}, success rate ${Math.round(validation.successRate * 100)}%`);
    } catch (error) {
      console.error('[OutcomeTracker] updatePatternValidation error:', error);
    }
  }

  /**
   * Deprecate a pattern due to poor performance
   * @param {string} patternId - Pattern ID
   * @param {string} reason - Deprecation reason
   */
  async deprecatePattern(patternId, reason) {
    try {
      const { error } = await this.supabase
        .from('learning_patterns')
        .update({
          status: 'deprecated',
          deprecated_reason: reason,
          deactivated_at: new Date().toISOString()
        })
        .eq('id', patternId);

      if (error) {
        console.error('[OutcomeTracker] Error deprecating pattern:', error);
        return;
      }

      console.log(`[OutcomeTracker] Deprecated pattern ${patternId}: ${reason}`);
    } catch (error) {
      console.error('[OutcomeTracker] deprecatePattern error:', error);
    }
  }

  /**
   * Get pattern effectiveness report
   * @param {string} userId - User ID
   * @param {number} days - Number of days to analyze
   * @returns {Object} Effectiveness report
   */
  async getEffectivenessReport(userId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get active patterns
      const { data: patterns, error: patternsError } = await this.supabase
        .from('learning_patterns')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (patternsError) {
        throw patternsError;
      }

      // Get override stats
      const { data: allOverrides, error: overridesError } = await this.supabase
        .from('agent_overrides')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString());

      if (overridesError) {
        throw overridesError;
      }

      // Calculate metrics
      const totalOverrides = allOverrides.length;
      const overridesWithOutcomes = allOverrides.filter(o => o.outcome_success !== null);
      const successfulOverrides = allOverrides.filter(o => o.outcome_success === true);

      const report = {
        period: { days, startDate: startDate.toISOString(), endDate: new Date().toISOString() },
        activePatternsCount: patterns.length,
        overrides: {
          total: totalOverrides,
          withOutcomes: overridesWithOutcomes.length,
          successful: successfulOverrides.length,
          successRate: overridesWithOutcomes.length > 0
            ? Math.round((successfulOverrides.length / overridesWithOutcomes.length) * 100)
            : 0
        },
        patterns: patterns.map(p => ({
          id: p.id,
          description: p.pattern_data?.description,
          confidence: p.confidence,
          validation: p.validation_metrics,
          activated: p.activated_at
        })),
        topPerformingPatterns: this.getTopPatterns(patterns, 3),
        lowPerformingPatterns: this.getLowPatterns(patterns, 3),
        estimatedTimeSaved: this.estimateTimeSaved(totalOverrides, patterns.length),
        recommendations: this.generateRecommendations(patterns, allOverrides)
      };

      return report;
    } catch (error) {
      console.error('[OutcomeTracker] getEffectivenessReport error:', error);
      throw error;
    }
  }

  /**
   * Get top performing patterns
   * @param {Array} patterns - Array of patterns
   * @param {number} limit - Number to return
   * @returns {Array} Top patterns
   */
  getTopPatterns(patterns, limit) {
    return patterns
      .filter(p => p.validation_metrics && p.validation_metrics.totalOutcomes >= 3)
      .sort((a, b) => (b.validation_metrics?.successRate || 0) - (a.validation_metrics?.successRate || 0))
      .slice(0, limit)
      .map(p => ({
        description: p.pattern_data?.description,
        successRate: Math.round((p.validation_metrics?.successRate || 0) * 100),
        totalOutcomes: p.validation_metrics?.totalOutcomes,
        confidence: p.confidence
      }));
  }

  /**
   * Get low performing patterns
   * @param {Array} patterns - Array of patterns
   * @param {number} limit - Number to return
   * @returns {Array} Low patterns
   */
  getLowPatterns(patterns, limit) {
    return patterns
      .filter(p => p.validation_metrics && p.validation_metrics.totalOutcomes >= 3 && p.validation_metrics.successRate < 0.6)
      .sort((a, b) => (a.validation_metrics?.successRate || 1) - (b.validation_metrics?.successRate || 1))
      .slice(0, limit)
      .map(p => ({
        description: p.pattern_data?.description,
        successRate: Math.round((p.validation_metrics?.successRate || 0) * 100),
        totalOutcomes: p.validation_metrics?.totalOutcomes,
        confidence: p.confidence,
        recommendation: 'Consider deactivating or reviewing this pattern'
      }));
  }

  /**
   * Estimate time saved from learning patterns
   * @param {number} totalOverrides - Total overrides in period
   * @param {number} activePatterns - Number of active patterns
   * @returns {Object} Time saved estimate
   */
  estimateTimeSaved(totalOverrides, activePatterns) {
    // Assume each override takes ~2 minutes to correct
    // Patterns reduce override rate by ~30% on average
    const minutesPerOverride = 2;
    const reductionRate = 0.30;
    const potentialReduction = totalOverrides * reductionRate;
    const minutesSaved = potentialReduction * minutesPerOverride;

    return {
      overridesPreventedEstimate: Math.round(potentialReduction),
      minutesSaved: Math.round(minutesSaved),
      hoursSaved: Math.round(minutesSaved / 60 * 10) / 10
    };
  }

  /**
   * Generate recommendations based on pattern analysis
   * @param {Array} patterns - Array of patterns
   * @param {Array} overrides - Array of overrides
   * @returns {Array} Recommendations
   */
  generateRecommendations(patterns, overrides) {
    const recommendations = [];

    // Check for patterns needing more data
    const needMoreData = patterns.filter(p =>
      !p.validation_metrics || p.validation_metrics.totalOutcomes < 3
    );
    if (needMoreData.length > 0) {
      recommendations.push({
        type: 'info',
        message: `${needMoreData.length} pattern${needMoreData.length > 1 ? 's' : ''} need${needMoreData.length === 1 ? 's' : ''} more outcome data for validation`
      });
    }

    // Check for low performing patterns
    const lowPerforming = patterns.filter(p =>
      p.validation_metrics &&
      p.validation_metrics.totalOutcomes >= 3 &&
      p.validation_metrics.successRate < 0.5
    );
    if (lowPerforming.length > 0) {
      recommendations.push({
        type: 'warning',
        message: `${lowPerforming.length} pattern${lowPerforming.length > 1 ? 's are' : ' is'} performing poorly and should be reviewed or deactivated`
      });
    }

    // Check for high override rate
    const recentOverrides = overrides.filter(o => {
      const daysAgo = (new Date() - new Date(o.created_at)) / (1000 * 60 * 60 * 24);
      return daysAgo <= 7;
    });
    if (recentOverrides.length > 10) {
      recommendations.push({
        type: 'suggestion',
        message: 'High override rate detected. Consider providing more feedback to help AI learn faster'
      });
    }

    return recommendations;
  }
}

module.exports = new OutcomeTracker();
