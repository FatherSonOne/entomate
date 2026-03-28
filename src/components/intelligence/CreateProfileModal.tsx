/**
 * CreateProfileModal
 * Modal for creating or editing custom intelligence profiles.
 * Supports cloning from existing profiles.
 */

import React, { useState, useEffect } from 'react';
import { createProfile, updateProfile } from '../../intelligence/profileService';
import type { IntelligenceProfile, CustomFieldDef, FocusArea, ContextSource } from '../../intelligence/types';

interface CreateProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (profile: IntelligenceProfile) => void;
  templateProfile?: IntelligenceProfile;
  editProfile?: IntelligenceProfile;
}

const CATEGORIES = [
  { value: 'meetings', label: 'Meetings' },
  { value: 'sales', label: 'Sales' },
  { value: 'operations', label: 'Operations' },
  { value: 'grants', label: 'Grants' },
  { value: 'hr', label: 'HR' },
  { value: 'custom', label: 'Custom' },
];

const TONES = [
  { value: 'formal', label: 'Formal' },
  { value: 'casual', label: 'Casual' },
  { value: 'balanced', label: 'Balanced' },
];

const CONTEXT_SOURCES: { value: ContextSource; label: string }[] = [
  { value: 'contacts', label: 'Contacts (CRM)' },
  { value: 'org_info', label: 'Organization Info' },
  { value: 'crm_deals', label: 'CRM Deals' },
  { value: 'past_meetings', label: 'Past Meetings' },
  { value: 'pulse_history', label: 'Pulse History' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'notes', label: 'Notes' },
];

const DEPTH_OPTIONS = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'standard', label: 'Standard' },
  { value: 'deep', label: 'Deep' },
];

const EMOJI_GRID = ['🤖', '📋', '🎯', '🤝', '🏛️', '⚡', '🗺️', '📝', '💡', '📊', '🔬', '📈', '🎓', '💼', '🛡️', '🔧', '📱', '🌐', '🎨', '🏥'];

