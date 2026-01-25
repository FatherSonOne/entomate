/**
 * Deal Risk Service
 * Calculates AI-powered risk scores for deals using multiple factors
 * Part of Enhanced Intelligence Dashboard
 */

const { supabase, supabaseAdmin } = require('../../config/supabase');

class DealRiskService {
  constructor() {
    this.hubClient = null;
    this.initializeHub();
  }

  /**
   * Initialize shared-hub client if available
   */
  initializeHub() {
    try {
      const hubUrl = process.env.HUB_SUPABASE_URL;
      const hubKey = process.env.HUB_SUPABASE_SERVICE_KEY || process.env.HUB_SUPABASE_ANON_KEY;

      if (hubUrl && hubKey) {
        const { createClient } = require('@supabase/supabase-js');
        this.hubClient = createClient(hubUrl, hubKey);
        console.log('[DealRiskService] Shared Hub client initialized');
      }
    } catch (error) {
      console.warn('[DealRiskService] Hub initialization failed:', error.message);
    }
  }

  /**
   * Get at-risk deals for a user
   * @param {string} userId - User ID
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Array of deal risk alerts
   */
  async getAtRiskDeals(userId, options = {}) {
    const { riskLevel = ['medium', 'high', 'critical'], limit = 10 } = options;

    try {
      // Get cached risk scores from database
      const { data: cachedScores, error } = await supabaseAdmin
        .from('deal_risk_scores')
        .select('*')
        .eq('user_id', userId)
        .in('risk_level', riskLevel)
        .order('score', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[DealRiskService] Error fetching cached scores:', error);
      }

      // If we have fresh cached scores (< 4 hours old), use them
      if (cachedScores && cachedScores.length > 0) {
        const fourHoursAgo = new Date();
        fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);

        const freshScores = cachedScores.filter(
          score => new Date(score.calculated_at) > fourHoursAgo
        );

        if (freshScores.length > 0) {
          console.log('[DealRiskService] Using cached risk scores');
          return freshScores.map(score => this.formatRiskAlert(score));
        }
      }

      // Otherwise, calculate fresh scores
      console.log('[DealRiskService] Calculating fresh risk scores');
      return await this.calculateAndCacheRiskScores(userId, options);
    } catch (error) {
      console.error('[DealRiskService] getAtRiskDeals error:', error);
      return [];
    }
  }

  /**
   * Calculate risk scores for all user's deals and cache them
   */
  async calculateAndCacheRiskScores(userId, options = {}) {
    try {
      // Get all deals for this user from shared hub or local projects
      const deals = await this.getUserDeals(userId);

      if (deals.length === 0) {
        return [];
      }

      // Calculate risk score for each deal
      const riskScores = await Promise.all(
        deals.map(deal => this.calculateRiskScore(deal, userId))
      );

      // Filter out nulls and filter by requested risk levels
      const validScores = riskScores.filter(Boolean);
      const { riskLevel = ['medium', 'high', 'critical'] } = options;
      const filteredScores = validScores.filter(score =>
        riskLevel.includes(score.risk_level)
      );

      // Cache in database using service role
      await this.cacheRiskScores(filteredScores);

      return filteredScores.map(score => this.formatRiskAlert(score));
    } catch (error) {
      console.error('[DealRiskService] calculateAndCacheRiskScores error:', error);
      return [];
    }
  }

  /**
   * Get user's deals from shared hub or projects
   */
  async getUserDeals(userId) {
    const deals = [];

    try {
      // Try to get deals from shared hub first
      if (this.hubClient) {
        const { data: hubDeals } = await this.hubClient
          .from('cross_app_events')
          .select('payload')
          .eq('source_app', 'logos_crm')
          .eq('event_category', 'deal')
          .order('created_at', { ascending: false })
          .limit(100);

        if (hubDeals && hubDeals.length > 0) {
          // Extract unique deals
          const dealMap = new Map();
          hubDeals.forEach(event => {
            const deal = event.payload?.deal;
            if (deal && deal.id) {
              dealMap.set(deal.id, deal);
            }
          });

          deals.push(...Array.from(dealMap.values()));
        }
      }

      // Also get local projects with CRM deal IDs
      const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', userId)
        .not('crm_deal_id', 'is', null)
        .limit(50);

      if (projects && projects.length > 0) {
        projects.forEach(project => {
          deals.push({
            id: project.crm_deal_id,
            name: project.name,
            value: project.deal_value,
            stage: project.status,
            projectId: project.id
          });
        });
      }

      return deals;
    } catch (error) {
      console.error('[DealRiskService] getUserDeals error:', error);
      return [];
    }
  }

  /**
   * Calculate comprehensive risk score for a deal
   * Uses weighted algorithm with 4 factors
   */
  async calculateRiskScore(deal, userId) {
    try {
      // Fetch all data needed for risk calculation
      const [
        engagementData,
        sentimentData,
        actionItemData,
        stakeholderData
      ] = await Promise.all([
        this.getEngagementData(deal),
        this.getSentimentData(deal),
        this.getActionItemData(deal),
        this.getStakeholderData(deal)
      ]);

      // Calculate each risk factor (0-100 scale, lower = higher risk)
      const factors = {
        engagementVelocity: {
          weight: 0.35,
          score: this.calculateEngagementScore(engagementData),
          impact: null,
          detail: `Meeting frequency: ${engagementData.meetingFrequency}/month`
        },
        sentimentTrend: {
          weight: 0.25,
          score: this.calculateSentimentScore(sentimentData),
          impact: null,
          detail: `Trend: ${sentimentData.trend || 'unknown'}`
        },
        actionItemHealth: {
          weight: 0.20,
          score: this.calculateActionItemScore(actionItemData),
          impact: null,
          detail: `Completion rate: ${actionItemData.completionRate}%`
        },
        stakeholderHealth: {
          weight: 0.20,
          score: this.calculateStakeholderScore(stakeholderData),
          impact: null,
          detail: `Coverage: ${stakeholderData.coverageLevel || 'unknown'}`
        }
      };

      // Calculate weighted total score (0-100, lower = higher risk)
      let totalScore = 0;
      Object.values(factors).forEach(factor => {
        totalScore += factor.score * factor.weight;

        // Determine impact level
        if (factor.score <= 30) factor.impact = 'high';
        else if (factor.score <= 60) factor.impact = 'medium';
        else factor.impact = 'low';
      });

      totalScore = Math.round(totalScore);

      // Determine risk level (inverse of score)
      const riskLevel = this.determineRiskLevel(totalScore);

      // Generate predictions
      const predictions = this.generatePredictions(totalScore, factors, deal);

      // Generate recommended actions
      const recommendedActions = this.generateRecommendedActions(factors, deal);

      return {
        deal_id: deal.id,
        user_id: userId,
        score: totalScore,
        risk_level: riskLevel,
        factors: factors,
        predictions: predictions,
        recommended_actions: recommendedActions,
        deal: {
          id: deal.id,
          name: deal.name || 'Unknown Deal',
          value: deal.value || 0,
          stage: deal.stage || 'Unknown',
          expectedCloseDate: deal.expectedCloseDate || null,
          owner: userId
        },
        calculated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('[DealRiskService] calculateRiskScore error:', error);
      return null;
    }
  }

  /**
   * Get engagement data for a deal (meetings, emails, calls)
   */
  async getEngagementData(deal) {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get meetings related to this deal
      const { data: meetings } = await supabase
        .from('meetings')
        .select('id, created_at')
        .eq('crm_deal_id', deal.id)
        .gte('created_at', thirtyDaysAgo.toISOString());

      const meetingCount = meetings?.length || 0;
      const meetingFrequency = meetingCount; // per month

      // Calculate historical average (last 90 days for comparison)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: historicalMeetings } = await supabase
        .from('meetings')
        .select('id')
        .eq('crm_deal_id', deal.id)
        .gte('created_at', ninetyDaysAgo.toISOString())
        .lt('created_at', thirtyDaysAgo.toISOString());

      const historicalCount = historicalMeetings?.length || 0;
      const historicalAvg = historicalCount / 2; // 2 months

      return {
        meetingFrequency,
        historicalAvg,
        dropPercentage: historicalAvg > 0
          ? ((historicalAvg - meetingFrequency) / historicalAvg) * 100
          : 0
      };
    } catch (error) {
      console.error('[DealRiskService] getEngagementData error:', error);
      return { meetingFrequency: 0, historicalAvg: 0, dropPercentage: 0 };
    }
  }

  /**
   * Get sentiment data from recent meetings
   */
  async getSentimentData(deal) {
    try {
      const { data: meetings } = await supabase
        .from('meetings')
        .select('sentiment_label, sentiment_score, created_at')
        .eq('crm_deal_id', deal.id)
        .not('sentiment_label', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!meetings || meetings.length === 0) {
        return { trend: 'unknown', currentScore: 50, scores: [] };
      }

      const scores = meetings.map(m => ({
        score: Math.round((m.sentiment_score || 0.5) * 100),
        date: m.created_at
      }));

      // Determine trend
      let trend = 'stable';
      if (scores.length >= 2) {
        const recentAvg = (scores[0].score + scores[1].score) / 2;
        const olderAvg = scores.slice(2).reduce((sum, s) => sum + s.score, 0) / Math.max(scores.length - 2, 1);

        if (recentAvg > olderAvg + 10) trend = 'improving';
        else if (recentAvg < olderAvg - 10) trend = 'declining';
      }

      return {
        trend,
        currentScore: scores[0]?.score || 50,
        scores
      };
    } catch (error) {
      console.error('[DealRiskService] getSentimentData error:', error);
      return { trend: 'unknown', currentScore: 50, scores: [] };
    }
  }

  /**
   * Get action item data for a deal
   */
  async getActionItemData(deal) {
    try {
      // Get action items from meetings related to this deal
      const { data: meetings } = await supabase
        .from('meetings')
        .select('id')
        .eq('crm_deal_id', deal.id);

      if (!meetings || meetings.length === 0) {
        return { total: 0, completed: 0, overdue: 0, completionRate: 100 };
      }

      const meetingIds = meetings.map(m => m.id);

      const { data: actionItems } = await supabase
        .from('action_items')
        .select('id, status, due_date')
        .in('meeting_id', meetingIds);

      if (!actionItems || actionItems.length === 0) {
        return { total: 0, completed: 0, overdue: 0, completionRate: 100 };
      }

      const total = actionItems.length;
      const completed = actionItems.filter(item =>
        ['done', 'complete', 'completed'].includes(item.status?.toLowerCase())
      ).length;

      const now = new Date();
      const overdue = actionItems.filter(item =>
        item.due_date &&
        new Date(item.due_date) < now &&
        !['done', 'complete', 'completed'].includes(item.status?.toLowerCase())
      ).length;

      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 100;

      return { total, completed, overdue, completionRate };
    } catch (error) {
      console.error('[DealRiskService] getActionItemData error:', error);
      return { total: 0, completed: 0, overdue: 0, completionRate: 100 };
    }
  }

  /**
   * Get stakeholder data for a deal
   */
  async getStakeholderData(deal) {
    try {
      // Get meeting participants from deal meetings
      const { data: meetings } = await supabase
        .from('meetings')
        .select('participants')
        .eq('crm_deal_id', deal.id);

      if (!meetings || meetings.length === 0) {
        return { uniqueStakeholders: 0, coverageLevel: 'low' };
      }

      // Extract unique stakeholders
      const stakeholders = new Set();
      meetings.forEach(meeting => {
        (meeting.participants || []).forEach(p => {
          if (p.email) stakeholders.add(p.email);
        });
      });

      const uniqueCount = stakeholders.size;
      let coverageLevel = 'low';

      if (uniqueCount >= 4) coverageLevel = 'high';
      else if (uniqueCount >= 2) coverageLevel = 'medium';

      return {
        uniqueStakeholders: uniqueCount,
        coverageLevel
      };
    } catch (error) {
      console.error('[DealRiskService] getStakeholderData error:', error);
      return { uniqueStakeholders: 0, coverageLevel: 'low' };
    }
  }

  /**
   * Calculate engagement velocity score (0-100, higher is better)
   */
  calculateEngagementScore(data) {
    const { meetingFrequency, historicalAvg, dropPercentage } = data;

    // Score based on frequency (4+ meetings/month = 100, 0 = 0)
    let score = Math.min((meetingFrequency / 4) * 100, 100);

    // Penalize for drop in frequency
    if (dropPercentage > 50) score *= 0.5;
    else if (dropPercentage > 25) score *= 0.75;

    return Math.round(score);
  }

  /**
   * Calculate sentiment trend score (0-100, higher is better)
   */
  calculateSentimentScore(data) {
    const { trend, currentScore } = data;

    let score = currentScore;

    // Adjust based on trend
    if (trend === 'declining') score *= 0.7;
    else if (trend === 'improving') score = Math.min(score * 1.2, 100);

    return Math.round(score);
  }

  /**
   * Calculate action item health score (0-100, higher is better)
   */
  calculateActionItemScore(data) {
    const { completionRate, overdue, total } = data;

    let score = completionRate;

    // Penalize for overdue items
    if (total > 0) {
      const overduePercentage = (overdue / total) * 100;
      if (overduePercentage > 30) score *= 0.6;
      else if (overduePercentage > 15) score *= 0.8;
    }

    return Math.round(score);
  }

  /**
   * Calculate stakeholder health score (0-100, higher is better)
   */
  calculateStakeholderScore(data) {
    const { coverageLevel, uniqueStakeholders } = data;

    if (coverageLevel === 'high') return 90;
    if (coverageLevel === 'medium') return 60;
    return 30;
  }

  /**
   * Determine risk level from total score
   */
  determineRiskLevel(score) {
    if (score >= 75) return 'low';
    if (score >= 50) return 'medium';
    if (score >= 25) return 'high';
    return 'critical';
  }

  /**
   * Generate predictions based on risk score
   */
  generatePredictions(score, factors, deal) {
    // Simple prediction model (can be enhanced with ML)
    const churnRisk = Math.max(0, Math.min(1, (100 - score) / 100));
    const closeProbability = Math.max(0, Math.min(1, score / 100));

    // Estimate close date based on current velocity
    let expectedCloseDate = deal.expectedCloseDate;
    if (!expectedCloseDate) {
      const daysToAdd = score >= 75 ? 30 : score >= 50 ? 60 : 90;
      const closeDate = new Date();
      closeDate.setDate(closeDate.getDate() + daysToAdd);
      expectedCloseDate = closeDate.toISOString().split('T')[0];
    }

    // Confidence based on data availability
    const confidence = Math.min(
      0.9,
      0.5 + (factors.engagementVelocity.score / 100) * 0.4
    );

    return {
      churnRisk: Math.round(churnRisk * 100) / 100,
      closeProbability: Math.round(closeProbability * 100) / 100,
      expectedCloseDate,
      confidence: Math.round(confidence * 100) / 100
    };
  }

  /**
   * Generate recommended actions based on risk factors
   */
  generateRecommendedActions(factors, deal) {
    const actions = [];

    // Engagement velocity recommendations
    if (factors.engagementVelocity.score < 50) {
      actions.push({
        action: 'Schedule check-in call this week',
        priority: 'high',
        effort: 'low',
        reason: 'Low meeting frequency detected'
      });
    }

    // Sentiment recommendations
    if (factors.sentimentTrend.score < 60) {
      actions.push({
        action: 'Address specific concerns from last meeting',
        priority: 'high',
        effort: 'medium',
        reason: 'Sentiment declining or negative'
      });
    }

    // Action item recommendations
    if (factors.actionItemHealth.score < 70) {
      actions.push({
        action: 'Follow up on overdue action items',
        priority: 'medium',
        effort: 'low',
        reason: 'Multiple overdue items'
      });
    }

    // Stakeholder recommendations
    if (factors.stakeholderHealth.score < 60) {
      actions.push({
        action: 'Engage additional stakeholders',
        priority: 'medium',
        effort: 'medium',
        reason: 'Limited stakeholder coverage'
      });
    }

    // Generic recovery action for high risk
    const totalScore = Object.values(factors).reduce(
      (sum, f) => sum + f.score * f.weight,
      0
    );

    if (totalScore < 40) {
      actions.push({
        action: 'Create comprehensive recovery plan',
        priority: 'critical',
        effort: 'high',
        reason: 'Deal at critical risk'
      });
    }

    return actions.slice(0, 5); // Top 5 actions
  }

  /**
   * Cache risk scores in database
   */
  async cacheRiskScores(riskScores) {
    if (!supabaseAdmin) {
      console.warn('[DealRiskService] No admin client for caching');
      return;
    }

    try {
      // Use upsert to update existing or insert new
      for (const score of riskScores) {
        const { error } = await supabaseAdmin
          .from('deal_risk_scores')
          .upsert({
            deal_id: score.deal_id,
            user_id: score.user_id,
            score: score.score,
            risk_level: score.risk_level,
            factors: score.factors,
            predictions: score.predictions,
            recommended_actions: score.recommended_actions,
            calculated_at: score.calculated_at
          }, {
            onConflict: 'deal_id,user_id'
          });

        if (error) {
          console.error('[DealRiskService] Cache error:', error);
        }
      }

      console.log(`[DealRiskService] Cached ${riskScores.length} risk scores`);
    } catch (error) {
      console.error('[DealRiskService] cacheRiskScores error:', error);
    }
  }

  /**
   * Format risk score for API response
   */
  formatRiskAlert(scoreData) {
    return {
      deal: scoreData.deal || {
        id: scoreData.deal_id,
        name: 'Unknown Deal',
        value: 0,
        stage: 'Unknown'
      },
      riskScore: {
        score: scoreData.score,
        level: scoreData.risk_level,
        trend: 'stable' // Can be enhanced with historical comparison
      },
      riskFactors: Object.entries(scoreData.factors || {}).map(([key, factor]) => ({
        factor: this.formatFactorName(key),
        weight: factor.weight,
        score: factor.score,
        impact: factor.impact,
        detail: factor.detail
      })),
      predictions: scoreData.predictions,
      recommendedActions: scoreData.recommended_actions || [],
      lastUpdated: scoreData.calculated_at
    };
  }

  /**
   * Format factor name for display
   */
  formatFactorName(key) {
    const names = {
      engagementVelocity: 'Engagement Velocity',
      sentimentTrend: 'Sentiment Trend',
      actionItemHealth: 'Action Item Health',
      stakeholderHealth: 'Stakeholder Coverage'
    };
    return names[key] || key;
  }
}

module.exports = new DealRiskService();
