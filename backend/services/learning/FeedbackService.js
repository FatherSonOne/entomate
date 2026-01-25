/**
 * Feedback Service
 * Captures user feedback on AI agent recommendations and overrides
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuid } = require('uuid');

class FeedbackService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }

  /**
   * Capture user override with optional feedback
   * @param {Object} override - Override details
   * @returns {Object} Created override record
   */
  async captureOverride(override) {
    try {
      const {
        userId,
        agentType,
        agentExecutionId = null,
        originalRecommendation,
        userChoice,
        feedbackReason = null,
        feedbackText = null,
        context
      } = override;

      // Validate required fields
      if (!userId || !agentType || !originalRecommendation || !userChoice || !context) {
        throw new Error('Missing required fields for override capture');
      }

      // Validate agent type
      const validAgentTypes = ['assignment', 'priority', 'deadline', 'followup'];
      if (!validAgentTypes.includes(agentType)) {
        throw new Error(`Invalid agent type: ${agentType}`);
      }

      // Store override in database
      const { data, error } = await this.supabase
        .from('agent_overrides')
        .insert({
          id: uuid(),
          user_id: userId,
          agent_type: agentType,
          agent_execution_id: agentExecutionId,
          original_recommendation: originalRecommendation,
          user_choice: userChoice,
          feedback_reason: feedbackReason,
          feedback_text: feedbackText,
          context_snapshot: context,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('[FeedbackService] Database error:', error);
        throw error;
      }

      console.log(`[FeedbackService] Override captured for user ${userId}, agent ${agentType}`);

      // Trigger pattern detection asynchronously (don't wait for it)
      this.triggerPatternDetection(userId, agentType).catch(err => {
        console.error('[FeedbackService] Pattern detection trigger failed:', err);
      });

      return data;
    } catch (error) {
      console.error('[FeedbackService] captureOverride error:', error);
      throw error;
    }
  }

  /**
   * Check if user wants feedback prompts for a specific agent type
   * @param {string} userId - User ID
   * @param {string} agentType - Agent type
   * @returns {boolean} Whether to show feedback prompt
   */
  async shouldPromptForFeedback(userId, agentType) {
    try {
      const preferenceKey = `feedback_prompt_${agentType}`;

      const { data, error } = await this.supabase
        .from('user_learning_preferences')
        .select('preference_value')
        .eq('user_id', userId)
        .eq('preference_key', preferenceKey)
        .maybeSingle();

      if (error) {
        console.error('[FeedbackService] Error checking preference:', error);
        // Default to true on error
        return true;
      }

      // Default: true (prompt for feedback)
      // Only return false if explicitly disabled
      return !data || data.preference_value !== 'disabled';
    } catch (error) {
      console.error('[FeedbackService] shouldPromptForFeedback error:', error);
      // Default to true on error
      return true;
    }
  }

  /**
   * Update user feedback preference
   * @param {string} userId - User ID
   * @param {string} agentType - Agent type
   * @param {boolean} enabled - Whether feedback prompts are enabled
   */
  async setFeedbackPreference(userId, agentType, enabled) {
    try {
      const preferenceKey = `feedback_prompt_${agentType}`;
      const preferenceValue = enabled ? 'enabled' : 'disabled';

      const { error } = await this.supabase
        .from('user_learning_preferences')
        .upsert({
          user_id: userId,
          preference_key: preferenceKey,
          preference_value: preferenceValue,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,preference_key'
        });

      if (error) {
        console.error('[FeedbackService] Error setting preference:', error);
        throw error;
      }

      console.log(`[FeedbackService] Feedback preference updated for user ${userId}, agent ${agentType}: ${preferenceValue}`);
    } catch (error) {
      console.error('[FeedbackService] setFeedbackPreference error:', error);
      throw error;
    }
  }

  /**
   * Get recent overrides for a user
   * @param {string} userId - User ID
   * @param {string} agentType - Optional agent type filter
   * @param {number} limit - Number of records to return
   * @returns {Array} Array of override records
   */
  async getRecentOverrides(userId, agentType = null, limit = 10) {
    try {
      let query = this.supabase
        .from('agent_overrides')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (agentType) {
        query = query.eq('agent_type', agentType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[FeedbackService] Error fetching overrides:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('[FeedbackService] getRecentOverrides error:', error);
      throw error;
    }
  }

  /**
   * Get override statistics for a user
   * @param {string} userId - User ID
   * @param {number} days - Number of days to look back
   * @returns {Object} Override statistics
   */
  async getOverrideStats(userId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await this.supabase
        .from('agent_overrides')
        .select('agent_type, feedback_reason')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.error('[FeedbackService] Error fetching stats:', error);
        throw error;
      }

      // Calculate statistics
      const stats = {
        total: data.length,
        byAgentType: {},
        withFeedback: data.filter(o => o.feedback_reason || o.feedback_text).length,
        feedbackRate: 0
      };

      // Count by agent type
      data.forEach(override => {
        const type = override.agent_type;
        stats.byAgentType[type] = (stats.byAgentType[type] || 0) + 1;
      });

      // Calculate feedback rate
      if (stats.total > 0) {
        stats.feedbackRate = Math.round((stats.withFeedback / stats.total) * 100);
      }

      return stats;
    } catch (error) {
      console.error('[FeedbackService] getOverrideStats error:', error);
      throw error;
    }
  }

  /**
   * Trigger pattern detection (async, non-blocking)
   * @param {string} userId - User ID
   * @param {string} agentType - Agent type
   */
  async triggerPatternDetection(userId, agentType) {
    try {
      console.log(`[FeedbackService] Pattern detection triggered for user ${userId}, agent ${agentType}`);

      // Call PatternDetectionService
      const PatternDetectionService = require('./PatternDetectionService');
      await PatternDetectionService.detectPatterns(userId, agentType);
    } catch (error) {
      console.error('[FeedbackService] triggerPatternDetection error:', error);
      // Don't throw - this is async and non-critical
    }
  }
}

module.exports = new FeedbackService();
