/**
 * Phase 3: Enterprise & Intelligence Layer Type Definitions
 *
 * This file contains all TypeScript types for Phase 3 features:
 * - Real-time Coaching
 * - Customer Sentiment Analysis
 * - Customer Health Scoring
 * - Customer Alerts
 * - RBAC (Role-Based Access Control)
 * - Audit Logging
 * - Webhooks
 * - Integrations
 */

// ============================================================================
// REAL-TIME COACHING TYPES
// ============================================================================

export type CoachingPromptType =
  | 'deal_context'
  | 'objection_handling'
  | 'competitor_alert'
  | 'talk_time_warning'
  | 'question_prompt'
  | 'topic_suggestion'
  | 'sentiment_alert'
  | 'follow_up_reminder';

export type CoachingPromptPriority = 'low' | 'medium' | 'high' | 'critical';

export interface CoachingSession {
  id: string;
  meetingId: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  promptsShown: number;
  promptsUsed: number;
  promptsDismissed: number;
  averageResponseTime: number | null;
  createdAt: string;
}

export interface CoachingPrompt {
  id: string;
  sessionId: string;
  promptType: CoachingPromptType;
  promptText: string;
  context: Record<string, unknown>;
  priority: CoachingPromptPriority;
  shownAt: string;
  usedAt: string | null;
  dismissedAt: string | null;
  triggerKeyword: string | null;
  triggerContext: string | null;
}

export interface CoachingKeyword {
  id: string;
  keyword: string;
  category: string;
  promptType: CoachingPromptType;
  promptTemplate: string;
  priority: CoachingPromptPriority;
  isActive: boolean;
  createdAt: string;
}

export interface CoachingContext {
  meetingId: string;
  dealId: string | null;
  participants: string[];
  dealStage: string | null;
  openObjections: string[];
  competitorMentions: string[];
  talkTimeByParticipant: Record<string, number>;
  currentSentiment: number;
  keyTopics: string[];
}

export interface CoachingStats {
  totalSessions: number;
  totalPrompts: number;
  promptsUsed: number;
  promptsDismissed: number;
  avgResponseTime: number | null;
  usageRate: number;
}

// WebSocket message types
export type CoachingMessageType =
  | 'coaching_prompt'
  | 'context_update'
  | 'talk_time_alert'
  | 'session_start'
  | 'session_end'
  | 'prompt_feedback';

export interface CoachingMessage {
  type: CoachingMessageType;
  payload: unknown;
  timestamp: string;
}

export interface CoachingPromptMessage {
  type: 'coaching_prompt';
  payload: {
    prompt: CoachingPrompt;
    context: CoachingContext;
  };
  timestamp: string;
}

export interface TalkTimeAlertMessage {
  type: 'talk_time_alert';
  payload: {
    userTalkTime: number;
    customerTalkTime: number;
    recommendation: string;
  };
  timestamp: string;
}

// ============================================================================
// CUSTOMER SENTIMENT TYPES
// ============================================================================

export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export type SentimentSourceType = 'meeting' | 'pulse_message' | 'email' | 'call' | 'note';

export interface CustomerSentiment {
  id: string;
  customerId: string;
  sourceType: SentimentSourceType;
  sourceId: string;
  sentimentScore: number; // -1.0 to 1.0
  sentimentLabel: SentimentLabel;
  confidence: number;
  keyPhrases: string[];
  emotions: Record<string, number>;
  analyzedAt: string;
  createdAt: string;
}

export interface SentimentAnalysisResult {
  score: number;
  label: SentimentLabel;
  confidence: number;
  keyPhrases: string[];
  emotions: {
    joy: number;
    trust: number;
    fear: number;
    surprise: number;
    sadness: number;
    disgust: number;
    anger: number;
    anticipation: number;
  };
  summary: string;
}

export interface SentimentTrend {
  period: string;
  averageScore: number;
  label: SentimentLabel;
  dataPoints: number;
  trend: 'improving' | 'stable' | 'declining';
}