const FIELD_TYPES = ['text', 'textarea', 'select', 'multiselect', 'date', 'number', 'toggle'];

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const CreateProfileModal: React.FC<CreateProfileModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  templateProfile,
  editProfile,
}) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [icon, setIcon] = useState('🤖');
  const [category, setCategory] = useState('custom');
  const [description, setDescription] = useState('');
  const [tone, setTone] = useState('balanced');
  const [systemPromptTemplate, setSystemPromptTemplate] = useState('');
  const [customFields, setCustomFields] = useState<Partial<CustomFieldDef>[]>([]);
  const [focusAreas, setFocusAreas] = useState<Partial<FocusArea>[]>([]);
  const [contextSources, setContextSources] = useState<ContextSource[]>(['contacts']);
  const [contextDepth, setContextDepth] = useState('standard');
  const [suggestionKeywords, setSuggestionKeywords] = useState('');
  const [saving, setSaving] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTemplateHelp, setShowTemplateHelp] = useState(false);

  // Pre-fill from template or edit profile
  useEffect(() => {
    const source = editProfile || templateProfile;
    if (source) {
      setName(editProfile ? source.name : `${source.name} (Copy)`);
      setSlug(editProfile ? source.slug : generateSlug(`${source.name}-copy`));
      setIcon(source.icon);
      setCategory(source.category);
      setDescription(source.description);
      setTone(source.tone);
      setSystemPromptTemplate(source.systemPromptTemplate);
      setCustomFields(source.customFields || []);
      setFocusAreas(source.focusAreas || []);
      setContextSources(source.contextSources || ['contacts']);
      setContextDepth(source.contextDepth || 'standard');
      const keywords = (source.suggestWhen || [])
        .filter(r => r.type === 'keyword')
        .flatMap(r => Array.isArray(r.match) ? r.match : [r.match]);
      setSuggestionKeywords(keywords.join(', '));
    }
  }, [templateProfile, editProfile]);

  // Auto-generate slug from name (only for new profiles)
  useEffect(() => {
    if (!editProfile && name) {
      setSlug(generateSlug(name));
    }
  }, [name, editProfile]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name || !systemPromptTemplate) return;

    setSaving(true);

    try {
      const suggestWhen = suggestionKeywords.trim()
        ? [{ type: 'keyword' as const, match: suggestionKeywords.split(',').map(k => k.trim()).filter(Boolean), confidence: 0.7 }]
        : [];

      const profileData = {
        name,
        slug,
        description,
        icon,
        category,
        system_prompt_template: systemPromptTemplate,
        custom_fields: customFields.filter(f => f.key && f.label) as CustomFieldDef[],
        focus_areas: focusAreas.filter(f => f.label) as FocusArea[],
        tone,
        output_format: { summaryStyle: 'executive' as const, includeRecommendations: true, includeRiskAssessment: false, includeSentimentBreakdown: false },
        context_sources: contextSources,
        context_depth: contextDepth,
        suggest_when: suggestWhen,
      };

      let result: IntelligenceProfile | null = null;

      if (editProfile) {
        result = await updateProfile(editProfile.id, profileData);
      } else {
        result = await createProfile(profileData);
      }

      if (result) {
        onCreated(result);
        onClose();
      }
    } catch (err) {
      console.error('[CreateProfileModal] Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { key: '', label: '', type: 'text', required: false }]);
  };

  const updateCustomField = (index: number, updates: Partial<CustomFieldDef>) => {
    const updated = [...customFields];
    updated[index] = { ...updated[index], ...updates };
    if (updates.label && !updated[index].key) {
      updated[index].key = generateSlug(updates.label);
    }
    setCustomFields(updated);
  };

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const addFocusArea = () => {
    setFocusAreas([...focusAreas, { key: '', label: '', description: '', weight: 0.7, extractionHint: '' }]);
  };

  const updateFocusArea = (index: number, updates: Partial<FocusArea>) => {
    const updated = [...focusAreas];
    updated[index] = { ...updated[index], ...updates };
    if (updates.label && !updated[index].key) {
      updated[index].key = generateSlug(updates.label as string);
    }
    setFocusAreas(updated);
  };

  const removeFocusArea = (index: number) => {
    setFocusAreas(focusAreas.filter((_, i) => i !== index));
  };

  const toggleContextSource = (source: ContextSource) => {
    setContextSources(prev =>
      prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        >
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {editProfile ? 'Edit Profile' : templateProfile ? 'Clone Profile' : 'Create Intelligence Profile'}
          </h2>
          <button onClick={onClose} className="text-xl" style={{ color: 'var(--text-tertiary)' }}>&times;</button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Name + Icon + Category */}
          <SectionHeader title="Basic Info" />
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-12 h-12 rounded-xl border text-2xl flex items-center justify-center hover:opacity-80 transition-all"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated)' }}
              >
                {icon}
              </button>
              {showEmojiPicker && (
                <div className="absolute top-14 left-0 z-20 grid grid-cols-5 gap-1 p-2 rounded-xl border shadow-lg"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
                >
                  {EMOJI_GRID.map(e => (
                    <button key={e} onClick={() => { setIcon(e); setShowEmojiPicker(false); }}
                      className="w-8 h-8 text-lg hover:opacity-70 rounded">{e}</button>
                  ))}
                </div>
              )}
            </div>
            <input
              value={name} onChange={e => setName(e.target.value)} placeholder="Profile Name"
              className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Slug</label>
              <input value={slug} onChange={e => setSlug(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm font-mono" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="text-xs font-mono uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description..."
            rows={2} className="w-full px-3 py-2 rounded-lg border text-sm resize-y" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />

          {/* Tone + Context */}
          <SectionHeader title="Behavior" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Tone</label>
              <select value={tone} onChange={e => setTone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-mono uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Context Depth</label>
              <select value={contextDepth} onChange={e => setContextDepth(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                {DEPTH_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-mono uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-tertiary)' }}>Context Sources</label>
            <div className="flex flex-wrap gap-2">
              {CONTEXT_SOURCES.map(s => (
                <button key={s.value} type="button" onClick={() => toggleContextSource(s.value)}
                  className="px-3 py-1 rounded-full text-sm border transition-all"
                  style={{
                    background: contextSources.includes(s.value) ? 'var(--accent-primary-dim)' : 'var(--bg-surface)',
                    borderColor: contextSources.includes(s.value) ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    color: contextSources.includes(s.value) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* System Prompt Template */}
          <SectionHeader title="System Prompt Template" />
          <button onClick={() => setShowTemplateHelp(!showTemplateHelp)} className="text-xs underline" style={{ color: 'var(--text-tertiary)' }}>
            {showTemplateHelp ? 'Hide' : 'Show'} template variable reference
          </button>
          {showTemplateHelp && (
            <div className="text-xs p-3 rounded-lg font-mono space-y-1" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              <p>{'{{participant_context}}'} — Participant info</p>
              <p>{'{{past_meeting_context}}'} — Past meeting data</p>
              <p>{'{{focus_areas}}'} — Configured focus areas</p>
              <p>{'{{tone}}'} — Tone setting</p>
              <p>{'{{output_style}}'} — Output format description</p>
              <p>{'{{additional_instructions}}'} — Per-meeting user input</p>
              <p>{'{{#if var}}...{{/if}}'} — Conditional blocks</p>
              <p>{'{{your_field_key}}'} — Any custom field key</p>
            </div>
          )}
          <textarea value={systemPromptTemplate} onChange={e => setSystemPromptTemplate(e.target.value)}
            placeholder="You are an AI assistant specializing in..." rows={8}
            className="w-full px-3 py-2 rounded-lg border text-sm font-mono resize-y" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />

          {/* Custom Fields */}
          <SectionHeader title="Custom Fields" />
          <div className="space-y-3">
            {customFields.map((field, i) => (
              <div key={i} className="flex gap-2 items-start p-3 rounded-lg border" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <input value={field.label || ''} onChange={e => updateCustomField(i, { label: e.target.value })} placeholder="Label"
                    className="px-2 py-1 rounded border text-sm" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                  <select value={field.type || 'text'} onChange={e => updateCustomField(i, { type: e.target.value as any })}
                    className="px-2 py-1 rounded border text-sm" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                    {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input value={field.placeholder || ''} onChange={e => updateCustomField(i, { placeholder: e.target.value })} placeholder="Placeholder"
                    className="px-2 py-1 rounded border text-sm" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                </div>
                <button onClick={() => removeCustomField(i)} className="text-sm px-2 py-1" style={{ color: 'var(--semantic-error)' }}>&times;</button>
              </div>
            ))}
          </div>
          <button onClick={addCustomField} className="text-sm px-3 py-1 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
            + Add Field
          </button>

          {/* Focus Areas */}
          <SectionHeader title="Focus Areas" />
          <div className="space-y-3">
            {focusAreas.map((area, i) => (
              <div key={i} className="flex gap-2 items-start p-3 rounded-lg border" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex-1 space-y-2">
                  <input value={area.label || ''} onChange={e => updateFocusArea(i, { label: e.target.value })} placeholder="Focus area label"
                    className="w-full px-2 py-1 rounded border text-sm" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                  <input value={area.extractionHint || ''} onChange={e => updateFocusArea(i, { extractionHint: e.target.value })} placeholder="Extraction hint for Gemini"
                    className="w-full px-2 py-1 rounded border text-sm" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Weight:</span>
                    <input type="range" min="0" max="1" step="0.1" value={area.weight || 0.7}
                      onChange={e => updateFocusArea(i, { weight: parseFloat(e.target.value) })}
                      className="flex-1" />
                    <span className="text-xs font-mono w-8" style={{ color: 'var(--text-tertiary)' }}>{area.weight || 0.7}</span>
                  </div>
                </div>
                <button onClick={() => removeFocusArea(i)} className="text-sm px-2 py-1" style={{ color: 'var(--semantic-error)' }}>&times;</button>
              </div>
            ))}
          </div>
          <button onClick={addFocusArea} className="text-sm px-3 py-1 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
            + Add Focus Area
          </button>

          {/* Suggestion Keywords */}
          <SectionHeader title="Auto-Suggestion" />
          <input value={suggestionKeywords} onChange={e => setSuggestionKeywords(e.target.value)}
            placeholder="Keywords (comma-separated) e.g. grant, funding, proposal"
            className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 px-6 py-4 border-t"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        >
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !name || !systemPromptTemplate}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--accent-primary)' }}>
            {saving ? 'Saving...' : editProfile ? 'Save Changes' : 'Create Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <p className="font-mono text-xs uppercase tracking-wider pt-2" style={{ color: 'var(--text-tertiary)' }}>{title}</p>
);
