/**
 * Relationship Intelligence Service
 * AI-powered stakeholder classification and relationship intelligence
 * Part of Enhanced Intelligence Dashboard
 */

const { supabase, supabaseAdmin } = require('../../config/supabase');
const log = require('../../utils/log');

class RelationshipIntelligenceService {
  constructor() {
    // Define required personas for coverage analysis
    this.requiredPersonas = [
      { role: 'executive_sponsor', importance: 'critical' },
      { role: 'economic_buyer', importance: 'critical' },
      { role: 'champion', importance: 'high' },
      { role: 'technical_champion', importance: 'high' },
      { role: 'end_user', importance: 'medium' }
    ];
  }

  /**
   * Get relationship intelligence for a deal
   * @param {string} dealId - Deal ID (from CRM)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Relationship intelligence
   */
  async getRelationshipInsights(dealId, userId) {
    try {
      // Get stakeholders from meetings related to this deal
      const stakeholders = await this.getStakeholders(dealId);

      if (stakeholders.length === 0) {
        return this.getEmptyInsights(dealId);
      }

      // Classify each stakeholder and calculate scores
      const classifiedStakeholders = await Promise.all(
        stakeholders.map(s => this.classifyStakeholder(s, dealId))
      );

      // Calculate coverage gaps
      const coverage = this.analyzeCoverage(classifiedStakeholders);

      // Detect new champions
      const newChampions = this.detectNewChampions(classifiedStakeholders);

      // Detect at-risk champions
      const atRiskChampions = this.detectAtRiskChampions(classifiedStakeholders);

      // Generate recommendations
      const recommendations = this.generateRecommendations(coverage, classifiedStakeholders);

      return {
        deal: {
          id: dealId
        },
        stakeholders: classifiedStakeholders,
        coverage,
        insights: {
          newChampions,
          atRiskChampions,
          recommendations
        }
      };
    } catch (error) {
      log.error('[RelationshipIntelligenceService] getRelationshipInsights error:', { error: error.message || error });
      return this.getEmptyInsights(dealId);
    }
  }

  /**
   * Get all stakeholders for a deal
   */
  async getStakeholders(dealId) {
    try {
      // Get meetings for this deal
      const { data: meetings } = await supabase
        .from('meetings')
        .select('id, participants, created_at, sentiment_label, sentiment_score, summary')
        .eq('crm_deal_id', dealId)
        .order('created_at', { ascending: false });

      if (!meetings || meetings.length === 0) {
        return [];
      }

      // Extract unique stakeholders from meeting participants
      const stakeholderMap = new Map();

      meetings.forEach(meeting => {
        const participants = meeting.participants || [];

        participants.forEach(participant => {
          if (!participant.email) return;

          if (!stakeholderMap.has(participant.email)) {
            stakeholderMap.set(participant.email, {
              email: participant.email,
              name: participant.name,
              title: participant.title,
              company: participant.company,
              meetingIds: [],
              lastContactDate: meeting.created_at,
              meetingCount: 0,
              mentions: 0
            });
          }

          const stakeholder = stakeholderMap.get(participant.email);
          stakeholder.meetingIds.push(meeting.id);
          stakeholder.meetingCount++;

          // Count mentions in summary
          if (meeting.summary) {
            const nameMatches = (meeting.summary.match(new RegExp(participant.name, 'gi')) || []).length;
            stakeholder.mentions += nameMatches;
          }

          // Update last contact date
          if (new Date(meeting.created_at) > new Date(stakeholder.lastContactDate)) {
            stakeholder.lastContactDate = meeting.created_at;
          }
        });
      });

      return Array.from(stakeholderMap.values());
    } catch (error) {
      log.error('[RelationshipIntelligenceService] getStakeholders error:', { error: error.message || error });
      return [];
    }
  }

