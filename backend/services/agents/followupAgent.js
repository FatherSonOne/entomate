/**
 * Follow-up Detector Agent
 * Identifies potential follow-up tasks from meeting context
 * Week 7: Automations & Basic Agents - Optional Enhancement
 */

const BaseAgent = require('./baseAgent');
const ai = require('../../config/ai');

class FollowupAgent extends BaseAgent {
  constructor() {
    super('followupAgent', 'Identifies and suggests follow-up tasks from meeting discussions');
  }

  getCapabilities() {
    return ['follow_up_detection', 'task_extraction', 'dependency_analysis', 'reminder_suggestion'];
  }

  /**
   * Follow-up trigger patterns
   */
  getFollowUpPatterns() {
    return {
      // Direct follow-up indicators
      directIndicators: [
        'follow up',
        'follow-up',
        'check back',
        'get back to',
        'circle back',
        'touch base',
        'reconnect',
        'revisit this',
        'come back to',
        'schedule a follow-up'
      ],
      // Action-implying phrases
      actionPhrases: [
        'need to verify',
        'should confirm',
        'waiting on',
        'waiting for',
        'pending',
        'depends on',
        'once we hear',
        'after we receive',
        'when they respond',
        'let me know',
        'keep me posted',
        'update me on'
      ],
      // Time-based triggers
      timeIndicators: [
        'next week',
        'end of week',
        'by friday',
        'next month',
        'in a few days',
        'tomorrow',
        'after the meeting',
        'once complete',
        'when ready'
      ],
      // Conditional triggers
      conditionalPhrases: [
        'if we don\'t hear',
        'unless we receive',
        'if this doesn\'t work',
        'should that fail',
        'in case of',
        'depending on the outcome'
      ]
    };
  }

  /**
   * Analyze meeting context for follow-up opportunities
   */
  async analyze(context, automation) {
    this.log('Analyzing for follow-up opportunities');

    const transcript = context.transcript || '';
    const summary = context.summary || '';
    const actionItems = context.actionItems || context.action_items || [];
    const meetingTitle = context.title || context.meeting_title || 'Meeting';

    return {
      transcript,
      summary,
      actionItems,
      meetingTitle,
      meetingDate: context.meetingDate || context.created_at || new Date(),
      patterns: this.getFollowUpPatterns()
    };
  }

  /**
   * Detect follow-up opportunities using pattern matching
   */
  detectPatternBasedFollowups(text) {
    const patterns = this.getFollowUpPatterns();
    const followups = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      let matchedPattern = null;
      let category = null;

      // Check each pattern category
      for (const [cat, phrases] of Object.entries(patterns)) {
        for (const phrase of phrases) {
          if (lowerSentence.includes(phrase)) {
            matchedPattern = phrase;
            category = cat;
            break;
          }
        }
        if (matchedPattern) break;
      }

      if (matchedPattern) {
        followups.push({
          sentence: sentence.trim(),
          pattern: matchedPattern,
          category,
          confidence: this.calculatePatternConfidence(category)
        });
      }
    }

