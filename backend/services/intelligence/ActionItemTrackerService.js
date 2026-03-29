/**
 * Action Item Tracker Service
 * Tracks action item completion, detects blocking chains, and sends intelligent nudges
 * Part of Enhanced Intelligence Dashboard
 */

const { supabase, supabaseAdmin } = require('../../config/supabase');
const log = require('../../utils/log');

class ActionItemTrackerService {
  constructor() {
    // Configure nudge settings
    this.nudgeSettings = {
      overdueThreshold: 3, // days
      blockingThreshold: 1, // days
      upcomingThreshold: 1 // days
    };
  }

  /**
   * Get comprehensive action item status for a user
   * @param {string} userId - User ID
   * @param {Object} options - Filter options
   * @returns {Promise<Object>} Action item intelligence
   */
  async getActionItemStatus(userId, options = {}) {
    try {
      // Get all action items for user (assigned or created by them)
      const actionItems = await this.getUserActionItems(userId);

      if (actionItems.length === 0) {
        return this.getEmptyStatus();
      }

      // Calculate summary metrics
      const summary = this.calculateSummary(actionItems);

      // Get trends
      const trends = await this.calculateTrends(userId);

      // Get team benchmarks
      const benchmarks = await this.calculateBenchmarks(userId);

      // Get critical overdue items
      const criticalOverdue = this.getCriticalOverdueItems(actionItems);

      // Detect blocking chains
      const blockingChains = await this.detectBlockingChains(actionItems);

      return {
        summary,
        trends,
        benchmarks,
        criticalOverdue,
        blockingChains
      };
    } catch (error) {
      log.error('[ActionItemTrackerService] getActionItemStatus error:', { error: error.message || error });
      return this.getEmptyStatus();
    }
  }