// ============================================================================
// CUSTOMER HEALTH TYPES
// ============================================================================

export type HealthLabel = 'healthy' | 'at_risk' | 'critical';

export type SentimentTrendLabel = 'improving' | 'stable' | 'declining';

export interface HealthFactors {
  sentimentScore: number;
  engagementScore: number;
  responsivenessScore: number;
  dealProgressScore: number;
  taskCompletionScore: number;
}

export interface CustomerHealth {
  id: string;
  customerId: string;
  healthScore: number; // 0-100
  healthLabel: HealthLabel;
  factors: HealthFactors;
  lastInteraction: string | null;
  sentimentTrend: SentimentTrendLabel;
  calculatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerHealthHistory {
  id: string;
  customerId: string;
  healthScore: number;
  healthLabel: HealthLabel;
  factors: HealthFactors;
  sentimentTrend: SentimentTrendLabel;
  recordedAt: string;
}

export interface HealthDistribution {
  healthy: number;
  atRisk: number;
  critical: number;
  total: number;
}

export interface CustomerNeedingAttention {
  customerId: string;
  healthScore: number;
  healthLabel: HealthLabel;
  sentimentTrend: SentimentTrendLabel;
  lastInteraction: string | null;
  daysSinceInteraction: number | null;
}

// Health score weights
export const HEALTH_WEIGHTS = {
  sentiment: 0.30,
  engagement: 0.25,
  responsiveness: 0.15,
  dealProgress: 0.15,
  taskCompletion: 0.15
} as const;

// ============================================================================
// CUSTOMER ALERTS TYPES
// ============================================================================

export type AlertType =
  | 'score_drop'
  | 'declining_trend'
  | 'no_interaction'
  | 'repeated_negative'
  | 'churn_risk'
  | 'engagement_drop';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed';

export interface CustomerAlert {
  id: string;
  customerId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  suggestedAction: string | null;
  context: Record<string, unknown>;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlertStatistics {
  totalActive: number;
  totalAcknowledged: number;
  totalResolved: number;
  bySeverity: {
    info: number;
    warning: number;
    critical: number;
  };
  byType: Record<AlertType, number>;
}

export interface CreateAlertInput {
  customerId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  suggestedAction?: string;
  context?: Record<string, unknown>;
}

// Alert thresholds configuration
export const ALERT_THRESHOLDS = {
  scoreDrop: 15, // Points drop
  lowScore: 40,
  criticalScore: 25,
  noInteractionDays: 14,
  repeatedNegativeCount: 3
} as const;

// ============================================================================
// RBAC (ROLE-BASED ACCESS CONTROL) TYPES
// ============================================================================

export type SystemRole = 'admin' | 'manager' | 'member' | 'viewer';

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  grantedBy: string | null;
  grantedAt: string;
  expiresAt: string | null;
}

export interface UserWithRoles {
  userId: string;
  roles: Role[];
  permissions: string[];
}

// Permission format: resource:action or resource:scope
// Examples: "agents:create", "meetings:own", "tasks:*", "*"
export type Permission = string;

export interface PermissionCheck {
  resource: string;
  action: string;
  allowed: boolean;
}

// Default role permissions
export const ROLE_PERMISSIONS: Record<SystemRole, string[]> = {
  admin: ['*'],
  manager: [
    'agents:*',
    'analytics:*',
    'meetings:*',
    'tasks:*',
    'customers:*',
    'team:read',
    'settings:read',
    'coaching:*',
    'sentiment:*',
    'alerts:*'
  ],
  member: [
    'meetings:own',
    'tasks:own',
    'customers:read',
    'analytics:read',
    'coaching:own',
    'sentiment:read',
    'alerts:own'
  ],
  viewer: [
    'meetings:read',
    'tasks:read',
    'customers:read',
    'analytics:read',
    'sentiment:read'
  ]
} as const;

// ============================================================================
// AUDIT LOGGING TYPES
// ============================================================================

export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'export'
  | 'import'
  | 'permission_change'
  | 'config_change';

export type AuditCategory =
  | 'auth'
  | 'access'
  | 'modification'
  | 'admin'
  | 'agent'
  | 'system'
  | 'security';

export type AuditResourceType =
  | 'user'
  | 'role'
  | 'meeting'
  | 'task'
  | 'customer'
  | 'agent'
  | 'integration'
  | 'webhook'
  | 'setting'
  | 'sso_config';

export interface AuditLog {
  id: string;
  userId: string | null;
  action: AuditAction;
  category: AuditCategory;
  resourceType: AuditResourceType;
  resourceId: string | null;
  changes: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  } | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
  createdAt: string;
}

