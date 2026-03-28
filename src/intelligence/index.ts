/**
 * Meeting Intelligence Profiles — Public API
 *
 * This module provides AI specialization profiles that shape how Gemini
 * processes meetings through specialized lenses (e.g., Grant Specialist,
 * Sales Discovery, Board Meeting).
 */

// Types
export type {
  CustomFieldType,
  CustomFieldDef,
  FocusArea,
  SuggestionRule,
  OutputFormatConfig,
  IntelligenceProfile,
  ProfileCategory,
  ProfileTone,
  ContextDepth,
  ProfileTemplate,
  ContextSource,
  AssembledContext,
  ParticipantContext,
  OrgContext,
  DealContext,
  PastMeetingContext,
  ConversationContext,
  TaskContext,
  MeetingIntelligenceConfig,
  ProfileSuggestion,
} from './types';

// Profile Service (CRUD)
export {
  getActiveProfiles,
  getProfileBySlug,
  getProfileById,
  getBuiltinProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  getMeetingIntelligenceConfig,
  saveMeetingIntelligenceConfig,
} from './profileService';

// Profile Registry (templates + seeding)
export {
  getDefaultProfiles,
  seedBuiltinProfiles,
} from './profileRegistry';

// Prompt Builder
export {
  buildMeetingPrompt,
  buildDefaultPrompt,
} from './promptBuilder';

// Context Assembly
export {
  assembleContext,
  getCachedContext,
  setCachedContext,
  clearExpiredCache,
} from './contextAssembler';

// Suggestion Engine
export {
  suggestProfiles,
  evaluateRule,
} from './suggestionEngine';

// Analytics & Learning
export {
  trackSuggestion,
  trackAccepted,
  trackDismissed,
  trackManualSelection,
  trackContextAssembled,
  trackMeetingCompleted,
  trackFeedback,
  updateProfileEffectiveness,
  getAllProfileEffectiveness,
  getProfileEffectiveness,
  computeOutputQuality,
} from './analyticsService';

export type { ProfileEffectiveness } from './analyticsService';

// Profile Export/Import
export {
  exportProfile,
  downloadProfile,
  validateImport,
  importProfile,
} from './profileExport';

export type { ExportedProfile } from './profileExport';

// Built-in Templates
export { BUILTIN_PROFILES } from './templates';
