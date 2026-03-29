/**
 * NodePalette Component
 *
 * Sidebar with draggable node types organized by category
 */

import React, { useState } from 'react'
import {
  ChevronDown, ChevronRight, Search,
  Webhook, Clock, FileText, AlertCircle, Play,
  GitBranch, ArrowRightLeft, Merge, Repeat, Filter,
  Timer, StopCircle, Layers,
  Globe, Workflow, MessageSquare, Mail, ListTodo, Users, Code,
  Bot, Sparkles, FileSearch, Tags, MessageCircle, FileType,
  Shuffle, Split, Variable, Calendar, FileJson, Lock
} from 'lucide-react'

// Node definitions organized by category
const nodeCategories = [
  {
    id: 'triggers',
    label: 'Triggers',
    description: 'Start your workflow',
    color: 'green',
    nodes: [
      { type: 'webhook', label: 'Webhook', description: 'Receive HTTP requests', icon: Webhook },
      { type: 'schedule', label: 'Schedule', description: 'Run on a schedule (cron)', icon: Clock },
      { type: 'meeting_processed', label: 'Meeting Processed', description: 'When a meeting is processed', icon: FileText },
      { type: 'action_item_created', label: 'Action Item Created', description: 'When an action item is created', icon: ListTodo },
      { type: 'error', label: 'Error Trigger', description: 'Handle workflow errors', icon: AlertCircle },
      { type: 'manual', label: 'Manual Trigger', description: 'Manually start workflow', icon: Play }
    ]
  },
  {
    id: 'logic',
    label: 'Logic',
    description: 'Control flow',
    color: 'yellow',
    nodes: [
      { type: 'if', label: 'IF', description: 'Conditional branching', icon: GitBranch },
      { type: 'switch', label: 'Switch', description: 'Multi-way branching', icon: ArrowRightLeft },
      { type: 'merge', label: 'Merge', description: 'Combine branches', icon: Merge },
      { type: 'loop', label: 'Loop', description: 'Iterate over items', icon: Repeat },
      { type: 'split_batches', label: 'Split Batches', description: 'Process in batches', icon: Layers },
      { type: 'filter', label: 'Filter', description: 'Filter items', icon: Filter },
      { type: 'aggregate', label: 'Aggregate', description: 'Collect and combine', icon: Layers },
      { type: 'wait', label: 'Wait', description: 'Pause execution', icon: Timer },
      { type: 'stop_error', label: 'Stop & Error', description: 'Stop with error', icon: StopCircle }
    ]
  },
  {
    id: 'actions',
    label: 'Actions',
    description: 'Do something',
    color: 'blue',
    nodes: [
      { type: 'http_request', label: 'HTTP Request', description: 'Make API calls', icon: Globe },
      { type: 'execute_workflow', label: 'Execute Workflow', description: 'Run sub-workflow', icon: Workflow },
      { type: 'send_slack', label: 'Send Slack', description: 'Send Slack message', icon: MessageSquare },
      { type: 'send_email', label: 'Send Email', description: 'Send email', icon: Mail },
      { type: 'create_task', label: 'Create Task', description: 'Create a task', icon: ListTodo },
      { type: 'sync_crm', label: 'Sync CRM', description: 'Sync with CRM', icon: Users },
      { type: 'respond_webhook', label: 'Respond Webhook', description: 'Send webhook response', icon: Webhook },
      { type: 'set_variable', label: 'Set Variable', description: 'Set workflow variable', icon: Variable },
      { type: 'code', label: 'Code', description: 'Run JavaScript code', icon: Code }
    ]
  },
  {
    id: 'ai',
    label: 'AI',
    description: 'AI-powered nodes',
    color: 'purple',
    nodes: [
      { type: 'ai_agent', label: 'AI Agent', description: 'Run an AI agent', icon: Bot },
      { type: 'ai_prompt', label: 'AI Prompt', description: 'Generate AI response', icon: Sparkles },
      { type: 'ai_extract', label: 'AI Extract', description: 'Extract structured data', icon: FileSearch },
      { type: 'ai_classify', label: 'AI Classify', description: 'Classify content', icon: Tags },
      { type: 'detect_followups', label: 'Detect Follow-ups', description: 'Find follow-up items', icon: MessageCircle },
      { type: 'ai_summarize', label: 'AI Summarize', description: 'Summarize content', icon: FileType }
    ]
  },
  {
    id: 'data',
    label: 'Data',
    description: 'Transform data',
    color: 'gray',
    nodes: [
      { type: 'transform', label: 'Transform', description: 'Transform data', icon: Shuffle },
      { type: 'split', label: 'Split', description: 'Split into items', icon: Split },
      { type: 'set', label: 'Set', description: 'Set field values', icon: Variable },
      { type: 'datetime', label: 'Date/Time', description: 'Date operations', icon: Calendar },
      { type: 'json', label: 'JSON', description: 'JSON operations', icon: FileJson },
      { type: 'crypto', label: 'Crypto', description: 'Hash and encrypt', icon: Lock }
    ]
  }
]