  /**
   * Classify stakeholder role using AI-powered analysis
   */
  async classifyStakeholder(stakeholder, dealId) {
    try {
      // Get stakeholder's meetings
      const { data: meetings } = await supabase
        .from('meetings')
        .select('*')
        .eq('crm_deal_id', dealId)
        .in('id', stakeholder.meetingIds);

      // Calculate engagement metrics
      const engagementMetrics = {
        meetingCount: stakeholder.meetingCount,
        lastContactDate: stakeholder.lastContactDate,
        daysSinceLastContact: Math.floor(
          (new Date() - new Date(stakeholder.lastContactDate)) / (1000 * 60 * 60 * 24)
        ),
        mentionFrequency: stakeholder.mentions
      };

      // Classify role
      const role = this.classifyRole(stakeholder, meetings);

      // Calculate influence score
      const influenceScore = this.calculateInfluenceScore(stakeholder, meetings, role);

      // Calculate relationship strength
      const relationshipStrength = this.calculateRelationshipStrength(engagementMetrics);

      // Calculate sentiment score
      const sentimentScore = this.calculateSentimentScore(meetings);

      // Detect influence network
      const influences = this.detectInfluenceNetwork(stakeholder, meetings);

      return {
        id: `${dealId}_${stakeholder.email}`, // Synthetic ID
        stakeholder_id: stakeholder.email, // Using email as ID
        name: stakeholder.name,
        title: stakeholder.title,
        company: stakeholder.company,
        email: stakeholder.email,
        role,
        influenceScore,
        relationshipStrength: {
          score: relationshipStrength,
          trend: this.calculateRelationshipTrend(engagementMetrics)
        },
        engagement: engagementMetrics,
        sentiment: {
          current: sentimentScore > 70 ? 'positive' : sentimentScore > 40 ? 'neutral' : 'negative',
          score: sentimentScore,
          trend: 'stable' // Can be enhanced with historical data
        },
        influences
      };
    } catch (error) {
      log.error('[RelationshipIntelligenceService] classifyStakeholder error:', { error: error.message || error });
      return null;
    }
  }

  /**
   * Classify stakeholder role based on signals
   */
  classifyRole(stakeholder, meetings) {
    const signals = {
      mentionFrequency: stakeholder.mentions,
      meetingParticipation: stakeholder.meetingCount,
      title: stakeholder.title?.toLowerCase() || '',
      advocacy: this.detectAdvocacy(stakeholder, meetings),
      decisionMaking: this.detectDecisionMaking(stakeholder, meetings),
      budgetAuthority: this.detectBudgetAuthority(stakeholder, meetings)
    };

    // Champion: High mentions, positive sentiment, advocates for solution
    if (signals.advocacy > 0.7 && signals.mentionFrequency > 5) {
      return 'champion';
    }

    // Economic Buyer: Budget approval signals
    if (signals.budgetAuthority || ['cfo', 'cio', 'ceo', 'president'].some(role => signals.title.includes(role))) {
      return 'economic_buyer';
    }

    // Influencer: Participates often, influences decisions
    if (signals.decisionMaking > 0.6 && signals.mentionFrequency > 3) {
      return 'influencer';
    }

    // Blocker: Negative sentiment, decision-making power (enhanced with sentiment analysis)
    // For now, we don't automatically classify blockers without more context

    return 'unknown';
  }

  /**
   * Detect advocacy signals in meetings
   */
  detectAdvocacy(stakeholder, meetings) {
    // Simple keyword detection - can be enhanced with NLP
    const advocacyKeywords = ['recommend', 'support', 'advocate', 'endorse', 'champion'];
    let advocacyCount = 0;

    meetings.forEach(meeting => {
      const summary = (meeting.summary || '').toLowerCase();

      advocacyKeywords.forEach(keyword => {
        if (summary.includes(keyword) && summary.includes(stakeholder.name?.toLowerCase())) {
          advocacyCount++;
        }
      });
    });

    return Math.min(advocacyCount / 3, 1); // Normalize to 0-1
  }

  /**
   * Detect decision-making signals
   */
  detectDecisionMaking(stakeholder, meetings) {
    const decisionKeywords = ['decide', 'approve', 'authorize', 'sign off', 'final say'];
    let decisionCount = 0;

    meetings.forEach(meeting => {
      const summary = (meeting.summary || '').toLowerCase();

      decisionKeywords.forEach(keyword => {
        if (summary.includes(keyword) && summary.includes(stakeholder.name?.toLowerCase())) {
          decisionCount++;
        }
      });
    });

    return Math.min(decisionCount / 2, 1); // Normalize to 0-1
  }

