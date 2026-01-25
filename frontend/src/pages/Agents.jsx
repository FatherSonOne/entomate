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
            <button
              onClick={() => setShowTemplates(true)}
              className="btn btn-secondary"
            >
              <Zap size={16} /> From Template
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              <Plus size={16} /> Create Agent
            </button>
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
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Layout size={18} className="text-accent-primary" /> Quick Start
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.slice(0, 3).map((template) => (
              <div
                key={template.id}
                className="card p-4 hover:border-accent-primary cursor-pointer group"
                onClick={() => setShowTemplates(true)}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-accent-primary/10 rounded-sm group-hover:bg-accent-primary group-hover:text-white transition-colors text-xl">
                    {template.icon || '🤖'}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{template.name}</h3>
                    <p className="text-xs text-content-secondary mt-1 line-clamp-2">{template.description}</p>
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
            <h3 className="text-sm font-mono uppercase text-content-tertiary tracking-wider">Active Fleet</h3>
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-content-tertiary" />
              <input type="text" placeholder="Filter agents..." className="pl-8 pr-2 py-1 bg-surface-elevated border border-line-subtle rounded-sm text-xs focus:outline-none focus:border-accent-primary w-48" />
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" count={3} />
            </div>
          ) : agents.length === 0 ? (
            <div className="card p-8 text-center border-dashed border-2">
              <Bot className="h-12 w-12 text-content-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-content-primary mb-2">No active agents</h3>
              <button onClick={() => setShowTemplates(true)} className="btn btn-primary mt-2">Deploy First Agent</button>
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => selectAgent(agent)}
                  className={`card p-4 cursor-pointer transition-all hover:translate-x-1 ${selectedAgent?.id === agent.id ? 'border-accent-primary ring-1 ring-accent-primary' : ''
                    }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-4">
                      <div className={`p-3 rounded-sm ${agent.enabled ? 'bg-green-500/10 text-green-500' : 'bg-surface-muted text-content-muted'}`}>
                        <Bot size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-content-primary flex items-center gap-2">
                          {agent.name}
                          {agent.enabled && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>}
                        </h3>
                        <p className="text-sm text-content-secondary mt-1">{agent.description}</p>

                        <div className="flex items-center gap-4 mt-3 text-xs font-mono text-content-tertiary">
                          <span className="flex items-center gap-1"><Activity size={12} /> {agent.execution_count || 0} runs</span>
                          <span className="flex items-center gap-1"><CheckCircle size={12} /> {((agent.success_rate || 0) * 100).toFixed(0)}% success</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} className={`text-content-tertiary transition-transform ${selectedAgent?.id === agent.id ? 'rotate-90 text-accent-primary' : ''}`} />
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
              <div className="card p-5 animate-fade-in border-t-4 border-t-accent-primary">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="font-bold text-lg">Agent Diagnostics</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleAgent(selectedAgent.id)}
                      className={`p-2 rounded-sm border ${selectedAgent.enabled ? 'border-red-500/20 text-red-500 hover:bg-red-500/10' : 'border-green-500/20 text-green-500 hover:bg-green-500/10'}`}
                      title={selectedAgent.enabled ? "Stop" : "Start"}
                    >
                      {selectedAgent.enabled ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button className="p-2 rounded-sm border border-line-default hover:text-red-500 hover:border-red-500/50 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-mono uppercase text-content-tertiary block mb-2">Configuration</label>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm p-2 bg-surface-muted rounded-sm">
                        <span>Trigger</span>
                        <span className="font-mono text-accent-primary">{selectedAgent.triggers?.[0]?.type || 'Manual'}</span>
                      </div>
                      <div className="flex justify-between text-sm p-2 bg-surface-muted rounded-sm">
                        <span>Actions</span>
                        <span className="font-mono">{selectedAgent.actions?.length || 0} Steps</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-mono uppercase text-content-tertiary block mb-2">Live Logs</label>
                    <div className="bg-black/90 text-green-400 p-3 rounded-sm font-mono text-xs h-48 overflow-y-auto custom-scrollbar">
                      {executionLogs.length === 0 ? (
                        <span className="text-gray-500">// Waiting for execution...</span>
                      ) : (
                        executionLogs.map(log => (
                          <div key={log.id} className="mb-1 border-b border-gray-800 pb-1 last:border-0">
                            <span className="text-gray-500">[{new Date(log.created_at).toLocaleTimeString()}]</span> {log.trigger_type}
                            <span className={log.success ? 'text-green-400' : 'text-red-400'}> {log.success ? 'OK' : 'ERR'}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card p-8 text-center bg-surface-muted/30 border-dashed">
                <Activity className="h-8 w-8 text-content-tertiary mx-auto mb-2 opacity-50" />
                <p className="text-sm text-content-secondary">Select an agent to view diagnostics and controls.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Template Selection Modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowTemplates(false)} />
          <div className="relative bg-surface border border-line-default rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-line-default">
              <div>
                <h2 className="text-xl font-bold">Agent Templates</h2>
                <p className="text-sm text-content-secondary">Choose a template to deploy an AI agent</p>
              </div>
              <button
                onClick={() => setShowTemplates(false)}
                className="p-2 hover:bg-surface-muted rounded-md transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Error Message */}
            {deployError && (
              <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-500 font-medium">Deployment Failed</p>
                  <p className="text-xs text-red-400 mt-1">{deployError}</p>
                </div>
                <button
                  onClick={() => setDeployError(null)}
                  className="text-red-400 hover:text-red-300"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Category Tabs */}
            <div className="flex gap-2 p-4 border-b border-line-default overflow-x-auto">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === category
                      ? 'bg-accent-primary text-white'
                      : 'bg-surface-muted text-content-secondary hover:text-content-primary'
                    }`}
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
                  <Bot className="h-12 w-12 text-content-muted mx-auto mb-4" />
                  <p className="text-content-secondary">No templates found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="card p-4 hover:border-accent-primary transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-3 bg-accent-primary/10 rounded-md text-2xl group-hover:bg-accent-primary group-hover:scale-110 transition-all">
                          {template.icon || '🤖'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-content-primary">{template.name}</h3>
                            <span className="text-xs px-2 py-0.5 bg-surface-muted rounded text-content-tertiary whitespace-nowrap">
                              {template.category}
                            </span>
                          </div>
                          <p className="text-sm text-content-secondary mt-1 line-clamp-2">{template.description}</p>

                          {/* Triggers & Actions */}
                          <div className="flex flex-wrap gap-2 mt-3">
                            {template.triggers?.slice(0, 2).map((trigger, idx) => (
                              <span key={idx} className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded">
                                {trigger.type}
                              </span>
                            ))}
                            {template.actions && (
                              <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-500 rounded">
                                {template.actions.length} actions
                              </span>
                            )}
                          </div>

                          {/* Setup Time & Deploy Button */}
                           <div className="flex items-center justify-between mt-4">
                             <span className="text-xs text-content-tertiary">
                               Setup: {template.setupTime || '5 minutes'}
                             </span>
                             <div className="flex gap-2">
                               <button
                                 onClick={() => startCustomization(template)}
                                 className="btn btn-secondary btn-sm"
                               >
                                 <ChevronRight size={14} /> Customize
                               </button>
                               <button
                                 onClick={() => createFromTemplate(template)}
                                 disabled={creatingFromTemplate === template.id}
                                 className="btn btn-primary btn-sm"
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
                               </button>
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
           <div className="relative bg-surface border border-line-default rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
             {/* Modal Header */}
             <div className="flex items-center justify-between p-4 border-b border-line-default">
               <div>
                 <h2 className="text-xl font-bold flex items-center gap-2">
                   <Settings size={20} className="text-accent-primary" />
                   Customize Agent Logic
                 </h2>
                 <p className="text-sm text-content-secondary">Configure triggers, actions, and behavior</p>
               </div>
               <button
                 onClick={() => setShowCustomizeModal(false)}
                 className="p-2 hover:bg-surface-muted rounded-md transition-colors"
               >
                 <X size={20} />
               </button>
             </div>

             <div className="p-6 overflow-y-auto max-h-[calc(85vh-140px)] space-y-6">
               {/* Basic Info */}
               <div>
                 <label className="block text-sm font-medium mb-2">Agent Name</label>
                 <input
                   type="text"
                   value={customizations.name}
                   onChange={(e) => setCustomizations({ ...customizations, name: e.target.value })}
                   className="input"
                   placeholder="My Custom Agent"
                 />
               </div>

               <div>
                 <label className="block text-sm font-medium mb-2">Description</label>
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
                 <label className="block text-sm font-medium mb-3 flex items-center gap-2">
                   <Zap size={16} className="text-accent-secondary" />
                   Triggers
                 </label>
                 <div className="space-y-2">
                   {customizations.triggers.map((trigger, idx) => (
                     <div key={idx} className="flex items-center gap-3 p-3 bg-surface-muted rounded-md border border-line-subtle">
                       <span className="flex-1 font-mono text-sm">{trigger.type}</span>
                       <button
                         onClick={() => setCustomizations({
                           ...customizations,
                           triggers: customizations.triggers.filter((_, i) => i !== idx)
                         })}
                         className="text-red-500 hover:text-red-600"
                       >
                         <X size={16} />
                       </button>
                     </div>
                   ))}
                 </div>
               </div>

               {/* Actions Section */}
               <div>
                 <label className="block text-sm font-medium mb-3 flex items-center gap-2">
                   <Target size={16} className="text-accent-tertiary" />
                   Actions ({customizations.actions.length})
                 </label>
                 <div className="space-y-2">
                   {customizations.actions.map((action, idx) => (
                     <div key={idx} className="flex items-center gap-3 p-3 bg-surface-muted rounded-md border border-line-subtle">
                       <span className="w-6 h-6 bg-accent-primary text-white rounded-sm flex items-center justify-center text-xs font-bold">
                         {idx + 1}
                       </span>
                       <span className="flex-1 font-mono text-sm">{action.type}</span>
                       <button
                         onClick={() => setCustomizations({
                           ...customizations,
                           actions: customizations.actions.filter((_, i) => i !== idx)
                         })}
                         className="text-red-500 hover:text-red-600"
                       >
                         <X size={16} />
                       </button>
                     </div>
                   ))}
                 </div>
               </div>

               {/* Preview */}
               <div className="bg-accent-primary/5 border border-accent-primary/20 rounded-md p-4">
                 <h4 className="text-sm font-bold mb-2 text-accent-primary">Configuration Preview</h4>
                 <div className="text-xs font-mono space-y-1 text-content-secondary">
                   <div>Name: <span className="text-content-primary">{customizations.name}</span></div>
                   <div>Triggers: <span className="text-content-primary">{customizations.triggers.length}</span></div>
                   <div>Actions: <span className="text-content-primary">{customizations.actions.length}</span></div>
                 </div>
               </div>
             </div>

             {/* Modal Footer */}
             <div className="flex items-center justify-between p-4 border-t border-line-default bg-surface-muted/30">
               <button
                 onClick={() => setShowCustomizeModal(false)}
                 className="btn btn-secondary"
               >
                 Cancel
               </button>
               <button
                 onClick={deployCustomizedAgent}
                 disabled={!customizations.name || creatingFromTemplate}
                 className="btn btn-primary"
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
               </button>
             </div>
           </div>
         </div>
       )}

       {/* Monitor Performance Panel (Step 3) - Shows when agent is selected */}
       {selectedAgent && wizardStep === 2 && (
         <div className="mt-8 card p-6 border-t-4 border-t-accent-tertiary animate-fade-in">
           <div className="flex items-center justify-between mb-6">
             <h3 className="text-xl font-bold flex items-center gap-2">
               <BarChart3 size={24} className="text-accent-tertiary" />
               Performance Analytics
             </h3>
             <button
               onClick={() => {
                 setSelectedAgent(null);
                 setWizardStep(0);
               }}
               className="btn btn-ghost btn-sm"
             >
               <X size={16} /> Close
             </button>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
             <div className="bg-surface-muted p-4 rounded-md border border-line-subtle">
               <div className="flex items-center justify-between mb-2">
                 <span className="text-xs text-content-tertiary uppercase">Total Runs</span>
                 <Activity size={16} className="text-content-tertiary" />
               </div>
               <div className="text-2xl font-bold font-mono">{selectedAgent.execution_count || 0}</div>
             </div>

             <div className="bg-surface-muted p-4 rounded-md border border-line-subtle">
               <div className="flex items-center justify-between mb-2">
                 <span className="text-xs text-content-tertiary uppercase">Success Rate</span>
                 <TrendingUp size={16} className="text-green-500" />
               </div>
               <div className="text-2xl font-bold font-mono text-green-500">
                 {((selectedAgent.success_rate || 0) * 100).toFixed(1)}%
               </div>
             </div>

             <div className="bg-surface-muted p-4 rounded-md border border-line-subtle">
               <div className="flex items-center justify-between mb-2">
                 <span className="text-xs text-content-tertiary uppercase">Avg Duration</span>
                 <Clock size={16} className="text-content-tertiary" />
               </div>
               <div className="text-2xl font-bold font-mono">2.4s</div>
             </div>

             <div className="bg-surface-muted p-4 rounded-md border border-line-subtle">
               <div className="flex items-center justify-between mb-2">
                 <span className="text-xs text-content-tertiary uppercase">Status</span>
                 <div className={`w-2 h-2 rounded-full ${selectedAgent.enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
               </div>
               <div className="text-2xl font-bold font-mono">{selectedAgent.enabled ? 'Active' : 'Paused'}</div>
             </div>
           </div>

           {/* Execution Timeline */}
           <div>
             <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
               <Clock size={16} /> Recent Executions
             </h4>
             <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
               {executionLogs.length === 0 ? (
                 <div className="bg-black/90 text-gray-500 p-4 rounded-md font-mono text-xs">
                   // No execution logs available
                 </div>
               ) : (
                 executionLogs.slice(0, 10).map((log, idx) => {
                   const explanation = explanations[log.id];
                   const isLoading = loadingExplanations[log.id];

                   return (
                     <div key={log.id} className="bg-surface-elevated border border-line-default rounded-md p-4">
                       {/* Execution Header */}
                       <div className="flex justify-between items-start mb-3">
                         <div>
                           <div className="flex items-center gap-2">
                             <span className={`text-xs font-bold ${log.success ? 'text-green-500' : 'text-red-500'}`}>
                               {log.success ? '✓ SUCCESS' : '✗ FAILED'}
                             </span>
                             <span className="text-xs text-content-tertiary">
                               {new Date(log.created_at).toLocaleString()}
                             </span>
                           </div>
                           <div className="mt-1 text-sm text-content-secondary">
                             Trigger: <span className="font-mono text-accent-primary">{log.trigger_type}</span>
                           </div>
                         </div>
                         {log.duration_ms && (
                           <span className="text-xs text-content-tertiary font-mono">
                             {log.duration_ms}ms
                           </span>
                         )}
                       </div>

                       {/* Decisions Summary */}
                       {log.decisions && log.decisions.length > 0 && (
                         <div className="mb-3 text-xs">
                           <span className="text-content-tertiary">Decisions: </span>
                           <span className="text-content-primary">
                             {log.decisions.length} action{log.decisions.length !== 1 ? 's' : ''} taken
                           </span>
                         </div>
                       )}

                       {/* AI Explanation */}
                       {isLoading && (
                         <div className="flex items-center gap-2 text-xs text-content-tertiary">
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
                         <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
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

