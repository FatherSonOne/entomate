/**
 * Slack API Service
 * Frontend API methods for Slack integration
 */

import api from './api';

// ========================================
// SLACK API
// ========================================
export const slackApi = {
  // Get Slack status
  getStatus: () => api.get('/slack/status'),

  // Test Slack connection
  test: () => api.post('/slack/test'),

  // Get available channels
  getChannels: (params = {}) => api.get('/slack/channels', { params }),

  // Get settings
  getSettings: () => api.get('/slack/settings'),

  // Update settings
  updateSettings: (settings) => api.put('/slack/settings', settings),

  // Send test notification
  sendTestNotification: (channel) =>
    api.post('/slack/settings/test-notification', { channel }),

  // Send manual notification
  notify: (type, data, channel) =>
    api.post('/slack/notify', { type, data, channel }),

  // Send meeting summary notification
  notifyMeeting: (meetingId, channel) =>
    api.post(`/slack/notify/meeting/${meetingId}`, { channel }),

  // Send overdue reminder
  notifyOverdue: (channel, assignee) =>
    api.post('/slack/notify/overdue', { channel, assignee })
};

export default slackApi;
