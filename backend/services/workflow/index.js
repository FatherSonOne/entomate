/**
 * Workflow Module - N8N-style workflow automation
 *
 * Exports all workflow-related services and utilities
 */

const WorkflowExecutor = require('./WorkflowExecutor');
const WorkflowScheduler = require('./WorkflowScheduler');
const NodeRegistry = require('./NodeRegistry');
const WorkflowTemplates = require('./WorkflowTemplates');

// Node handlers
const TriggerNodes = require('./nodes/TriggerNodes');
const LogicNodes = require('./nodes/LogicNodes');
const ActionNodes = require('./nodes/ActionNodes');
const AINodes = require('./nodes/AINodes');
const DataNodes = require('./nodes/DataNodes');
const BaseNode = require('./nodes/BaseNode');

module.exports = {
  // Core services
  WorkflowExecutor,
  WorkflowScheduler,
  NodeRegistry,
  WorkflowTemplates,

  // Node handlers
  nodes: {
    BaseNode,
    TriggerNodes,
    LogicNodes,
    ActionNodes,
    AINodes,
    DataNodes
  },

  // Convenience methods
  createExecutor: () => new WorkflowExecutor(),
  getScheduler: () => WorkflowScheduler,
  getNodeRegistry: () => new NodeRegistry(),
  getTemplates: () => WorkflowTemplates.getAllTemplates()
};
