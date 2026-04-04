import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Target, Plus, ChevronDown, ChevronRight, ChevronLeft,
  Building2, Users, User, TrendingUp,
  CheckCircle, AlertCircle, X, Search,
  Calendar, BarChart3, Edit2, Trash2,
  Download, Filter, Link2, Unlink, Clock, MessageSquare
} from 'lucide-react';
import api, { reportsApi, calendarApi, tasksApi } from '../services/api';
import { useConfirm } from '../components/vc/ConfirmDialog';
import { VCButton, VCBadge, VCProgress } from '../components/vc';
import { useToast } from '../components/vc/ToastProvider';
import ErrorState from '../components/vc/ErrorState';

const STATUS_OPTIONS = [
  { value: 'planning', label: 'Planning', color: 'neutral' },
  { value: 'active', label: 'Active', color: 'amber' },
  { value: 'completed', label: 'Completed', color: 'mint' },
  { value: 'abandoned', label: 'Abandoned', color: 'crimson' }
];

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'company', label: 'Company' },
  { value: 'team', label: 'Team' },
  { value: 'individual', label: 'Individual' }
];

const PAGE_SIZE = 20;

export default function Goals() {
  const toast = useToast();
  const [goals, setGoals] = useState([]);
  const [hierarchy, setHierarchy] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState('hierarchy');
  const [expandedGoals, setExpandedGoals] = useState(new Set());

  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterQuarter, setFilterQuarter] = useState('');

  // Pagination (list view only)
  const [page, setPage] = useState(1);

  // Keyboard nav
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const goalListRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const params = {};
      if (filterType) params.type = filterType;
      if (filterStatus) params.status = filterStatus;
      if (filterQuarter) params.quarter = filterQuarter;

      const [goalsRes, hierarchyRes, statsRes] = await Promise.all([
        api.get('/goals', { params }),
        api.get('/goals/hierarchy', { params: filterQuarter ? { quarter: filterQuarter } : {} }),
        api.get('/goals/stats/summary', { params: filterQuarter ? { quarter: filterQuarter } : {} })
      ]);
      setGoals(goalsRes.data || []);
      setHierarchy(hierarchyRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to fetch goals:', err);
      setError(err.message || 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, filterQuarter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [filterType, filterStatus, filterQuarter]);

  // Keep selectedGoal in sync with fetched data
  useEffect(() => {
    if (selectedGoal) {
      const updated = goals.find(g => g.id === selectedGoal.id);
      if (updated) setSelectedGoal(updated);
      else setSelectedGoal(null);
    }
  }, [goals]);

  const toggleExpand = (goalId) => {
    const newExpanded = new Set(expandedGoals);
    if (newExpanded.has(goalId)) {
      newExpanded.delete(goalId);
    } else {
      newExpanded.add(goalId);
    }
    setExpandedGoals(newExpanded);
  };

  // Keyboard navigation for goal list
  const handleListKeyDown = (e) => {
    const displayGoals = viewMode === 'list' ? paginatedGoals : goals;
    if (!displayGoals.length) return;

    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      setFocusedIndex(prev => Math.min(prev + 1, displayGoals.length - 1));
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      setFocusedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      setSelectedGoal(displayGoals[focusedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSelectedGoal(null);
      setFocusedIndex(-1);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed': return <VCBadge color="mint">{status}</VCBadge>;
      case 'active':    return <VCBadge color="amber">{status}</VCBadge>;
      case 'abandoned': return <VCBadge color="crimson">{status}</VCBadge>;
      default:          return <VCBadge color="neutral">{status}</VCBadge>;
    }
  };

  const GoalTypeIcon = ({ type }) => {
    switch (type) {
      case 'company':    return <Building2 className="h-4 w-4" />;
      case 'team':       return <Users className="h-4 w-4" />;
      case 'individual': return <User className="h-4 w-4" />;
      default:           return <Target className="h-4 w-4" />;
    }
  };

  const GoalCard = ({ goal, level = 0, index }) => {
    const isExpanded = expandedGoals.has(goal.id);
    const hasChildren = goal.children && goal.children.length > 0;
    const isFocused = focusedIndex === index;

    return (
      <div className={`${level > 0 ? 'ml-8 pl-4' : ''}`}
        style={level > 0 ? { borderLeft: '2px solid rgba(248,240,242,.08)' } : {}}
      >
        <div
          className={`vc p-4 mb-3 cursor-pointer transition-shadow ${
            selectedGoal?.id === goal.id ? 'ring-2 ring-primary-500' : ''
          } ${isFocused ? 'ring-1 ring-primary-300' : ''}`}
          onClick={() => setSelectedGoal(goal)}
          tabIndex={0}
          role="button"
          aria-label={`${goal.title}, ${goal.status}, ${Math.round(goal.progress || 0)}% progress`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedGoal(goal);
            }
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {hasChildren && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleExpand(goal.id); }}
                  className="mt-1 p-1 rounded"
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
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
                <h3 className="font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                  {goal.title}
                </h3>
                {goal.description && (
                  <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{goal.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  {getStatusBadge(goal.status)}
                  {goal.quarter && (
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                      <Calendar className="h-3 w-3" />{goal.quarter}
                    </span>
                  )}
                  {goal.key_results?.length > 0 && (
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {goal.key_results.length} Key Results
                    </span>
                  )}
                  {goal.related_tasks?.length > 0 && (
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                      <Link2 className="h-3 w-3" />{goal.related_tasks.length} Tasks
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {Math.round(goal.progress || 0)}%
              </div>
              <div className="w-24 mt-1">
                <VCProgress
                  value={goal.progress || 0}
                  color={(goal.progress || 0) >= 70 ? 'mint' : (goal.progress || 0) >= 40 ? 'amber' : 'crimson'}
                />
              </div>
            </div>
          </div>

          {goal.key_results?.length > 0 && (
            <div className="mt-4 pt-3 border-t" style={{ borderColor: 'rgba(248,240,242,.08)' }}>
              <div className="space-y-2">
                {goal.key_results.slice(0, 3).map((kr) => (
                  <div key={kr.id} className="flex items-center justify-between text-sm">
                    <span className="truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{kr.title}</span>
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

  const handleExportPDF = async () => {
    try {
      await reportsApi.downloadGoalsPDF(filterQuarter || undefined);
    } catch (error) {
      console.error('Failed to export PDF:', error);
    }
  };

  const handleExportCSV = async () => {
    const params = {};
    if (filterQuarter) params.quarter = filterQuarter;
    try {
      await reportsApi.downloadGoalsCSV(params);
    } catch (error) {
      console.error('Failed to export CSV:', error);
    }
  };

  const hasActiveFilters = filterType || filterStatus || filterQuarter;

  // Pagination
  const totalPages = Math.ceil(goals.length / PAGE_SIZE);
  const paginatedGoals = goals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent-primary)' }} />
      </div>
    );
  }

  if (error) return (
    <div className="space-y-6">
      <ErrorState message={error} onRetry={fetchData} />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            <Target className="h-7 w-7" style={{ color: 'var(--accent-primary)' }} />
            Goals & OKRs
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Track company, team, and individual objectives
          </p>
        </div>
        <div className="flex items-center gap-2">
          <VCButton variant="ghost" size="sm" onClick={handleExportPDF} title="Export PDF">
            <Download className="h-4 w-4 mr-1" />PDF
          </VCButton>
          <VCButton variant="ghost" size="sm" onClick={handleExportCSV} title="Export CSV">
            <Download className="h-4 w-4 mr-1" />CSV
          </VCButton>
          <VCButton variant="primary" onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />New Goal
          </VCButton>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
        <select
          value={filterQuarter}
          onChange={(e) => setFilterQuarter(e.target.value)}
          className="input text-sm"
          style={{ width: 'auto', minWidth: 120 }}
        >
          <option value="">All Quarters</option>
          {getQuarterOptions().map(q => (
            <option key={q} value={q}>{q}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {TYPE_OPTIONS.map(opt => (
            <VCButton
              key={opt.value}
              variant={filterType === opt.value ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setFilterType(opt.value)}
            >
              {opt.label}
            </VCButton>
          ))}
        </div>
        <div className="flex gap-1">
          <VCButton
            variant={filterStatus === '' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setFilterStatus('')}
          >
            All Status
          </VCButton>
          {STATUS_OPTIONS.map(opt => (
            <VCButton
              key={opt.value}
              variant={filterStatus === opt.value ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setFilterStatus(opt.value)}
            >
              {opt.label}
            </VCButton>
          ))}
        </div>
        {hasActiveFilters && (
          <VCButton
            variant="ghost"
            size="sm"
            onClick={() => { setFilterType(''); setFilterStatus(''); setFilterQuarter(''); }}
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X className="h-3 w-3 mr-1" />Clear
          </VCButton>
        )}
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
                <p className="text-2xl font-bold" style={{ color: 'var(--accent-primary)' }}>{stats.averageProgress}%</p>
              </div>
              <TrendingUp className="h-8 w-8" style={{ color: 'var(--accent-primary)' }} />
            </div>
          </div>
          <div className="vc p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>On Track</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--accent-secondary)' }}>{stats.onTrack}</p>
              </div>
              <CheckCircle className="h-8 w-8" style={{ color: 'var(--accent-secondary)' }} />
            </div>
          </div>
          <div className="vc p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>At Risk</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--accent-primary)' }}>{stats.atRisk}</p>
              </div>
              <AlertCircle className="h-8 w-8" style={{ color: 'var(--accent-primary)' }} />
            </div>
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <VCButton variant={viewMode === 'hierarchy' ? 'primary' : 'ghost'} size="sm" onClick={() => setViewMode('hierarchy')}>
          Hierarchy View
        </VCButton>
        <VCButton variant={viewMode === 'list' ? 'primary' : 'ghost'} size="sm" onClick={() => setViewMode('list')}>
          List View
        </VCButton>
        {viewMode === 'list' && goals.length > 0 && (
          <span className="text-xs ml-2" style={{ color: 'var(--text-tertiary)' }}>
            {goals.length} goals {totalPages > 1 && `(page ${page}/${totalPages})`}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Goals List */}
        <div
          className="lg:col-span-2 space-y-4"
          ref={goalListRef}
          onKeyDown={handleListKeyDown}
          tabIndex={-1}
          role="listbox"
          aria-label="Goals list"
        >
          {viewMode === 'hierarchy' && hierarchy ? (
            <>
              {hierarchy.company?.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                    <Building2 className="h-5 w-5" style={{ color: 'var(--accent-tertiary)' }} />Company Goals
                  </h2>
                  {hierarchy.company.map((goal) => <GoalCard key={goal.id} goal={goal} />)}
                </div>
              )}
              {hierarchy.teams?.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                    <Users className="h-5 w-5" style={{ color: 'var(--accent-secondary)' }} />Team Goals
                  </h2>
                  {hierarchy.teams.map((goal) => <GoalCard key={goal.id} goal={goal} />)}
                </div>
              )}
              {hierarchy.individuals?.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                    <User className="h-5 w-5" style={{ color: 'var(--accent-secondary)' }} />Individual Goals
                  </h2>
                  {hierarchy.individuals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedGoals.map((goal, i) => <GoalCard key={goal.id} goal={goal} index={i} />)}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <VCButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </VCButton>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <VCButton
                      key={p}
                      variant={page === p ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => setPage(p)}
                      aria-label={`Page ${p}`}
                      aria-current={page === p ? 'page' : undefined}
                    >
                      {p}
                    </VCButton>
                  ))}
                  <VCButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </VCButton>
                </div>
              )}
            </>
          )}

          {goals.length === 0 && (
            <div className="vc p-8 text-center">
              <Target className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
              <h3 className="text-lg font-medium mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                No goals yet
              </h3>
              <p className="mb-4" style={{ color: 'var(--text-tertiary)' }}>
                {hasActiveFilters ? 'No goals match your filters' : 'Create your first goal to start tracking progress'}
              </p>
              {hasActiveFilters ? (
                <VCButton variant="secondary" onClick={() => { setFilterType(''); setFilterStatus(''); setFilterQuarter(''); }}>
                  Clear Filters
                </VCButton>
              ) : (
                <VCButton variant="primary" onClick={() => setShowCreateModal(true)}>Create Goal</VCButton>
              )}
            </div>
          )}
        </div>

        {/* Goal Details Panel */}
        <div>
          {selectedGoal ? (
            <GoalDetailPanel goal={selectedGoal} onUpdate={fetchData} onClose={() => setSelectedGoal(null)} />
          ) : (
            <div className="vc p-8 text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
              <p style={{ color: 'var(--text-tertiary)' }}>Select a goal to view details</p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                Use arrow keys to navigate, Enter to select
              </p>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateGoalModal
          goals={goals}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchData(); }}
        />
      )}
    </div>
  );
}

// ============================================================
// GoalDetailPanel — view, edit, status, KR CRUD, tasks, history
// ============================================================
function GoalDetailPanel({ goal, onUpdate, onClose }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [editingKR, setEditingKR] = useState(null);
  const [newKRTitle, setNewKRTitle] = useState('');
  const [newKRTarget, setNewKRTarget] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [deletingKR, setDeletingKR] = useState(null);

  // Task linking
  const [showTaskSearch, setShowTaskSearch] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [taskSearchResults, setTaskSearchResults] = useState([]);
  const [linkedTasks, setLinkedTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Progress history
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyNote, setHistoryNote] = useState('');

  // Load linked tasks when goal changes
  useEffect(() => {
    if (goal.related_tasks?.length > 0) {
      loadLinkedTasks();
    } else {
      setLinkedTasks([]);
    }
    setShowTaskSearch(false);
    setTaskSearchQuery('');
    setShowHistory(false);
  }, [goal.id, goal.related_tasks?.length]);

  const loadLinkedTasks = async () => {
    try {
      const res = await api.get(`/goals/${goal.id}`);
      setLinkedTasks(res.data?.relatedTasks || []);
    } catch {
      setLinkedTasks([]);
    }
  };

  const searchTasks = async (query) => {
    if (!query || query.length < 2) {
      setTaskSearchResults([]);
      return;
    }
    setLoadingTasks(true);
    try {
      const res = await tasksApi.list({ search: query, limit: 10 });
      const tasks = res.data || [];
      // Filter out already-linked tasks
      const linked = new Set(goal.related_tasks || []);
      setTaskSearchResults(tasks.filter(t => !linked.has(t.id)));
    } catch {
      setTaskSearchResults([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => searchTasks(taskSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [taskSearchQuery]);

  const linkTask = async (taskId) => {
    try {
      await api.post(`/goals/${goal.id}/link-task`, { task_id: taskId });
      toast.success('Task linked');
      setTaskSearchQuery('');
      setTaskSearchResults([]);
      onUpdate();
    } catch (err) {
      toast.error('Failed to link task', err.message);
    }
  };

  const unlinkTask = async (taskId) => {
    try {
      await api.delete(`/goals/${goal.id}/link-task/${taskId}`);
      toast.success('Task unlinked');
      onUpdate();
    } catch (err) {
      toast.error('Failed to unlink task', err.message);
    }
  };

  // Progress history
  const loadHistory = async () => {
    try {
      const res = await api.get(`/goals/${goal.id}/history`);
      setHistory(res.data || []);
    } catch {
      setHistory([]);
    }
  };

  const toggleHistory = () => {
    if (!showHistory) loadHistory();
    setShowHistory(!showHistory);
  };

  const addHistoryNote = async () => {
    try {
      await api.post(`/goals/${goal.id}/history`, { note: historyNote || 'Manual progress snapshot' });
      setHistoryNote('');
      toast.success('Progress snapshot saved');
      loadHistory();
    } catch (err) {
      toast.error('Failed to save snapshot', err.message);
    }
  };

  const startEdit = () => {
    setEditData({
      title: goal.title,
      description: goal.description || '',
      goal_type: goal.goal_type,
      quarter: goal.quarter,
      start_date: goal.start_date || '',
      target_date: goal.target_date || ''
    });
    setIsEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/goals/${goal.id}`, editData);
      toast.success('Goal updated', 'Changes saved successfully');
      setIsEditing(false);
      onUpdate();
    } catch (err) {
      toast.error('Update failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (newStatus) => {
    try {
      await api.put(`/goals/${goal.id}`, { status: newStatus });
      // Auto-log progress snapshot on status change
      api.post(`/goals/${goal.id}/history`, { note: `Status changed to ${newStatus}` }).catch(() => {});
      toast.success('Status updated', `Goal marked as ${newStatus}`);
      onUpdate();
    } catch (err) {
      toast.error('Status update failed', err.message);
    }
  };

  const updateKeyResult = async (krId, current) => {
    try {
      await api.put(`/goals/${goal.id}/key-results/${krId}`, { current });
      // Auto-log progress snapshot on KR update
      api.post(`/goals/${goal.id}/history`, { note: `Key result updated` }).catch(() => {});
      toast.success('Key result updated');
      onUpdate();
    } catch (err) {
      toast.error('Update failed', err.message);
    }
  };

  const addKeyResult = async () => {
    if (!newKRTitle || !newKRTarget) return;
    try {
      await api.post(`/goals/${goal.id}/key-results`, {
        title: newKRTitle,
        target: Number(newKRTarget)
      });
      setNewKRTitle('');
      setNewKRTarget('');
      toast.success('Key result added');
      onUpdate();
    } catch (err) {
      toast.error('Failed to add key result', err.message);
    }
  };

  const deleteKeyResult = async (krId) => {
    setDeletingKR(krId);
    try {
      const updatedKRs = (goal.key_results || []).filter(kr => kr.id !== krId);
      const totalProgress = updatedKRs.reduce((sum, kr) => {
        const p = kr.target > 0 ? (kr.current / kr.target) * 100 : 0;
        return sum + Math.min(p, 100);
      }, 0);
      const avgProgress = updatedKRs.length > 0 ? totalProgress / updatedKRs.length : 0;

      await api.put(`/goals/${goal.id}`, {
        key_results: updatedKRs,
        progress: Math.round(avgProgress * 100) / 100
      });
      toast.success('Key result removed');
      onUpdate();
    } catch (err) {
      toast.error('Failed to delete key result', err.message);
    } finally {
      setDeletingKR(null);
    }
  };

  const deleteGoal = async () => {
    const ok = await confirm({
      title: 'Delete Goal?',
      message: 'This action cannot be undone. All key results will be lost.',
      confirmLabel: 'Delete',
      variant: 'danger'
    });
    if (!ok) return;
    try {
      await api.delete(`/goals/${goal.id}`);
      toast.success('Goal deleted');
      onClose();
      onUpdate();
    } catch (err) {
      toast.error('Delete failed', err.message);
    }
  };

  const handleSyncCalendar = async () => {
    try {
      await calendarApi.syncGoal(goal.id);
      toast.success('Calendar synced', 'Goal synced to your calendar');
    } catch (err) {
      toast.error('Calendar sync failed', err.message);
    }
  };

  const krProgressColor = (kr) => {
    const pct = kr.target > 0 ? (kr.current / kr.target) * 100 : 0;
    return pct >= 70 ? 'mint' : pct >= 40 ? 'amber' : 'crimson';
  };

  const getTaskStatusColor = (status) => {
    if (status === 'completed' || status === 'done') return 'mint';
    if (status === 'in_progress' || status === 'active') return 'amber';
    return 'neutral';
  };

  return (
    <div className="vc p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        {isEditing ? (
          <input
            type="text"
            value={editData.title}
            onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
            className="input font-semibold text-base flex-1 mr-2"
            style={{ fontFamily: 'var(--font-display)' }}
            autoFocus
          />
        ) : (
          <h3 className="font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            {goal.title}
          </h3>
        )}
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <VCButton variant="primary" size="sm" onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </VCButton>
              <VCButton variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</VCButton>
            </>
          ) : (
            <>
              <VCButton variant="ghost" size="sm" onClick={startEdit} title="Edit goal" aria-label="Edit goal">
                <Edit2 className="h-4 w-4" />
              </VCButton>
              <VCButton variant="ghost" size="sm" onClick={handleSyncCalendar} title="Sync to calendar" aria-label="Sync to calendar">
                <Calendar className="h-4 w-4" />
              </VCButton>
              <VCButton variant="danger" size="sm" onClick={deleteGoal} title="Delete goal" aria-label="Delete goal">
                <Trash2 className="h-4 w-4" />
              </VCButton>
            </>
          )}
        </div>
      </div>

      {/* Description */}
      {isEditing ? (
        <textarea
          value={editData.description}
          onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
          className="input text-sm"
          rows={2}
          placeholder="Describe this goal..."
        />
      ) : (
        goal.description && (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{goal.description}</p>
        )
      )}

      {/* Status Transition */}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Status</label>
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTIONS.map(opt => (
            <VCButton
              key={opt.value}
              variant={goal.status === opt.value ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => { if (goal.status !== opt.value) updateStatus(opt.value); }}
            >
              {opt.label}
            </VCButton>
          ))}
        </div>
      </div>

      {/* Edit fields: type, quarter, dates */}
      {isEditing && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>Type</label>
              <select
                value={editData.goal_type}
                onChange={(e) => setEditData(prev => ({ ...prev, goal_type: e.target.value }))}
                className="input text-sm"
              >
                <option value="company">Company</option>
                <option value="team">Team</option>
                <option value="individual">Individual</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>Quarter</label>
              <select
                value={editData.quarter}
                onChange={(e) => setEditData(prev => ({ ...prev, quarter: e.target.value }))}
                className="input text-sm"
              >
                {getQuarterOptions().map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>Start Date</label>
              <input
                type="date"
                value={editData.start_date}
                onChange={(e) => setEditData(prev => ({ ...prev, start_date: e.target.value }))}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>Target Date</label>
              <input
                type="date"
                value={editData.target_date}
                onChange={(e) => setEditData(prev => ({ ...prev, target_date: e.target.value }))}
                className="input text-sm"
              />
            </div>
          </div>
        </div>
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
          color={(goal.progress || 0) >= 70 ? 'mint' : (goal.progress || 0) >= 40 ? 'amber' : 'crimson'}
        />
      </div>

      {/* Key Results */}
      <div>
        <h4 className="font-medium mb-3" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
          Key Results
        </h4>
        <div className="space-y-3">
          {(goal.key_results || []).map((kr) => (
            <div key={kr.id} className="rounded-lg p-3" style={{ background: 'var(--bg-elevated)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{kr.title}</span>
                <div className="flex items-center gap-0.5">
                  <VCButton
                    variant="ghost" size="sm"
                    onClick={() => setEditingKR(editingKR === kr.id ? null : kr.id)}
                    className="p-0.5" title="Edit" aria-label="Edit key result"
                  >
                    <Edit2 className="h-3 w-3" />
                  </VCButton>
                  <VCButton
                    variant="ghost" size="sm"
                    onClick={() => deleteKeyResult(kr.id)}
                    disabled={deletingKR === kr.id}
                    className="p-0.5" title="Remove" aria-label="Remove key result"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </VCButton>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <VCProgress
                    value={kr.target > 0 ? (kr.current / kr.target) * 100 : 0}
                    color={krProgressColor(kr)}
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateKeyResult(kr.id, Number(e.target.value));
                        setEditingKR(null);
                      }
                    }}
                  />
                  <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>/ {kr.target}</span>
                </div>
              )}
            </div>
          ))}

          {/* Add Key Result */}
          <div className="border-2 border-dashed rounded-lg p-3" style={{ borderColor: 'rgba(248,240,242,.08)' }}>
            <input
              type="text"
              value={newKRTitle}
              onChange={(e) => setNewKRTitle(e.target.value)}
              placeholder="Key result title"
              className="input text-sm mb-2"
              onKeyDown={(e) => { if (e.key === 'Enter' && newKRTitle && newKRTarget) addKeyResult(); }}
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={newKRTarget}
                onChange={(e) => setNewKRTarget(e.target.value)}
                placeholder="Target"
                className="input text-sm flex-1"
                onKeyDown={(e) => { if (e.key === 'Enter' && newKRTitle && newKRTarget) addKeyResult(); }}
              />
              <VCButton variant="primary" size="sm" onClick={addKeyResult} disabled={!newKRTitle || !newKRTarget}>
                Add
              </VCButton>
            </div>
          </div>
        </div>
      </div>

      {/* Linked Tasks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            Linked Tasks
          </h4>
          <VCButton
            variant="ghost"
            size="sm"
            onClick={() => setShowTaskSearch(!showTaskSearch)}
            title={showTaskSearch ? 'Close search' : 'Link a task'}
          >
            {showTaskSearch ? <X className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
          </VCButton>
        </div>

        {/* Task search */}
        {showTaskSearch && (
          <div className="mb-3 relative">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                value={taskSearchQuery}
                onChange={(e) => setTaskSearchQuery(e.target.value)}
                placeholder="Search tasks to link..."
                className="input text-sm pl-8"
                autoFocus
              />
            </div>
            {taskSearchQuery.length >= 2 && (
              <div
                className="mt-1 rounded-lg overflow-hidden border"
                style={{ borderColor: 'rgba(248,240,242,.08)', background: 'var(--bg-elevated)' }}
              >
                {loadingTasks ? (
                  <div className="p-3 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>Searching...</div>
                ) : taskSearchResults.length === 0 ? (
                  <div className="p-3 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>No tasks found</div>
                ) : (
                  taskSearchResults.map(task => (
                    <button
                      key={task.id}
                      className="w-full text-left p-2.5 text-sm flex items-center justify-between hover:opacity-80 transition-opacity"
                      style={{ borderBottom: '1px solid rgba(248,240,242,.08)' }}
                      onClick={() => linkTask(task.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="truncate block" style={{ color: 'var(--text-primary)' }}>{task.title || task.name}</span>
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{task.status}</span>
                      </div>
                      <Plus className="h-3.5 w-3.5 ml-2 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Linked tasks list */}
        {linkedTasks.length > 0 ? (
          <div className="space-y-1.5">
            {linkedTasks.map(task => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-lg p-2.5 text-sm"
                style={{ background: 'var(--bg-elevated)' }}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <VCBadge color={getTaskStatusColor(task.status)}>
                    {task.status}
                  </VCBadge>
                  <span className="truncate" style={{ color: 'var(--text-primary)' }}>{task.title || task.name}</span>
                </div>
                <VCButton
                  variant="ghost"
                  size="sm"
                  onClick={() => unlinkTask(task.id)}
                  className="p-0.5 flex-shrink-0"
                  title="Unlink task"
                  aria-label="Unlink task"
                >
                  <Unlink className="h-3 w-3" />
                </VCButton>
              </div>
            ))}
          </div>
        ) : !showTaskSearch && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            No tasks linked. Click the link icon to search and attach tasks.
          </p>
        )}
      </div>

      {/* Progress History */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4
            className="font-medium cursor-pointer flex items-center gap-1.5"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            onClick={toggleHistory}
            role="button"
            aria-expanded={showHistory}
          >
            <Clock className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
            Progress History
            {showHistory ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </h4>
        </div>

        {showHistory && (
          <div className="space-y-2">
            {/* Add note */}
            <div className="flex gap-2">
              <input
                type="text"
                value={historyNote}
                onChange={(e) => setHistoryNote(e.target.value)}
                placeholder="Add a note (optional)"
                className="input text-xs flex-1"
                onKeyDown={(e) => { if (e.key === 'Enter') addHistoryNote(); }}
              />
              <VCButton variant="ghost" size="sm" onClick={addHistoryNote} title="Save snapshot">
                <Plus className="h-3 w-3" />
              </VCButton>
            </div>

            {/* Timeline */}
            {history.length > 0 ? (
              <div className="space-y-1" style={{ maxHeight: 200, overflowY: 'auto' }}>
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2 py-1.5 text-xs"
                    style={{ borderBottom: '1px solid rgba(248,240,242,.04)' }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{
                        background: entry.progress >= 70 ? 'var(--accent-secondary)' :
                                    entry.progress >= 40 ? 'var(--accent-tertiary)' : 'var(--accent-primary)'
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {Math.round(entry.progress || 0)}%
                        </span>
                        <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                          {new Date(entry.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {entry.note && (
                        <p className="truncate" style={{ color: 'var(--text-tertiary)' }}>
                          {entry.note}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                No history yet. Snapshots are recorded on status and KR changes.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div
        className="pt-3 border-t text-xs space-y-1"
        style={{ borderColor: 'rgba(248,240,242,.08)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
      >
        <p>Quarter: {goal.quarter}</p>
        <p>Type: {goal.goal_type}</p>
        <p>Status: {goal.status}</p>
        {goal.start_date && <p>Start: {goal.start_date}</p>}
        {goal.target_date && <p>Target: {goal.target_date}</p>}
      </div>
    </div>
  );
}

// ============================================================
// CreateGoalModal — with date fields
// ============================================================
function CreateGoalModal({ goals, onClose, onCreated }) {
  const toast = useToast();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goal_type: 'individual',
    parent_goal_id: '',
    quarter: getCurrentQuarter(),
    start_date: '',
    target_date: ''
  });
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!formData.title?.trim()) errs.title = 'Title is required';
    if (!['company', 'team', 'individual'].includes(formData.goal_type)) errs.goal_type = 'Invalid goal type';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = { ...formData };
      if (!payload.parent_goal_id) delete payload.parent_goal_id;
      if (!payload.start_date) delete payload.start_date;
      if (!payload.target_date) delete payload.target_date;

      await api.post('/goals', payload);
      toast.success('Goal created', `"${formData.title}" has been created`);
      onCreated();
    } catch (err) {
      toast.error('Failed to create goal', err.message);
    } finally {
      setSaving(false);
    }
  };

  const parentOptions = goals.filter(g => {
    if (formData.goal_type === 'team') return g.goal_type === 'company';
    if (formData.goal_type === 'individual') return g.goal_type === 'team';
    return false;
  });

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="vc rounded-xl shadow-xl max-w-lg w-full mx-4">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b" style={{ borderColor: 'rgba(248,240,242,.08)' }}>
            <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
              Create Goal
            </h2>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Goal Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="input"
                placeholder="Increase revenue by 20%"
                required
                autoFocus
              />
              {formErrors.title && <span style={{ color: 'var(--semantic-error)', fontSize: 12, marginTop: 2, display: 'block' }}>{formErrors.title}</span>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Description</label>
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
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Goal Type</label>
                <select
                  value={formData.goal_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, goal_type: e.target.value, parent_goal_id: '' }))}
                  className="input"
                >
                  <option value="company">Company</option>
                  <option value="team">Team</option>
                  <option value="individual">Individual</option>
                </select>
                {formErrors.goal_type && <span style={{ color: 'var(--semantic-error)', fontSize: 12, marginTop: 2, display: 'block' }}>{formErrors.goal_type}</span>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Quarter</label>
                <select
                  value={formData.quarter}
                  onChange={(e) => setFormData(prev => ({ ...prev, quarter: e.target.value }))}
                  className="input"
                >
                  {getQuarterOptions().map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Start Date</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Target Date</label>
                <input
                  type="date"
                  value={formData.target_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, target_date: e.target.value }))}
                  className="input"
                />
              </div>
            </div>

            {parentOptions.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Parent Goal (optional)</label>
                <select
                  value={formData.parent_goal_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, parent_goal_id: e.target.value }))}
                  className="input"
                >
                  <option value="">None</option>
                  {parentOptions.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="p-6 border-t flex justify-end gap-3" style={{ borderColor: 'rgba(248,240,242,.08)' }}>
            <VCButton type="button" variant="secondary" onClick={onClose}>Cancel</VCButton>
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
