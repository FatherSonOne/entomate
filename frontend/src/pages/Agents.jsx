import React, { useState, useEffect } from 'react';
import {
  Bot, Plus, Play, Pause, Trash2,
  Activity, CheckCircle, Zap,
  ChevronRight, Layout, Search, X, Loader2, AlertCircle,
  Settings, BarChart3, TrendingUp, Clock, Target
} from 'lucide-react';
import api from '../services/api';
import { GuideCard, PageHeader, Skeleton } from '../components/SharedUI';
import ExplanationCard from '../components/explainability/ExplanationCard';
import { VCButton, VCBadge, VCIconBox } from '../components/vc';

// Category icons mapping
const categoryIcons = {
  'Sales': '💰',
  'Meetings': '📋',
  'Operations': '⚙️',
  'Customer Success': '🎉',
  'Cross-App Sync': '🔄',
  'Sales Automation': '🎯',
  'Communication': '💬'
};

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [executionLogs, setExecutionLogs] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(null);
  const [deployError, setDeployError] = useState(null);
  const [explanations, setExplanations] = useState({});
  const [loadingExplanations, setLoadingExplanations] = useState({});

  // Wizard state
  const [wizardStep, setWizardStep] = useState(0); // 0: Select Template, 1: Customize Logic, 2: Monitor Performance
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [customizations, setCustomizations] = useState({
    name: '',
    description: '',
    triggers: [],
    actions: []
  });

  useEffect(() => {
    fetchAgents();
    fetchTemplates();
  }, []);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/agents');
      setAgents(response?.data || []);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/agents/templates');
      const tpls = Array.isArray(response) ? response : (response?.data || []);
      setTemplates(tpls);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      setTemplates([]);
    }
  };

  const fetchAgentLogs = async (agentId) => {
    try {
      const response = await api.get(`/agents/${agentId}/logs`);
      const logs = response?.data || [];
      setExecutionLogs(logs);

      // Fetch explanations for recent executions
      logs.slice(0, 5).forEach(log => {
        if (log.id) {
          fetchExplanation(log.id);
        }
      });
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const fetchExplanation = async (executionId) => {
    if (loadingExplanations[executionId] || explanations[executionId]) {
      return; // Already loading or loaded
    }

    setLoadingExplanations(prev => ({ ...prev, [executionId]: true }));

    try {
      const response = await api.agents.getExplanation(executionId);
      if (response?.data) {
        setExplanations(prev => ({ ...prev, [executionId]: response.data }));
      }
    } catch (error) {
      // Explanation not found or error - that's okay, not all executions have explanations
      console.log('No explanation available for execution:', executionId);
    } finally {
      setLoadingExplanations(prev => ({ ...prev, [executionId]: false }));
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

  const selectAgent = (agent) => {
    setSelectedAgent(agent);
    setWizardStep(2); // Jump to Monitor Performance
    fetchAgentLogs(agent.id);
  };

  const startCustomization = (template) => {
    setSelectedTemplate(template);
    setCustomizations({
      name: template.name,
      description: template.description,
      triggers: template.triggers || [],
      actions: template.actions || []
    });
    setShowTemplates(false);
    setShowCustomizeModal(true);
    setWizardStep(1); // Move to Customize Logic
  };

  const deployCustomizedAgent = async () => {
    try {
      setCreatingFromTemplate(selectedTemplate.id);
      setDeployError(null);
      await api.post('/agents/from-template', {
        templateId: selectedTemplate.id,
        customizations: {
          name: customizations.name,
          description: customizations.description,
          triggers: customizations.triggers,
          actions: customizations.actions
        }
      });
      setShowCustomizeModal(false);
      setWizardStep(0);
      fetchAgents();
    } catch (error) {
      console.error('Failed to create agent:', error);
      setDeployError(error.message || 'Failed to deploy agent.');
    } finally {
      setCreatingFromTemplate(null);
    }
  };

  const createFromTemplate = async (template) => {
    try {
      setCreatingFromTemplate(template.id);
      setDeployError(null);
      await api.post('/agents/from-template', {
        templateId: template.id,
        customizations: {}
      });
      setShowTemplates(false);
      fetchAgents();
    } catch (error) {
      console.error('Failed to create agent from template:', error);
      setDeployError(error.message || 'Failed to deploy agent. Please check your database configuration.');
    } finally {
      setCreatingFromTemplate(null);
    }
  };

  // Get unique categories
  const categories = ['All', ...new Set(templates.map(t => t.category))];

  // Filter templates by category
  const filteredTemplates = selectedCategory === 'All'
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  return (
    <div className="animate-fade-in max-w-7xl mx-auto">
      <PageHeader
        title="AI Agents"
        subtitle="Orchestrate your automated workforce."
        actions={
          <>
            <VCButton
              variant="secondary"
              onClick={() => setShowTemplates(true)}
            >
              <Zap size={16} /> From Template
            </VCButton>
            <VCButton
              variant="primary"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={16} /> Create Agent
            </VCButton>
          </>
        }
      />

      <GuideCard
        title="Agent Configuration"
        steps={['Select Template', 'Customize Logic', 'Monitor Performance']}
        activeStep={wizardStep}
      />

      {/* Quick Templates Preview */}
      {templates.length > 0 && !loading && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Layout size={18} style={{ color: 'var(--accent-primary)' }} /> Quick Start
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.slice(0, 3).map((template) => (
              <div
                key={template.id}
                className="vc p-4 hover:border-accent-primary cursor-pointer group"
                onClick={() => setShowTemplates(true)}
              >
                <div className="flex items-start gap-3">
                  <VCIconBox color="amber" className="group-hover:scale-110 transition-transform text-xl">
                    {template.icon || '🤖'}
                  </VCIconBox>
                  <div>
                    <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{template.name}</h3>
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{template.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agents List Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-mono uppercase tracking-wider" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>Active Fleet</h3>
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                placeholder="Filter agents..."
                className="pl-8 pr-2 py-1 rounded-sm text-xs focus:outline-none w-48"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid rgba(248,240,242,.08)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" count={3} />
            </div>
          ) : agents.length === 0 ? (
            <div className="vc p-8 text-center border-dashed border-2">
              <Bot className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
              <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>No active agents</h3>
              <VCButton variant="primary" onClick={() => setShowTemplates(true)} className="mt-2">Deploy First Agent</VCButton>
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => selectAgent(agent)}
                  className={`vc p-4 cursor-pointer transition-all hover:translate-x-1 ${selectedAgent?.id === agent.id ? 'border-accent-primary ring-1 ring-accent-primary' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-4">
                      <VCIconBox color={agent.enabled ? 'mint' : 'neutral'}>
                        <Bot size={20} />
                      </VCIconBox>
                      <div>
                        <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                          {agent.name}
                          {agent.enabled
                            ? <VCBadge color="mint" live>Running</VCBadge>
                            : null
                          }
                        </h3>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{agent.description}</p>

                        <div className="flex items-center gap-4 mt-3 text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                          <span className="flex items-center gap-1"><Activity size={12} /> {agent.execution_count || 0} runs</span>
                          <span className="flex items-center gap-1"><CheckCircle size={12} /> {((agent.success_rate || 0) * 100).toFixed(0)}% success</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} className={`transition-transform ${selectedAgent?.id === agent.id ? 'rotate-90' : ''}`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details Panel Column */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            {selectedAgent ? (
              <div className="vc p-5 animate-fade-in" style={{ borderTop: '4px solid var(--accent-primary)' }}>
                <div className="flex justify-between items-start mb-6">
                  <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Agent Diagnostics</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleAgent(selectedAgent.id)}
                      className="p-2 rounded-sm border transition-colors"
                      style={selectedAgent.enabled
                        ? { borderColor: 'rgba(255,59,48,.3)', color: '#ff3b30' }
                        : { borderColor: 'rgba(0,245,212,.3)', color: 'var(--accent-secondary)' }
                      }
                      title={selectedAgent.enabled ? "Stop" : "Start"}
                    >
                      {selectedAgent.enabled ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button
                      className="p-2 rounded-sm border transition-colors"
                      style={{ borderColor: 'rgba(248,240,242,.08)', color: 'var(--text-secondary)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-mono uppercase block mb-2" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>Configuration</label>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm p-2 rounded-sm" style={{ background: 'var(--bg-elevated)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Trigger</span>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{selectedAgent.triggers?.[0]?.type || 'Manual'}</span>
                      </div>
                      <div className="flex justify-between text-sm p-2 rounded-sm" style={{ background: 'var(--bg-elevated)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Actions</span>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{selectedAgent.actions?.length || 0} Steps</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-mono uppercase block mb-2" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>Live Logs</label>
                    <div className="text-green-400 p-3 rounded-sm font-mono text-xs h-48 overflow-y-auto custom-scrollbar" style={{ background: 'rgba(0,0,0,.9)', fontFamily: 'var(--font-mono)' }}>
                      {executionLogs.length === 0 ? (
                        <span style={{ color: 'var(--text-tertiary)' }}>// Waiting for execution...</span>
                      ) : (
                        executionLogs.map(log => (
                          <div key={log.id} className="mb-1 border-b border-gray-800 pb-1 last:border-0">
                            <span style={{ color: 'var(--text-tertiary)' }}>[{new Date(log.created_at).toLocaleTimeString()}]</span> {log.trigger_type}
                            <span className={log.success ? 'text-green-400' : 'text-red-400'}> {log.success ? 'OK' : 'ERR'}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="vc p-8 text-center border-dashed" style={{ background: 'rgba(16,16,16,.3)' }}>
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Select an agent to view diagnostics and controls.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Template Selection Modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowTemplates(false)} />
          <div className="relative rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden" style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(248,240,242,.08)' }}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid rgba(248,240,242,.08)' }}>
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Agent Templates</h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Choose a template to deploy an AI agent</p>
              </div>
              <button
                onClick={() => setShowTemplates(false)}
                className="p-2 rounded-md transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Error Message */}
            {deployError && (
              <div className="mx-4 mt-4 p-3 rounded-md flex items-start gap-2" style={{ background: 'rgba(255,45,107,.1)', border: '1px solid rgba(255,45,107,.2)' }}>
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-primary)' }} />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--accent-primary)' }}>Deployment Failed</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{deployError}</p>
                </div>
                <button onClick={() => setDeployError(null)} style={{ color: 'var(--text-tertiary)' }}>
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Category Tabs */}
            <div className="flex gap-2 p-4 overflow-x-auto" style={{ borderBottom: '1px solid rgba(248,240,242,.08)' }}>
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className="px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors"
                  style={selectedCategory === category
                    ? { background: 'var(--accent-primary)', color: '#fff' }
                    : { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid rgba(248,240,242,.08)' }
                  }
                >
                  {category !== 'All' && <span className="mr-1">{categoryIcons[category] || '📦'}</span>}
                  {category}
                </button>
              ))}
            </div>

            {/* Templates Grid */}
            <div className="p-4 overflow-y-auto max-h-[calc(85vh-160px)]">
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-12">
                  <Bot className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
                  <p style={{ color: 'var(--text-secondary)' }}>No templates found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="vc p-4 hover:border-accent-primary transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <VCIconBox color="amber" className="group-hover:scale-110 transition-transform text-2xl">
                          {template.icon || '🤖'}
                        </VCIconBox>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{template.name}</h3>
                            <span className="text-xs px-2 py-0.5 rounded whitespace-nowrap" style={{ background: 'var(--bg-elevated)', color: 'var(--text-tertiary)', border: '1px solid rgba(248,240,242,.08)' }}>
                              {template.category}
                            </span>
                          </div>
                          <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{template.description}</p>

                          {/* Triggers & Actions */}
                          <div className="flex flex-wrap gap-2 mt-3">
                            {template.triggers?.slice(0, 2).map((trigger, idx) => (
                              <span key={idx} className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(0,245,212,.1)', color: 'var(--accent-secondary)' }}>
                                {trigger.type}
                              </span>
                            ))}
                            {template.actions && (
                              <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(160,255,50,.1)', color: 'var(--accent-phosphor)' }}>
                                {template.actions.length} actions
                              </span>
                            )}
                          </div>

                          {/* Setup Time & Deploy Button */}
                          <div className="flex items-center justify-between mt-4">
                            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              Setup: {template.setupTime || '5 minutes'}
                            </span>
                            <div className="flex gap-2">
                              <VCButton
                                variant="secondary"
                                size="sm"
                                onClick={() => startCustomization(template)}
                              >
                                <ChevronRight size={14} /> Customize
                              </VCButton>
                              <VCButton
                                variant="primary"
                                size="sm"
                                onClick={() => createFromTemplate(template)}
                                disabled={creatingFromTemplate === template.id}
                              >
                                {creatingFromTemplate === template.id ? (
                                  <>
                                    <Loader2 size={14} className="animate-spin" /> Deploying...
                                  </>
                                ) : (
                                  <>
                                    <Zap size={14} /> Quick Deploy
                                  </>
                                )}
                              </VCButton>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customize Logic Modal (Step 2) */}
      {showCustomizeModal && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCustomizeModal(false)} />
          <div className="relative rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden" style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(248,240,242,.08)' }}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid rgba(248,240,242,.08)' }}>
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Settings size={20} style={{ color: 'var(--accent-primary)' }} />
                  Customize Agent Logic
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Configure triggers, actions, and behavior</p>
              </div>
              <button
                onClick={() => setShowCustomizeModal(false)}
                className="p-2 rounded-md transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(85vh-140px)] space-y-6">
              {/* Basic Info */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Agent Name</label>
                <input
                  type="text"
                  value={customizations.name}
                  onChange={(e) => setCustomizations({ ...customizations, name: e.target.value })}
                  className="input"
                  placeholder="My Custom Agent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Description</label>
                <textarea
                  value={customizations.description}
                  onChange={(e) => setCustomizations({ ...customizations, description: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="What does this agent do?"
                />
              </div>

              {/* Triggers Section */}
              <div>
                <label className="block text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Zap size={16} style={{ color: 'var(--accent-secondary)' }} />
                  Triggers
                </label>
                <div className="space-y-2">
                  {customizations.triggers.map((trigger, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-md" style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(248,240,242,.08)' }}>
                      <span className="flex-1 text-sm" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{trigger.type}</span>
                      <button
                        onClick={() => setCustomizations({
                          ...customizations,
                          triggers: customizations.triggers.filter((_, i) => i !== idx)
                        })}
                        style={{ color: 'var(--accent-primary)' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions Section */}
              <div>
                <label className="block text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Target size={16} style={{ color: 'var(--accent-tertiary)' }} />
                  Actions ({customizations.actions.length})
                </label>
                <div className="space-y-2">
                  {customizations.actions.map((action, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-md" style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(248,240,242,.08)' }}>
                      <span className="w-6 h-6 rounded-sm flex items-center justify-center text-xs font-bold" style={{ background: 'var(--accent-primary)', color: '#fff' }}>
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-sm" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{action.type}</span>
                      <button
                        onClick={() => setCustomizations({
                          ...customizations,
                          actions: customizations.actions.filter((_, i) => i !== idx)
                        })}
                        style={{ color: 'var(--accent-primary)' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-md p-4" style={{ background: 'rgba(255,45,107,.05)', border: '1px solid rgba(255,45,107,.2)' }}>
                <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--accent-primary)' }}>Configuration Preview</h4>
                <div className="text-xs space-y-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  <div>Name: <span style={{ color: 'var(--text-primary)' }}>{customizations.name}</span></div>
                  <div>Triggers: <span style={{ color: 'var(--text-primary)' }}>{customizations.triggers.length}</span></div>
                  <div>Actions: <span style={{ color: 'var(--text-primary)' }}>{customizations.actions.length}</span></div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4" style={{ borderTop: '1px solid rgba(248,240,242,.08)', background: 'rgba(16,16,16,.3)' }}>
              <VCButton variant="secondary" onClick={() => setShowCustomizeModal(false)}>
                Cancel
              </VCButton>
              <VCButton
                variant="primary"
                onClick={deployCustomizedAgent}
                disabled={!customizations.name || creatingFromTemplate}
              >
                {creatingFromTemplate ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Deploying...
                  </>
                ) : (
                  <>
                    <Zap size={16} /> Deploy Agent
                  </>
                )}
              </VCButton>
            </div>
          </div>
        </div>
      )}

      {/* Monitor Performance Panel (Step 3) - Shows when agent is selected */}
      {selectedAgent && wizardStep === 2 && (
        <div className="mt-8 vc p-6 animate-fade-in" style={{ borderTop: '4px solid var(--accent-tertiary)' }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <BarChart3 size={24} style={{ color: 'var(--accent-tertiary)' }} />
              Performance Analytics
            </h3>
            <VCButton
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedAgent(null);
                setWizardStep(0);
              }}
            >
              <X size={16} /> Close
            </VCButton>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-md" style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(248,240,242,.08)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase" style={{ color: 'var(--text-tertiary)' }}>Total Runs</span>
                <Activity size={16} style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{selectedAgent.execution_count || 0}</div>
            </div>

            <div className="p-4 rounded-md" style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(248,240,242,.08)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase" style={{ color: 'var(--text-tertiary)' }}>Success Rate</span>
                <TrendingUp size={16} style={{ color: 'var(--accent-secondary)' }} />
              </div>
              <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-secondary)' }}>
                {((selectedAgent.success_rate || 0) * 100).toFixed(1)}%
              </div>
            </div>

            <div className="p-4 rounded-md" style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(248,240,242,.08)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase" style={{ color: 'var(--text-tertiary)' }}>Avg Duration</span>
                <Clock size={16} style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>2.4s</div>
            </div>

            <div className="p-4 rounded-md" style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(248,240,242,.08)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase" style={{ color: 'var(--text-tertiary)' }}>Status</span>
                {selectedAgent.enabled
                  ? <VCBadge color="mint" live>Active</VCBadge>
                  : <VCBadge color="neutral">Paused</VCBadge>
                }
              </div>
              <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{selectedAgent.enabled ? 'Active' : 'Paused'}</div>
            </div>
          </div>

          {/* Execution Timeline */}
          <div>
            <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Clock size={16} /> Recent Executions
            </h4>
            <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
              {executionLogs.length === 0 ? (
                <div className="p-4 rounded-md font-mono text-xs" style={{ background: 'rgba(0,0,0,.9)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  // No execution logs available
                </div>
              ) : (
                executionLogs.slice(0, 10).map((log, idx) => {
                  const explanation = explanations[log.id];
                  const isLoading = loadingExplanations[log.id];

                  return (
                    <div key={log.id} className="vc p-4">
                      {/* Execution Header */}
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            {log.success
                              ? <VCBadge color="mint">SUCCESS</VCBadge>
                              : <VCBadge color="crimson">FAILED</VCBadge>
                            }
                            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Trigger: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{log.trigger_type}</span>
                          </div>
                        </div>
                        {log.duration_ms && (
                          <span className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                            {log.duration_ms}ms
                          </span>
                        )}
                      </div>

                      {/* Decisions Summary */}
                      {log.decisions && log.decisions.length > 0 && (
                        <div className="mb-3 text-xs">
                          <span style={{ color: 'var(--text-tertiary)' }}>Decisions: </span>
                          <span style={{ color: 'var(--text-primary)' }}>
                            {log.decisions.length} action{log.decisions.length !== 1 ? 's' : ''} taken
                          </span>
                        </div>
                      )}

                      {/* AI Explanation */}
                      {isLoading && (
                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          <Loader2 size={12} className="animate-spin" />
                          Loading explanation...
                        </div>
                      )}

                      {explanation && (
                        <ExplanationCard
                          recommendation={{
                            label: explanation.recommendation?.name || explanation.recommendation?.label || 'Recommendation',
                            ...explanation.recommendation
                          }}
                          explanation={explanation}
                          executionId={log.id}
                          onAccept={() => {
                            console.log('Recommendation accepted:', explanation.recommendation);
                          }}
                          onChangeRecommendation={(alternative) => {
                            console.log('Alternative selected:', alternative);
                          }}
                        />
                      )}

                      {/* Error Message */}
                      {!log.success && log.error_message && (
                        <div className="mt-2 p-2 rounded text-xs" style={{ background: 'rgba(255,45,107,.1)', border: '1px solid rgba(255,45,107,.2)', color: '#ff6b6b' }}>
                          {log.error_message}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
