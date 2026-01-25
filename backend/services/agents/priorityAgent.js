/**
 * Priority Agent
 * Determines appropriate priority for tasks
 * Week 7: Automations & Basic Agents
 */

const BaseAgent = require('./baseAgent');
const ai = require('../../config/ai');
const LearningEngine = require('../learning/LearningEngine');

class PriorityAgent extends BaseAgent {
  constructor() {
    super('priorityAgent', 'Determines task priority based on impact, urgency, and context');
  }

  getCapabilities() {
    return ['impact_analysis', 'urgency_detection', 'priority_recommendation'];
  }

  /**
   * Analyze context for priority determination
   */
  async analyze(context, automation) {
    this.log('Analyzing priority context');

    return {
      taskDescription: context.task || context.task_description,
      meetingTitle: context.meetingTitle || context.meeting_title,
      meetingSentiment: context.sentiment || 'neutral',
      existingPriority: context.priority,
      dueDate: context.dueDate || context.due_date,
      actionItems: context.actionItems || [],
      keywords: this.extractKeywords(context.task || context.task_description || '')
    };
  }

  /**
   * Extract priority-relevant keywords
   */
  extractKeywords(text) {
    const highPriorityKeywords = ['urgent', 'asap', 'critical', 'immediately', 'blocker', 'emergency', 'deadline'];
    const lowPriorityKeywords = ['when possible', 'nice to have', 'eventually', 'sometime', 'optional', 'consider'];

    const lowerText = text.toLowerCase();

    return {
      hasHighPriorityIndicators: highPriorityKeywords.some(kw => lowerText.includes(kw)),
      hasLowPriorityIndicators: lowPriorityKeywords.some(kw => lowerText.includes(kw))
    };
  }

  /**
   * Generate priority suggestion
   */
  async suggest(context, automation) {
    try {
      this.log('Generating priority suggestion');

      const analysis = await this.analyze(context, automation);

      // Quick heuristic check first
      if (analysis.keywords.hasHighPriorityIndicators) {
        return {
          recommended: 'high',
          reason: 'Contains urgent language',
          confidence: 0.85,
          factors: ['urgent_keywords']
        };
      }

      if (analysis.keywords.hasLowPriorityIndicators) {
        return {
          recommended: 'low',
          reason: 'Contains non-urgent language',
          confidence: 0.8,
          factors: ['optional_keywords']
        };
      }

      // Check meeting sentiment
      if (analysis.meetingSentiment === 'negative') {
        return {
          recommended: 'high',
          reason: 'Meeting had negative sentiment, indicating issues to address',
          confidence: 0.7,
          factors: ['negative_sentiment']
        };
      }

      // Use AI for more nuanced analysis
      if (!ai.isConfigured()) {
        return {
          recommended: 'medium',
          reason: 'Default priority (AI not configured)',
          confidence: 0.5,
          factors: []
        };
      }

      const prompt = `Determine the priority for this action item:

Task: ${analysis.taskDescription}
Meeting context: ${analysis.meetingTitle || 'N/A'}
Meeting sentiment: ${analysis.meetingSentiment}
Due date: ${analysis.dueDate || 'Not specified'}

Consider:
1. Business impact
2. Time sensitivity
3. Meeting sentiment (negative = more urgent)
4. Dependencies

Return ONLY this JSON:
{
  "recommended": "high|medium|low",
  "reason": "brief reason",
  "confidence": 0.0-1.0,
  "factors": ["factor1", "factor2"]
}`;

      const response = await ai.chat(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      let suggestion;
      if (jsonMatch) {
        suggestion = JSON.parse(jsonMatch[0]);
        this.log('AI priority suggestion', { priority: suggestion.recommended });
      } else {
        suggestion = {
          recommended: 'medium',
          reason: 'Default priority',
          confidence: 0.5,
          factors: []
        };
      }

      // Apply learning patterns if userId available
      if (context.userId) {
        try {
          const learnedSuggestion = await LearningEngine.applyLearning(
            context.userId,
            'priority',
            suggestion,
            {
              task: {
                title: analysis.taskDescription,
                description: analysis.taskDescription,
                priority: suggestion.recommended
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
      this.log('Error generating priority', { error: error.message });
      return {
        recommended: 'medium',
        reason: `Analysis error: ${error.message}`,
        confidence: 0.3,
        factors: []
      };
    }
  }

  /**
   * Batch priority suggestion for multiple items
   */
  async suggestBatch(actionItems, context, automation) {
    try {
      this.log('Generating batch priority suggestions', { count: actionItems.length });

      if (!ai.isConfigured() || actionItems.length === 0) {
        return actionItems.map(item => ({
          itemId: item.id,
          recommended: 'medium',
          confidence: 0.5
        }));
      }

      const itemsList = actionItems
        .map((item, i) => `${i + 1}. ${item.task_description || item.task}`)
        .join('\n');

      const prompt = `Prioritize these action items from a meeting:

Meeting: ${context.meetingTitle || 'Unknown'}
Sentiment: ${context.sentiment || 'neutral'}

Items:
${itemsList}

Return ONLY this JSON:
{
  "priorities": [
    {"index": 1, "priority": "high|medium|low", "reason": "brief"},
    {"index": 2, "priority": "high|medium|low", "reason": "brief"}
  ],
  "reasoning": "overall approach"
}`;

      const response = await ai.chat(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return actionItems.map((item, i) => {
          const priority = result.priorities?.find(p => p.index === i + 1);
          return {
            itemId: item.id,
            recommended: priority?.priority || 'medium',
            reason: priority?.reason || '',
            confidence: 0.75
          };
        });
      }

      return actionItems.map(item => ({
        itemId: item.id,
        recommended: 'medium',
        confidence: 0.5
      }));

    } catch (error) {
      this.log('Batch error', { error: error.message });
      return actionItems.map(item => ({
        itemId: item.id,
        recommended: 'medium',
        confidence: 0.3
      }));
    }
  }

  /**
   * Execute priority update
   */
  async execute(suggestion, context) {
    this.log('Executing priority update', { priority: suggestion.recommended });

    return {
      type: 'priority',
      priority: suggestion.recommended,
      confidence: suggestion.confidence,
      reason: suggestion.reason,
      executed: true
    };
  }
}

module.exports = new PriorityAgent();
