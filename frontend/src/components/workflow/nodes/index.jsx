/**
 * Custom Node Components for React Flow
 *
 * These components render the visual representation of workflow nodes
 */

import React, { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import {
  Webhook, Clock, FileText, AlertCircle, Play,
  GitBranch, ArrowRightLeft, Merge, Repeat, Filter,
  Timer, StopCircle, Layers,
  Globe, Workflow, MessageSquare, Mail, ListTodo, Users, Code,
  Bot, Sparkles, FileSearch, Tags, MessageCircle, FileType,
  Shuffle, Split, Variable, Calendar, FileJson, Lock
} from 'lucide-react'

// Node category colors
const categoryColors = {
  trigger: { bg: 'bg-semantic-success-dim', border: 'border-semantic-success', icon: 'text-semantic-success' },
  logic: { bg: 'vc-bg-warning-dim', border: 'vc-border-warning', icon: 'vc-text-warning' },
  action: { bg: 'bg-semantic-info-dim', border: 'vc-border-subtle', icon: 'text-semantic-info' },
  ai: { bg: 'bg-accent-tertiary-dim', border: 'vc-border-subtle', icon: 'text-accent-tertiary' },
  data: { bg: 'bg-surface-muted', border: 'border-line-strong', icon: 'text-content-secondary' }
}

// Node type icons
const nodeIcons = {
  // Triggers
  webhook: Webhook,
  schedule: Clock,
  meeting_processed: FileText,
  action_item_created: ListTodo,
  error: AlertCircle,
  manual: Play,

  // Logic
  if: GitBranch,
  switch: ArrowRightLeft,
  merge: Merge,
  split_batches: Layers,
  loop: Repeat,
  aggregate: Layers,
  filter: Filter,
  wait: Timer,
  stop_error: StopCircle,

  // Actions
  http_request: Globe,
  execute_workflow: Workflow,
  send_slack: MessageSquare,
  send_email: Mail,
  create_task: ListTodo,
  sync_crm: Users,
  respond_webhook: Webhook,
  set_variable: Variable,
  code: Code,

  // AI
  ai_agent: Bot,
  ai_prompt: Sparkles,
  ai_extract: FileSearch,
  ai_classify: Tags,
  detect_followups: MessageCircle,
  ai_summarize: FileType,

  // Data
  transform: Shuffle,
  split: Split,
  set: Variable,
  datetime: Calendar,
  json: FileJson,
  crypto: Lock
}

// Get category from node type
const getCategory = (type) => {
  const triggerTypes = ['webhook', 'schedule', 'meeting_processed', 'action_item_created', 'error', 'manual']
  const logicTypes = ['if', 'switch', 'merge', 'split_batches', 'loop', 'aggregate', 'filter', 'wait', 'stop_error']
  const actionTypes = ['http_request', 'execute_workflow', 'send_slack', 'send_email', 'create_task', 'sync_crm', 'respond_webhook', 'set_variable', 'code']
  const aiTypes = ['ai_agent', 'ai_prompt', 'ai_extract', 'ai_classify', 'detect_followups', 'ai_summarize']

  if (triggerTypes.includes(type)) return 'trigger'
  if (logicTypes.includes(type)) return 'logic'
  if (actionTypes.includes(type)) return 'action'
  if (aiTypes.includes(type)) return 'ai'
  return 'data'
}

// Base node component
const BaseNode = memo(({ data, selected, type }) => {
  const category = getCategory(type)
  const colors = categoryColors[category]
  const IconComponent = nodeIcons[type] || Play

  // Determine which handles to show based on node type
  const isTrigger = category === 'trigger'
  const hasMultipleOutputs = ['if', 'switch', 'filter', 'split_batches', 'loop'].includes(type)

  return (
    <div
      className={`
        min-w-[180px] max-w-[280px] rounded-lg border-2 shadow-sm
        ${colors.bg} ${colors.border}
        ${selected ? 'ring-2 ring-primary-500 ring-offset-2' : ''}
        transition-all duration-150
      `}
    >
      {/* Input handle (not for triggers) */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !vc-bg-raised !border-2 !border-white"
        />
      )}

      {/* Node header */}
      <div className={`px-3 py-2 border-b ${colors.border} flex items-center gap-2`}>
        <IconComponent className={`w-4 h-4 ${colors.icon} flex-shrink-0`} />
        <span className="text-sm font-medium text-content-primary truncate">
          {data.label || type.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Node content */}
      {data.description && (
        <div className="px-3 py-2">
          <p className="text-xs text-content-tertiary line-clamp-2">{data.description}</p>
        </div>
      )}

      {/* Status indicator */}
      {data.status && (
        <div className={`px-3 py-1 text-xs flex items-center gap-1 ${
          data.status === 'success' ? 'text-semantic-success' :
          data.status === 'error' ? 'text-semantic-error' :
          data.status === 'running' ? 'text-semantic-info' :
          'text-content-tertiary'
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            data.status === 'success' ? 'vc-bg-success' :
            data.status === 'error' ? 'bg-semantic-error' :
            data.status === 'running' ? 'vc-bg-info animate-pulse' :
            'bg-surface-muted'
          }`} />
          {data.status}
        </div>
      )}

      {/* Output handles */}
      {hasMultipleOutputs ? (
        <div className="relative">
          {type === 'if' && (
            <>
              <Handle
                type="source"
                position={Position.Right}
                id="true"
                style={{ top: '30%' }}
                className="!w-3 !h-3 !vc-bg-success !border-2 !border-white"
              />
              <Handle
                type="source"
                position={Position.Right}
                id="false"
                style={{ top: '70%' }}
                className="!w-3 !h-3 !bg-semantic-error !border-2 !border-white"
              />
            </>
          )}
          {type === 'switch' && (
            <>
              <Handle
                type="source"
                position={Position.Right}
                id="case_0"
                style={{ top: '25%' }}
                className="!w-3 !h-3 !vc-bg-info !border-2 !border-white"
              />
              <Handle
                type="source"
                position={Position.Right}
                id="case_1"
                style={{ top: '50%' }}
                className="!w-3 !h-3 !vc-bg-info !border-2 !border-white"
              />
              <Handle
                type="source"
                position={Position.Right}
                id="default"
                style={{ top: '75%' }}
                className="!w-3 !h-3 !vc-bg-raised !border-2 !border-white"
              />
            </>
          )}
          {type === 'filter' && (
            <>
              <Handle
                type="source"
                position={Position.Right}
                id="matches"
                style={{ top: '30%' }}
                className="!w-3 !h-3 !vc-bg-success !border-2 !border-white"
              />
              <Handle
                type="source"
                position={Position.Right}
                id="no_match"
                style={{ top: '70%' }}
                className="!w-3 !h-3 !bg-semantic-error !border-2 !border-white"
              />
            </>
          )}
          {(type === 'split_batches' || type === 'loop') && (
            <>
              <Handle
                type="source"
                position={Position.Right}
                id="loop"
                style={{ top: '30%' }}
                className="!w-3 !h-3 !vc-bg-info !border-2 !border-white"
              />
              <Handle
                type="source"
                position={Position.Right}
                id="done"
                style={{ top: '70%' }}
                className="!w-3 !h-3 !vc-bg-success !border-2 !border-white"
              />
            </>
          )}
        </div>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !vc-bg-raised !border-2 !border-white"
        />
      )}
    </div>
  )
})

