/**
 * Deadline Agent
 * Suggests realistic due dates for tasks
 * Week 7: Automations & Basic Agents
 */

const BaseAgent = require('./baseAgent');
const ai = require('../../config/ai');
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

    return {
      taskDescription: context.task || context.task_description,
      priority: context.priority || 'medium',
      meetingDate: new Date(meetingDate),
      complexity: this.estimateComplexity(context.task || context.task_description || ''),
      actionItems: context.actionItems || [],
      existingDeadline: context.dueDate || context.due_date
    };
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
  calculateDeadline(meetingDate, priority, complexity) {
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
      priorityDays[priority] * complexityMultiplier[complexity]
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
        analysis.complexity
      );

      // Use AI for more intelligent estimation if available
      if (!ai.isConfigured()) {
        return {
          recommended: heuristicDeadline.toISOString().split('T')[0],
          reason: `Based on ${analysis.priority} priority and ${analysis.complexity} complexity`,
          confidence: 0.7,
          complexity: analysis.complexity,
          businessDays: this.getBusinessDaysBetween(analysis.meetingDate, heuristicDeadline)
        };
      }

      const prompt = `Suggest a realistic due date for this task:

Task: ${analysis.taskDescription}
Priority: ${analysis.priority}
Meeting date: ${analysis.meetingDate.toISOString().split('T')[0]}
Estimated complexity: ${analysis.complexity}

Consider:
1. Task complexity and effort needed
2. Priority level
3. Realistic timelines (don't be too aggressive)
4. Buffer for unexpected delays

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
          complexity: analysis.complexity
        };
      } else {
        suggestion = {
          recommended: heuristicDeadline.toISOString().split('T')[0],
          reason: `Default deadline based on ${analysis.priority} priority`,
          confidence: 0.6,
          complexity: analysis.complexity
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
