/**
 * Intelligence Service
 * Aggregates data for "Today's Intelligence" morning briefing
 * Gathers meetings, action items, and shared-hub data
 */

const { supabase, supabaseAdmin } = require('../config/supabase');

// Import specialized intelligence services
const MeetingPrepService = require('./intelligence/MeetingPrepService');
const DealRiskService = require('./intelligence/DealRiskService');
const ActionItemTrackerService = require('./intelligence/ActionItemTrackerService');
const RelationshipIntelligenceService = require('./intelligence/RelationshipIntelligenceService');
const log = require('../utils/log');

class IntelligenceService {
  constructor() {
    this.hubClient = null;
    this.initializeHub();

    // Initialize specialized services
    this.meetingPrepService = MeetingPrepService;
    this.dealRiskService = DealRiskService;
    this.actionItemService = ActionItemTrackerService;
    this.relationshipService = RelationshipIntelligenceService;
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
        log.info('[IntelligenceService] Shared Hub client initialized');
      } else {
        log.info('[IntelligenceService] Shared Hub not configured');
      }
    } catch (error) {
      log.warn('[IntelligenceService] Failed to initialize Hub client:', error.message);
    }
  }

  /**
   * Get today's intelligence briefing
   * @param {Object} options - Query options
   * @param {string} options.userId - User ID for filtering (optional)
   * @param {string} options.timezone - User's timezone (default: UTC)
   * @returns {Object} Today's intelligence data
   */
  async getTodaysBriefing(options = {}) {
    const { userId, timezone = 'UTC' } = options;

    try {
      // Calculate today's date range
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      // Fetch all data in parallel
      const [
        meetingsData,
        overdueItemsData,
        dealsData,
        recentContactsData,
        upcomingDeadlines,
        meetingSentiment
      ] = await Promise.all([
        this.getTodaysMeetings(todayStart, todayEnd),
        this.getOverdueActionItems(),
        this.getDealsRequiringAttention(),
        this.getRecentContacts(),
        this.getUpcomingDeadlines(7), // Next 7 days
        this.getMeetingSentimentSummary(7) // Last 7 days
      ]);

      // Calculate summary stats
      const stats = {
        todaysMeetingsCount: meetingsData.meetings?.length || 0,
        overdueItemsCount: overdueItemsData.count || 0,
        urgentDealsCount: dealsData.deals?.filter(d => d.urgencyScore >= 7).length || 0,
        newContactsCount: recentContactsData.contacts?.length || 0,
        upcomingDeadlinesCount: upcomingDeadlines.items?.length || 0
      };

      // Generate AI-powered insights
      const insights = this.generateInsights({
        meetings: meetingsData,
        overdueItems: overdueItemsData,
        deals: dealsData,
        contacts: recentContactsData,
        sentiment: meetingSentiment
      });

      // Generate greeting based on time
      const greeting = this.getTimeBasedGreeting();

      return {
        success: true,
        briefing: {
          greeting,
          date: now.toISOString(),
          formattedDate: now.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          }),
          stats,
          meetings: meetingsData,
          overdueItems: overdueItemsData,
          deals: dealsData,
          recentContacts: recentContactsData,
          upcomingDeadlines,
          sentiment: meetingSentiment,
          insights
        }
      };
    } catch (error) {
      log.error('[IntelligenceService] getTodaysBriefing error:', { error: error.message || error });
      throw error;
    }
  }

  /**
   * Get today's scheduled meetings with context
   */
  async getTodaysMeetings(startDate, endDate) {
    if (!supabase) {
      return { meetings: [], count: 0 };
    }

    try {
      // Get meetings from calendar/scheduled meetings
      const { data: meetings, error } = await supabase
        .from('meetings')
        .select(`
          id,
          title,
          created_at,
          updated_at,
          duration_minutes,
          summary,
          sentiment_label,
          sentiment_score,
          participants
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        log.error('[IntelligenceService] Error fetching meetings:', { error: error.message || error });
        return { meetings: [], count: 0 };
      }

      // Enrich meetings with related deal info from hub if available
      const enrichedMeetings = await this.enrichMeetingsWithDeals(meetings || []);

      return {
        meetings: enrichedMeetings,
        count: enrichedMeetings.length
      };
    } catch (error) {
      log.error('[IntelligenceService] getTodaysMeetings error:', { error: error.message || error });
      return { meetings: [], count: 0 };
    }
  }

  /**
   * Enrich meetings with related deal information from shared-hub
   */
  async enrichMeetingsWithDeals(meetings) {
    if (!this.hubClient || meetings.length === 0) {
      return meetings;
    }

    try {
      // Extract attendee emails from meetings
      const allEmails = meetings.flatMap(m => {
        if (Array.isArray(m.participants)) {
          return m.participants.map(p => p.email).filter(Boolean);
        }
        return [];
      });

      if (allEmails.length === 0) {
        return meetings;
      }

      // Query hub for contacts with these emails
      const { data: contacts } = await this.hubClient
        .from('shared_contacts')
        .select('email, company_name, job_title')
        .in('email', allEmails);

      // Query for active deals related to these contacts
      const { data: events } = await this.hubClient
        .from('cross_app_events')
        .select('payload')
        .eq('event_category', 'deal')
        .in('event_type', ['deal.created', 'deal.stage_changed'])
        .order('created_at', { ascending: false })
        .limit(50);

      // Create lookup map
      const contactMap = new Map((contacts || []).map(c => [c.email, c]));
      const deals = (events || []).map(e => e.payload?.deal).filter(Boolean);

      // Enrich meetings
      return meetings.map(meeting => {
        const attendeeContext = [];
        if (Array.isArray(meeting.participants)) {
          for (const participant of meeting.participants) {
            if (participant.email) {
              const contact = contactMap.get(participant.email);
              if (contact) {
                attendeeContext.push({
                  email: participant.email,
                  name: participant.name,
                  company: contact.company_name,
                  title: contact.job_title
                });
              }
            }
          }
        }

        // Find related deals by company name
        const relatedDeals = deals.filter(deal => {
          return attendeeContext.some(ac =>
            ac.company && deal.company_name &&
            ac.company.toLowerCase().includes(deal.company_name.toLowerCase())
          );
        });

        return {
          ...meeting,
          attendeeContext: attendeeContext.length > 0 ? attendeeContext : null,
          relatedDeals: relatedDeals.length > 0 ? relatedDeals.slice(0, 3) : null
        };
      });
    } catch (error) {
      log.warn('[IntelligenceService] Error enriching meetings:', error.message);
      return meetings;
    }
  }

  /**
   * Get overdue action items
   */
  async getOverdueActionItems() {
    if (!supabase) {
      return { items: [], count: 0 };
    }

    try {
      const now = new Date().toISOString();

      const { data: items, error } = await supabase
        .from('action_items')
        .select(`
          id,
          task_description,
          assigned_to_name,
          assigned_to_email,
          due_date,
          priority,
          status,
          meeting_id,
          meetings:meeting_id (
            title
          )
        `)
        .lt('due_date', now)
        .not('status', 'in', '("done","complete","completed")')
        .order('due_date', { ascending: true })
        .limit(20);

      if (error) {
        log.error('[IntelligenceService] Error fetching overdue items:', { error: error.message || error });
        return { items: [], count: 0 };
      }

      // Calculate days overdue
      const enrichedItems = (items || []).map(item => ({
        ...item,
        daysOverdue: Math.floor(
          (new Date() - new Date(item.due_date)) / (1000 * 60 * 60 * 24)
        ),
        meetingTitle: item.meetings?.title || null
      }));

      // Sort by priority and days overdue
      enrichedItems.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const priorityDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
        if (priorityDiff !== 0) return priorityDiff;
        return b.daysOverdue - a.daysOverdue;
      });

      return {
        items: enrichedItems,
        count: enrichedItems.length,
        highPriorityCount: enrichedItems.filter(i => i.priority === 'high').length
      };
    } catch (error) {
      log.error('[IntelligenceService] getOverdueActionItems error:', { error: error.message || error });
      return { items: [], count: 0 };
    }
  }

  /**
   * Get deals requiring attention with AI-scored urgency
   */
  async getDealsRequiringAttention() {
    if (!this.hubClient) {
      return { deals: [], count: 0, source: 'not_configured' };
    }

    try {
      // Query for recent deal events from the hub
      const { data: dealEvents, error } = await this.hubClient
        .from('cross_app_events')
        .select('*')
        .eq('source_app', 'logos_crm')
        .eq('event_category', 'deal')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        log.error('[IntelligenceService] Error fetching deal events:', { error: error.message || error });
        return { deals: [], count: 0, source: 'hub_error' };
      }

      // Group events by deal ID to get latest state
      const dealMap = new Map();
      for (const event of (dealEvents || [])) {
        const dealId = event.payload?.deal?.id || event.payload?.dealId;
        if (!dealId) continue;

        if (!dealMap.has(dealId)) {
          dealMap.set(dealId, {
            id: dealId,
            name: event.payload?.deal?.name || 'Unknown Deal',
            value: event.payload?.deal?.value || 0,
            stage: event.payload?.deal?.stage || event.payload?.newStage,
            companyName: event.payload?.deal?.company_name,
            lastActivity: event.created_at,
            events: []
          });
        }
        dealMap.get(dealId).events.push(event);
      }

      // Calculate urgency scores
      const dealsWithScores = Array.from(dealMap.values()).map(deal => {
        const urgencyScore = this.calculateDealUrgency(deal);
        return {
          ...deal,
          urgencyScore,
          urgencyLevel: urgencyScore >= 8 ? 'critical' :
                        urgencyScore >= 6 ? 'high' :
                        urgencyScore >= 4 ? 'medium' : 'low'
        };
      });

      // Sort by urgency and filter to those needing attention
      const urgentDeals = dealsWithScores
        .filter(d => d.urgencyScore >= 4)
        .sort((a, b) => b.urgencyScore - a.urgencyScore)
        .slice(0, 10);

      return {
        deals: urgentDeals,
        count: urgentDeals.length,
        source: 'logos_crm'
      };
    } catch (error) {
      log.error('[IntelligenceService] getDealsRequiringAttention error:', { error: error.message || error });
      return { deals: [], count: 0, source: 'error' };
    }
  }

  /**
   * Calculate deal urgency score (0-10)
   */
  calculateDealUrgency(deal) {
    let score = 0;

    // Factor 1: Days since last activity (max 3 points)
    const daysSinceActivity = Math.floor(
      (new Date() - new Date(deal.lastActivity)) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceActivity > 14) score += 3;
    else if (daysSinceActivity > 7) score += 2;
    else if (daysSinceActivity > 3) score += 1;

    // Factor 2: Deal value (max 2 points)
    if (deal.value > 100000) score += 2;
    else if (deal.value > 50000) score += 1;

    // Factor 3: Stage progression (max 3 points)
    const lateStages = ['negotiation', 'proposal', 'closing', 'contract'];
    const stageLower = (deal.stage || '').toLowerCase();
    if (lateStages.some(s => stageLower.includes(s))) {
      score += 3;
    } else if (stageLower.includes('qualified') || stageLower.includes('discovery')) {
      score += 1;
    }

    // Factor 4: Recent negative events (max 2 points)
    const negativeEvents = (deal.events || []).filter(e =>
      e.event_type === 'deal.lost' ||
      e.payload?.sentiment === 'negative'
    );
    if (negativeEvents.length > 0) score += 2;

    return Math.min(score, 10);
  }

  /**
   * Get contacts synced from Logos CRM in last 24 hours
   */
  async getRecentContacts() {
    if (!this.hubClient) {
      return { contacts: [], count: 0, source: 'not_configured' };
    }

    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data: contacts, error } = await this.hubClient
        .from('shared_contacts')
        .select(`
          id,
          name,
          email,
          company_name,
          job_title,
          phone,
          source_app,
          created_at,
          tags
        `)
        .eq('source_app', 'logos_crm')
        .gte('created_at', twentyFourHoursAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        log.error('[IntelligenceService] Error fetching recent contacts:', { error: error.message || error });
        return { contacts: [], count: 0, source: 'hub_error' };
      }

      return {
        contacts: contacts || [],
        count: (contacts || []).length,
        source: 'logos_crm'
      };
    } catch (error) {
      log.error('[IntelligenceService] getRecentContacts error:', { error: error.message || error });
      return { contacts: [], count: 0, source: 'error' };
    }
  }

  /**
   * Get upcoming deadlines in the next N days
   */
  async getUpcomingDeadlines(days = 7) {
    if (!supabase) {
      return { items: [], count: 0 };
    }

    try {
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const { data: items, error } = await supabase
        .from('action_items')
        .select(`
          id,
          task_description,
          assigned_to_name,
          due_date,
          priority,
          status,
          meeting_id
        `)
        .gte('due_date', now.toISOString())
        .lte('due_date', futureDate.toISOString())
        .not('status', 'in', '("done","complete","completed")')
        .order('due_date', { ascending: true })
        .limit(15);

      if (error) {
        log.error('[IntelligenceService] Error fetching upcoming deadlines:', { error: error.message || error });
        return { items: [], count: 0 };
      }

      // Add days until due
      const enrichedItems = (items || []).map(item => ({
        ...item,
        daysUntilDue: Math.ceil(
          (new Date(item.due_date) - now) / (1000 * 60 * 60 * 24)
        )
      }));

      return {
        items: enrichedItems,
        count: enrichedItems.length
      };
    } catch (error) {
      log.error('[IntelligenceService] getUpcomingDeadlines error:', { error: error.message || error });
      return { items: [], count: 0 };
    }
  }

  /**
   * Get meeting sentiment summary for last N days
   */
  async getMeetingSentimentSummary(days = 7) {
    if (!supabase) {
      return { summary: null };
    }

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: meetings, error } = await supabase
        .from('meetings')
        .select('sentiment_label, sentiment_score')
        .gte('created_at', startDate.toISOString())
        .not('sentiment_label', 'is', null);

      if (error) {
        log.error('[IntelligenceService] Error fetching sentiment:', { error: error.message || error });
        return { summary: null };
      }

      if (!meetings || meetings.length === 0) {
        return { summary: null };
      }

      // Calculate sentiment distribution
      const counts = { Positive: 0, Neutral: 0, Negative: 0 };
      let totalScore = 0;

      for (const meeting of meetings) {
        if (meeting.sentiment_label) {
          counts[meeting.sentiment_label] = (counts[meeting.sentiment_label] || 0) + 1;
        }
        if (meeting.sentiment_score !== null) {
          totalScore += meeting.sentiment_score;
        }
      }

      const total = meetings.length;
      const averageScore = totalScore / total;
      const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

      return {
        summary: {
          total,
          distribution: counts,
          percentages: {
            positive: Math.round((counts.Positive / total) * 100),
            neutral: Math.round((counts.Neutral / total) * 100),
            negative: Math.round((counts.Negative / total) * 100)
          },
          averageScore: Math.round(averageScore * 100) / 100,
          dominantSentiment: dominant[0],
          trend: averageScore >= 0.6 ? 'positive' :
                 averageScore >= 0.4 ? 'neutral' : 'concerning'
        }
      };
    } catch (error) {
      log.error('[IntelligenceService] getMeetingSentimentSummary error:', { error: error.message || error });
      return { summary: null };
    }
  }

  /**
   * Generate AI-powered insights from the data
   */
  generateInsights(data) {
    const insights = [];

    // Overdue items insight
    if (data.overdueItems.count > 0) {
      const highPriority = data.overdueItems.highPriorityCount || 0;
      if (highPriority > 0) {
        insights.push({
          type: 'warning',
          category: 'action_items',
          title: 'High Priority Items Overdue',
          message: `You have ${highPriority} high-priority action item${highPriority > 1 ? 's' : ''} that ${highPriority > 1 ? 'are' : 'is'} overdue. Consider addressing these first.`,
          priority: 1
        });
      } else {
        insights.push({
          type: 'info',
          category: 'action_items',
          title: 'Overdue Items',
          message: `${data.overdueItems.count} action item${data.overdueItems.count > 1 ? 's need' : ' needs'} attention.`,
          priority: 2
        });
      }
    }

    // Deals insight
    if (data.deals.deals && data.deals.deals.length > 0) {
      const criticalDeals = data.deals.deals.filter(d => d.urgencyLevel === 'critical');
      if (criticalDeals.length > 0) {
        insights.push({
          type: 'alert',
          category: 'deals',
          title: 'Critical Deals Need Attention',
          message: `${criticalDeals.length} deal${criticalDeals.length > 1 ? 's require' : ' requires'} immediate attention based on activity and stage.`,
          priority: 1
        });
      }
    }

    // Sentiment insight
    if (data.sentiment?.summary) {
      const trend = data.sentiment.summary.trend;
      if (trend === 'positive') {
        insights.push({
          type: 'success',
          category: 'sentiment',
          title: 'Positive Meeting Trend',
          message: `Your meetings this week have been predominantly positive (${data.sentiment.summary.percentages.positive}% positive). Keep up the good work!`,
          priority: 3
        });
      } else if (trend === 'concerning') {
        insights.push({
          type: 'warning',
          category: 'sentiment',
          title: 'Meeting Sentiment Alert',
          message: `Meeting sentiment has been lower this week. Consider reviewing recent discussions for improvement areas.`,
          priority: 2
        });
      }
    }

    // New contacts insight
    if (data.contacts.count > 0) {
      insights.push({
        type: 'info',
        category: 'contacts',
        title: 'New Contacts Synced',
        message: `${data.contacts.count} new contact${data.contacts.count > 1 ? 's have' : ' has'} been synced from Logos CRM in the last 24 hours.`,
        priority: 3
      });
    }

    // Meetings insight
    if (data.meetings.count > 0) {
      insights.push({
        type: 'info',
        category: 'meetings',
        title: 'Today\'s Schedule',
        message: `You have ${data.meetings.count} meeting${data.meetings.count > 1 ? 's' : ''} scheduled for today.`,
        priority: 2
      });
    }

    // Sort by priority
    insights.sort((a, b) => a.priority - b.priority);

    return insights;
  }

  /**
   * Get time-based greeting
   */
  getTimeBasedGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  /**
   * Mark briefing as viewed (for tracking)
   */
  async markBriefingViewed(userId) {
    if (!supabase) {
      return { success: false, message: 'Database not configured' };
    }

    try {
      // Store in a briefing_views table or user preferences
      // For now, just log it
      log.info(`[IntelligenceService] Briefing viewed by user: ${userId || 'anonymous'}`);

      return {
        success: true,
        viewedAt: new Date().toISOString()
      };
    } catch (error) {
      log.error('[IntelligenceService] markBriefingViewed error:', { error: error.message || error });
      return { success: false, message: error.message };
    }
  }

  /**
   * Get comprehensive intelligence dashboard for Enhanced Intelligence Dashboard
   * Orchestrates all 4 intelligence services
   * @param {string} userId - User ID
   * @param {Object} options - Dashboard options
   * @returns {Promise<Object>} Complete dashboard intelligence
   */
  async getDashboardIntelligence(userId, options = {}) {
    try {
      const {
        dealRiskFilter = ['medium', 'high', 'critical'],
        timeHorizon = {
          meetings: 24,  // hours
          risks: 7       // days
        }
      } = options;

      log.info(`[IntelligenceService] Getting dashboard intelligence for user: ${userId}`);

      // Fetch all intelligence data in parallel for performance
      const [
        meetingPrep,
        dealRisks,
        actionItems,
        // Relationships are deal-specific, so we'll get them on-demand
      ] = await Promise.all([
        this.meetingPrepService.getUpcomingMeetingPrep(userId, { hours: timeHorizon.meetings }),
        this.dealRiskService.getAtRiskDeals(userId, { riskLevel: dealRiskFilter, limit: 10 }),
        this.actionItemService.getActionItemStatus(userId),
      ]);

      return {
        success: true,
        data: {
          meetingPrep: {
            cards: meetingPrep,
            count: meetingPrep.length
          },
          dealRisks: {
            cards: dealRisks,
            count: dealRisks.length
          },
          actionItems: {
            summary: actionItems.summary,
            trends: actionItems.trends,
            benchmarks: actionItems.benchmarks,
            criticalItems: actionItems.criticalOverdue,
            blockingChains: actionItems.blockingChains
          },
          relationships: {
            // Relationships are fetched per-deal via separate endpoint
            // This keeps the main dashboard load fast
            count: 0,
            message: 'Use /api/intelligence/relationships/:dealId for deal-specific insights'
          },
          lastUpdated: new Date().toISOString()
        }
      };
    } catch (error) {
      log.error('[IntelligenceService] getDashboardIntelligence error:', { error: error.message || error });
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
}

module.exports = new IntelligenceService();