    return followups;
  }

  /**
   * Calculate confidence based on pattern category
   */
  calculatePatternConfidence(category) {
    const confidenceMap = {
      directIndicators: 0.9,
      actionPhrases: 0.75,
      timeIndicators: 0.7,
      conditionalPhrases: 0.6
    };
    return confidenceMap[category] || 0.5;
  }

  /**
   * Extract follow-up task from detected pattern
   */
  extractFollowUpTask(detection, context) {
    const { sentence, pattern, category, confidence } = detection;

    // Determine follow-up timing
    let suggestedTiming = '1 week';
    const lowerSentence = sentence.toLowerCase();

    if (lowerSentence.includes('tomorrow')) suggestedTiming = '1 day';
    else if (lowerSentence.includes('end of week') || lowerSentence.includes('by friday')) suggestedTiming = '3-5 days';
    else if (lowerSentence.includes('next week')) suggestedTiming = '1 week';
    else if (lowerSentence.includes('next month')) suggestedTiming = '1 month';
    else if (lowerSentence.includes('few days')) suggestedTiming = '3 days';

    // Calculate follow-up date
    const followUpDate = this.calculateFollowUpDate(suggestedTiming);

    return {
      originalText: sentence,
      suggestedTask: `Follow up: ${this.summarizeSentence(sentence)}`,
      triggerPattern: pattern,
      category,
      confidence,
      suggestedTiming,
      suggestedDate: followUpDate.toISOString().split('T')[0],
      priority: confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low'
    };
  }

  /**
   * Summarize a sentence into a task-like format
   */
  summarizeSentence(sentence) {
    // Remove common filler words and create a task-like summary
    let summary = sentence.trim();

    // Capitalize first letter
    summary = summary.charAt(0).toUpperCase() + summary.slice(1);

    // Truncate if too long
    if (summary.length > 100) {
      summary = summary.substring(0, 97) + '...';
    }

    return summary;
  }

  /**
   * Calculate follow-up date from timing string
   */
  calculateFollowUpDate(timing) {
    const date = new Date();

    switch (timing) {
      case '1 day':
        date.setDate(date.getDate() + 1);
        break;
      case '3 days':
        date.setDate(date.getDate() + 3);
        break;
      case '3-5 days':
        date.setDate(date.getDate() + 4);
        break;
      case '1 week':
        date.setDate(date.getDate() + 7);
        break;
      case '2 weeks':
        date.setDate(date.getDate() + 14);
        break;
      case '1 month':
        date.setMonth(date.getMonth() + 1);
        break;
      default:
        date.setDate(date.getDate() + 7);
    }

    // Skip weekends
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) date.setDate(date.getDate() + 1);
    if (dayOfWeek === 6) date.setDate(date.getDate() + 2);

    return date;
  }

  /**
   * Generate follow-up suggestions
   */
  async suggest(context, automation) {
    try {
      this.log('Generating follow-up suggestions');

      const analysis = await this.analyze(context, automation);
      const textToAnalyze = analysis.transcript || analysis.summary || '';

      if (!textToAnalyze) {
        return {
          followups: [],
          message: 'No text content to analyze'
        };
      }

      // First try pattern-based detection
      const patternDetections = this.detectPatternBasedFollowups(textToAnalyze);

      // Extract tasks from detections
      let followups = patternDetections.map(detection =>
        this.extractFollowUpTask(detection, analysis)
      );

      // If AI is available, enhance with AI analysis
      if (ai.isConfigured() && textToAnalyze.length > 50) {
        try {
          const aiFollowups = await this.getAIFollowUpSuggestions(textToAnalyze, analysis);

          // Merge AI suggestions with pattern-based ones, avoiding duplicates
          for (const aiFollowup of aiFollowups) {
            const isDuplicate = followups.some(f =>
              this.calculateSimilarity(f.suggestedTask, aiFollowup.suggestedTask) > 0.7
            );
            if (!isDuplicate) {
              followups.push(aiFollowup);
            }
          }
        } catch (aiError) {
          this.log('AI enhancement failed, using pattern-based only', { error: aiError.message });
        }
      }

      // Sort by confidence
      followups.sort((a, b) => b.confidence - a.confidence);

      // Limit to top 10 most confident suggestions
      followups = followups.slice(0, 10);

      this.log('Follow-up suggestions generated', { count: followups.length });

      return {
        followups,
        meetingTitle: analysis.meetingTitle,
        analyzedDate: new Date().toISOString(),
        totalDetections: patternDetections.length
      };

    } catch (error) {
      this.log('Error generating follow-ups', { error: error.message });
      return {
        followups: [],
        error: error.message
      };
    }
  }

  /**
   * Get AI-powered follow-up suggestions
   */
  async getAIFollowUpSuggestions(text, analysis) {
    const prompt = `Analyze this meeting content and identify any follow-up actions that should be scheduled:

Meeting: ${analysis.meetingTitle}
Content:
${text.substring(0, 2000)}

Look for:
1. Promises to get back to someone
2. Items pending external response
3. Tasks that need verification later
4. Decisions that need to be confirmed
5. Items waiting on dependencies

Return ONLY this JSON (no explanation):
{
  "followups": [
    {
      "task": "Clear action description",
      "reason": "Why this needs follow-up",
      "timing": "when to follow up (e.g., '3 days', '1 week')",
      "priority": "high|medium|low",
      "confidence": 0.0-1.0
    }
  ]
}`;

    const response = await ai.chat(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return (result.followups || []).map(f => ({
        suggestedTask: `Follow up: ${f.task}`,
        reason: f.reason,
        suggestedTiming: f.timing,
        suggestedDate: this.calculateFollowUpDate(f.timing).toISOString().split('T')[0],
        priority: f.priority || 'medium',
        confidence: f.confidence || 0.7,
        source: 'ai'
      }));
    }

    return [];
  }

  /**
   * Calculate text similarity (simple Jaccard)
   */
  calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }

  /**
   * Analyze existing action items for missing follow-ups
   */
  async analyzeActionItems(actionItems, context) {
    this.log('Analyzing action items for follow-up needs');

    const followupNeeds = [];

    for (const item of actionItems) {
      const description = item.task_description || item.task || '';
      const status = item.status || 'pending';

      // Skip completed items
      if (status === 'completed' || status === 'cancelled') continue;

      // Check if this action item implies a follow-up
      const patterns = this.getFollowUpPatterns();
      const lowerDesc = description.toLowerCase();

      let needsFollowup = false;
      let followupReason = '';

      // Check for dependency indicators
      if (patterns.actionPhrases.some(p => lowerDesc.includes(p))) {
        needsFollowup = true;
        followupReason = 'Waiting on external input';
      }

      // Check for conditional phrases
      if (patterns.conditionalPhrases.some(p => lowerDesc.includes(p))) {
        needsFollowup = true;
        followupReason = 'Has conditional outcome';
      }

      if (needsFollowup) {
        followupNeeds.push({
          actionItemId: item.id,
          description: description,
          reason: followupReason,
          suggestedFollowupDate: this.calculateFollowUpDate('1 week').toISOString().split('T')[0]
        });
      }
    }

    return followupNeeds;
  }

  /**
   * Execute follow-up task creation
   */
  async execute(suggestion, context) {
    this.log('Executing follow-up creation');

    const followups = suggestion.followups || [];

    return {
      type: 'followup',
      created: followups.map(f => ({
        task: f.suggestedTask,
        dueDate: f.suggestedDate,
        priority: f.priority,
        confidence: f.confidence
      })),
      count: followups.length,
      executed: true
    };
  }

  /**
   * Get batch follow-ups for multiple action items
   */
  async suggestBatch(actionItems, context, automation) {
    this.log('Generating batch follow-up suggestions', { count: actionItems.length });

    const allFollowups = [];

    // Analyze action items for follow-up needs
    const actionItemFollowups = await this.analyzeActionItems(actionItems, context);
    allFollowups.push(...actionItemFollowups.map(f => ({
      ...f,
      source: 'action_item_analysis'
    })));

    // If we have transcript/summary, analyze that too
    if (context.transcript || context.summary) {
      const suggestion = await this.suggest(context, automation);
      allFollowups.push(...(suggestion.followups || []).map(f => ({
        ...f,
        source: 'content_analysis'
      })));
    }

    return {
      followups: allFollowups,
      totalSuggestions: allFollowups.length
    };
  }
}

module.exports = new FollowupAgent();
