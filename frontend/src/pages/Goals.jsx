import { useState, useEffect } from 'react';
import {
  Target, Plus, ChevronDown, ChevronRight,
  Building2, Users, User, TrendingUp,
  CheckCircle, Circle, AlertCircle,
  Calendar, BarChart3, Edit2, Trash2
} from 'lucide-react';
import api from '../services/api';
import { VCButton, VCBadge, VCProgress } from '../components/vc';

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

  const getProgressBarStyle = (progress) => {
    if (progress >= 70) return { background: 'var(--accent-secondary)' };
    if (progress >= 40) return { background: 'var(--accent-tertiary)' };
    return { background: 'var(--accent-primary)' };
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed': return <VCBadge color="mint">{status}</VCBadge>;
      case 'active':    return <VCBadge color="amber">{status}</VCBadge>;
      case 'abandoned': return <VCBadge color="crimson">{status}</VCBadge>;
      default:          return <VCBadge color="neutral">{status}</VCBadge>; // planning, etc.
    }
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
      <div className={`${level > 0 ? 'ml-8 pl-4' : ''}`}
        style={level > 0 ? { borderLeft: '2px solid rgba(248,240,242,.08)' } : {}}
      >
        <div
          className={`vc p-4 mb-3 cursor-pointer transition-shadow ${
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
                  className="mt-1 p-1 rounded"
                  style={{ ['--hover-bg']: 'var(--bg-elevated)' }}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                  ) : (
                    <ChevronRight className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                  )}
                </button>
              )}
              <div className={`p-2 rounded-lg ${
                goal.goal_type === 'company' ? 'bg-accent-tertiary-dim' :
                goal.goal_type === 'team' ? 'bg-semantic-info-dim' : 'bg-semantic-success-dim'
              }`}>
                <GoalTypeIcon type={goal.goal_type} />
              </div>
              <div>
                <h3
                  className="font-semibold"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                >
                  {goal.title}
                </h3>
                {goal.description && (
                  <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    {goal.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  {getStatusBadge(goal.status)}
                  {goal.quarter && (
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                      <Calendar className="h-3 w-3" />
                      {goal.quarter}
                    </span>
                  )}
                  {goal.key_results?.length > 0 && (
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {goal.key_results.length} Key Results
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div
                className="text-2xl font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                {Math.round(goal.progress || 0)}%
              </div>
              <div className="w-24 mt-1">
                <VCProgress
                  value={goal.progress || 0}
                  color={
                    (goal.progress || 0) >= 70 ? 'mint' :
                    (goal.progress || 0) >= 40 ? 'amber' : 'crimson'
                  }
                />
              </div>
            </div>
          </div>

          {/* Key Results Preview */}
          {goal.key_results?.length > 0 && (
            <div
              className="mt-4 pt-3 border-t"
              style={{ borderColor: 'rgba(248,240,242,.08)' }}
            >
              <div className="space-y-2">
                {goal.key_results.slice(0, 3).map((kr) => (
                  <div key={kr.id} className="flex items-center justify-between text-sm">
                    <span className="truncate flex-1" style={{ color: 'var(--text-secondary)' }}>
                      {kr.title}
                    </span>
                    <span className="font-medium ml-4" style={{ color: 'var(--text-primary)' }}>
                      {kr.current}/{kr.target} {kr.unit}
                    </span>
                  </div>
                ))}
                {goal.key_results.length > 3 && (
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
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
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: 'var(--accent-primary)' }}
        ></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold flex items-center gap-2"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            <Target className="h-7 w-7" style={{ color: 'var(--accent-primary)' }} />
            Goals & OKRs
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Track company, team, and individual objectives
          </p>
        </div>
        <VCButton
          variant="primary"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Goal
        </VCButton>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="vc p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Total Goals</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats.total}</p>
              </div>
              <Target className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
            </div>
          </div>
          <div className="vc p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Avg Progress</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--accent-primary)' }}>
                  {stats.averageProgress}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8" style={{ color: 'var(--accent-primary)' }} />
            </div>
          </div>
          <div className="vc p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>On Track</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--accent-secondary)' }}>
                  {stats.onTrack}
                </p>
              </div>
              <CheckCircle className="h-8 w-8" style={{ color: 'var(--accent-secondary)' }} />
            </div>
          </div>
          <div className="vc p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>At Risk</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--accent-primary)' }}>
                  {stats.atRisk}
                </p>
              </div>
              <AlertCircle className="h-8 w-8" style={{ color: 'var(--accent-primary)' }} />
            </div>
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <VCButton
          variant={viewMode === 'hierarchy' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('hierarchy')}
        >
          Hierarchy View
        </VCButton>
        <VCButton
          variant={viewMode === 'list' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('list')}
        >
          List View
        </VCButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Goals List */}
        <div className="lg:col-span-2 space-y-4">
          {viewMode === 'hierarchy' && hierarchy ? (
            <>
              {/* Company Goals */}
              {hierarchy.company?.length > 0 && (
                <div>
                  <h2
                    className="text-lg font-semibold mb-3 flex items-center gap-2"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                  >
                    <Building2 className="h-5 w-5" style={{ color: 'var(--accent-tertiary)' }} />
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
                  <h2
                    className="text-lg font-semibold mb-3 flex items-center gap-2"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                  >
                    <Users className="h-5 w-5" style={{ color: 'var(--accent-secondary)' }} />
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
                  <h2
                    className="text-lg font-semibold mb-3 flex items-center gap-2"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                  >
                    <User className="h-5 w-5" style={{ color: 'var(--accent-secondary)' }} />
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
            <div className="vc p-8 text-center">
              <Target className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
              <h3
                className="text-lg font-medium mb-2"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
              >
                No goals yet
              </h3>
              <p className="mb-4" style={{ color: 'var(--text-tertiary)' }}>
                Create your first goal to start tracking progress
              </p>
              <VCButton variant="primary" onClick={() => setShowCreateModal(true)}>
                Create Goal
              </VCButton>
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
            <div className="vc p-8 text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
              <p style={{ color: 'var(--text-tertiary)' }}>
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

  const getProgressBarStyle = (progress) => {
    if (progress >= 70) return { background: 'var(--accent-secondary)' };
    if (progress >= 40) return { background: 'var(--accent-tertiary)' };
    return { background: 'var(--accent-primary)' };
  };

  return (
    <div className="vc p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3
          className="font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          {goal.title}
        </h3>
        <VCButton
          variant="danger"
          size="sm"
          onClick={deleteGoal}
          className="p-2"
          title="Delete goal"
        >
          <Trash2 className="h-4 w-4" />
        </VCButton>
      </div>

      {goal.description && (
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{goal.description}</p>
      )}

      {/* Progress */}
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span style={{ color: 'var(--text-tertiary)' }}>Progress</span>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {Math.round(goal.progress || 0)}%
          </span>
        </div>
        <VCProgress
          value={goal.progress || 0}
          color={
            (goal.progress || 0) >= 70 ? 'mint' :
            (goal.progress || 0) >= 40 ? 'amber' : 'crimson'
          }
        />
      </div>

      {/* Key Results */}
      <div>
        <h4
          className="font-medium mb-3"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          Key Results
        </h4>
        <div className="space-y-3">
          {(goal.key_results || []).map((kr) => (
            <div
              key={kr.id}
              className="rounded-lg p-3"
              style={{ background: 'var(--bg-elevated)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {kr.title}
                </span>
                <VCButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingKR(editingKR === kr.id ? null : kr.id)}
                  className="p-0.5"
                  title="Edit key result"
                >
                  <Edit2 className="h-3 w-3" />
                </VCButton>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <VCProgress
                    value={kr.target > 0 ? (kr.current / kr.target) * 100 : 0}
                    color="crimson"
                  />
                </div>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
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
                  <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>/ {kr.target}</span>
                </div>
              )}
            </div>
          ))}

          {/* Add Key Result */}
          <div
            className="border-2 border-dashed rounded-lg p-3"
            style={{ borderColor: 'rgba(248,240,242,.08)' }}
          >
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
              <VCButton
                variant="primary"
                size="sm"
                onClick={addKeyResult}
                disabled={!newKRTitle || !newKRTarget}
              >
                Add
              </VCButton>
            </div>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div
        className="pt-3 border-t text-xs space-y-1"
        style={{ borderColor: 'rgba(248,240,242,.08)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
      >
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
      <div className="vc rounded-xl shadow-xl max-w-lg w-full mx-4">
        <form onSubmit={handleSubmit}>
          <div
            className="p-6 border-b"
            style={{ borderColor: 'rgba(248,240,242,.08)' }}
          >
            <h2
              className="text-xl font-bold"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
              Create Goal
            </h2>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
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
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
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
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
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
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
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
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
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

          <div
            className="p-6 border-t flex justify-end gap-3"
            style={{ borderColor: 'rgba(248,240,242,.08)' }}
          >
            <VCButton type="button" variant="secondary" onClick={onClose}>
              Cancel
            </VCButton>
            <VCButton type="submit" variant="primary" disabled={saving || !formData.title}>
              {saving ? 'Creating...' : 'Create Goal'}
            </VCButton>
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
