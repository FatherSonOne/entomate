/**
 * Agent Registry
 * Exports all available agents
 * Week 7: Automations & Basic Agents
 */

const BaseAgent = require('./baseAgent');
const assignmentAgent = require('./assignmentAgent');
const priorityAgent = require('./priorityAgent');
const deadlineAgent = require('./deadlineAgent');
const followupAgent = require('./followupAgent');
const ragHandler = require('./ragHandler');

// Agent registry
const agents = {
  assignment: assignmentAgent,
  priority: priorityAgent,
  deadline: deadlineAgent,
  followup: followupAgent,
  ragHandler,
  rag: ragHandler
};

/**
 * Get agent by name
 */
function getAgent(name) {
  return agents[name] || null;
}

/**
 * Get all available agents
 */
function getAllAgents() {
  return Object.entries(agents).map(([key, agent]) => ({
    id: key,
    ...agent.getMetadata()
  }));
}

/**
 * Check if agent exists
 */
function hasAgent(name) {
  return !!agents[name];
}

module.exports = {
  BaseAgent,
  assignmentAgent,
  priorityAgent,
  deadlineAgent,
  followupAgent,
  ragHandler,
  getAgent,
  getAllAgents,
  hasAgent
};
