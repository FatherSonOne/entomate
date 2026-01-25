/**
 * Assignment Agent
 * Determines the best person to assign a task to
 * Week 7: Automations & Basic Agents
 */

const BaseAgent = require('./baseAgent');
const ai = require('../../config/ai');
const { supabase } = require('../../config/supabase');
const LearningEngine = require('../learning/LearningEngine');

class AssignmentAgent extends BaseAgent {
  constructor() {
    super('assignmentAgent', 'Determines the best person to assign tasks based on skills, workload, and availability');
  }

  getCapabilities() {
    return ['skill_matching', 'workload_analysis', 'availability_check'];
  }

  /**
   * Analyze the task and team context
   */
  async analyze(context, automation) {
    this.log('Analyzing assignment context');

    // Get team members
    let teamMembers = context.team || [];

    // If no team provided, try to get from database
    if (teamMembers.length === 0 && supabase) {
      try {
        const { data: members } = await supabase
          .from('team_members')
          .select('*')
          .eq('active', true);

        teamMembers = members || [];
      } catch (error) {
        this.log('Could not fetch team members', { error: error.message });
      }
    }

    // Get current workload for each team member
    const workload = {};
    if (supabase && teamMembers.length > 0) {
      try {
        for (const member of teamMembers) {
          const { count } = await supabase
            .from('action_items')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to_name', member.name)
            .in('status', ['open', 'in_progress']);

          workload[member.name] = count || 0;
        }
      } catch (error) {
        this.log('Could not fetch workload', { error: error.message });
      }
    }

    return {
      taskDescription: context.task || context.task_description,
      taskPriority: context.priority || 'medium',
      requiredSkills: context.requiredSkills || [],
      teamMembers,
      workload,
      meetingContext: context.meetingTitle || context.meeting_title
    };
  }

  /**
   * Generate assignment suggestion
   */
  async suggest(context, automation) {
    try {
      this.log('Generating assignment suggestion');

      const analysis = await this.analyze(context, automation);

      // If no team members, return unassigned
      if (!analysis.teamMembers || analysis.teamMembers.length === 0) {
        return {
          recommended: null,
          reason: 'No team members available',
          confidence: 0,
          alternatives: []
        };
      }

      // If only one team member, assign to them
      if (analysis.teamMembers.length === 1) {
        return {
          recommended: analysis.teamMembers[0].name,
          reason: 'Only available team member',
          confidence: 1.0,
          alternatives: []
        };
      }

      // Use AI for intelligent assignment
      if (!ai.isConfigured()) {
        // Fallback: assign to person with lowest workload
        const lowestWorkload = Object.entries(analysis.workload)
          .sort((a, b) => a[1] - b[1])[0];

        return {
          recommended: lowestWorkload ? lowestWorkload[0] : analysis.teamMembers[0].name,
          reason: 'Assigned to team member with lowest workload (AI not configured)',
          confidence: 0.6,
          alternatives: analysis.teamMembers.slice(0, 3).map(m => m.name)
        };
      }

      // Build prompt for AI
      const teamInfo = analysis.teamMembers
        .map(m => {
          const skills = m.skills?.join(', ') || 'general';
          const currentTasks = analysis.workload[m.name] || 0;
          return `- ${m.name}: Skills: ${skills}, Current tasks: ${currentTasks}`;
        })
        .join('\n');

      const prompt = `Given this action item and team, who should be assigned?

Task: ${analysis.taskDescription}
Priority: ${analysis.taskPriority}
Meeting context: ${analysis.meetingContext || 'N/A'}

Team:
${teamInfo}

Consider:
1. Skill match with the task
2. Current workload (fewer tasks = more available)
3. Priority (high priority = assign to most capable)

Return ONLY this JSON (no markdown, no explanation):
{
  "recommended": "person's name",
  "reason": "brief reason (1 sentence)",
  "confidence": 0.0-1.0,
  "alternatives": ["name1", "name2"]
}`;

      const response = await ai.chat(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      let suggestion;
      if (jsonMatch) {
        suggestion = JSON.parse(jsonMatch[0]);
        this.log('AI suggestion generated', { recommended: suggestion.recommended });
      } else {
        // Fallback if AI response parsing fails
        suggestion = {
          recommended: analysis.teamMembers[0].name,
          reason: 'Default assignment',
          confidence: 0.5,
          alternatives: analysis.teamMembers.slice(1, 3).map(m => m.name)
        };
      }

      // Apply learning patterns if userId available
      if (context.userId) {
        try {
          const learnedSuggestion = await LearningEngine.applyLearning(
            context.userId,
            'assignment',
            suggestion,
            {
              task: {
                title: analysis.taskDescription,
                description: analysis.taskDescription,
                priority: analysis.taskPriority
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
      this.log('Error generating suggestion', { error: error.message });
      return {
        recommended: context.team?.[0]?.name || null,
        reason: `Error in analysis: ${error.message}`,
        confidence: 0.3,
        alternatives: []
      };
    }
  }

  /**
   * Execute the assignment
   */
  async execute(suggestion, context) {
    this.log('Executing assignment', { assignee: suggestion.recommended });

    if (!suggestion.recommended) {
      return {
        type: 'assignment',
        executed: false,
        reason: 'No recommended assignee'
      };
    }

    // Update the action item if we have an ID
    if (context.actionItemId && supabase) {
      try {
        await supabase
          .from('action_items')
          .update({
            assigned_to_name: suggestion.recommended,
            updated_at: new Date().toISOString()
          })
          .eq('id', context.actionItemId);

        this.log('Assignment updated in database');
      } catch (error) {
        this.log('Failed to update database', { error: error.message });
      }
    }

    return {
      type: 'assignment',
      assignedTo: suggestion.recommended,
      confidence: suggestion.confidence,
      reason: suggestion.reason,
      executed: true
    };
  }
}

module.exports = new AssignmentAgent();
