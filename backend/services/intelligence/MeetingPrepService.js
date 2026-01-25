/**
 * Meeting Prep Service
 * Provides AI-powered meeting preparation intelligence
 * Part of Enhanced Intelligence Dashboard
 */

const { supabase, supabaseAdmin } = require('../../config/supabase');
const OpenAI = require('openai');

class MeetingPrepService {
  constructor() {
    this.openai = null;
    this.initializeAI();
  }

  /**
   * Initialize OpenAI client if API key is available
   */
  initializeAI() {
    const apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (apiKey && process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      console.log('[MeetingPrepService] AI client initialized');
    } else {
      console.warn('[MeetingPrepService] No AI API key configured');
    }
  }

  /**
   * Get upcoming meetings with full preparation context
   * @param {string} userId - User ID
   * @param {Object} options - Options
   * @param {number} options.hours - Hours ahead to look (default: 24)
   * @returns {Promise<Array>} Array of meeting prep intelligence
   */
  async getUpcomingMeetingPrep(userId, options = {}) {
    const { hours = 24 } = options;

    try {
      if (!supabase) {
        return [];
      }

      // Calculate time window
      const now = new Date();
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + hours);

      // Get upcoming meetings
      const { data: meetings, error } = await supabase
        .from('meetings')
        .select(`
          id,
          title,
          description,
          summary,
          start_time,
          end_time,
          duration_minutes,
          participants,
          sentiment_label,
          sentiment_score,
          created_at,
          project_id,
          crm_deal_id
        `)
        .gte('start_time', now.toISOString())
        .lte('start_time', futureDate.toISOString())
        .order('start_time', { ascending: true })
        .limit(10);

      if (error) {
        console.error('[MeetingPrepService] Error fetching meetings:', error);
        return [];
      }

      if (!meetings || meetings.length === 0) {
        return [];
      }

      // Enrich each meeting with prep intelligence
      const enrichedMeetings = await Promise.all(
        meetings.map(meeting => this.getMeetingPrep(meeting.id, meeting))
      );

      return enrichedMeetings.filter(Boolean);
    } catch (error) {
      console.error('[MeetingPrepService] getUpcomingMeetingPrep error:', error);
      return [];
    }
  }

  /**
   * Get comprehensive preparation intelligence for a specific meeting
   * @param {string} meetingId - Meeting ID
   * @param {Object} meetingData - Optional pre-fetched meeting data
   * @returns {Promise<Object>} Meeting prep intelligence
   */
  async getMeetingPrep(meetingId, meetingData = null) {
    try {
      let meeting = meetingData;

      // Fetch meeting if not provided
      if (!meeting) {
        const { data, error } = await supabase
          .from('meetings')
          .select('*')
          .eq('id', meetingId)
          .single();

        if (error || !data) {
          console.error('[MeetingPrepService] Meeting not found:', meetingId);
          return null;
        }

        meeting = data;
      }

      // Fetch related data in parallel
      const [
        actionItems,
        sentimentHistory,
        relatedMeetings,
        dealContext
      ] = await Promise.all([
        this.getRelatedActionItems(meetingId),
        this.getSentimentHistory(meeting),
        this.getRelatedMeetingHistory(meeting),
        this.getDealContext(meeting.crm_deal_id)
      ]);

      // Calculate derived metrics
      const lastContactDays = relatedMeetings.length > 0
        ? Math.floor((new Date() - new Date(relatedMeetings[0].created_at)) / (1000 * 60 * 60 * 24))
        : null;

      const sentimentTrend = this.calculateSentimentTrend(sentimentHistory);

      // Generate AI talking points
      const talkingPoints = await this.generateTalkingPoints({
        meeting,
        actionItems,
        sentimentHistory,
        dealContext
      });

      // Build response
      return {
        meeting: {
          id: meeting.id,
          title: meeting.title,
          scheduledAt: meeting.start_time,
          endTime: meeting.end_time,
          duration: meeting.duration_minutes,
          attendees: meeting.participants || [],
          location: meeting.location,
          meetingLink: meeting.meeting_link,
          description: meeting.description
        },
        dealContext: dealContext,
        history: {
          lastContactDate: relatedMeetings[0]?.created_at || null,
          meetingCount: relatedMeetings.length,
          daysSinceLastContact: lastContactDays
        },
        sentiment: {
          current: meeting.sentiment_label?.toLowerCase() || 'neutral',
          trend: sentimentTrend,
          history: sentimentHistory.map(m => ({
            date: m.created_at,
            sentiment: m.sentiment_label?.toLowerCase() || 'neutral',
            score: Math.round((m.sentiment_score || 0.5) * 100)
          }))
        },
        actionItems: {
          total: actionItems.length,
          overdue: actionItems.filter(item => item.isOverdue).length,
          items: actionItems.slice(0, 5).map(item => ({
            id: item.id,
            task: item.task_description,
            owner: item.assigned_to_name || item.assigned_to_email,
            dueDate: item.due_date,
            status: item.status,
            isOverdue: item.isOverdue,
            daysOverdue: item.daysOverdue
          }))
        },
        insights: {
          competitorMentions: this.extractCompetitorMentions(relatedMeetings),
          keyTopics: this.extractKeyTopics(relatedMeetings),
          relationshipChanges: []
        },
        talkingPoints: talkingPoints,
        briefDocument: null // Generated on-demand via separate endpoint
      };
    } catch (error) {
      console.error('[MeetingPrepService] getMeetingPrep error:', error);
      return null;
    }
  }

  /**
   * Get action items related to a meeting
   */
  async getRelatedActionItems(meetingId) {
    try {
      const { data: items, error } = await supabase
        .from('action_items')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('due_date', { ascending: true });

      if (error) {
        console.error('[MeetingPrepService] Error fetching action items:', error);
        return [];
      }

      const now = new Date();
      return (items || []).map(item => ({
        ...item,
        isOverdue: item.due_date && new Date(item.due_date) < now && item.status !== 'done',
        daysOverdue: item.due_date
          ? Math.floor((now - new Date(item.due_date)) / (1000 * 60 * 60 * 24))
          : 0
      }));
    } catch (error) {
      console.error('[MeetingPrepService] getRelatedActionItems error:', error);
      return [];
    }
  }

  /**
   * Get sentiment history from past meetings with same participants
   */
  async getSentimentHistory(meeting) {
    try {
      // Extract attendee emails
      const attendeeEmails = (meeting.participants || [])
        .map(p => p.email)
        .filter(Boolean);

      if (attendeeEmails.length === 0) {
        return [];
      }

      // Find recent meetings with overlapping participants
      const { data: pastMeetings, error } = await supabase
        .from('meetings')
        .select('id, created_at, sentiment_label, sentiment_score, participants')
        .lt('created_at', meeting.created_at || new Date().toISOString())
        .not('sentiment_label', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !pastMeetings) {
        return [];
      }

      // Filter to meetings with overlapping participants
      const relevantMeetings = pastMeetings.filter(pm => {
        const pmEmails = (pm.participants || []).map(p => p.email).filter(Boolean);
        return pmEmails.some(email => attendeeEmails.includes(email));
      });

      return relevantMeetings.slice(0, 5);
    } catch (error) {
      console.error('[MeetingPrepService] getSentimentHistory error:', error);
      return [];
    }
  }

  /**
   * Get related meeting history (same company/deal)
   */
  async getRelatedMeetingHistory(meeting) {
    try {
      const filters = [];

      // Find by CRM deal ID
      if (meeting.crm_deal_id) {
        const { data: dealMeetings } = await supabase
          .from('meetings')
          .select('id, created_at, title, sentiment_label')
          .eq('crm_deal_id', meeting.crm_deal_id)
          .neq('id', meeting.id)
          .order('created_at', { ascending: false })
          .limit(10);

        return dealMeetings || [];
      }

      // Find by project ID
      if (meeting.project_id) {
        const { data: projectMeetings } = await supabase
          .from('meetings')
          .select('id, created_at, title, sentiment_label')
          .eq('project_id', meeting.project_id)
          .neq('id', meeting.id)
          .order('created_at', { ascending: false})
          .limit(10);

        return projectMeetings || [];
      }

      return [];
    } catch (error) {
      console.error('[MeetingPrepService] getRelatedMeetingHistory error:', error);
      return [];
    }
  }

  /**
   * Get deal context from CRM (via shared hub)
   */
  async getDealContext(crmDealId) {
    if (!crmDealId) {
      return null;
    }

    try {
      // TODO: Query shared hub for deal information
      // For now, return null - this will be enhanced when shared hub is fully integrated
      return null;
    } catch (error) {
      console.error('[MeetingPrepService] getDealContext error:', error);
      return null;
    }
  }

  /**
   * Calculate sentiment trend from history
   */
  calculateSentimentTrend(sentimentHistory) {
    if (sentimentHistory.length < 2) {
      return 'stable';
    }

    const recent = sentimentHistory.slice(0, 3);
    const scores = recent.map(m => m.sentiment_score || 0.5);

    // Calculate simple linear trend
    const avgChange = (scores[0] - scores[scores.length - 1]) / scores.length;

    if (avgChange > 0.1) return 'improving';
    if (avgChange < -0.1) return 'declining';
    return 'stable';
  }

  /**
   * Extract competitor mentions from meeting transcripts
   */
  extractCompetitorMentions(meetings) {
    // Simple keyword extraction - can be enhanced with NLP
    const competitorKeywords = ['competitor', 'alternative', 'versus', 'compared to'];
    const mentions = new Set();

    meetings.forEach(meeting => {
      const text = (meeting.transcript || meeting.summary || '').toLowerCase();
      // This is a simplified version - in production, use NER (Named Entity Recognition)
      if (competitorKeywords.some(keyword => text.includes(keyword))) {
        // Extract potential competitor names (simplified)
        const words = text.split(/\s+/);
        words.forEach((word, i) => {
          if (competitorKeywords.includes(word) && i < words.length - 1) {
            mentions.add(words[i + 1]);
          }
        });
      }
    });

    return Array.from(mentions).slice(0, 3);
  }

  /**
   * Extract key topics from meetings
   */
  extractKeyTopics(meetings) {
    const allTopics = meetings.flatMap(m => m.topics || []);

    // Count topic frequency
    const topicCounts = {};
    allTopics.forEach(topic => {
      if (typeof topic === 'string') {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      }
    });

    // Sort by frequency and return top 5
    return Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);
  }

  /**
   * Generate AI talking points for a meeting
   */
  async generateTalkingPoints(context) {
    const { meeting, actionItems, sentimentHistory, dealContext } = context;

    // If no AI client, return rule-based talking points
    if (!this.openai) {
      return this.generateRuleBasedTalkingPoints(context);
    }

    try {
      const prompt = this.buildTalkingPointsPrompt(context);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant helping prepare for business meetings. Generate concise, actionable talking points based on meeting context and history.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const response = completion.choices[0]?.message?.content || '';

      // Parse talking points (expecting bullet list)
      const points = response
        .split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
        .map(line => line.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean);

      return points.slice(0, 5);
    } catch (error) {
      console.error('[MeetingPrepService] AI generation error:', error);
      return this.generateRuleBasedTalkingPoints(context);
    }
  }

  /**
   * Build prompt for AI talking points generation
   */
  buildTalkingPointsPrompt(context) {
    const { meeting, actionItems, sentimentHistory } = context;

    let prompt = `Generate 3-5 talking points for the following meeting:\n\n`;
    prompt += `Meeting: ${meeting.title}\n`;

    if (meeting.description) {
      prompt += `Description: ${meeting.description}\n`;
    }

    if (actionItems.overdue > 0) {
      prompt += `\nThere are ${actionItems.overdue} overdue action items from previous meetings.\n`;
    }

    if (sentimentHistory.length > 0) {
      const trend = this.calculateSentimentTrend(sentimentHistory);
      prompt += `\nRecent sentiment trend: ${trend}\n`;
    }

    prompt += `\nProvide specific, actionable talking points focusing on:\n`;
    prompt += `- Following up on pending items\n`;
    prompt += `- Addressing any concerns\n`;
    prompt += `- Moving the relationship forward\n`;

    return prompt;
  }

  /**
   * Generate rule-based talking points (fallback when no AI)
   */
  generateRuleBasedTalkingPoints(context) {
    const { meeting, actionItems, sentimentHistory } = context;
    const points = [];

    // Overdue items
    if (actionItems.overdue > 0) {
      points.push(`Follow up on ${actionItems.overdue} overdue action item${actionItems.overdue > 1 ? 's' : ''}`);
    }

    // Sentiment concerns
    const trend = this.calculateSentimentTrend(sentimentHistory);
    if (trend === 'declining') {
      points.push('Address recent concerns and ensure alignment');
    }

    // Generic productive points
    if (points.length < 3) {
      points.push('Review progress since last meeting');
      points.push('Discuss next steps and timeline');
      points.push('Clarify any blockers or challenges');
    }

    return points.slice(0, 5);
  }

  /**
   * Generate full AI meeting brief document
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<string>} Formatted brief document
   */
  async generateMeetingBrief(meetingId) {
    try {
      const prep = await this.getMeetingPrep(meetingId);
      if (!prep) {
        throw new Error('Meeting not found');
      }

      // If no AI, return formatted summary
      if (!this.openai) {
        return this.formatMeetingBrief(prep);
      }

      // Generate AI brief
      const prompt = this.buildBriefPrompt(prep);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an executive assistant preparing comprehensive meeting briefs. Create a well-structured, professional brief that helps the user be fully prepared.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      return completion.choices[0]?.message?.content || this.formatMeetingBrief(prep);
    } catch (error) {
      console.error('[MeetingPrepService] generateMeetingBrief error:', error);
      throw error;
    }
  }

  /**
   * Build prompt for full meeting brief
   */
  buildBriefPrompt(prep) {
    let prompt = `Create a comprehensive meeting brief for:\n\n`;
    prompt += `**Meeting:** ${prep.meeting.title}\n`;
    prompt += `**Time:** ${new Date(prep.meeting.scheduledAt).toLocaleString()}\n`;
    prompt += `**Duration:** ${prep.meeting.duration} minutes\n\n`;

    if (prep.history.daysSinceLastContact) {
      prompt += `**Last Contact:** ${prep.history.daysSinceLastContact} days ago\n`;
    }

    if (prep.actionItems.overdue > 0) {
      prompt += `**Overdue Items:** ${prep.actionItems.overdue}\n`;
    }

    prompt += `\n**Sentiment Trend:** ${prep.sentiment.trend}\n\n`;

    prompt += `Include sections for:\n`;
    prompt += `1. Meeting Objective\n`;
    prompt += `2. Key Context & Background\n`;
    prompt += `3. Important Discussion Points\n`;
    prompt += `4. Recommended Approach\n`;
    prompt += `5. Potential Challenges\n`;

    return prompt;
  }

  /**
   * Format meeting brief (fallback without AI)
   */
  formatMeetingBrief(prep) {
    let brief = `# Meeting Brief: ${prep.meeting.title}\n\n`;
    brief += `**Time:** ${new Date(prep.meeting.scheduledAt).toLocaleString()}\n`;
    brief += `**Duration:** ${prep.meeting.duration} minutes\n\n`;

    brief += `## Context\n\n`;
    if (prep.history.daysSinceLastContact) {
      brief += `- Last contact: ${prep.history.daysSinceLastContact} days ago\n`;
    }
    brief += `- Meeting count: ${prep.history.meetingCount}\n`;
    brief += `- Sentiment trend: ${prep.sentiment.trend}\n\n`;

    if (prep.actionItems.overdue > 0) {
      brief += `## Overdue Items (${prep.actionItems.overdue})\n\n`;
      prep.actionItems.items.filter(i => i.isOverdue).forEach(item => {
        brief += `- ${item.task} (${item.daysOverdue}d overdue)\n`;
      });
      brief += `\n`;
    }

    brief += `## Talking Points\n\n`;
    prep.talkingPoints.forEach(point => {
      brief += `- ${point}\n`;
    });

    return brief;
  }
}

module.exports = new MeetingPrepService();
