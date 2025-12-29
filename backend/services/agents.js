/**
 * Agent Registry Service
 * Provides access to AI agent definitions
 * Week 7: Automations & Basic Agents
 */

const geminiService = require('../config/gemini');

// Available agents registry
const agents = {
  assignment: {
    name: 'Assignment Agent',
    description: 'Suggests the best team member to assign tasks to',
    capabilities: ['team analysis', 'workload balancing', 'skill matching'],
    async suggest(context, automation = {}) {
      const { task, team = [], currentAssignee } = context;

      if (!team.length) {
        return {
          recommended: currentAssignee || null,
          confidence: 0.5,
          reason: 'No team members available for analysis'
        };
      }

      // Use AI to analyze and suggest
      try {
        const prompt = `Given this task: "${task}"
And these team members: ${team.map(m => `${m.name} (skills: ${m.skills?.join(', ') || 'general'})`).join(', ')}
Who would be the best person to assign this to? Consider workload and skills.
Respond with JSON: { "recommended": "name", "confidence": 0.0-1.0, "reason": "brief reason" }`;

        const result = await geminiService.generateText(prompt);
        return JSON.parse(result);
      } catch (error) {
        console.error('[AssignmentAgent] Error:', error);
        return {
          recommended: team[0]?.name || null,
          confidence: 0.3,
          reason: 'Default assignment due to analysis error'
        };
      }
    }
  },

  priority: {
    name: 'Priority Agent',
    description: 'Analyzes tasks to suggest appropriate priority levels',
    capabilities: ['urgency detection', 'importance assessment', 'deadline awareness'],
    async suggest(context, automation = {}) {
      const { task, meetingTitle, sentiment, currentPriority, dueDate } = context;

      try {
        const prompt = `Analyze this task and suggest a priority level.
Task: "${task}"
${meetingTitle ? `From meeting: "${meetingTitle}"` : ''}
${sentiment ? `Meeting sentiment: ${sentiment}` : ''}
${dueDate ? `Current due date: ${dueDate}` : ''}

Priority levels: high, medium, low
Respond with JSON: { "recommended": "priority", "confidence": 0.0-1.0, "reason": "brief reason" }`;

        const result = await geminiService.generateText(prompt);
        return JSON.parse(result);
      } catch (error) {
        console.error('[PriorityAgent] Error:', error);
        return {
          recommended: currentPriority || 'medium',
          confidence: 0.5,
          reason: 'Default priority due to analysis error'
        };
      }
    }
  },

  deadline: {
    name: 'Deadline Agent',
    description: 'Suggests realistic deadlines based on task complexity',
    capabilities: ['complexity estimation', 'workload awareness', 'calendar integration'],
    async suggest(context, automation = {}) {
      const { task, priority, currentDeadline } = context;

      try {
        const today = new Date();
        const prompt = `Suggest a realistic deadline for this task.
Task: "${task}"
Priority: ${priority || 'medium'}
Today's date: ${today.toISOString().split('T')[0]}

Consider task complexity and priority.
Respond with JSON: { "recommended": "YYYY-MM-DD", "confidence": 0.0-1.0, "reason": "brief reason" }`;

        const result = await geminiService.generateText(prompt);
        return JSON.parse(result);
      } catch (error) {
        console.error('[DeadlineAgent] Error:', error);
        // Default to 1 week from now
        const defaultDeadline = new Date();
        defaultDeadline.setDate(defaultDeadline.getDate() + 7);
        return {
          recommended: defaultDeadline.toISOString().split('T')[0],
          confidence: 0.4,
          reason: 'Default deadline (1 week) due to analysis error'
        };
      }
    }
  },

  followup: {
    name: 'Follow-up Agent',
    description: 'Identifies required follow-up actions from meeting content',
    capabilities: ['action extraction', 'commitment tracking', 'follow-up scheduling'],
    async suggest(context, automation = {}) {
      const { transcript, summary, actionItems = [] } = context;

      try {
        const prompt = `Analyze this meeting content for follow-up actions.
Summary: "${summary || 'No summary available'}"
Existing action items: ${actionItems.length}

Identify any additional follow-up actions needed.
Respond with JSON: { "followUps": [{ "action": "description", "urgency": "high/medium/low" }], "confidence": 0.0-1.0 }`;

        const result = await geminiService.generateText(prompt);
        return JSON.parse(result);
      } catch (error) {
        console.error('[FollowupAgent] Error:', error);
        return {
          followUps: [],
          confidence: 0.3,
          reason: 'Unable to analyze for follow-ups'
        };
      }
    }
  }
};

/**
 * Get a specific agent by name
 */
function getAgent(agentName) {
  return agents[agentName] || null;
}

/**
 * Get all available agents
 */
function getAllAgents() {
  return Object.entries(agents).map(([key, agent]) => ({
    id: key,
    name: agent.name,
    description: agent.description,
    capabilities: agent.capabilities
  }));
}

/**
 * Check if an agent exists
 */
function hasAgent(agentName) {
  return !!agents[agentName];
}

module.exports = {
  getAgent,
  getAllAgents,
  hasAgent,
  agents
};
