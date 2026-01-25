/**
 * Pattern Detection Service
 * Analyzes user overrides to detect learning patterns
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuid } = require('uuid');

class PatternDetectionService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Minimum overrides needed to detect a pattern
    this.MIN_OVERRIDES = 3;

    // Minimum consistency rate to create a pattern
    this.MIN_CONSISTENCY = 0.7; // 70%
  }

  /**
   * Detect patterns from user overrides
   * @param {string} userId - User ID
   * @param {string} agentType - Agent type
   * @returns {Array} Array of detected patterns
   */
  async detectPatterns(userId, agentType) {
    try {
      console.log(`[PatternDetection] Detecting patterns for user ${userId}, agent ${agentType}`);

      // Get recent overrides (last 90 days)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      const { data: overrides, error } = await this.supabase
        .from('agent_overrides')
        .select('*')
        .eq('user_id', userId)
        .eq('agent_type', agentType)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (!overrides || overrides.length < this.MIN_OVERRIDES) {
        console.log(`[PatternDetection] Not enough overrides (${overrides?.length || 0}) to detect patterns`);
        return [];
      }

      console.log(`[PatternDetection] Analyzing ${overrides.length} overrides`);

      // Group overrides by similar context
      const contextClusters = this.clusterByContext(overrides);
      console.log(`[PatternDetection] Found ${contextClusters.length} context clusters`);

      const detectedPatterns = [];

      for (const cluster of contextClusters) {
        if (cluster.overrides.length < this.MIN_OVERRIDES) {
          continue;
        }

        // Detect preference pattern (user always chooses same option)
        const preferencePattern = this.detectPreferencePattern(cluster, agentType);
        if (preferencePattern) {
          detectedPatterns.push(preferencePattern);
        }

        // Detect constraint pattern (user never chooses certain option)
        const constraintPattern = this.detectConstraintPattern(cluster, agentType);
        if (constraintPattern) {
          detectedPatterns.push(constraintPattern);
        }

        // Detect boost pattern (user consistently adjusts certain factors)
        const boostPattern = this.detectBoostPattern(cluster, agentType);
        if (boostPattern) {
          detectedPatterns.push(boostPattern);
        }
      }

      console.log(`[PatternDetection] Detected ${detectedPatterns.length} patterns`);

      // Store detected patterns
      for (const pattern of detectedPatterns) {
        await this.storePattern(userId, agentType, pattern);
      }

      return detectedPatterns;
    } catch (error) {
      console.error('[PatternDetection] detectPatterns error:', error);
      throw error;
    }
  }

  /**
   * Cluster overrides by context similarity
   * @param {Array} overrides - Array of override records
   * @returns {Array} Array of context clusters
   */
  clusterByContext(overrides) {
    const clusters = {};

    for (const override of overrides) {
      const context = override.context_snapshot;
      const keywords = this.extractContextKeywords(context);

      // Group by each keyword
      for (const keyword of keywords) {
        if (!clusters[keyword]) {
          clusters[keyword] = {
            keyword: keyword,
            overrides: []
          };
        }
        clusters[keyword].overrides.push(override);
      }
    }

    // Return clusters with at least MIN_OVERRIDES
    return Object.values(clusters).filter(c => c.overrides.length >= this.MIN_OVERRIDES);
  }

  /**
   * Extract keywords from context for clustering
   * @param {Object} context - Context snapshot
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

      // Task type
      if (context.task.type) {
        keywords.add(context.task.type.toLowerCase());
      }

      // Task priority
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

    // If no keywords extracted, use a generic one
    if (keywords.size === 0) {
      keywords.add('general');
    }

    return Array.from(keywords);
  }

  /**
   * Detect preference pattern (A > B in context C)
   * @param {Object} cluster - Context cluster
   * @param {string} agentType - Agent type
   * @returns {Object|null} Preference pattern or null
   */
  detectPreferencePattern(cluster, agentType) {
    const { keyword, overrides } = cluster;

    // Count user choices and original recommendations
    const choiceCounts = {};
    const originalCounts = {};

    for (const override of overrides) {
      const choice = this.getChoiceIdentifier(override.user_choice, agentType);
      const original = this.getChoiceIdentifier(override.original_recommendation, agentType);

      choiceCounts[choice] = (choiceCounts[choice] || 0) + 1;
      originalCounts[original] = (originalCounts[original] || 0) + 1;
    }

    // Find most common choice
    const topChoice = Object.keys(choiceCounts)
      .sort((a, b) => choiceCounts[b] - choiceCounts[a])[0];

    // Find most common original (what AI recommended)
    const topOriginal = Object.keys(originalCounts)
      .sort((a, b) => originalCounts[b] - originalCounts[a])[0];

    // Consistency rate (how often user makes the same choice)
    const consistency = choiceCounts[topChoice] / overrides.length;

    // Only create pattern if consistency is high enough
    if (consistency < this.MIN_CONSISTENCY) {
      return null;
    }

    // Don't create pattern if user is choosing what AI already recommended
    if (topChoice === topOriginal) {
      return null;
    }

    // Get user feedback reasons
    const feedbackReasons = overrides
      .filter(o => o.feedback_reason || o.feedback_text)
      .map(o => ({
        reason: o.feedback_reason,
        text: o.feedback_text
      }));

    // Get the most common feedback reason
    const reasonCounts = {};
    feedbackReasons.forEach(fr => {
      if (fr.reason) {
        reasonCounts[fr.reason] = (reasonCounts[fr.reason] || 0) + 1;
      }
    });
    const topReason = Object.keys(reasonCounts).length > 0
      ? Object.keys(reasonCounts).sort((a, b) => reasonCounts[b] - reasonCounts[a])[0]
      : null;

    // Get the most recent override date
    const mostRecentDate = new Date(Math.max(...overrides.map(o => new Date(o.created_at))));
    const daysSinceLastOverride = Math.floor((new Date() - mostRecentDate) / (1000 * 60 * 60 * 24));

    return {
      type: 'preference',
      context: keyword,
      preferredOption: topChoice,
      alternativeOption: topOriginal,
      consistency: consistency,
      sampleSize: overrides.length,
      feedbackReasons: feedbackReasons,
      topFeedbackReason: topReason,
      supportingOverrides: overrides.map(o => o.id),
      daysSinceLastOverride: daysSinceLastOverride,
      description: this.generatePatternDescription(agentType, keyword, topChoice, topOriginal)
    };
  }

  /**
   * Detect constraint pattern (never choose option X)
   * @param {Object} cluster - Context cluster
   * @param {string} agentType - Agent type
   * @returns {Object|null} Constraint pattern or null
   */
  detectConstraintPattern(cluster, agentType) {
    const { keyword, overrides } = cluster;

    // Count original recommendations that were ALWAYS overridden
    const originalCounts = {};
    const overriddenCounts = {};

    for (const override of overrides) {
      const original = this.getChoiceIdentifier(override.original_recommendation, agentType);
      originalCounts[original] = (originalCounts[original] || 0) + 1;
      overriddenCounts[original] = (overriddenCounts[original] || 0) + 1;
    }

    // Find options that were ALWAYS overridden (never accepted)
    const neverAccepted = Object.keys(originalCounts).filter(option => {
      const overriddenRate = overriddenCounts[option] / originalCounts[option];
      return overriddenRate >= 0.9 && originalCounts[option] >= 2; // At least 2 instances
    });

    if (neverAccepted.length === 0) {
      return null;
    }

    // Get the most recent override date
    const mostRecentDate = new Date(Math.max(...overrides.map(o => new Date(o.created_at))));
    const daysSinceLastOverride = Math.floor((new Date() - mostRecentDate) / (1000 * 60 * 60 * 24));

    return {
      type: 'constraint',
      context: keyword,
      excludedOptions: neverAccepted,
      sampleSize: overrides.length,
      supportingOverrides: overrides.map(o => o.id),
      daysSinceLastOverride: daysSinceLastOverride,
      description: `Avoid ${neverAccepted.join(', ')} for ${keyword} tasks`
    };
  }

  /**
   * Detect boost pattern (consistently boost certain factors)
   * @param {Object} cluster - Context cluster
   * @param {string} agentType - Agent type
   * @returns {Object|null} Boost pattern or null
   */
  detectBoostPattern(cluster, agentType) {
    const { keyword, overrides } = cluster;

    // For priority agent, detect if user consistently increases/decreases priority
    if (agentType === 'priority') {
      const priorityLevels = { low: 1, medium: 2, high: 3 };
      let totalIncrease = 0;
      let increaseCount = 0;

      for (const override of overrides) {
        const originalLevel = priorityLevels[override.original_recommendation.value] || 2;
        const userLevel = priorityLevels[override.user_choice.value] || 2;
        const diff = userLevel - originalLevel;

        if (diff !== 0) {
          totalIncrease += diff;
          increaseCount++;
        }
      }

      if (increaseCount >= this.MIN_OVERRIDES) {
        const avgBoost = totalIncrease / increaseCount;
        const consistency = increaseCount / overrides.length;

        if (Math.abs(avgBoost) >= 0.5 && consistency >= this.MIN_CONSISTENCY) {
          const mostRecentDate = new Date(Math.max(...overrides.map(o => new Date(o.created_at))));
          const daysSinceLastOverride = Math.floor((new Date() - mostRecentDate) / (1000 * 60 * 60 * 24));

          return {
            type: 'boost',
            context: keyword,
            factor: 'priority',
            boostAmount: avgBoost > 0 ? Math.round(avgBoost * 33) : Math.round(avgBoost * 33), // -33%, +33%, +66%
            direction: avgBoost > 0 ? 'increase' : 'decrease',
            consistency: consistency,
            sampleSize: overrides.length,
            supportingOverrides: overrides.map(o => o.id),
            daysSinceLastOverride: daysSinceLastOverride,
            description: `${avgBoost > 0 ? 'Increase' : 'Decrease'} priority by ${Math.abs(Math.round(avgBoost * 33))}% for ${keyword} tasks`
          };
        }
      }
    }

    return null;
  }

  /**
   * Get choice identifier from choice object
   * @param {Object} choice - Choice object
   * @param {string} agentType - Agent type
   * @returns {string} Choice identifier
   */
  getChoiceIdentifier(choice, agentType) {
    if (!choice) return 'unknown';

    switch (agentType) {
      case 'assignment':
        return choice.id || choice.name || 'unknown';
      case 'priority':
        return choice.value || 'unknown';
      case 'deadline':
        return choice.date || 'unknown';
      case 'followup':
        return choice.action || choice.id || 'unknown';
      default:
        return JSON.stringify(choice);
    }
  }

  /**
   * Generate human-readable pattern description
   * @param {string} agentType - Agent type
   * @param {string} context - Context keyword
   * @param {string} preferred - Preferred option
   * @param {string} alternative - Alternative option
   * @returns {string} Pattern description
   */
  generatePatternDescription(agentType, context, preferred, alternative) {
    switch (agentType) {
      case 'assignment':
        return `Assign ${context} tasks to ${preferred} instead of ${alternative}`;
      case 'priority':
        return `Set ${context} tasks to ${preferred} priority instead of ${alternative}`;
      case 'deadline':
        return `Set ${context} deadlines to ${preferred} instead of ${alternative}`;
      case 'followup':
        return `Use ${preferred} for ${context} follow-ups instead of ${alternative}`;
      default:
        return `Prefer ${preferred} over ${alternative} for ${context}`;
    }
  }

  /**
   * Calculate pattern confidence score
   * @param {Object} pattern - Pattern object
   * @returns {number} Confidence score (0-100)
   */
  calculateConfidence(pattern) {
    const {
      sampleSize,
      consistency,
      daysSinceLastOverride
    } = pattern;

    // Base confidence from sample size (more samples = higher confidence)
    let confidence = Math.min(100, (sampleSize / 5) * 100);

    // Boost for high consistency
    if (consistency) {
      confidence *= consistency;
    }

    // Reduce if pattern is old
    if (daysSinceLastOverride > 30) {
      confidence *= 0.8;
    } else if (daysSinceLastOverride > 60) {
      confidence *= 0.6;
    }

    // Boost if has feedback reasons
    if (pattern.feedbackReasons && pattern.feedbackReasons.length > 0) {
      confidence *= 1.1;
    }

    return Math.min(100, Math.round(confidence));
  }

  /**
   * Store detected pattern in database
   * @param {string} userId - User ID
   * @param {string} agentType - Agent type
   * @param {Object} pattern - Pattern object
   */
  async storePattern(userId, agentType, pattern) {
    try {
      const confidence = this.calculateConfidence(pattern);

      // Check if similar pattern already exists
      const { data: existingPatterns } = await this.supabase
        .from('learning_patterns')
        .select('*')
        .eq('user_id', userId)
        .eq('agent_type', agentType)
        .eq('pattern_type', pattern.type)
        .in('status', ['pending_approval', 'active']);

      // Check for duplicates
      const isDuplicate = existingPatterns?.some(existing => {
        const existingData = existing.pattern_data;
        return existingData.context === pattern.context &&
               existingData.preferredOption === pattern.preferredOption;
      });

      if (isDuplicate) {
        console.log(`[PatternDetection] Pattern already exists, skipping`);
        return null;
      }

      const { data, error } = await this.supabase
        .from('learning_patterns')
        .insert({
          id: uuid(),
          user_id: userId,
          agent_type: agentType,
          pattern_type: pattern.type,
          pattern_data: pattern,
          confidence: confidence,
          status: 'pending_approval',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('[PatternDetection] Error storing pattern:', error);
        throw error;
      }

      console.log(`[PatternDetection] Pattern stored: ${pattern.description} (confidence: ${confidence}%)`);

      return data;
    } catch (error) {
      console.error('[PatternDetection] storePattern error:', error);
      throw error;
    }
  }

  /**
   * Get pending patterns for user
   * @param {string} userId - User ID
   * @returns {Array} Array of pending patterns
   */
  async getPendingPatterns(userId) {
    try {
      const { data, error } = await this.supabase
        .from('learning_patterns')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending_approval')
        .order('confidence', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('[PatternDetection] getPendingPatterns error:', error);
      throw error;
    }
  }
}

module.exports = new PatternDetectionService();
