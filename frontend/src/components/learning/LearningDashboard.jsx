import React, { useState, useEffect } from 'react';
import {
  Brain, TrendingUp, CheckCircle, Clock, AlertCircle, X, Settings, BarChart3,
  Activity, Zap, Target
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../vc/ToastProvider';
import { useConfirm } from '../vc/ConfirmDialog';
import PatternCard from './PatternCard';
import PatternApprovalModal from './PatternApprovalModal';
import EffectivenessReport from './EffectivenessReport';

/**
 * Learning Dashboard Component
 * Displays AI learning insights, patterns, and statistics
 */
export default function LearningDashboard() {
  const toast = useToast();
  const confirm = useConfirm();
  const [activePatterns, setActivePatterns] = useState([]);
  const [pendingPatterns, setPendingPatterns] = useState([]);
  const [overrideStats, setOverrideStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'pending' | 'stats' | 'effectiveness'

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load active patterns
      const activeResponse = await api.learning.getPatterns('active');
      setActivePatterns(activeResponse?.data || []);

      // Load pending patterns
      const pendingResponse = await api.learning.getPatterns('pending_approval');
      setPendingPatterns(pendingResponse?.data || []);

      // Load override statistics
      const statsResponse = await api.learning.getOverrideStats(30);
      setOverrideStats(statsResponse?.data || null);
    } catch (error) {
      console.error('Failed to load learning dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePattern = async (pattern, customization = null) => {
    try {
      await api.learning.approvePattern(pattern.id, customization);
      await loadDashboardData(); // Reload data
      setShowApprovalModal(false);
      setSelectedPattern(null);
    } catch (error) {
      console.error('Failed to approve pattern:', error);
      toast.error('Error', 'Failed to approve pattern. Please try again.');
    }
  };

  const handleRejectPattern = async (pattern, reason = null) => {
    try {
      await api.learning.rejectPattern(pattern.id, reason);
      await loadDashboardData(); // Reload data
      setShowApprovalModal(false);
      setSelectedPattern(null);
    } catch (error) {
      console.error('Failed to reject pattern:', error);
      toast.error('Error', 'Failed to reject pattern. Please try again.');
    }
  };

  const handleDeactivatePattern = async (pattern) => {
    const ok = await confirm({ title: 'Deactivate?', message: 'Deactivate this learning pattern?', confirmLabel: 'Deactivate', variant: 'danger' });
    if (!ok) return;

    try {
      await api.learning.deactivatePattern(pattern.id);
      await loadDashboardData(); // Reload data
    } catch (error) {
      console.error('Failed to deactivate pattern:', error);
      toast.error('Error', 'Failed to deactivate pattern. Please try again.');
    }
  };

  const openApprovalModal = (pattern) => {
    setSelectedPattern(pattern);
    setShowApprovalModal(true);
  };

  const getAgentIcon = (agentType) => {
    const icons = {
      assignment: '👥',
      priority: '🎯',
      deadline: '📅',
      followup: '🔔'
    };
    return icons[agentType] || '🤖';
  };

  const getAgentName = (agentType) => {
    const names = {
      assignment: 'Assignment Agent',
      priority: 'Priority Agent',
      deadline: 'Deadline Agent',
      followup: 'Follow-up Agent'
    };
    return names[agentType] || 'AI Agent';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 vc-spinner"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Brain size={32} className="text-accent-primary" />
          <h1 className="text-3xl font-bold text-content-primary">AI Learning Insights</h1>
        </div>
        <p className="text-content-secondary">
          View and manage how the AI learns from your feedback
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-content-secondary">Active Patterns</div>
            <CheckCircle size={20} className="text-semantic-success" />
          </div>
          <div className="text-3xl font-bold text-content-primary">{activePatterns.length}</div>
          <div className="text-xs text-content-tertiary mt-1">Improving AI accuracy</div>
        </div>

        <div className="bg-surface rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-content-secondary">Pending Approval</div>
            <Clock size={20} className="vc-text-warning" />
          </div>
          <div className="text-3xl font-bold text-content-primary">{pendingPatterns.length}</div>
          <div className="text-xs text-content-tertiary mt-1">New patterns detected</div>
        </div>

        <div className="bg-surface rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-content-secondary">Total Overrides</div>
            <Activity size={20} className="vc-text-info" />
          </div>
          <div className="text-3xl font-bold text-content-primary">{overrideStats?.total || 0}</div>
          <div className="text-xs text-content-tertiary mt-1">Last 30 days</div>
        </div>

        <div className="bg-surface rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-content-secondary">Feedback Rate</div>
            <BarChart3 size={20} className="text-accent-primary" />
          </div>
          <div className="text-3xl font-bold text-content-primary">{overrideStats?.feedbackRate || 0}%</div>
          <div className="text-xs text-content-tertiary mt-1">User feedback provided</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-line-default mb-6">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('active')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'active'
                ? 'vc-border-error text-accent-primary'
                : 'border-transparent text-content-tertiary hover:text-content-secondary hover:border-line-strong'
            }`}
          >
            Active Patterns ({activePatterns.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pending'
                ? 'vc-border-error text-accent-primary'
                : 'border-transparent text-content-tertiary hover:text-content-secondary hover:border-line-strong'
            }`}
          >
            Pending Approval ({pendingPatterns.length})
            {pendingPatterns.length > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium vc-bg-warning-dim vc-text-warning">
                New
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'stats'
                ? 'vc-border-error text-accent-primary'
                : 'border-transparent text-content-tertiary hover:text-content-secondary hover:border-line-strong'
            }`}
          >
            Statistics
          </button>
          <button
            onClick={() => setActiveTab('effectiveness')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'effectiveness'
                ? 'vc-border-error text-accent-primary'
                : 'border-transparent text-content-tertiary hover:text-content-secondary hover:border-line-strong'
            }`}
          >
            Effectiveness Report
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {activePatterns.length === 0 ? (
            <div className="bg-surface rounded-lg shadow p-12 text-center">
              <Target size={48} className="mx-auto text-content-tertiary mb-4" />
              <h3 className="text-lg font-medium text-content-primary mb-2">No Active Patterns</h3>
              <p className="text-content-secondary">
                As you provide feedback on AI recommendations, patterns will be detected and appear here.
              </p>
            </div>
          ) : (
            activePatterns.map((pattern) => (
              <PatternCard
                key={pattern.id}
                pattern={pattern}
                status="active"
                onDeactivate={handleDeactivatePattern}
                getAgentIcon={getAgentIcon}
                getAgentName={getAgentName}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingPatterns.length === 0 ? (
            <div className="bg-surface rounded-lg shadow p-12 text-center">
              <CheckCircle size={48} className="mx-auto text-content-tertiary mb-4" />
              <h3 className="text-lg font-medium text-content-primary mb-2">No Pending Patterns</h3>
              <p className="text-content-secondary">
                When new patterns are detected, they'll appear here for your approval.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-semantic-info-dim border border-semantic-info rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle size={20} className="text-semantic-info mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-semantic-info mb-1">New Patterns Detected</h4>
                    <p className="text-sm text-semantic-info">
                      The AI has detected {pendingPatterns.length} new learning{' '}
                      {pendingPatterns.length === 1 ? 'pattern' : 'patterns'} from your recent feedback.
                      Review and approve them to improve AI accuracy.
                    </p>
                  </div>
                </div>
              </div>

              {pendingPatterns.map((pattern) => (
                <PatternCard
                  key={pattern.id}
                  pattern={pattern}
                  status="pending"
                  onApprove={() => openApprovalModal(pattern)}
                  onReject={() => handleRejectPattern(pattern)}
                  getAgentIcon={getAgentIcon}
                  getAgentName={getAgentName}
                />
              ))}
            </>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-6">
          {/* Override Stats by Agent Type */}
          {overrideStats && overrideStats.byAgentType && (
            <div className="bg-surface rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-content-primary mb-4">Overrides by Agent Type</h3>
              <div className="space-y-3">
                {Object.entries(overrideStats.byAgentType).map(([agentType, count]) => (
                  <div key={agentType}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getAgentIcon(agentType)}</span>
                        <span className="font-medium text-content-secondary">{getAgentName(agentType)}</span>
                      </div>
                      <span className="text-sm font-semibold text-content-primary">{count} overrides</span>
                    </div>
                    <div className="w-full bg-surface-muted rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{ background: 'var(--c)' }}
                        style={{ width: `${(count / overrideStats.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feedback Statistics */}
          <div className="bg-surface rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-content-primary mb-4">Feedback Statistics</h3>
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <dt className="text-sm font-medium text-content-tertiary mb-1">Total Overrides</dt>
                <dd className="text-2xl font-bold text-content-primary">{overrideStats?.total || 0}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-content-tertiary mb-1">With Feedback</dt>
                <dd className="text-2xl font-bold text-content-primary">{overrideStats?.withFeedback || 0}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-content-tertiary mb-1">Feedback Rate</dt>
                <dd className="text-2xl font-bold text-content-primary">{overrideStats?.feedbackRate || 0}%</dd>
              </div>
            </dl>
          </div>

          {/* Link to Effectiveness Report */}
          <div className="rounded-lg shadow p-6 vc-bg-error-dim vc-border-subtle" style={{ border: '1px solid' }}>
            <div className="flex items-center gap-3 mb-2">
              <Zap size={24} className="text-accent-primary" />
              <h3 className="text-lg font-semibold text-content-primary">Detailed Learning Impact</h3>
            </div>
            <p className="text-content-secondary mb-4">
              View comprehensive effectiveness metrics including pattern performance, time saved, and recommendations.
            </p>
            <button
              onClick={() => setActiveTab('effectiveness')}
              className="vbtn vbtn-primary inline-flex items-center gap-2"
            >
              <BarChart3 size={18} />
              View Effectiveness Report
            </button>
          </div>
        </div>
      )}

      {activeTab === 'effectiveness' && (
        <EffectivenessReport days={30} />
      )}

      {/* Pattern Approval Modal */}
      {showApprovalModal && selectedPattern && (
        <PatternApprovalModal
          pattern={selectedPattern}
          onApprove={handleApprovePattern}
          onReject={handleRejectPattern}
          onClose={() => {
            setShowApprovalModal(false);
            setSelectedPattern(null);
          }}
          getAgentIcon={getAgentIcon}
          getAgentName={getAgentName}
        />
      )}
    </div>
  );
}