// Color mappings
const colorClasses = {
  green: {
    bg: 'bg-semantic-success-dim',
    border: 'border-semantic-success',
    text: 'text-semantic-success',
    icon: 'text-semantic-success',
    hover: 'hover:bg-semantic-success-dim'
  },
  yellow: {
    bg: 'vc-bg-warning-dim',
    border: 'vc-border-warning',
    text: 'vc-text-warning',
    icon: 'vc-text-warning',
    hover: 'hover:vc-bg-warning-dim'
  },
  blue: {
    bg: 'bg-semantic-info-dim',
    border: 'border-semantic-info',
    text: 'text-semantic-info',
    icon: 'text-semantic-info',
    hover: 'hover:bg-semantic-info-dim'
  },
  purple: {
    bg: 'bg-accent-tertiary-dim',
    border: 'border-accent-tertiary',
    text: 'text-accent-tertiary',
    icon: 'text-accent-tertiary',
    hover: 'hover:bg-accent-tertiary-dim'
  },
  gray: {
    bg: 'bg-surface-muted',
    border: 'border-line-default',
    text: 'text-content-secondary',
    icon: 'text-content-secondary',
    hover: 'hover:bg-surface-muted'
  }
}

export default function NodePalette({ onAddNode }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCategories, setExpandedCategories] = useState({
    triggers: true,
    logic: true,
    actions: true,
    ai: true,
    data: true
  })

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }))
  }

  const handleDragStart = (event, node, category) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({
      type: node.type,
      label: node.label,
      category: category.id
    }))
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleNodeClick = (node) => {
    if (onAddNode) {
      onAddNode(node.type, node.label)
    }
  }

  // Filter nodes based on search
  const filteredCategories = nodeCategories.map(category => ({
    ...category,
    nodes: category.nodes.filter(node =>
      node.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.nodes.length > 0)

  return (
    <div className="w-64 bg-surface border-r border-line-default flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-line-default">
        <h3 className="text-sm font-semibold text-content-primary mb-2">Nodes</h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-line-default rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredCategories.map((category) => {
          const colors = colorClasses[category.color]
          const isExpanded = expandedCategories[category.id]

          return (
            <div key={category.id} className="rounded-lg overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 ${colors.bg} ${colors.hover} transition-colors`}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-content-tertiary" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-content-tertiary" />
                )}
                <span className={`text-sm font-medium ${colors.text}`}>{category.label}</span>
                <span className="text-xs text-content-tertiary ml-auto">{category.nodes.length}</span>
              </button>

              {/* Nodes */}
              {isExpanded && (
                <div className="py-1 space-y-0.5">
                  {category.nodes.map((node) => {
                    const IconComponent = node.icon

                    return (
                      <div
                        key={node.type}
                        draggable
                        onDragStart={(e) => handleDragStart(e, node, category)}
                        onClick={() => handleNodeClick(node)}
                        className={`
                          flex items-center gap-2 px-3 py-2 mx-1 rounded-md cursor-grab
                          border ${colors.border} ${colors.bg}
                          hover:shadow-sm hover:border-line-strong transition-all
                          active:cursor-grabbing
                        `}
                        title={node.description}
                      >
                        <IconComponent className={`w-4 h-4 ${colors.icon} flex-shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-content-primary truncate">{node.label}</p>
                          <p className="text-xs text-content-tertiary truncate">{node.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {filteredCategories.length === 0 && (
          <div className="text-center py-8 text-content-tertiary">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No nodes found</p>
          </div>
        )}
      </div>

      {/* Help text */}
      <div className="p-3 border-t border-line-default bg-surface-muted">
        <p className="text-xs text-content-tertiary">
          Drag nodes to the canvas or click to add at center
        </p>
      </div>
    </div>
  )
}

// Export for use elsewhere
export { nodeCategories, colorClasses }
