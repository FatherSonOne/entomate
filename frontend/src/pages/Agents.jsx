import { useState, useEffect } from 'react';
import {
  Bot, Plus, Play, Pause, Settings, Trash2,
  Activity, CheckCircle, XCircle, Clock,
  Zap, MessageSquare, FolderPlus, Users,
  TrendingUp, Rocket, UserPlus, ChevronRight
} from 'lucide-react';
import api from '../services/api';

const iconMap = {
  'bot': Bot,
  'rocket': Rocket,
  'message-circle': MessageSquare,
  'activity': Activity,
  'user-plus': UserPlus,
  'trending-up': TrendingUp,
  'zap': Zap
};

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [executionLogs, setExecutionLogs] = useState([]);

  useEffect(() => {
    fetchAgents();
    fetchTemplates();
  }, []);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/agents');
      setAgents(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/agents/templates');
      setTemplates(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const fetchAgentLogs = async (agentId) => {
    try {
      const response = await api.get(`/agents/${agentId}/logs`);
      setExecutionLogs(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const toggleAgent = async (agentId) => {
    try {
      await api.post(`/agents/${agentId}/toggle`);
      fetchAgents();
    } catch (error) {
      console.error('Failed to toggle agent:', error);
    }
  };

  const createFromTemplate = async (templateId) => {
    try {
      await api.post('/agents/from-template', { templateId });
      setShowTemplates(false);
      fetchAgents();
    } catch (error) {
      console.error('Failed to create agent:', error);
    }
  };

  const deleteAgent = async (agentId) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    try {
      await api.delete(`/agents/${agentId}`);
      setSelectedAgent(null);
      fetchAgents();
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const executeAgent = async (agentId) => {
    try {
      const agent = agents.find(a => a.id === agentId);
      const triggerType = agent?.triggers?.[0]?.type || 'manual';
      await api.post(`/agents/${agentId}/execute`, {
        trigger_type: triggerType,
        trigger_data: { manual: true }
      });
      fetchAgentLogs(agentId);
    } catch (error) {
      console.error('Failed to execute agent:', error);
    }
  };

  const selectAgent = (agent) => {
    setSelectedAgent(agent);
    fetchAgentLogs(agent.id);
  };

  const AgentIcon = ({ icon, className }) => {
    const Icon = iconMap[icon] || Bot;
    return <Icon className={className} />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bot className="h-7 w-7 text-primary-600" />
            AI Agents
          </h1>
          <p className="text-gray-500 mt-1">
            Autonomous agents that automate your workflows
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowTemplates(true)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            From Template
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Agent
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agents List */}
        <div className="lg:col-span-2 space-y-4">
          {agents.length === 0 ? (
            <div className="card p-8 text-center">
              <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No agents yet</h3>
              <p className="text-gray-500 mb-4">
                Create your first AI agent to automate workflows
              </p>
              <button
                onClick={() => setShowTemplates(true)}
                className="btn btn-primary"
              >
                Browse Templates
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => selectAgent(agent)}
                  className={`card p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedAgent?.id === agent.id ? 'ring-2 ring-primary-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${
                        agent.enabled ? 'bg-primary-100' : 'bg-gray-100'
                      }`}>
                        <AgentIcon
                          icon={agent.icon}
                          className={`h-6 w-6 ${
                            agent.enabled ? 'text-primary-600' : 'text-gray-400'
                          }`}
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          {agent.name}
                          {agent.agent_type === 'predefined' && (
                            <span className="badge badge-blue text-xs">Template</span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {agent.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            {agent.execution_count || 0} runs
                          </span>
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            {((agent.success_rate || 0) * 100).toFixed(0)}% success
                          </span>
                          {agent.last_executed_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(agent.last_executed_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAgent(agent.id);
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          agent.enabled
                            ? 'bg-green-100 text-green-600 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                        title={agent.enabled ? 'Disable' : 'Enable'}
                      >
                        {agent.enabled ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                      </button>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>

                  {/* Triggers & Actions Summary */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                    {agent.triggers?.map((trigger, i) => (
                      <span key={i} className="badge badge-purple text-xs">
                        {trigger.type}
                      </span>
                    ))}
                    <span className="text-gray-400">→</span>
                    {agent.actions?.slice(0, 3).map((action, i) => (
                      <span key={i} className="badge badge-gray text-xs">
                        {action.type}
                      </span>
                    ))}
                    {agent.actions?.length > 3 && (
                      <span className="text-xs text-gray-400">
                        +{agent.actions.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent Details Panel */}
        <div className="space-y-4">
          {selectedAgent ? (
            <>
              {/* Agent Info */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Agent Details</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => executeAgent(selectedAgent.id)}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                      title="Run Now"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteAgent(selectedAgent.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Status</label>
                    <p className={`font-medium ${
                      selectedAgent.enabled ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {selectedAgent.enabled ? 'Active' : 'Disabled'}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase">Triggers</label>
                    <div className="space-y-1 mt-1">
                      {selectedAgent.triggers?.map((trigger, i) => (
                        <div key={i} className="text-sm">
                          <span className="font-medium">{trigger.type}</span>
                          {trigger.conditions?.length > 0 && (
                            <span className="text-gray-500 ml-2">
                              ({trigger.conditions.length} conditions)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase">Actions</label>
                    <div className="space-y-1 mt-1">
                      {selectedAgent.actions?.map((action, i) => (
                        <div key={i} className="text-sm flex items-center gap-2">
                          <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded text-xs flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span>{action.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase">Stats</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="bg-gray-50 rounded p-2 text-center">
                        <div className="text-xl font-bold text-gray-900">
                          {selectedAgent.execution_count || 0}
                        </div>
                        <div className="text-xs text-gray-500">Runs</div>
                      </div>
                      <div className="bg-gray-50 rounded p-2 text-center">
                        <div className="text-xl font-bold text-green-600">
                          {((selectedAgent.success_rate || 0) * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-gray-500">Success</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Execution Logs */}
              <div className="card p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Recent Executions</h3>
                {executionLogs.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No executions yet
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {executionLogs.slice(0, 10).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                      >
                        <div className="flex items-center gap-2">
                          {log.success ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-gray-600">
                            {log.trigger_type}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="card p-8 text-center">
              <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                Select an agent to view details
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Agent Templates</h2>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              <p className="text-gray-500 mt-1">
                Choose a pre-built agent to get started quickly
              </p>
            </div>
            <div className="p-6 space-y-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-primary-500 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary-100 rounded-lg">
                      <AgentIcon icon={template.icon} className="h-6 w-6 text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {template.triggers?.map((t, i) => (
                          <span key={i} className="badge badge-purple text-xs">
                            {t.type}
                          </span>
                        ))}
                        <span className="text-gray-300">→</span>
                        <span className="text-xs text-gray-500">
                          {template.actions?.length} actions
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => createFromTemplate(template.id)}
                      className="btn btn-primary btn-sm"
                    >
                      Use Template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Agent Modal */}
      {showCreateModal && (
        <CreateAgentModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchAgents();
          }}
        />
      )}
    </div>
  );
}

function CreateAgentModal({ onClose, onCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_type: 'meeting_processed',
    actions: []
  });
  const [saving, setSaving] = useState(false);

  const triggerTypes = [
    { value: 'meeting_processed', label: 'Meeting Processed' },
    { value: 'meeting_created', label: 'Meeting Created' },
    { value: 'deal_created', label: 'Deal Created' },
    { value: 'task_completed', label: 'Task Completed' },
    { value: 'task_overdue', label: 'Task Overdue' }
  ];

  const actionTypes = [
    { value: 'create_task', label: 'Create Task' },
    { value: 'create_crm_task', label: 'Create CRM Task' },
    { value: 'sync_to_crm', label: 'Sync to CRM' },
    { value: 'post_to_chat', label: 'Post to Chat' },
    { value: 'create_project', label: 'Create Project' }
  ];

  const addAction = (actionType) => {
    setFormData(prev => ({
      ...prev,
      actions: [...prev.actions, { type: actionType, config: {} }]
    }));
  };

  const removeAction = (index) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || formData.actions.length === 0) return;

    setSaving(true);
    try {
      await api.post('/agents', {
        name: formData.name,
        description: formData.description,
        triggers: [{ type: formData.trigger_type }],
        actions: formData.actions
      });
      onCreated();
    } catch (error) {
      console.error('Failed to create agent:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Create Custom Agent</h2>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Agent Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="input"
                placeholder="My Custom Agent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="input"
                rows={2}
                placeholder="What does this agent do?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trigger
              </label>
              <select
                value={formData.trigger_type}
                onChange={(e) => setFormData(prev => ({ ...prev, trigger_type: e.target.value }))}
                className="input"
              >
                {triggerTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Actions *
              </label>
              {formData.actions.length > 0 && (
                <div className="space-y-2 mb-3">
                  {formData.actions.map((action, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded p-2">
                      <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded text-xs flex items-center justify-center font-medium">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm">{action.type}</span>
                      <button
                        type="button"
                        onClick={() => removeAction(i)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {actionTypes.map(a => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => addAction(a.value)}
                    className="btn btn-secondary btn-sm"
                  >
                    + {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.name || formData.actions.length === 0}
              className="btn btn-primary"
            >
              {saving ? 'Creating...' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
