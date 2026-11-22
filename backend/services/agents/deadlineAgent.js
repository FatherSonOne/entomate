/**
 * Deadline Agent
 * Suggests realistic due dates for tasks
 * Week 7: Automations & Basic Agents
 */

const BaseAgent = require('./baseAgent');
const ai = require('../../config/ai');
const { supabase } = require('../../config/supabase');
const LearningEngine = require('../learning/LearningEngine');

class DeadlineAgent extends BaseAgent {
  constructor() {
    super('deadlineAgent', 'Suggests realistic due dates based on task complexity and priority');
  }

  getCapabilities() {
    return ['complexity_estimation', 'deadline_suggestion', 'timeline_planning'];
  }

  /**
   * Analyze context for deadline estimation
   */
  async analyze(context, automation) {
    this.log('Analyzing deadline context');

    const meetingDate = context.meetingDate || context.meeting_date || context.created_at || new Date();
    const owner = context.assignedTo || context.assigned_to_name || null;

    return {
      owner,
      ownerOpenItems: await this.getOwnerWorkload(owner, context.orgId, context.actionItemId),
      taskDescription: context.task || context.task_description,
      priority: context.priority || 'medium',
      meetingDate: new Date(meetingDate),
      complexity: this.estimateComplexity(context.task || context.task_description || ''),
      actionItems: context.actionItems || [],
      existingDeadline: context.dueDate || context.due_date
    };
  }

  /**
   * Count the owner's other open items in the same org.
   * Returns null when there is no owner, no org or no database, so the
   * deadline falls back to priority and complexity alone.
   */
  async getOwnerWorkload(owner, orgId, excludeItemId) {
    if (!owner || !orgId || !supabase) return null;
    try {
      let query = supabase
        .from('action_items')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('assigned_to_name', owner)
        .in('status', ['open', 'in_progress']);
      if (excludeItemId) query = query.neq('id', excludeItemId);
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    } catch (error) {
      this.log('Could not fetch owner workload', { error: error.message });
      return null;
    }
  }

  /**
   * More open work means more time: 0-2 open items add nothing,
   * 3-5 add a quarter, 6-9 add half, 10+ double the window.
   */
  workloadMultiplier(openItems) {
    if (typeof openItems !== 'number') return 1;
    if (openItems >= 10) return 2;
    if (openItems >= 6) return 1.5;
    if (openItems >= 3) return 1.25;
    return 1;
  }

