/**
 * Profile Registry
 * Loads built-in profile templates and provides idempotent DB seeding.
 */

import { supabase } from '../lib/supabase';
import { BUILTIN_PROFILES } from './templates';
import type { ProfileTemplate } from './types';

/**
 * Get the 7 default built-in profile templates (in-memory, no DB call)
 */
export function getDefaultProfiles(): ProfileTemplate[] {
  return BUILTIN_PROFILES;
}

/**
 * Seed built-in profiles into the database if they don't already exist.
 * Uses slug as the uniqueness key — idempotent (safe to call multiple times).
 */
export async function seedBuiltinProfiles(): Promise<{
  seeded: number;
  skipped: number;
  errors: string[];
}> {
  const results = { seeded: 0, skipped: 0, errors: [] as string[] };

  for (const template of BUILTIN_PROFILES) {
    try {
      // Check if profile already exists by slug
      const { data: existing } = await supabase
        .from('intelligence_profiles')
        .select('id')
        .eq('slug', template.slug)
        .single();

      if (existing) {
        results.skipped++;
        continue;
      }

      // Insert the profile
      const { error } = await supabase
        .from('intelligence_profiles')
        .insert([{
          name: template.name,
          slug: template.slug,
          description: template.description,
          icon: template.icon,
          category: template.category,
          system_prompt_template: template.systemPromptTemplate,
          custom_fields: template.customFields,
          focus_areas: template.focusAreas,
          tone: template.tone,
          output_format: template.outputFormat,
          context_sources: template.contextSources,
          context_depth: template.contextDepth,
          suggest_when: template.suggestWhen,
          is_builtin: true,
          is_active: true,
          created_by: null,
        }]);

      if (error) {
        // ON CONFLICT (slug) DO NOTHING in the migration handles races
        if (error.code === '23505') {
          results.skipped++;
        } else {
          results.errors.push(`${template.slug}: ${error.message}`);
        }
      } else {
        results.seeded++;
        console.log(`[Intelligence:registry] Seeded profile: ${template.name}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.errors.push(`${template.slug}: ${msg}`);
    }
  }

  console.log(`[Intelligence:registry] Seed complete — seeded: ${results.seeded}, skipped: ${results.skipped}, errors: ${results.errors.length}`);
  return results;
}
