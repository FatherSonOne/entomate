/**
 * Explanation Service
 * Generates and stores transparent explanations for AI agent decisions
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuid } = require('uuid');
const log = require('../../utils/log');

class ExplanationService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }

  /**
   * Generate explanation for an AI agent decision
   * @param {Object} params - Explanation parameters
   * @returns {Object} Generated explanation
   */
  async generateExplanation(params) {
    const {
      agentExecutionId,
      agentType,
      recommendation,
      confidence,
      factors,
      alternatives,
      metadata = {}
    } = params;

    try {
      // Validate required fields
      if (!agentExecutionId || !agentType || !recommendation || !factors) {
        throw new Error('Missing required fields for explanation generation');
      }

      // Normalize factors (ensure they have all required fields)
      const normalizedFactors = this.normalizeFactors(factors);

      // Normalize alternatives
      const normalizedAlternatives = this.normalizeAlternatives(alternatives || []);

      // Calculate overall confidence if not provided
      const calculatedConfidence = confidence !== undefined
        ? confidence
        : this.calculateConfidence(normalizedFactors);

      const explanation = {
        agentExecutionId,
        agentType,
        recommendation,
        confidence: calculatedConfidence,
        factors: normalizedFactors,
        alternatives: normalizedAlternatives,
        metadata: {
          ...metadata,
          generatedAt: new Date().toISOString(),
          version: '1.0'
        }
      };

      return explanation;
    } catch (error) {
      log.error('[ExplanationService] generateExplanation error:', { error: error.message || error });
      throw error;
    }
  }

  /**
   * Store explanation in database
   * @param {Object} explanation - Explanation object
   * @returns {Object} Stored explanation record
   */
  async storeExplanation(explanation) {
    try {
      const { data, error } = await this.supabase
        .from('agent_explanations')
        .insert({
          id: uuid(),
          agent_execution_id: explanation.agentExecutionId,
          agent_type: explanation.agentType,
          recommendation: explanation.recommendation,
          confidence: explanation.confidence,
          factors: explanation.factors,
          alternatives: explanation.alternatives,
          metadata: explanation.metadata,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        log.error('[ExplanationService] Database error:', { error: error.message || error });
        throw error;
      }

      log.info(`[ExplanationService] Explanation stored for execution ${explanation.agentExecutionId}`);

      return data;
    } catch (error) {
      log.error('[ExplanationService] storeExplanation error:', { error: error.message || error });
      throw error;
    }
  }

  /**
   * Generate and store explanation in one step
   * @param {Object} params - Explanation parameters
   * @returns {Object} Stored explanation record
   */
  async createExplanation(params) {
    const explanation = await this.generateExplanation(params);
    return await this.storeExplanation(explanation);
  }

  /**
   * Get explanation by agent execution ID
   * @param {string} agentExecutionId - Agent execution ID
   * @returns {Object|null} Explanation record or null
   */
  async getExplanationByExecutionId(agentExecutionId) {
    try {
      const { data, error } = await this.supabase
        .from('agent_explanations')
        .select('*')
        .eq('agent_execution_id', agentExecutionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      log.error('[ExplanationService] getExplanationByExecutionId error:', { error: error.message || error });
      throw error;
    }
  }

  /**
   * Get recent explanations for an agent type
   * @param {string} agentType - Agent type
   * @param {number} limit - Number of records to return
   * @returns {Array} Array of explanation records
   */
  async getRecentExplanations(agentType = null, limit = 10) {
    try {
      let query = this.supabase
        .from('agent_explanations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (agentType) {
        query = query.eq('agent_type', agentType);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      log.error('[ExplanationService] getRecentExplanations error:', { error: error.message || error });
      throw error;
    }
  }

  /**
   * Normalize factors to ensure consistent structure
   * @param {Array} factors - Array of factor objects
   * @returns {Array} Normalized factors
   */
  normalizeFactors(factors) {
    return factors.map(factor => ({
      name: factor.name,
      weight: factor.weight || 0,
      score: factor.score || 0,
      impact: factor.impact || this.calculateImpact(factor.score),
      details: factor.details || [],
      naturalLanguage: factor.naturalLanguage || factor.name,
      learningApplied: factor.learningApplied || null
    }));
  }

  /**
   * Normalize alternatives to ensure consistent structure
   * @param {Array} alternatives - Array of alternative options
   * @returns {Array} Normalized alternatives
   */
  normalizeAlternatives(alternatives) {
    return alternatives.map(alt => ({
      option: alt.option,
      score: alt.score || 0,
      whyLower: alt.whyLower || 'Lower overall score',
      factors: alt.factors ? this.normalizeFactors(alt.factors) : []
    }));
  }

  /**
   * Calculate impact level from score
   * @param {number} score - Factor score (0-100)
   * @returns {string} Impact level
   */
  calculateImpact(score) {
    if (score >= 80) return 'strong';
    if (score >= 60) return 'moderate';
    if (score >= 40) return 'weak';
    return 'minimal';
  }

  /**
   * Calculate overall confidence from factors
   * @param {Array} factors - Array of factors
   * @returns {number} Confidence score (0-100)
   */
  calculateConfidence(factors) {
    if (!factors || factors.length === 0) return 50;

    // Weighted average of factor scores
    const totalWeight = factors.reduce((sum, f) => sum + (f.weight || 0), 0);
    const weightedScore = factors.reduce((sum, f) => {
      const weight = f.weight || 0;
      const score = f.score || 0;
      return sum + (weight * score);
    }, 0);

    const confidence = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 50;
    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Generate natural language summary of explanation
   * @param {Object} explanation - Explanation object
   * @returns {string} Natural language summary
   */
  generateSummary(explanation) {
    const { agentType, recommendation, confidence, factors } = explanation;

    // Get top 3 factors by impact
    const topFactors = factors
      .sort((a, b) => (b.score * b.weight) - (a.score * a.weight))
      .slice(0, 3);

    let summary = `AI recommended `;

    switch (agentType) {
      case 'assignment':
        summary += `assigning to ${recommendation.name} `;
        break;
      case 'priority':
        summary += `${recommendation.value} priority `;
        break;
      case 'deadline':
        summary += `deadline of ${recommendation.date} `;
        break;
      case 'followup':
        summary += `follow-up action `;
        break;
      default:
        summary += `this option `;
    }

    summary += `with ${confidence}% confidence. `;
    summary += `Key factors: `;
    summary += topFactors.map(f => f.naturalLanguage).join(', ');
    summary += '.';

    return summary;
  }

  /**
   * Get explanation statistics
   * @param {number} days - Number of days to look back
   * @returns {Object} Statistics object
   */
  async getExplanationStats(days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await this.supabase
        .from('agent_explanations')
        .select('agent_type, confidence')
        .gte('created_at', startDate.toISOString());

      if (error) {
        throw error;
      }

      const stats = {
        total: data.length,
        byAgentType: {},
        avgConfidence: 0,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0
      };

      let totalConfidence = 0;

      data.forEach(record => {
        // Count by agent type
        const type = record.agent_type;
        stats.byAgentType[type] = (stats.byAgentType[type] || 0) + 1;

        // Aggregate confidence
        totalConfidence += record.confidence;

        // Categorize by confidence
        if (record.confidence >= 80) {
          stats.highConfidence++;
        } else if (record.confidence >= 60) {
          stats.mediumConfidence++;
        } else {
          stats.lowConfidence++;
        }
      });

      if (data.length > 0) {
        stats.avgConfidence = Math.round(totalConfidence / data.length);
      }

      return stats;
    } catch (error) {
      log.error('[ExplanationService] getExplanationStats error:', { error: error.message || error });
      throw error;
    }
  }
}

module.exports = new ExplanationService();
