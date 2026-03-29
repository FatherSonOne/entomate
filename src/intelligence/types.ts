/**
 * Meeting Intelligence Profiles — Core Types
 *
 * Defines the type system for AI specialization profiles that shape how
 * Gemini processes meetings through specialized lenses.
 */

// ==================== CUSTOM FIELD DEFINITIONS ====================

export type CustomFieldType = 'text' | 'textarea' | 'select' | 'multiselect' | 'date' | 'number' | 'toggle';

export interface CustomFieldDef {
  key: string;                        // "grant_name", "funding_org"
  label: string;                      // "Grant Name"
  type: CustomFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;                  // Tooltip/helper text
  options?: { value: string; label: string }[];  // For select/multiselect
  defaultValue?: any;
}

// ==================== FOCUS AREAS ====================

export interface FocusArea {
  key: string;                        // "action_items", "budget_discussion", "risks"
  label: string;                      // "Action Items"
  description: string;
  weight: number;                     // 0-1, how much to emphasize
  extractionHint: string;             // Hint for Gemini on what to look for
}

// ==================== SUGGESTION RULES ====================

export interface SuggestionRule {
  type: 'keyword' | 'participant' | 'tag' | 'recurring' | 'org_type';
  match: string | string[];           // What to match against
  confidence: number;                 // 0-1, threshold for auto-suggest
}

// ==================== OUTPUT FORMAT ====================

export interface OutputFormatConfig {
  summaryStyle: 'executive' | 'detailed' | 'bullet_points';
  includeRecommendations: boolean;
  includeRiskAssessment: boolean;
  includeSentimentBreakdown: boolean;
  customSections?: { title: string; prompt: string }[];
}

// ==================== INTELLIGENCE PROFILE ====================

export interface IntelligenceProfile {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  category: ProfileCategory;

  systemPromptTemplate: string;       // Template with {{variable}} placeholders
  customFields: CustomFieldDef[];
  focusAreas: FocusArea[];
  tone: ProfileTone;
  outputFormat: OutputFormatConfig;

  contextSources: ContextSource[];
  contextDepth: ContextDepth;

  suggestWhen: SuggestionRule[];

  isBuiltin: boolean;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProfileCategory = 'meetings' | 'sales' | 'operations' | 'grants' | 'hr' | 'custom';
export type ProfileTone = 'formal' | 'casual' | 'balanced';
export type ContextDepth = 'minimal' | 'standard' | 'deep';

/**
 * Template definition for built-in profiles (omits DB-generated fields)
 */
export type ProfileTemplate = Omit<IntelligenceProfile, 'id' | 'createdAt' | 'updatedAt'>;

// ==================== CONTEXT SOURCES ====================

export type ContextSource =
  | 'contacts'           // Pull participant info from Logos Vision
  | 'pulse_history'      // Recent Pulse conversations involving participants
  | 'crm_deals'          // Active deals linked to participants/org
  | 'past_meetings'      // Previous Entomate meetings with same participants
  | 'org_info'           // Organization details from CRM
  | 'tasks'              // Open tasks related to participants/deals
  | 'notes';             // Notes from CRM/Entomate linked to contacts

// ==================== ASSEMBLED CONTEXT ====================

export interface AssembledContext {
  participants: ParticipantContext[];
  organization?: OrgContext;
  relatedDeals?: DealContext[];
  pastMeetings?: PastMeetingContext[];
  recentConversations?: ConversationContext[];
  openTasks?: TaskContext[];
  assembledAt: string;
  sources: string[];                  // Which sources were actually queried
  tokenEstimate: number;              // Estimated token count for prompt budgeting
}

export interface ParticipantContext {
  name: string;
  email?: string;
  role?: string;
  organization?: string;
  orgType?: string;                   // "nonprofit", "corporate", "government"
  relationship?: string;              // "client", "partner", "team_member"
  lastInteraction?: string;           // ISO date
  meetingCount?: number;
  notes?: string;                     // CRM notes about this contact
  donationContext?: {
    totalDonated: number;
    lastDonation: string | null;
    donationCount: number;
    averageDonation: number;
  };
  activeProjects?: { name: string; status: string; description: string | null }[];
  sourceApp: 'logos_vision' | 'pulse' | 'entomate';
}

export interface OrgContext {
  name: string;
  type?: string;                      // "nonprofit", "corporate", "government"
  sector?: string;
  relationship?: string;
  activeDeals?: number;
  totalMeetings?: number;
  keyContacts?: string[];
  notes?: string;
}

export interface DealContext {
  name: string;
  stage: string;
  value?: number;
  lastActivity?: string;
  nextSteps?: string[];
}

export interface PastMeetingContext {
  title: string;
  date: string;
  summary?: string;
  keyDecisions?: string[];
  openActionItems?: string[];
}

export interface ConversationContext {
  channel: string;
  lastMessage: string;
  messageCount: number;
  lastActivity: string;
  topics?: string[];
}

export interface TaskContext {
  title: string;
  status: string;
  assignee?: string;
  dueDate?: string;
  priority: string;
  relatedTo?: string;
}

// ==================== MEETING INTELLIGENCE CONFIG ====================

export interface MeetingIntelligenceConfig {
  id: string;
  meetingId: string;
  profileId: string | null;

  customFieldValues: Record<string, any>;
  assembledContext: AssembledContext | null;
  contextAssembledAt: string | null;
  composedPrompt: string | null;

  toneOverride: string | null;
  focusOverride: FocusArea[] | null;
  additionalInstructions: string | null;

  status: 'pending' | 'context_ready' | 'active' | 'completed';
  suggestionDismissed: boolean;

  createdAt: string;
  updatedAt: string;
}

// ==================== PROFILE SUGGESTION ====================

export interface ProfileSuggestion {
  profile: IntelligenceProfile;
  confidence: number;                 // 0-1
  reason: string;                     // "Meeting title contains 'grant'"
  matchedRules: SuggestionRule[];
}
