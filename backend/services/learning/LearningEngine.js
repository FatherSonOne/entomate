/**
 * Learning Engine
 * Applies learned patterns to AI agent decisions
 */

const { createClient } = require('@supabase/supabase-js');

class LearningEngine {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }

  /**
   * Apply active learning patterns to agent decision
   * @param {string} userId - User ID
   * @param {string} agentType - Agent type
   * @param {Object} recommendation - Original recommendation from agent
   * @param {Object} context - Decision context (task, deal, etc.)
   * @returns {Object} Enhanced recommendation with learning applied
   */
  async applyLearning(userId, agentType, recommendation, context) {
    try {
      // Get active patterns for this user and agent type
      const { data: patterns, error } = await this.supabase
        .from('learning_patterns')
        .select('*')
        .eq('user_id', userId)
        .eq('agent_type', agentType)
        .eq('status', 'active');

      if (error) {
        console.error('[LearningEngine] Error fetching patterns:', error);
        return recommendation; // Return original on error
      }

      if (!patterns || patterns.length === 0) {
        console.log(`[LearningEngine] No active patterns for user ${userId}, agent ${agentType}`);
        return recommendation; // No learning to apply
      }

      console.log(`[LearningEngine] Applying ${patterns.length} patterns for user ${userId}, agent ${agentType}`);

      // Clone recommendation to avoid mutation
      const learnedRecommendation = JSON.parse(JSON.stringify(recommendation));

      // Track which patterns were applied
      const appliedPatterns = [];

      // Apply each pattern
      for (const pattern of patterns) {
        const patternData = pattern.pattern_data;

        // Check if pattern applies to current context
        if (!this.contextMatches(patternData.context, context)) {
          continue;
        }

        // Apply pattern based on type
        const applied = this.applyPattern(learnedRecommendation, pattern, context);
        if (applied) {
          appliedPatterns.push({
            patternId: pattern.id,
            patternType: pattern.pattern_type,
            description: patternData.description
          });
        }
      }

      // Add metadata about applied learning
      learnedRecommendation._learningMetadata = {
        patternsApplied: appliedPatterns.length,
        patterns: appliedPatterns
      };

      console.log(`[LearningEngine] Applied ${appliedPatterns.length} patterns to recommendation`);

      return learnedRecommendation;
    } catch (error) {
      console.error('[LearningEngine] applyLearning error:', error);
      return recommendation; // Return original on error
    }
  }

  /**
   * Apply a single pattern to the recommendation
   * @param {Object} recommendation - Recommendation object
   * @param {Object} pattern - Pattern record
   * @param {Object} context - Decision context
   * @returns {boolean} Whether pattern was applied
   */
  applyPattern(recommendation, pattern, context) {
    const patternData = pattern.pattern_data;

    switch (pattern.pattern_type) {
      case 'preference':
        return this.applyPreferencePattern(recommendation, patternData);

      case 'constraint':
        return this.applyConstraintPattern(recommendation, patternData);

      case 'boost':
        return this.applyBoostPattern(recommendation, patternData);

      default:
        console.warn(`[LearningEngine] Unknown pattern type: ${pattern.pattern_type}`);
        return false;
    }
  }

  /**
   * Apply preference pattern (boost preferred option)
   * @param {Object} recommendation - Recommendation object
   * @param {Object} patternData - Pattern data
   * @returns {boolean} Whether pattern was applied
   */
  applyPreferencePattern(recommendation, patternData) {
    const { preferredOption, consistency, context } = patternData;

    // If recommendation has candidates (multiple options), boost the preferred one
    if (recommendation.candidates && Array.isArray(recommendation.candidates)) {
      const preferred = recommendation.candidates.find(c =>
        c.id === preferredOption || c.name === preferredOption
      );

      if (preferred && preferred.explanation && preferred.explanation.factors) {
        // Boost skill match factor by 15% (scaled by consistency)
        const skillFactor = preferred.explanation.factors.find(f =>
          f.name === 'Skill Match' || f.name === 'Relevance' || f.name === 'Match'
        );

        if (skillFactor) {
          const boost = Math.round(15 * consistency);
          const originalScore = skillFactor.score;
          skillFactor.score = Math.min(100, skillFactor.score + boost);

          // Add learning metadata
          skillFactor.learningApplied = {
            pattern: 'preference',
            boost: boost,
            originalScore: originalScore,
            reason: `User historically prefers this option for ${context} tasks`
          };

          console.log(`[LearningEngine] Applied preference boost: +${boost}% to ${preferredOption}`);
          return true;
        }
      }

      // If preferred is not the top candidate, try to boost it to top
      if (preferred && recommendation.recommendation) {
        const currentTopId = recommendation.recommendation.id || recommendation.recommendation.name;
        if (currentTopId !== preferredOption) {
          // Calculate boost needed to make it top recommendation
          const preferredScore = preferred.score || 0;
          const topScore = recommendation.recommendation.score || 100;

          if (preferredScore >= topScore - 20) { // Only boost if reasonably close
            preferred.score = topScore + 5;
            recommendation.recommendation = preferred;
            console.log(`[LearningEngine] Boosted ${preferredOption} to top recommendation`);
            return true;
          }
        }
      }
    }

    // Simple recommendation (single option) - add metadata
    if (recommendation.id === preferredOption || recommendation.name === preferredOption) {
      recommendation._learningBoost = {
        type: 'preference',
        amount: Math.round(15 * consistency),
        reason: `Matches learned preference for ${context} tasks`
      };
      return true;
    }

    return false;
  }

  /**
   * Apply constraint pattern (exclude certain options)
   * @param {Object} recommendation - Recommendation object
   * @param {Object} patternData - Pattern data
   * @returns {boolean} Whether pattern was applied
   */
  applyConstraintPattern(recommendation, patternData) {
    const { excludedOptions, context } = patternData;

    if (!excludedOptions || excludedOptions.length === 0) {
      return false;
    }

    // If recommendation has candidates, filter out excluded options
    if (recommendation.candidates && Array.isArray(recommendation.candidates)) {
      const originalCount = recommendation.candidates.length;

      recommendation.candidates = recommendation.candidates.filter(c => {
        const id = c.id || c.name;
        return !excludedOptions.includes(id);
      });

      const filtered = originalCount - recommendation.candidates.length;
      if (filtered > 0) {
        console.log(`[LearningEngine] Applied constraint: filtered ${filtered} excluded options`);

        // If current top recommendation was excluded, pick new top
        if (recommendation.candidates.length > 0) {
          recommendation.recommendation = recommendation.candidates[0];
        }

        return true;
      }
    }

    return false;
  }

  /**
   * Apply boost pattern (increase/decrease factor scores)
   * @param {Object} recommendation - Recommendation object
   * @param {Object} patternData - Pattern data
   * @returns {boolean} Whether pattern was applied
   */
  applyBoostPattern(recommendation, patternData) {
    const { factor, boostAmount, direction, context } = patternData;

    // For priority agent, boost priority scoring
    if (factor === 'priority' && recommendation.value) {
      const priorityLevels = { low: 1, medium: 2, high: 3 };
      const currentLevel = priorityLevels[recommendation.value] || 2;

      // Apply boost direction
      let newLevel = currentLevel;
      if (direction === 'increase' && boostAmount > 20) {
        newLevel = Math.min(3, currentLevel + 1);
      } else if (direction === 'decrease' && boostAmount > 20) {
        newLevel = Math.max(1, currentLevel - 1);
      }

      if (newLevel !== currentLevel) {
        const levelNames = { 1: 'low', 2: 'medium', 3: 'high' };
        recommendation.value = levelNames[newLevel];
        recommendation._learningBoost = {
          type: 'boost',
          factor: 'priority',
          direction: direction,
          amount: boostAmount,
          reason: `Adjusted based on learned ${context} priority patterns`
        };

        console.log(`[LearningEngine] Applied priority boost: ${direction} (${boostAmount}%)`);
        return true;
      }
    }

    // For other agents with explanation factors
    if (recommendation.explanation && recommendation.explanation.factors) {
      const targetFactor = recommendation.explanation.factors.find(f =>
        f.name.toLowerCase().includes(factor.toLowerCase())
      );

      if (targetFactor) {
        const originalScore = targetFactor.score;
        const adjustment = direction === 'increase' ? boostAmount : -boostAmount;
        targetFactor.score = Math.min(100, Math.max(0, targetFactor.score + adjustment));

        targetFactor.learningApplied = {
          pattern: 'boost',
          adjustment: adjustment,
          originalScore: originalScore,
          reason: `${direction === 'increase' ? 'Increased' : 'Decreased'} based on learned patterns`
        };

        console.log(`[LearningEngine] Applied boost: ${adjustment}% to ${factor}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Check if pattern context matches current context
   * @param {string} patternContext - Pattern context keyword
   * @param {Object} currentContext - Current decision context
   * @returns {boolean} Whether contexts match
   */
  contextMatches(patternContext, currentContext) {
    if (!currentContext) return false;

    // Extract keywords from current context
    const keywords = this.extractContextKeywords(currentContext);

    // Check if pattern context matches any keyword
    return keywords.includes(patternContext);
  }

  /**
   * Extract keywords from context
   * @param {Object} context - Context object
   * @returns {Array} Array of keywords
   */
  extractContextKeywords(context) {
    const keywords = new Set();

    // Task-based keywords
    if (context.task) {
      const taskText = (context.task.title || '') + ' ' + (context.task.description || '');
      const taskKeywords = taskText.toLowerCase()
        .match(/\b(api|integration|crm|legal|frontend|backend|database|design|testing|security|review|meeting|proposal|contract)\b/g);
      if (taskKeywords) {
        taskKeywords.forEach(k => keywords.add(k));
      }

      if (context.task.type) {
        keywords.add(context.task.type.toLowerCase());
      }

      if (context.task.priority) {
        keywords.add(`priority_${context.task.priority}`);
      }
    }

    // Deal-based keywords
    if (context.deal) {
      if (context.deal.value > 50000) {
        keywords.add('high_value_deal');
      }
      if (context.deal.stage) {
        keywords.add(`deal_stage_${context.deal.stage.toLowerCase().replace(/\s+/g, '_')}`);
      }
      if (context.deal.accountType) {
        keywords.add(`account_${context.deal.accountType.toLowerCase()}`);
      }
    }

    // Meeting-based keywords
    if (context.meeting) {
      if (context.meeting.type) {
        keywords.add(`meeting_${context.meeting.type.toLowerCase()}`);
      }
    }

    // Generic fallback
    if (keywords.size === 0) {
      keywords.add('general');
    }

    return Array.from(keywords);
  }

  /**
   * Get learning summary for a recommendation
   * @param {Object} recommendation - Recommendation with learning applied
   * @returns {string} Human-readable learning summary
   */
  getLearningsum(recommendation) {
    if (!recommendation._learningMetadata || recommendation._learningMetadata.patternsApplied === 0) {
      return 'No learning patterns applied';
    }

    const { patternsApplied, patterns } = recommendation._learningMetadata;

    let summary = `Applied ${patternsApplied} learned pattern${patternsApplied > 1 ? 's' : ''}: `;
    summary += patterns.map(p => p.description).join('; ');

    return summary;
  }
}

module.exports = new LearningEngine();