export interface AuditLogInput {
  action: AuditAction;
  category: AuditCategory;
  resourceType: AuditResourceType;
  resourceId?: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
}

export interface AuditQueryParams {
  userId?: string;
  action?: AuditAction;
  category?: AuditCategory;
  resourceType?: AuditResourceType;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface AuditStatistics {
  totalLogs: number;
  byCategory: Record<AuditCategory, number>;
  byAction: Record<AuditAction, number>;
  uniqueUsers: number;
  dateRange: {
    start: string;
    end: string;
  };
}

// ============================================================================
// SSO (SINGLE SIGN-ON) TYPES
// ============================================================================

export type SSOProvider = 'okta' | 'azure' | 'google' | 'saml_generic' | 'oauth_generic';

export type SSOProtocol = 'saml' | 'oauth' | 'oidc';

export interface SSOConfig {
  id: string;
  provider: SSOProvider;
  protocol: SSOProtocol;
  displayName: string;
  entityId: string | null;
  ssoUrl: string | null;
  certificate: string | null;
  clientId: string | null;
  clientSecret: string | null;
  authorizationUrl: string | null;
  tokenUrl: string | null;
  userInfoUrl: string | null;
  scopes: string[];
  attributeMapping: Record<string, string>;
  isActive: boolean;
  autoProvision: boolean;
  defaultRole: string;
  createdAt: string;
  updatedAt: string;
}

export interface SSOSession {
  id: string;
  userId: string;
  ssoConfigId: string;
  sessionIndex: string | null;
  nameId: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface SSOLoginRequest {
  provider: SSOProvider;
  returnUrl?: string;
}

export interface SSOCallbackData {
  code?: string;
  state?: string;
  SAMLResponse?: string;
  RelayState?: string;
}

// ============================================================================
// DATA RETENTION TYPES
// ============================================================================

export type RetentionResourceType =
  | 'meeting_transcripts'
  | 'meeting_recordings'
  | 'audit_logs'
  | 'agent_runs'
  | 'pulse_messages'
  | 'customer_sentiment'
  | 'coaching_sessions'
  | 'webhook_deliveries';

export interface RetentionPolicy {
  id: string;
  resourceType: RetentionResourceType;
  retentionDays: number;
  archiveFirst: boolean;
  notifyBeforeDelete: boolean;
  notifyDaysBefore: number;
  isActive: boolean;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RetentionJobResult {
  resourceType: RetentionResourceType;
  recordsDeleted: number;
  recordsArchived: number;
  errors: string[];
  executedAt: string;
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export type WebhookEvent =
  | 'meeting.created'
  | 'meeting.completed'
  | 'meeting.deleted'
  | 'task.created'
  | 'task.completed'
  | 'task.overdue'
  | 'customer.created'
  | 'customer.updated'
  | 'customer.health_changed'
  | 'alert.created'
  | 'alert.resolved'
  | 'agent.run_completed'
  | 'sentiment.analyzed';

export type WebhookStatus = 'active' | 'paused' | 'disabled';

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  filters: Record<string, unknown> | null;
  customHeaders: Record<string, string>;
  isActive: boolean;
  lastTriggeredAt: string | null;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  responseStatus: number | null;
  responseBody: string | null;
  deliveredAt: string;
  success: boolean;
  retryCount: number;
  nextRetryAt: string | null;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface CreateWebhookInput {
  name: string;
  url: string;
  events: WebhookEvent[];
  filters?: Record<string, unknown>;
  customHeaders?: Record<string, string>;
}

export interface WebhookTestResult {
  success: boolean;
  statusCode: number | null;
  responseTime: number;
  error: string | null;
}

// ============================================================================
// INTEGRATIONS TYPES
// ============================================================================

export type IntegrationType =
  | 'salesforce'
  | 'hubspot'
  | 'pipedrive'
  | 'zoom'
  | 'teams'
  | 'google_meet'
  | 'google_calendar'
  | 'outlook_calendar'
  | 'slack'
  | 'custom';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending';

export type SyncDirection = 'inbound' | 'outbound' | 'bidirectional';

export interface Integration {
  id: string;
  integrationType: IntegrationType;
  displayName: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  config: Record<string, unknown>;
  isActive: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  errorCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationSyncLog {
  id: string;
  integrationId: string;
  syncDirection: SyncDirection;
  recordsSynced: number;
  recordsFailed: number;
  errors: string[];
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'completed' | 'failed';
}

export interface IntegrationFieldMapping {
  id: string;
  integrationId: string;
  localField: string;
  remoteField: string;
  transformFunction: string | null;
  isRequired: boolean;
  createdAt: string;
}

export interface ConnectIntegrationInput {
  integrationType: IntegrationType;
  authCode?: string;
  accessToken?: string;
  refreshToken?: string;
  config?: Record<string, unknown>;
}

export interface IntegrationSyncResult {
  success: boolean;
  recordsSynced: number;
  recordsFailed: number;
  errors: string[];
  duration: number;
}

// ============================================================================
// CRM SPECIFIC TYPES
// ============================================================================

export interface CRMContact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  customFields: Record<string, unknown>;
}

export interface CRMDeal {
  id: string;
  name: string;
  stage: string;
  amount: number | null;
  probability: number | null;
  closeDate: string | null;
  contactId: string | null;
  customFields: Record<string, unknown>;
}

export interface CRMActivity {
  id: string;
  type: 'call' | 'meeting' | 'email' | 'task' | 'note';
  subject: string;
  description: string | null;
  timestamp: string;
  contactId: string | null;
  dealId: string | null;
}

// ============================================================================
// VIDEO PLATFORM SPECIFIC TYPES
// ============================================================================

export interface VideoMeeting {
  id: string;
  topic: string;
  startTime: string;
  duration: number; // minutes
  joinUrl: string;
  hostEmail: string;
  participants: string[];
  recordingUrl: string | null;
  transcriptUrl: string | null;
}

export interface VideoRecording {
  id: string;
  meetingId: string;
  downloadUrl: string;
  playUrl: string;
  duration: number;
  fileSize: number;
  fileType: string;
  createdAt: string;
}

// ============================================================================
// CALENDAR SPECIFIC TYPES
// ============================================================================

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  location: string | null;
  attendees: CalendarAttendee[];
  meetingLink: string | null;
  isAllDay: boolean;
  recurrence: string | null;
}

export interface CalendarAttendee {
  email: string;
  name: string | null;
  responseStatus: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  optional: boolean;
}

// ============================================================================
// SERVICE RESPONSE TYPES
// ============================================================================

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// REAL-TIME EVENT TYPES (for WebSocket)
// ============================================================================

export type RealTimeEventType =
  | 'coaching:prompt'
  | 'coaching:talk_time'
  | 'coaching:session_start'
  | 'coaching:session_end'
  | 'health:updated'
  | 'alert:created'
  | 'alert:acknowledged'
  | 'alert:resolved'
  | 'sentiment:analyzed'
  | 'integration:sync_complete'
  | 'webhook:delivered';

export interface RealTimeEvent<T = unknown> {
  type: RealTimeEventType;
  payload: T;
  timestamp: string;
  userId?: string;
  resourceId?: string;
}