  /** Human reason for the heuristic deadline. */
  describeBasis(analysis) {
    const parts = [`${analysis.priority} priority`, `${analysis.complexity} complexity`];
    if (typeof analysis.ownerOpenItems === 'number') {
      parts.push(`${analysis.owner} has ${analysis.ownerOpenItems} other open item${analysis.ownerOpenItems === 1 ? '' : 's'}`);
    }
    return `Based on ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  }

  /**
   * Estimate task complexity from description
   */
  estimateComplexity(description) {
    const lowerDesc = description.toLowerCase();

    // High complexity indicators
    const highComplexity = ['implement', 'build', 'develop', 'create system', 'redesign', 'migrate', 'integrate'];
    // Low complexity indicators
    const lowComplexity = ['update', 'review', 'check', 'confirm', 'send', 'email', 'call', 'schedule'];

    if (highComplexity.some(kw => lowerDesc.includes(kw))) {
      return 'high';
    }
    if (lowComplexity.some(kw => lowerDesc.includes(kw))) {
      return 'low';
    }
    return 'medium';
  }

  /**
   * Calculate deadline based on priority and complexity
   */
  calculateDeadline(meetingDate, priority, complexity, workloadFactor = 1) {
    const baseDate = new Date(meetingDate);

    // Base days by priority
    const priorityDays = {
      high: 3,
      medium: 7,
      low: 14
    };

    // Multiplier by complexity
    const complexityMultiplier = {
      high: 2,
      medium: 1,
      low: 0.5
    };

    const daysToAdd = Math.ceil(
      (priorityDays[priority] || priorityDays.medium) *
      (complexityMultiplier[complexity] || 1) *
      workloadFactor
    );

    // Add days (skip weekends for business days)
    let deadline = new Date(baseDate);
    let addedDays = 0;

    while (addedDays < daysToAdd) {
      deadline.setDate(deadline.getDate() + 1);
      const dayOfWeek = deadline.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        addedDays++;
      }
    }

    return deadline;
  }

  /**
   * Generate deadline suggestion
   */
  async suggest(context, automation) {
    try {
      this.log('Generating deadline suggestion');

      const analysis = await this.analyze(context, automation);

      // If deadline already exists, don't override
      if (analysis.existingDeadline) {
        return {
          recommended: analysis.existingDeadline,
          reason: 'Deadline already specified',
          confidence: 1.0,
          isExisting: true
        };
      }

      // Calculate heuristic deadline
      const heuristicDeadline = this.calculateDeadline(
        analysis.meetingDate,
        analysis.priority,
        analysis.complexity,
        this.workloadMultiplier(analysis.ownerOpenItems)
      );

      // Use AI for more intelligent estimation if available
      if (!ai.isConfigured()) {
        return {
          recommended: heuristicDeadline.toISOString().split('T')[0],
          reason: this.describeBasis(analysis),
          confidence: 0.7,
          complexity: analysis.complexity,
          ownerOpenItems: analysis.ownerOpenItems,
          businessDays: this.getBusinessDaysBetween(analysis.meetingDate, heuristicDeadline)
        };
      }

      const prompt = `Suggest a realistic due date for this task:

Task: ${analysis.taskDescription}
Priority: ${analysis.priority}
Meeting date: ${analysis.meetingDate.toISOString().split('T')[0]}
Estimated complexity: ${analysis.complexity}
${typeof analysis.ownerOpenItems === 'number'
  ? `Owner: ${analysis.owner}, who already has ${analysis.ownerOpenItems} other open item(s)`
  : 'Owner: not known yet'}

Consider:
1. Task complexity and effort needed
2. Priority level
3. The owner's current workload (more open items means more time)
4. Realistic timelines (don't be too aggressive)
5. Buffer for unexpected delays

Today is ${new Date().toISOString().split('T')[0]}.

Return ONLY this JSON:
{
  "recommended": "YYYY-MM-DD",
  "reason": "brief explanation",
  "confidence": 0.0-1.0,
  "estimatedHours": number
}`;

      const response = await ai.chat(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      let suggestion;
      if (jsonMatch) {
        suggestion = JSON.parse(jsonMatch[0]);
        this.log('AI deadline suggestion', { deadline: suggestion.recommended });
        suggestion = {
          ...suggestion,
          complexity: analysis.complexity,
          ownerOpenItems: analysis.ownerOpenItems
        };
      } else {
        suggestion = {
          recommended: heuristicDeadline.toISOString().split('T')[0],
          reason: this.describeBasis(analysis),
          confidence: 0.6,
          complexity: analysis.complexity,
          ownerOpenItems: analysis.ownerOpenItems
        };
      }

      // Apply learning patterns if userId available
      if (context.userId) {
        try {
          const learnedSuggestion = await LearningEngine.applyLearning(
            context.userId,
            'deadline',
            suggestion,
            {
              task: {
                title: analysis.taskDescription,
                description: analysis.taskDescription,
                priority: analysis.priority
              }
            }
          );

          if (learnedSuggestion._learningMetadata) {
            this.log('Learning patterns applied', {
              patternsApplied: learnedSuggestion._learningMetadata.patternsApplied
            });
          }

          return learnedSuggestion;
        } catch (learningError) {
          this.log('Learning application failed, using original suggestion', {
            error: learningError.message
          });
        }
      }

      return suggestion;

    } catch (error) {
      this.log('Error generating deadline', { error: error.message });

      // Fallback to simple calculation
      const fallbackDate = new Date();
      fallbackDate.setDate(fallbackDate.getDate() + 7);

      return {
        recommended: fallbackDate.toISOString().split('T')[0],
        reason: `Default 1-week deadline (error: ${error.message})`,
        confidence: 0.3
      };
    }
  }

  /**
   * Get business days between two dates
   */
  getBusinessDaysBetween(start, end) {
    let count = 0;
    const current = new Date(start);

    while (current < end) {
      current.setDate(current.getDate() + 1);
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
    }

    return count;
  }

  /**
   * Batch deadline suggestion for multiple items
   */
  async suggestBatch(actionItems, context, automation) {
    try {
      this.log('Generating batch deadline suggestions', { count: actionItems.length });

      const meetingDate = context.meetingDate || context.created_at || new Date();

      if (!ai.isConfigured()) {
        return actionItems.map(item => {
          const priority = item.priority || 'medium';
          const complexity = this.estimateComplexity(item.task_description || item.task || '');
          const deadline = this.calculateDeadline(meetingDate, priority, complexity);

          return {
            itemId: item.id,
            recommended: deadline.toISOString().split('T')[0],
            confidence: 0.6,
            complexity
          };
        });
      }

      const itemsList = actionItems
        .map((item, i) => `${i + 1}. ${item.task_description || item.task} (priority: ${item.priority || 'medium'})`)
        .join('\n');

      const prompt = `Suggest due dates for these action items from a meeting on ${new Date(meetingDate).toISOString().split('T')[0]}:

${itemsList}

Today is ${new Date().toISOString().split('T')[0]}.

Return ONLY this JSON:
{
  "deadlines": [
    {"index": 1, "date": "YYYY-MM-DD", "reason": "brief"},
    {"index": 2, "date": "YYYY-MM-DD", "reason": "brief"}
  ]
}`;

      const response = await ai.chat(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return actionItems.map((item, i) => {
          const deadline = result.deadlines?.find(d => d.index === i + 1);
          return {
            itemId: item.id,
            recommended: deadline?.date || this.calculateDeadline(meetingDate, item.priority || 'medium', 'medium').toISOString().split('T')[0],
            reason: deadline?.reason || '',
            confidence: 0.75
          };
        });
      }

      return actionItems.map(item => ({
        itemId: item.id,
        recommended: this.calculateDeadline(meetingDate, item.priority || 'medium', 'medium').toISOString().split('T')[0],
        confidence: 0.5
      }));

    } catch (error) {
      this.log('Batch error', { error: error.message });
      return actionItems.map(item => ({
        itemId: item.id,
        recommended: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        confidence: 0.3
      }));
    }
  }

  /**
   * Execute deadline update
   */
  async execute(suggestion, context) {
    this.log('Executing deadline update', { deadline: suggestion.recommended });

    return {
      type: 'deadline',
      dueDate: suggestion.recommended,
      confidence: suggestion.confidence,
      reason: suggestion.reason,
      executed: true
    };
  }
}

module.exports = new DeadlineAgent();
