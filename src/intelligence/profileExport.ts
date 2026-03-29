/**
 * Profile Export/Import
 * Enables sharing intelligence profiles as JSON files.
 */

import { createProfile, getProfileBySlug } from './profileService';
import type { IntelligenceProfile } from './types';

// ==================== TYPES ====================

export interface ExportedProfile {
  version: 1;
  exportedAt: string;
  profile: Omit<IntelligenceProfile, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;
}

const VALID_CONTEXT_SOURCES = ['contacts', 'pulse_history', 'crm_deals', 'past_meetings', 'org_info', 'tasks', 'notes'];
const VALID_FIELD_TYPES = ['text', 'textarea', 'select', 'multiselect', 'date', 'number', 'toggle'];

// ==================== EXPORT ====================

export function exportProfile(profile: IntelligenceProfile): ExportedProfile {
  const { id, createdAt, updatedAt, createdBy, ...rest } = profile;
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: rest,
  };
}

export function downloadProfile(profile: IntelligenceProfile): void {
  const exported = exportProfile(profile);
  const json = JSON.stringify(exported, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${profile.slug}-profile.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==================== IMPORT ====================

export function validateImport(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid JSON structure'] };
  }

  const obj = data as Record<string, any>;

  if (obj.version !== 1) {
    errors.push(`Unsupported version: ${obj.version} (expected 1)`);
  }

  if (!obj.profile || typeof obj.profile !== 'object') {
    errors.push('Missing "profile" object');
    return { valid: false, errors };
  }

  const p = obj.profile;

  if (!p.name || typeof p.name !== 'string') errors.push('Missing or invalid "name"');
  if (!p.slug || typeof p.slug !== 'string') errors.push('Missing or invalid "slug"');
  if (!p.systemPromptTemplate || typeof p.systemPromptTemplate !== 'string') {
    errors.push('Missing or invalid "systemPromptTemplate"');
  }

  if (p.customFields && Array.isArray(p.customFields)) {
    for (let i = 0; i < p.customFields.length; i++) {
      const field = p.customFields[i];
      if (!field.key || !field.label || !field.type) {
        errors.push(`Custom field ${i}: missing key, label, or type`);
      } else if (!VALID_FIELD_TYPES.includes(field.type)) {
        errors.push(`Custom field ${i}: invalid type "${field.type}"`);
      }
    }
  }

  if (p.contextSources && Array.isArray(p.contextSources)) {
    for (const source of p.contextSources) {
      if (!VALID_CONTEXT_SOURCES.includes(source)) {
        errors.push(`Invalid context source: "${source}"`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function importProfile(data: ExportedProfile): Promise<IntelligenceProfile | null> {
  const validation = validateImport(data);
  if (!validation.valid) {
    console.error('[Intelligence:export] Import validation failed:', validation.errors);
    return null;
  }

  const p = data.profile;

  // Check for slug conflict
  let slug = p.slug;
  const existing = await getProfileBySlug(slug);
  if (existing) {
    slug = `${slug}-imported`;
    // If that also exists, append timestamp
    const existing2 = await getProfileBySlug(slug);
    if (existing2) {
      slug = `${p.slug}-${Date.now()}`;
    }
  }

  const result = await createProfile({
    name: p.name,
    slug,
    description: p.description,
    icon: p.icon,
    category: p.category,
    system_prompt_template: p.systemPromptTemplate,
    custom_fields: p.customFields,
    focus_areas: p.focusAreas,
    tone: p.tone,
    output_format: p.outputFormat,
    context_sources: p.contextSources,
    context_depth: p.contextDepth,
    suggest_when: p.suggestWhen,
  });

  return result;
}
