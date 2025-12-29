import { useState, useEffect } from 'react';
import {
  Target, Plus, ChevronDown, ChevronRight,
  Building2, Users, User, TrendingUp,
  CheckCircle, Circle, AlertCircle,
  Calendar, BarChart3, Edit2, Trash2
} from 'lucide-react';
import api from '../services/api';

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [hierarchy, setHierarchy] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState('hierarchy'); // hierarchy, list
  const [expandedGoals, setExpandedGoals] = useState(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [goalsRes, hierarchyRes, statsRes] = await Promise.all([
        api.get('/goals'),
        api.get('/goals/hierarchy'),
        api.get('/goals/stats/summary')
      ]);
      // API interceptor already unwraps response.data, so goalsRes IS the response data
      setGoals(goalsRes.data || []);
      setHierarchy(hierarchyRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (goalId) => {
    const newExpanded = new Set(expandedGoals);
    if (newExpanded.has(goalId)) {
      newExpanded.delete(goalId);
    } else {
      newExpanded.add(goalId);
    }
    setExpandedGoals(newExpanded);
  };

  const getProgressColor = (progress) => {
    if (progress >= 70) return 'bg-green-500';
    if (progress >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusBadge = (status) => {
    const styles = {
      planning: 'badge-gray',
      active: 'badge-blue',
      completed: 'badge-green',
      abandoned: 'badge-red'
    };
    return styles[status] || 'badge-gray';
  };

  const GoalTypeIcon = ({ type }) => {
    switch (type) {
      case 'company':
        return <Building2 className="h-4 w-4" />;
      case 'team':
        return <Users className="h-4 w-4" />;
      case 'individual':
        return <User className="h-4 w-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  const GoalCard = ({ goal, level = 0 }) => {
    const isExpanded = expandedGoals.has(goal.id);
    const hasChildren = goal.children && goal.children.length > 0;

    return (
      <div className={`${level > 0 ? 'ml-8 border-l-2 border-gray-200 pl-4' : ''}`}>
        <div
          className={`card p-4 mb-3 cursor-pointer hover:shadow-md transition-shadow ${
            selectedGoal?.id === goal.id ? 'ring-2 ring-primary-500' : ''
          }`}
          onClick={() => setSelectedGoal(goal)}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(goal.id);
                  }}
                  className="mt-1 p-1 hover:bg-gray-100 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              )}
              <div className={`p-2 rounded-lg ${
                goal.goal_type === 'company' ? 'bg-purple-100' :
                goal.goal_type === 'team' ? 'bg-blue-100' : 'bg-green-100'
              }`}>
                <GoalTypeIcon type={goal.goal_type} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{goal.title}</h3>
                {goal.description && (
                  <p className="text-sm text-gray-500 mt-1">{goal.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <span className={`badge ${getStatusBadge(goal.status)} text-xs`}>
                    {goal.status}
                  </span>
                  {goal.quarter && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {goal.quarter}
                    </span>
                  )}
                  {goal.key_results?.length > 0 && (
                    <span className="text-xs text-gray-400">
                      {goal.key_results.length} Key Results
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {Math.round(goal.progress || 0)}%
              </div>
              <div className="w-24 h-2 bg-gray-200 rounded-full mt-1">
                <div
                  className={`h-full rounded-full ${getProgressColor(goal.progress)}`}
                  style={{ width: `${Math.min(goal.progress || 0, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Key Results Preview */}
          {goal.key_results?.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="space-y-2">
                {goal.key_results.slice(0, 3).map((kr) => (
                  <div key={kr.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 truncate flex-1">{kr.title}</span>
                    <span className="text-gray-900 font-medium ml-4">
                      {kr.current}/{kr.target} {kr.unit}
                    </span>
                  </div>
                ))}
                {goal.key_results.length > 3 && (
                  <p className="text-xs text-gray-400">
                    +{goal.key_results.length - 3} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Render children if expanded */}
        {isExpanded && hasChildren && (
          <div className="space-y-2">
            {goal.children.map((child) => (
              <GoalCard key={child.id} goal={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
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
            <Target className="h-7 w-7 text-primary-600" />
            Goals & OKRs
          </h1>
          <p className="text-gray-500 mt-1">
            Track company, team, and individual objectives
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Goal
        </button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Goals</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Target className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avg Progress</p>
                <p className="text-2xl font-bold text-primary-600">{stats.averageProgress}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary-400" />
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">On Track</p>
                <p className="text-2xl font-bold text-green-600">{stats.onTrack}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">At Risk</p>
                <p className="text-2xl font-bold text-red-600">{stats.atRisk}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode('hierarchy')}
          className={`px-3 py-1.5 rounded-lg text-sm ${
            viewMode === 'hierarchy'
              ? 'bg-primary-100 text-primary-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Hierarchy View
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`px-3 py-1.5 rounded-lg text-sm ${
            viewMode === 'list'
              ? 'bg-primary-100 text-primary-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          List View
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Goals List */}
        <div className="lg:col-span-2 space-y-4">
          {viewMode === 'hierarchy' && hierarchy ? (
            <>
              {/* Company Goals */}
              {hierarchy.company?.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-purple-600" />
                    Company Goals
                  </h2>
                  {hierarchy.company.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} />
                  ))}
                </div>
              )}

              {/* Orphan Team Goals */}
              {hierarchy.teams?.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    Team Goals
                  </h2>
                  {hierarchy.teams.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} />
                  ))}
                </div>
              )}

              {/* Orphan Individual Goals */}
              {hierarchy.individuals?.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <User className="h-5 w-5 text-green-600" />
                    Individual Goals
                  </h2>
                  {hierarchy.individuals.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              {goals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          )}

          {goals.length === 0 && (
            <div className="card p-8 text-center">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No goals yet</h3>
              <p className="text-gray-500 mb-4">
                Create your first goal to start tracking progress
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary"
              >
                Create Goal
              </button>
            </div>
          )}
        </div>

        {/* Goal Details Panel */}
        <div>
          {selectedGoal ? (
            <GoalDetailPanel
              goal={selectedGoal}
              onUpdate={fetchData}
              onClose={() => setSelectedGoal(null)}
            />
          ) : (
            <div className="card p-8 text-center">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                Select a goal to view details
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Goal Modal */}
      {showCreateModal && (
        <CreateGoalModal
          goals={goals}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function GoalDetailPanel({ goal, onUpdate, onClose }) {
  const [editingKR, setEditingKR] = useState(null);
  const [newKRTitle, setNewKRTitle] = useState('');
  const [newKRTarget, setNewKRTarget] = useState('');

  const updateKeyResult = async (krId, current) => {
    try {
      await api.put(`/goals/${goal.id}/key-results/${krId}`, { current });
      onUpdate();
    } catch (error) {
      console.error('Failed to update key result:', error);
    }
  };

  const addKeyResult = async () => {
    if (!newKRTitle || !newKRTarget) return;
    try {
      await api.post(`/goals/${goal.id}/key-results`, {
        title: newKRTitle,
        target: newKRTarget
      });
      setNewKRTitle('');
      setNewKRTarget('');
      onUpdate();
    } catch (error) {
      console.error('Failed to add key result:', error);
    }
  };

  const deleteGoal = async () => {
    if (!confirm('Are you sure you want to delete this goal?')) return;
    try {
      await api.delete(`/goals/${goal.id}`);
      onClose();
      onUpdate();
    } catch (error) {
      console.error('Failed to delete goal:', error);
    }
  };

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{goal.title}</h3>
        <button
          onClick={deleteGoal}
          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {goal.description && (
        <p className="text-sm text-gray-500">{goal.description}</p>
      )}

      {/* Progress */}
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-500">Progress</span>
          <span className="font-medium">{Math.round(goal.progress || 0)}%</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full">
          <div
            className={`h-full rounded-full ${
              goal.progress >= 70 ? 'bg-green-500' :
              goal.progress >= 40 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(goal.progress || 0, 100)}%` }}
          />
        </div>
      </div>

      {/* Key Results */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Key Results</h4>
        <div className="space-y-3">
          {(goal.key_results || []).map((kr) => (
            <div key={kr.id} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">{kr.title}</span>
                <button
                  onClick={() => setEditingKR(editingKR === kr.id ? null : kr.id)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 rounded-full">
                  <div
                    className="h-full bg-primary-500 rounded-full"
                    style={{ width: `${Math.min((kr.current / kr.target) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">
                  {kr.current}/{kr.target} {kr.unit}
                </span>
              </div>
              {editingKR === kr.id && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    defaultValue={kr.current}
                    className="input text-sm flex-1"
                    onBlur={(e) => {
                      updateKeyResult(kr.id, Number(e.target.value));
                      setEditingKR(null);
                    }}
                  />
                  <span className="text-sm text-gray-500">/ {kr.target}</span>
                </div>
              )}
            </div>
          ))}

          {/* Add Key Result */}
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-3">
            <input
              type="text"
              value={newKRTitle}
              onChange={(e) => setNewKRTitle(e.target.value)}
              placeholder="Key result title"
              className="input text-sm mb-2"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={newKRTarget}
                onChange={(e) => setNewKRTarget(e.target.value)}
                placeholder="Target"
                className="input text-sm flex-1"
              />
              <button
                onClick={addKeyResult}
                disabled={!newKRTitle || !newKRTarget}
                className="btn btn-primary btn-sm"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="pt-3 border-t border-gray-200 text-xs text-gray-400 space-y-1">
        <p>Quarter: {goal.quarter}</p>
        <p>Type: {goal.goal_type}</p>
        <p>Status: {goal.status}</p>
      </div>
    </div>
  );
}

function CreateGoalModal({ goals, onClose, onCreated }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goal_type: 'individual',
    parent_goal_id: '',
    quarter: getCurrentQuarter()
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title) return;

    setSaving(true);
    try {
      await api.post('/goals', formData);
      onCreated();
    } catch (error) {
      console.error('Failed to create goal:', error);
    } finally {
      setSaving(false);
    }
  };

  const parentOptions = goals.filter(g => {
    if (formData.goal_type === 'team') return g.goal_type === 'company';
    if (formData.goal_type === 'individual') return g.goal_type === 'team';
    return false;
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Create Goal</h2>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Goal Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="input"
                placeholder="Increase revenue by 20%"
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
                placeholder="Describe this goal..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Goal Type
                </label>
                <select
                  value={formData.goal_type}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    goal_type: e.target.value,
                    parent_goal_id: ''
                  }))}
                  className="input"
                >
                  <option value="company">Company</option>
                  <option value="team">Team</option>
                  <option value="individual">Individual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quarter
                </label>
                <select
                  value={formData.quarter}
                  onChange={(e) => setFormData(prev => ({ ...prev, quarter: e.target.value }))}
                  className="input"
                >
                  {getQuarterOptions().map(q => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>
            </div>

            {parentOptions.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Goal (optional)
                </label>
                <select
                  value={formData.parent_goal_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, parent_goal_id: e.target.value }))}
                  className="input"
                >
                  <option value="">None</option>
                  {parentOptions.map(g => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving || !formData.title} className="btn btn-primary">
              {saving ? 'Creating...' : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getCurrentQuarter() {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `Q${quarter}-${now.getFullYear()}`;
}

function getQuarterOptions() {
  const now = new Date();
  const year = now.getFullYear();
  const options = [];
  for (let y = year - 1; y <= year + 1; y++) {
    for (let q = 1; q <= 4; q++) {
      options.push(`Q${q}-${y}`);
    }
  }
  return options;
}
