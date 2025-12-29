/**
 * SlackSettings Component
 * Configure Slack notification integration settings
 */

import React, { useState, useEffect } from 'react';
import slackApi from '../../services/slackApi';

export default function SlackSettings() {
  const [status, setStatus] = useState(null);
  const [channels, setChannels] = useState([]);
  const [settings, setSettings] = useState({
    defaultChannel: '',
    meetingCompleted: true,
    dealWon: true,
    overdueReminder: true,
    actionItemCreated: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);

  // Load initial status and settings
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load status and settings in parallel
      const [statusRes, settingsRes] = await Promise.all([
        slackApi.getStatus(),
        slackApi.getSettings()
      ]);

      setStatus(statusRes);
      setSettings({
        defaultChannel: settingsRes.defaultChannel || '',
        meetingCompleted: settingsRes.meetingCompleted ?? true,
        dealWon: settingsRes.dealWon ?? true,
        overdueReminder: settingsRes.overdueReminder ?? true,
        actionItemCreated: settingsRes.actionItemCreated ?? false
      });

      // Load channels if connected
      if (statusRes.connected) {
        loadChannels();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadChannels = async () => {
    try {
      const response = await slackApi.getChannels();
      if (response.success) {
        setChannels(response.channels);
      }
    } catch (err) {
      console.error('Failed to load channels:', err);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);

      const result = await slackApi.test();
      setTestResult(result);

      if (result.success) {
        loadChannels();
      }
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSendTestNotification = async () => {
    try {
      setTesting(true);
      setTestResult(null);

      const result = await slackApi.sendTestNotification(
        settings.defaultChannel || undefined
      );

      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setError(null);

      await slackApi.updateSettings(settings);
      setTestResult({ success: true, message: 'Settings saved successfully' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  if (loading) {
    return (
      <div className="slack-settings">
        <div className="loading-spinner">Loading Slack settings...</div>
      </div>
    );
  }

  return (
    <div className="slack-settings">
      <div className="settings-header">
        <h2>Slack Integration</h2>
        <p className="settings-description">
          Connect Slack to receive real-time notifications for meetings, deals, and action items.
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">!</span>
          {error}
        </div>
      )}

      {testResult && (
        <div className={`alert ${testResult.success ? 'alert-success' : 'alert-error'}`}>
          <span className="alert-icon">{testResult.success ? 'check' : '!'}</span>
          {testResult.success
            ? testResult.message || `Connected to ${testResult.team || 'Slack'}`
            : testResult.error || 'Connection failed'
          }
        </div>
      )}

      {/* Connection Status */}
      <div className="settings-section">
        <h3>Connection Status</h3>
        <div className="status-card">
          <div className="status-row">
            <span className="status-label">Status</span>
            <span className={`status-badge ${status?.connected ? 'connected' : 'disconnected'}`}>
              {status?.connected ? 'Connected' : 'Not Connected'}
            </span>
          </div>

          {status?.connected && status?.team && (
            <div className="status-row">
              <span className="status-label">Workspace</span>
              <span className="status-value">{status.team}</span>
            </div>
          )}

          <div className="status-row">
            <span className="status-label">Configuration</span>
            <span className={`status-badge ${status?.configured ? 'configured' : 'not-configured'}`}>
              {status?.configured ? 'Configured' : 'Not Configured'}
            </span>
          </div>

          <div className="button-group">
            <button
              className="btn btn-secondary"
              onClick={handleTestConnection}
              disabled={testing || !status?.configured}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          {!status?.configured && (
            <div className="help-text">
              <p>To configure Slack, add the following to your backend .env file:</p>
              <code>SLACK_BOT_TOKEN=xoxb-your-bot-token</code>
              <code>SLACK_DEFAULT_CHANNEL=general</code>
            </div>
          )}
        </div>
      </div>

      {/* Default Channel */}
      <div className="settings-section">
        <h3>Default Channel</h3>
        <p className="section-description">
          Select the default channel for Slack notifications.
        </p>

        <div className="form-group">
          <label htmlFor="defaultChannel">Channel</label>
          <select
            id="defaultChannel"
            value={settings.defaultChannel}
            onChange={(e) => setSettings(prev => ({ ...prev, defaultChannel: e.target.value }))}
            disabled={!status?.connected || channels.length === 0}
          >
            <option value="">Select a channel...</option>
            {channels.map(channel => (
              <option key={channel.id} value={channel.id}>
                {channel.displayName || `#${channel.name}`}
                {channel.isPrivate && ' (private)'}
              </option>
            ))}
          </select>

          {status?.connected && channels.length === 0 && (
            <p className="help-text">
              No channels found. Make sure the bot is invited to at least one channel.
            </p>
          )}
        </div>
      </div>

      {/* Notification Types */}
      <div className="settings-section">
        <h3>Notification Types</h3>
        <p className="section-description">
          Choose which events trigger Slack notifications.
        </p>

        <div className="toggle-list">
          <div className="toggle-item">
            <div className="toggle-info">
              <span className="toggle-label">Meeting Completed</span>
              <span className="toggle-description">
                Send a summary when a meeting is processed and analyzed
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.meetingCompleted}
                onChange={() => handleToggle('meetingCompleted')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="toggle-item">
            <div className="toggle-info">
              <span className="toggle-label">Deal Won</span>
              <span className="toggle-description">
                Celebrate when a deal is marked as won in the CRM
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.dealWon}
                onChange={() => handleToggle('dealWon')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="toggle-item">
            <div className="toggle-info">
              <span className="toggle-label">Overdue Reminders</span>
              <span className="toggle-description">
                Get notified about action items that are past their due date
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.overdueReminder}
                onChange={() => handleToggle('overdueReminder')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="toggle-item">
            <div className="toggle-info">
              <span className="toggle-label">New Action Items</span>
              <span className="toggle-description">
                Notify when new action items are created from meetings
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.actionItemCreated}
                onChange={() => handleToggle('actionItemCreated')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="settings-section">
        <div className="button-group">
          <button
            className="btn btn-primary"
            onClick={handleSaveSettings}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleSendTestNotification}
            disabled={testing || !status?.connected}
          >
            {testing ? 'Sending...' : 'Send Test Notification'}
          </button>
        </div>
      </div>

      <style>{`
        .slack-settings {
          max-width: 800px;
          padding: 1.5rem;
        }

        .settings-header {
          margin-bottom: 2rem;
        }

        .settings-header h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: var(--text-primary, #1a1a2e);
        }

        .settings-description {
          color: var(--text-secondary, #6b7280);
          font-size: 0.95rem;
        }

        .settings-section {
          background: var(--bg-card, #ffffff);
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .settings-section h3 {
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: var(--text-primary, #1a1a2e);
        }

        .section-description {
          color: var(--text-secondary, #6b7280);
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          font-size: 0.95rem;
        }

        .alert-success {
          background: #ecfdf5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }

        .alert-error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .alert-icon {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-weight: bold;
          font-size: 0.8rem;
        }

        .alert-success .alert-icon {
          background: #059669;
          color: white;
        }

        .alert-error .alert-icon {
          background: #dc2626;
          color: white;
        }

        .status-card {
          background: var(--bg-secondary, #f9fafb);
          border-radius: 6px;
          padding: 1rem;
        }

        .status-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
        }

        .status-row:not(:last-child) {
          border-bottom: 1px solid var(--border-color, #e5e7eb);
        }

        .status-label {
          color: var(--text-secondary, #6b7280);
          font-size: 0.9rem;
        }

        .status-value {
          font-weight: 500;
          color: var(--text-primary, #1a1a2e);
        }

        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .status-badge.connected,
        .status-badge.configured {
          background: #d1fae5;
          color: #065f46;
        }

        .status-badge.disconnected,
        .status-badge.not-configured {
          background: #fee2e2;
          color: #991b1b;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group label {
          display: block;
          font-size: 0.9rem;
          font-weight: 500;
          margin-bottom: 0.5rem;
          color: var(--text-primary, #1a1a2e);
        }

        .form-group select {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--border-color, #d1d5db);
          border-radius: 6px;
          font-size: 0.95rem;
          background: white;
          cursor: pointer;
        }

        .form-group select:disabled {
          background: var(--bg-secondary, #f3f4f6);
          cursor: not-allowed;
        }

        .toggle-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .toggle-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: var(--bg-secondary, #f9fafb);
          border-radius: 6px;
        }

        .toggle-info {
          flex: 1;
        }

        .toggle-label {
          display: block;
          font-weight: 500;
          color: var(--text-primary, #1a1a2e);
          margin-bottom: 0.25rem;
        }

        .toggle-description {
          font-size: 0.85rem;
          color: var(--text-secondary, #6b7280);
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 48px;
          height: 24px;
          margin-left: 1rem;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #d1d5db;
          transition: 0.3s;
          border-radius: 24px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        .toggle-switch input:checked + .toggle-slider {
          background-color: #4f46e5;
        }

        .toggle-switch input:checked + .toggle-slider:before {
          transform: translateX(24px);
        }

        .button-group {
          display: flex;
          gap: 1rem;
          margin-top: 1rem;
        }

        .btn {
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #4f46e5;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #4338ca;
        }

        .btn-secondary {
          background: var(--bg-secondary, #f3f4f6);
          color: var(--text-primary, #1a1a2e);
          border: 1px solid var(--border-color, #d1d5db);
        }

        .btn-secondary:hover:not(:disabled) {
          background: var(--bg-hover, #e5e7eb);
        }

        .help-text {
          margin-top: 1rem;
          padding: 1rem;
          background: #fffbeb;
          border: 1px solid #fcd34d;
          border-radius: 6px;
          font-size: 0.9rem;
          color: #92400e;
        }

        .help-text p {
          margin-bottom: 0.5rem;
        }

        .help-text code {
          display: block;
          background: #fef3c7;
          padding: 0.5rem;
          margin-top: 0.5rem;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.85rem;
        }

        .loading-spinner {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 3rem;
          color: var(--text-secondary, #6b7280);
        }

        @media (max-width: 640px) {
          .toggle-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .toggle-switch {
            margin-left: 0;
          }

          .button-group {
            flex-direction: column;
          }

          .btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