// Create node type components for each type
const createNodeComponent = (type) => memo((props) => (
  <BaseNode {...props} type={type} />
))

// Export all node types
export const nodeTypes = {
  // Triggers
  webhook: createNodeComponent('webhook'),
  schedule: createNodeComponent('schedule'),
  meeting_processed: createNodeComponent('meeting_processed'),
  action_item_created: createNodeComponent('action_item_created'),
  error: createNodeComponent('error'),
  manual: createNodeComponent('manual'),

  // Logic
  if: createNodeComponent('if'),
  switch: createNodeComponent('switch'),
  merge: createNodeComponent('merge'),
  split_batches: createNodeComponent('split_batches'),
  loop: createNodeComponent('loop'),
  aggregate: createNodeComponent('aggregate'),
  filter: createNodeComponent('filter'),
  wait: createNodeComponent('wait'),
  stop_error: createNodeComponent('stop_error'),

  // Actions
  http_request: createNodeComponent('http_request'),
  execute_workflow: createNodeComponent('execute_workflow'),
  send_slack: createNodeComponent('send_slack'),
  send_email: createNodeComponent('send_email'),
  create_task: createNodeComponent('create_task'),
  sync_crm: createNodeComponent('sync_crm'),
  respond_webhook: createNodeComponent('respond_webhook'),
  set_variable: createNodeComponent('set_variable'),
  code: createNodeComponent('code'),

  // AI
  ai_agent: createNodeComponent('ai_agent'),
  ai_prompt: createNodeComponent('ai_prompt'),
  ai_extract: createNodeComponent('ai_extract'),
  ai_classify: createNodeComponent('ai_classify'),
  detect_followups: createNodeComponent('detect_followups'),
  ai_summarize: createNodeComponent('ai_summarize'),

  // Data
  transform: createNodeComponent('transform'),
  split: createNodeComponent('split'),
  set: createNodeComponent('set'),
  datetime: createNodeComponent('datetime'),
  json: createNodeComponent('json'),
  crypto: createNodeComponent('crypto')
}

// Export helpers
export { categoryColors, nodeIcons, getCategory }
