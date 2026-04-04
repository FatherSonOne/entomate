/**
 * Agent Registry Service
 * Delegates to typed agents in agents/ directory
 *
 * The typed agents (assignment, priority, deadline, followup) provide:
 * - LearningEngine integration for pattern-based improvements
 * - Workload analysis and skill matching (assignment)
 * - Keyword extraction and sentiment analysis (priority)
 * - Complexity estimation and business-day calculation (deadline)
 * - Pattern matching and AI-powered follow-up detection (followup)
 */

const typedAgents = require('./agents/index');

module.exports = {
  getAgent: typedAgents.getAgent,
  getAllAgents: typedAgents.getAllAgents,
  hasAgent: typedAgents.hasAgent,
  agents: {
    assignment: typedAgents.assignmentAgent,
    priority: typedAgents.priorityAgent,
    deadline: typedAgents.deadlineAgent,
    followup: typedAgents.followupAgent
  }
};