  /**
   * Detect budget authority signals
   */
  detectBudgetAuthority(stakeholder, meetings) {
    const budgetKeywords = ['budget', 'pricing', 'cost', 'investment', 'roi'];
    let budgetMentions = 0;

    meetings.forEach(meeting => {
      const summary = (meeting.summary || '').toLowerCase();

      budgetKeywords.forEach(keyword => {
        if (summary.includes(keyword) && summary.includes(stakeholder.name?.toLowerCase())) {
          budgetMentions++;
        }
      });
    });

    return budgetMentions >= 2; // Boolean
  }

  /**
   * Calculate influence score (0-100)
   */
  calculateInfluenceScore(stakeholder, meetings, role) {
    const factors = {
      title: this.getTitleScore(stakeholder.title),
      decisionMaking: this.detectDecisionMaking(stakeholder, meetings) * 100,
      networkSize: Math.min(stakeholder.meetingCount * 10, 100),
      mentionFrequency: Math.min(stakeholder.mentions * 10, 100)
    };

    // Weighted average
    const score = (
      factors.title * 0.3 +
      factors.decisionMaking * 0.4 +
      factors.networkSize * 0.2 +
      factors.mentionFrequency * 0.1
    );

    return Math.round(score);
  }

  /**
   * Get title-based score
   */
  getTitleScore(title) {
    if (!title) return 50;

    const titleLower = title.toLowerCase();

    if (['ceo', 'president', 'owner'].some(role => titleLower.includes(role))) return 100;
    if (['cto', 'cfo', 'cio', 'coo'].some(role => titleLower.includes(role))) return 95;
    if (titleLower.includes('vp') || titleLower.includes('vice president')) return 80;
    if (titleLower.includes('director')) return 70;
    if (titleLower.includes('manager')) return 60;
    if (titleLower.includes('lead') || titleLower.includes('senior')) return 50;

    return 40;
  }

