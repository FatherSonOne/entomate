/**
 * Profile Service
 * CRUD operations for intelligence profiles and meeting intelligence configs.
 * Follows Supabase query patterns from meetingService.ts.
 */

import { supabase } from '../lib/supabase';
import type {
  IntelligenceProfile,
  MeetingIntelligenceConfig,
  FocusArea,
} from './types';

// ==================== DB ROW → APP TYPE MAPPERS ====================

function rowToProfile(row: any): IntelligenceProfile {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    icon: row.icon || '🤖',
    category: row.category,
    systemPromptTemplate: row.system_prompt_template,
    customFields: row.custom_fields || [],
    focusAreas: row.focus_areas || [],
    tone: row.tone,
    outputFormat: row.output_format || {},
    contextSources: row.context_sources || ['contacts'],
    contextDepth: row.context_depth || 'standard',
    suggestWhen: row.suggest_when || [],
    isBuiltin: row.is_builtin,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToConfig(row: any): MeetingIntelligenceConfig {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    profileId: row.profile_id,
    customFieldValues: row.custom_field_values || {},
    assembledContext: row.assembled_context || null,
    contextAssembledAt: row.context_assembled_at,
    composedPrompt: row.composed_prompt,
    toneOverride: row.tone_override,
    focusOverride: row.focus_override,
    additionalInstructions: row.additional_instructions,
    status: row.status,
    suggestionDismissed: row.suggestion_dismissed || false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==================== PROFILE CRUD ====================

export async function getActiveProfiles(): Promise<IntelligenceProfile[]> {
  const { data, error } = await supabase
    .from('intelligence_profiles')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('[Intelligence:profileService] Error fetching active profiles:', error);
    return [];
  }
  return (data || []).map(rowToProfile);
}

export async function getProfileBySlug(slug: string): Promise<IntelligenceProfile | null> {
  const { data, error } = await supabase
    .from('intelligence_profiles')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('[Intelligence:profileService] Error fetching profile by slug:', error);
    return null;
  }
  return data ? rowToProfile(data) : null;
}

export async function getProfileById(id: string): Promise<IntelligenceProfile | null> {
  const { data, error } = await supabase
    .from('intelligence_profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[Intelligence:profileService] Error fetching profile by id:', error);
    return null;
  }
  return data ? rowToProfile(data) : null;
}

export async function getBuiltinProfiles(): Promise<IntelligenceProfile[]> {
  const { data, error } = await supabase
    .from('intelligence_profiles')
    .select('*')
    .eq('is_builtin', true)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('[Intelligence:profileService] Error fetching builtin profiles:', error);
    return [];
  }
  return (data || []).map(rowToProfile);
}

export async function createProfile(profile: {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  category?: string;
  system_prompt_template: string;
  custom_fields?: any[];
  focus_areas?: FocusArea[];
  tone?: string;
  output_format?: any;
  context_sources?: string[];
  context_depth?: string;
  suggest_when?: any[];
  created_by?: string;
}): Promise<IntelligenceProfile | null> {
  const { data, error } = await supabase
    .from('intelligence_profiles')
    .insert([profile])
    .select()
    .single();

  if (error) {
    console.error('[Intelligence:profileService] Error creating profile:', error);
    return null;
  }
  return data ? rowToProfile(data) : null;
}

export async function updateProfile(
  id: string,
  updates: Record<string, any>
): Promise<IntelligenceProfile | null> {
  const { data, error } = await supabase
    .from('intelligence_profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Intelligence:profileService] Error updating profile:', error);
    return null;
  }
  return data ? rowToProfile(data) : null;
}

export async function deleteProfile(id: string): Promise<boolean> {
  // Soft-delete: set is_active = false
  const { error } = await supabase
    .from('intelligence_profiles')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[Intelligence:profileService] Error deleting profile:', error);
    return false;
  }
  return true;
}

// ==================== MEETING INTELLIGENCE CONFIG CRUD ====================

export async function getMeetingIntelligenceConfig(
  meetingId: string
): Promise<MeetingIntelligenceConfig | null> {
  const { data, error } = await supabase
    .from('meeting_intelligence_config')
    .select('*')
    .eq('meeting_id', meetingId)
    .single();

  if (error) {
    // Not found is expected for meetings without a config
    if (error.code !== 'PGRST116') {
      console.error('[Intelligence:profileService] Error fetching meeting config:', error);
    }
    return null;
  }
  return data ? rowToConfig(data) : null;
}

export async function saveMeetingIntelligenceConfig(config: {
  meeting_id: string;
  profile_id?: string | null;
  custom_field_values?: Record<string, any>;
  assembled_context?: any;
  context_assembled_at?: string;
  composed_prompt?: string;
  tone_override?: string | null;
  focus_override?: any;
  additional_instructions?: string | null;
  status?: string;
  suggestion_dismissed?: boolean;
}): Promise<MeetingIntelligenceConfig | null> {
  // Upsert on meeting_id (UNIQUE constraint)
  const { data, error } = await supabase
    .from('meeting_intelligence_config')
    .upsert(config, { onConflict: 'meeting_id' })
    .select()
    .single();

  if (error) {
    console.error('[Intelligence:profileService] Error saving meeting config:', error);
    return null;
  }
  return data ? rowToConfig(data) : null;
}