  /**
   * Get all action items for a user
   */
  async getUserActionItems(userId) {
    try {
      const { data: items, error } = await supabase
        .from('action_items')
        .select(`
          *,
          meetings:meeting_id (
            title,
            crm_deal_id
          )
        `)
        .or(`assigned_to_id.eq.${userId},meeting_id.in.(SELECT id FROM meetings WHERE created_by = '${userId}')`)
        .order('due_date', { ascending: true });

      if (error) {
        log.error('[ActionItemTrackerService] Error fetching items:', { error: error.message || error });
        return [];
      }

      const now = new Date();
      return (items || []).map(item => ({
        ...item,
        isOverdue: item.due_date && new Date(item.due_date) < now &&
          !['done', 'complete', 'completed'].includes(item.status?.toLowerCase()),
        daysOverdue: item.due_date
          ? Math.max(0, Math.floor((now - new Date(item.due_date)) / (1000 * 60 * 60 * 24)))
          : 0,
        daysUntilDue: item.due_date
          ? Math.ceil((new Date(item.due_date) - now) / (1000 * 60 * 60 * 24))
          : null
      }));
    } catch (error) {
      log.error('[ActionItemTrackerService] getUserActionItems error:', { error: error.message || error });
      return [];
    }
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary(actionItems) {
    const total = actionItems.length;
    const completed = actionItems.filter(item =>
      ['done', 'complete', 'completed'].includes(item.status?.toLowerCase())
    ).length;

    const inProgress = actionItems.filter(item =>
      ['in_progress', 'in progress', 'working'].includes(item.status?.toLowerCase())
    ).length;

    const overdue = actionItems.filter(item => item.isOverdue).length;

    // Blocked items (have dependencies)
    const blocked = 0; // Will be updated after dependency detection

    const completionRate = total > 0 ? (completed / total) : 1;

    return {
      total,
      completed,
      inProgress,
      overdue,
      blocked,
      completionRate: Math.round(completionRate * 100) / 100
    };
  }

  /**
   * Calculate week-over-week trends
   */
  async calculateTrends(userId) {
    try {
      const now = new Date();
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      // Get last week's items
      const { data: lastWeekItems } = await supabase
        .from('action_items')
        .select('id, status, created_at, completed_at')
        .eq('assigned_to_id', userId)
        .gte('created_at', oneWeekAgo.toISOString())
        .lt('created_at', now.toISOString());

      // Get week before last
      const { data: previousWeekItems } = await supabase
        .from('action_items')
        .select('id, status, created_at, completed_at')
        .eq('assigned_to_id', userId)
        .gte('created_at', twoWeeksAgo.toISOString())
        .lt('created_at', oneWeekAgo.toISOString());

      const lastWeekCompletionRate = this.calculateCompletionRateForItems(lastWeekItems || []);
      const previousWeekCompletionRate = this.calculateCompletionRateForItems(previousWeekItems || []);

      const completionRateDelta = lastWeekCompletionRate - previousWeekCompletionRate;

      // Calculate average time to complete
      const lastWeekAvgTime = this.calculateAvgTimeToComplete(lastWeekItems || []);
      const previousWeekAvgTime = this.calculateAvgTimeToComplete(previousWeekItems || []);

      const avgTimeDelta = lastWeekAvgTime - previousWeekAvgTime;

      return {
        weekOverWeek: {
          completionRate: Math.round(completionRateDelta * 100) / 100,
          avgTimeToComplete: Math.round(avgTimeDelta * 10) / 10
        }
      };
    } catch (error) {
      log.error('[ActionItemTrackerService] calculateTrends error:', { error: error.message || error });
      return {
        weekOverWeek: {
          completionRate: 0,
          avgTimeToComplete: 0
        }
      };
    }
  }

  /**
   * Calculate completion rate for a set of items
   */
  calculateCompletionRateForItems(items) {
    if (items.length === 0) return 0;

    const completed = items.filter(item =>
      ['done', 'complete', 'completed'].includes(item.status?.toLowerCase())
    ).length;

    return completed / items.length;
  }

  /**
   * Calculate average time to complete
   */
  calculateAvgTimeToComplete(items) {
    const completedItems = items.filter(item =>
      item.completed_at && item.created_at
    );

    if (completedItems.length === 0) return 0;

    const totalDays = completedItems.reduce((sum, item) => {
      const days = (new Date(item.completed_at) - new Date(item.created_at)) / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0);

    return totalDays / completedItems.length;
  }

  /**
   * Calculate team benchmarks
   */
  async calculateBenchmarks(userId) {
    try {
      // Get user's team
      const { data: user } = await supabase
        .from('users')
        .select('team_id')
        .eq('id', userId)
        .single();

      if (!user || !user.team_id) {
        return {
          userCompletionRate: 0,
          teamAverage: 0,
          topPerformer: null
        };
      }

      // Get team members
      const { data: teamMembers } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('team_id', user.team_id);

      if (!teamMembers || teamMembers.length === 0) {
        return {
          userCompletionRate: 0,
          teamAverage: 0,
          topPerformer: null
        };
      }

      // Calculate completion rates for all team members
      const memberRates = await Promise.all(
        teamMembers.map(async member => {
          const { data: items } = await supabase
            .from('action_items')
            .select('id, status')
            .eq('assigned_to_id', member.id);

          const rate = this.calculateCompletionRateForItems(items || []);

          return {
            userId: member.id,
            name: member.full_name,
            rate
          };
        })
      );

      const userRate = memberRates.find(m => m.userId === userId)?.rate || 0;
      const teamAvg = memberRates.reduce((sum, m) => sum + m.rate, 0) / memberRates.length;
      const topPerformer = memberRates.sort((a, b) => b.rate - a.rate)[0];

      return {
        userCompletionRate: Math.round(userRate * 100) / 100,
        teamAverage: Math.round(teamAvg * 100) / 100,
        topPerformer: topPerformer ? {
          name: topPerformer.name,
          rate: Math.round(topPerformer.rate * 100) / 100
        } : null
      };
    } catch (error) {
      log.error('[ActionItemTrackerService] calculateBenchmarks error:', { error: error.message || error });
      return {
        userCompletionRate: 0,
        teamAverage: 0,
        topPerformer: null
      };
    }
  }

  /**
   * Get critical overdue items
   */
  getCriticalOverdueItems(actionItems) {
    const overdue = actionItems.filter(item => item.isOverdue);

    // Sort by priority and days overdue
    const priorityOrder = { high: 0, medium: 1, low: 2 };

    overdue.sort((a, b) => {
      const priorityDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
      if (priorityDiff !== 0) return priorityDiff;
      return b.daysOverdue - a.daysOverdue;
    });

    return overdue.slice(0, 10).map(item => ({
      id: item.id,
      task: item.task_description,
      owner: item.assigned_to_name || item.assigned_to_email,
      assignedTo: item.assigned_to_id,
      dueDate: item.due_date,
      daysOverdue: item.daysOverdue,
      priority: item.priority,
      isBlocking: false, // Will be updated by blocking chain detection
      blockedTasks: [],
      relatedDeal: item.meetings?.crm_deal_id ? {
        id: item.meetings.crm_deal_id,
        name: item.meetings.title
      } : null
    }));
  }

  /**
   * Detect blocking chains between action items
   */
  async detectBlockingChains(actionItems) {
    try {
      // Get existing dependencies from database
      const actionItemIds = actionItems.map(item => item.id);

      const { data: dependencies } = await supabaseAdmin
        .from('action_item_dependencies')
        .select('*')
        .or(`action_item_id.in.(${actionItemIds.join(',')}),blocks_action_item_id.in.(${actionItemIds.join(',')}))`);

      if (!dependencies || dependencies.length === 0) {
        return [];
      }

      // Build dependency graph
      const graph = new Map();
      dependencies.forEach(dep => {
        if (!graph.has(dep.action_item_id)) {
          graph.set(dep.action_item_id, []);
        }
        graph.get(dep.action_item_id).push(dep.blocks_action_item_id);
      });

      // Find blocking chains
      const chains = [];
      const visited = new Set();

      graph.forEach((blockedIds, blockerId) => {
        if (!visited.has(blockerId)) {
          const chain = this.buildChain(blockerId, graph, actionItems, visited);
          if (chain.nodes.length > 1) {
            chains.push(chain);
          }
        }
      });

      return chains;
    } catch (error) {
      log.error('[ActionItemTrackerService] detectBlockingChains error:', { error: error.message || error });
      return [];
    }
  }

  /**
   * Build a dependency chain starting from a blocker
   */
  buildChain(startId, graph, actionItems, visited) {
    const nodes = [];
    const queue = [startId];
    const seen = new Set();

    while (queue.length > 0) {
      const itemId = queue.shift();

      if (seen.has(itemId)) continue;
      seen.add(itemId);
      visited.add(itemId);

      const item = actionItems.find(i => i.id === itemId);
      if (item) {
        nodes.push({
          id: item.id,
          task: item.task_description,
          status: item.status,
          owner: item.assigned_to_name || item.assigned_to_email,
          isOverdue: item.isOverdue,
          daysOverdue: item.daysOverdue
        });
      }

      // Add blocked items to queue
      const blockedIds = graph.get(itemId) || [];
      blockedIds.forEach(id => queue.push(id));
    }

    return {
      rootTask: nodes[0]?.task || 'Unknown',
      chainLength: nodes.length,
      totalBlocked: nodes.length - 1,
      nodes
    };
  }

  /**
   * Get intelligent nudges for action items
   */
  async getIntelligentNudges(userId) {
    try {
      const actionItems = await this.getUserActionItems(userId);
      const nudges = [];

      actionItems.forEach(item => {
        const nudge = this.shouldNudge(item);
        if (nudge) {
          nudges.push({
            ...nudge,
            actionItemId: item.id,
            recipient: item.assigned_to_id
          });
        }
      });

      return nudges;
    } catch (error) {
      log.error('[ActionItemTrackerService] getIntelligentNudges error:', { error: error.message || error });
      return [];
    }
  }

  /**
   * Determine if an action item should trigger a nudge
   */
  shouldNudge(actionItem) {
    const rules = [
      {
        condition: actionItem.daysOverdue >= this.nudgeSettings.overdueThreshold,
        nudgeType: 'overdue_reminder',
        message: `This item is ${actionItem.daysOverdue} days overdue`,
        priority: 'high'
      },
      {
        condition: actionItem.isBlocking && actionItem.daysOverdue >= this.nudgeSettings.blockingThreshold,
        nudgeType: 'blocking_alert',
        message: 'This item is blocking other tasks',
        priority: 'critical'
      },
      {
        condition: actionItem.daysUntilDue === this.nudgeSettings.upcomingThreshold &&
          actionItem.status?.toLowerCase() === 'open',
        nudgeType: 'due_tomorrow',
        message: 'Due tomorrow - need help?',
        priority: 'medium'
      }
    ];

    return rules.find(rule => rule.condition) || null;
  }

  /**
   * Send a nudge via configured channel
   */
  async sendNudge(actionItemId, channel = 'in_app') {
    try {
      // Get action item details
      const { data: item } = await supabase
        .from('action_items')
        .select('*')
        .eq('id', actionItemId)
        .single();

      if (!item) {
        throw new Error('Action item not found');
      }

      const nudge = this.shouldNudge(item);
      if (!nudge) {
        log.info('[ActionItemTrackerService] No nudge needed');
        return { success: true, sent: false };
      }

      // Send nudge based on channel
      switch (channel) {
        case 'slack':
          try {
            const chatService = require('../chatService');
            const slackChannel = process.env.SLACK_DEFAULT_CHANNEL || '#general';
            await chatService.postMessage(slackChannel, nudge.message, {
              blocks: [
                { type: 'section', text: { type: 'mrkdwn', text: `*Action Item Reminder*\n${nudge.message}` } },
                { type: 'context', elements: [{ type: 'mrkdwn', text: `Assigned to: ${item.assigned_to_name || 'Unassigned'} | Priority: ${item.priority || 'medium'} | Due: ${item.due_date || 'No date'}` }] }
              ]
            });
          } catch (slackErr) {
            log.warn('[ActionItemTrackerService] Slack nudge failed:', slackErr.message);
          }
          break;

        case 'email':
          try {
            const hubEventPublisher = require('../hubEventPublisher');
            await hubEventPublisher.publish({
              type: 'notification.email',
              category: 'meeting',
              targetApp: 'pulse',
              payload: {
                to: item.assigned_to_email,
                subject: `Action Item Reminder: ${item.task_description}`,
                body: nudge.message,
                priority: item.priority
              }
            });
          } catch (emailErr) {
            log.warn('[ActionItemTrackerService] Email nudge failed:', emailErr.message);
          }
          break;

        case 'in_app':
        default:
          log.info('[ActionItemTrackerService] In-app nudge:', nudge.message);
          break;
      }

      return { success: true, sent: true, channel, message: nudge.message };
    } catch (error) {
      log.error('[ActionItemTrackerService] sendNudge error:', { error: error.message || error });
      throw error;
    }
  }

  /**
   * Get empty status (when no action items exist)
   */
  getEmptyStatus() {
    return {
      summary: {
        total: 0,
        completed: 0,
        inProgress: 0,
        overdue: 0,
        blocked: 0,
        completionRate: 1
      },
      trends: {
        weekOverWeek: {
          completionRate: 0,
          avgTimeToComplete: 0
        }
      },
      benchmarks: {
        userCompletionRate: 0,
        teamAverage: 0,
        topPerformer: null
      },
      criticalOverdue: [],
      blockingChains: []
    };
  }
}

module.exports = new ActionItemTrackerService();