  /**
   * Calculate relationship strength (0-100)
   */
  calculateRelationshipStrength(engagementMetrics) {
    const { meetingCount, daysSinceLastContact, mentionFrequency } = engagementMetrics;

    let score = 50; // Base score

    // Boost for meeting frequency
    score += Math.min(meetingCount * 5, 30);

    // Boost for mentions
    score += Math.min(mentionFrequency * 3, 20);

    // Penalty for recency
    if (daysSinceLastContact > 30) score -= 30;
    else if (daysSinceLastContact > 14) score -= 15;
    else if (daysSinceLastContact > 7) score -= 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Calculate sentiment score from meetings
   */
  calculateSentimentScore(meetings) {
    const sentimentScores = meetings
      .filter(m => m.sentiment_score !== null)
      .map(m => m.sentiment_score * 100);

    if (sentimentScores.length === 0) return 50;

    const avg = sentimentScores.reduce((sum, score) => sum + score, 0) / sentimentScores.length;
    return Math.round(avg);
  }

  /**
   * Calculate relationship trend
   */
  calculateRelationshipTrend(engagementMetrics) {
    const { daysSinceLastContact } = engagementMetrics;

    if (daysSinceLastContact <= 7) return 'growing';
    if (daysSinceLastContact <= 21) return 'stable';
    return 'declining';
  }

  /**
   * Detect influence network
   */
  detectInfluenceNetwork(stakeholder, meetings) {
    // Simplified - in production, analyze meeting transcripts for influence patterns
    // For now, return empty array
    return [];
  }

  /**
   * Analyze coverage (persona mapping)
   */
  analyzeCoverage(stakeholders) {
    const hasChampion = stakeholders.some(s => s.role === 'champion');
    const hasEconomicBuyer = stakeholders.some(s => s.role === 'economic_buyer');
    const multiThreaded = stakeholders.length >= 3;

    // Calculate coverage score (0-100)
    let coverageScore = 0;
    if (hasChampion) coverageScore += 40;
    if (hasEconomicBuyer) coverageScore += 40;
    if (multiThreaded) coverageScore += 20;

    // Identify gaps
    const gaps = [];

    if (!hasEconomicBuyer) {
      gaps.push({
        missingPersona: 'Economic Buyer / CFO',
        importance: 'critical',
        risk: 'Budget approval may be delayed or denied',
        recommendation: 'Request introduction from current champion'
      });
    }

    if (!hasChampion) {
      gaps.push({
        missingPersona: 'Internal Champion',
        importance: 'critical',
        risk: 'No internal advocate to drive decision',
        recommendation: 'Identify and build relationship with potential champion'
      });
    }

    if (!multiThreaded) {
      gaps.push({
        missingPersona: 'Additional Stakeholders',
        importance: 'high',
        risk: 'Single point of failure if champion leaves',
        recommendation: 'Expand relationship network across organization'
      });
    }

    return {
      hasChampion,
      hasEconomicBuyer,
      multiThreaded,
      coverageScore,
      gaps
    };
  }

  /**
   * Detect new champions
   */
  detectNewChampions(stakeholders) {
    // Filter stakeholders who recently became champions
    // For now, return all champions as "new" (can be enhanced with historical data)
    return stakeholders
      .filter(s => s.role === 'champion')
      .slice(0, 3)
      .map(s => ({
        stakeholder: s.name,
        detectedOn: new Date().toISOString(),
        signals: [
          `Mentioned ${s.engagement.mentionFrequency} times in meetings`,
          `High engagement: ${s.engagement.meetingCount} meetings`,
          `Influence score: ${s.influenceScore}/100`
        ]
      }));
  }

  /**
   * Detect at-risk champions
   */
  detectAtRiskChampions(stakeholders) {
    const champions = stakeholders.filter(s => s.role === 'champion');

    return champions
      .filter(c => {
        const healthScore = this.calculateChampionHealth(c);
        return healthScore.score < 70;
      })
      .map(c => {
        const health = this.calculateChampionHealth(c);
        return {
          stakeholder: c.name,
          healthScore: health.score,
          redFlags: health.redFlags
        };
      });
  }

  /**
   * Calculate champion health score
   */
  calculateChampionHealth(champion) {
    let healthScore = 100;
    const redFlags = [];

    const daysSince = champion.engagement.daysSinceLastContact;

    // Check engagement recency
    if (daysSince > 21) {
      healthScore -= 40;
      redFlags.push(`No contact in ${daysSince} days`);
    } else if (daysSince > 14) {
      healthScore -= 20;
      redFlags.push(`Limited recent contact (${daysSince} days)`);
    }

    // Check sentiment
    if (champion.sentiment.current === 'negative') {
      healthScore -= 30;
      redFlags.push('Negative sentiment detected');
    } else if (champion.sentiment.current === 'neutral') {
      healthScore -= 15;
      redFlags.push('Neutral sentiment (not enthusiastic)');
    }

    // Check relationship strength
    if (champion.relationshipStrength.score < 50) {
      healthScore -= 20;
      redFlags.push('Weak relationship strength');
    }

    return {
      score: Math.max(0, healthScore),
      status: healthScore > 70 ? 'healthy' : healthScore > 40 ? 'at_risk' : 'critical',
      redFlags
    };
  }

  /**
   * Generate recommendations based on coverage analysis
   */
  generateRecommendations(coverage, stakeholders) {
    const recommendations = [];

    // Coverage gap recommendations
    coverage.gaps.forEach(gap => {
      recommendations.push(`Fill gap: ${gap.missingPersona} - ${gap.recommendation}`);
    });

    // Champion health recommendations
    const champions = stakeholders.filter(s => s.role === 'champion');
    champions.forEach(champion => {
      if (champion.engagement.daysSinceLastContact > 14) {
        recommendations.push(`Re-engage champion: ${champion.name} (last contact ${champion.engagement.daysSinceLastContact}d ago)`);
      }
    });

    // Influencer engagement recommendations
    const influencers = stakeholders.filter(s => s.role === 'influencer');
    if (influencers.length > 0 && !coverage.hasChampion) {
      recommendations.push(`Convert influencer to champion: Consider ${influencers[0].name}`);
    }

    return recommendations.slice(0, 5);
  }

  /**
   * Get empty insights (when no stakeholders found)
   */
  getEmptyInsights(dealId) {
    return {
      deal: { id: dealId },
      stakeholders: [],
      coverage: {
        hasChampion: false,
        hasEconomicBuyer: false,
        multiThreaded: false,
        coverageScore: 0,
        gaps: []
      },
      insights: {
        newChampions: [],
        atRiskChampions: [],
        recommendations: ['Begin stakeholder mapping for this deal']
      }
    };
  }
}

module.exports = new RelationshipIntelligenceService();
