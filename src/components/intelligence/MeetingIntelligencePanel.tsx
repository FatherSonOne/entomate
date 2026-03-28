/**
 * MeetingIntelligencePanel
 * Main panel for configuring intelligence profiles on meetings.
 * Orchestrates suggestion, profile selection, customization, and context preview.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { SuggestionBanner } from './SuggestionBanner';
import { ProfileSelector } from './ProfileSelector';
import { ProfileCustomizer } from './ProfileCustomizer';
import { ContextPreview } from './ContextPreview';
import { getActiveProfiles, getMeetingIntelligenceConfig, saveMeetingIntelligenceConfig, getProfileById } from '../../intelligence/profileService';
import { suggestProfiles } from '../../intelligence/suggestionEngine';
import { assembleContext } from '../../intelligence/contextAssembler';
import { buildMeetingPrompt } from '../../intelligence/promptBuilder';
import type { IntelligenceProfile, ProfileSuggestion, MeetingIntelligenceConfig, AssembledContext } from '../../intelligence/types';

interface MeetingIntelligencePanelProps {
  meetingId: string;
  meetingTitle: string;
  meetingDescription?: string;
  meetingTags?: string[];
  meetingParticipants?: string[];
  onConfigSaved?: (config: MeetingIntelligenceConfig) => void;
}

type PanelState = 'loading' | 'suggestions' | 'configuring' | 'assembling' | 'ready' | 'dismissed';

export const MeetingIntelligencePanel: React.FC<MeetingIntelligencePanelProps> = ({
  meetingId,
  meetingTitle,
  meetingDescription,
  meetingTags,
  meetingParticipants,
  onConfigSaved,
}) => {
  const [panelState, setPanelState] = useState<PanelState>('loading');
  const [profiles, setProfiles] = useState<IntelligenceProfile[]>([]);
  const [suggestions, setSuggestions] = useState<ProfileSuggestion[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<IntelligenceProfile | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [, setExistingConfig] = useState<MeetingIntelligenceConfig | null>(null);
  const [assembledContext, setAssembledContext] = useState<AssembledContext | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, [meetingId]);

  const loadInitialData = async () => {
    setPanelState('loading');

    try {
      // Load profiles and existing config in parallel
      const [allProfiles, config] = await Promise.all([
        getActiveProfiles(),
        getMeetingIntelligenceConfig(meetingId),
      ]);

      setProfiles(allProfiles);

      if (config) {
        setExistingConfig(config);

        // If already configured, load the profile and show ready state
        if (config.profileId) {
          const profile = await getProfileById(config.profileId);
          if (profile) {
            setSelectedProfile(profile);
            setFieldValues(config.customFieldValues || {});
            setAdditionalInstructions(config.additionalInstructions || '');
            setAssembledContext(config.assembledContext);
          }
        }

        if (config.status === 'context_ready' || config.status === 'active' || config.status === 'completed') {
          setPanelState('ready');
        } else if (config.profileId) {
          setPanelState('configuring');
        } else if (config.suggestionDismissed) {
          setPanelState('dismissed');
        } else {
          await runSuggestions(allProfiles);
        }
      } else {
        await runSuggestions(allProfiles);
      }
    } catch (err) {
      console.error('[MeetingIntelligencePanel] Failed to load:', err);
      setPanelState('suggestions');
    }
  };

  const runSuggestions = async (_profileList: IntelligenceProfile[]) => {
    try {
      const results = await suggestProfiles({
        title: meetingTitle,
        description: meetingDescription,
        tags: meetingTags,
        participants: meetingParticipants,
      });
      setSuggestions(results);
    } catch (err) {
      console.error('[MeetingIntelligencePanel] Suggestion failed:', err);
    }
    setPanelState('suggestions');
  };

  const handleSelectProfile = useCallback((profile: IntelligenceProfile) => {
    setSelectedProfile(profile);
    setFieldValues({});
    setShowValidation(false);
    setPanelState('configuring');
  }, []);

  const handleAcceptSuggestion = useCallback(() => {
    if (suggestions.length > 0) {
      handleSelectProfile(suggestions[0].profile);
    }
  }, [suggestions, handleSelectProfile]);

  const handleCustomizeSuggestion = useCallback(() => {
    if (suggestions.length > 0) {
      handleSelectProfile(suggestions[0].profile);
    }
  }, [suggestions, handleSelectProfile]);

  const handleDismiss = useCallback(async () => {
    setPanelState('dismissed');
    try {
      await saveMeetingIntelligenceConfig({
        meeting_id: meetingId,
        suggestion_dismissed: true,
      });
    } catch {
      // Non-critical
    }
  }, [meetingId]);

  const handleSaveAndPrepare = useCallback(async () => {
    if (!selectedProfile) return;

    // Validate required fields
    const missingRequired = selectedProfile.customFields
      .filter(f => f.required && !fieldValues[f.key]);

    if (missingRequired.length > 0) {
      setShowValidation(true);
      return;
    }

    setSaving(true);
    setPanelState('assembling');

    try {
      // Save the config
      await saveMeetingIntelligenceConfig({
        meeting_id: meetingId,
        profile_id: selectedProfile.id,
        custom_field_values: fieldValues,
        additional_instructions: additionalInstructions || undefined,
        status: 'pending',
      });

      // Assemble context
      const context = await assembleContext(meetingId, selectedProfile);
      setAssembledContext(context);

      // Build composed prompt
      const composedPrompt = buildMeetingPrompt(
        selectedProfile,
        fieldValues,
        context,
        { additionalInstructions: additionalInstructions || undefined }
      );

      // Update config with composed prompt
      const finalConfig = await saveMeetingIntelligenceConfig({
        meeting_id: meetingId,
        composed_prompt: composedPrompt,
        status: 'context_ready',
      });

      if (finalConfig) {
        setExistingConfig(finalConfig);
        onConfigSaved?.(finalConfig);
      }

      setPanelState('ready');
    } catch (err) {
      console.error('[MeetingIntelligencePanel] Save failed:', err);
      setPanelState('configuring');
    } finally {
      setSaving(false);
    }
  }, [selectedProfile, fieldValues, additionalInstructions, meetingId, onConfigSaved]);

  const handleClearProfile = useCallback(async () => {
    setSelectedProfile(null);
    setFieldValues({});
    setAdditionalInstructions('');
    setAssembledContext(null);
    setExistingConfig(null);
    setPanelState('suggestions');

    try {
      await saveMeetingIntelligenceConfig({
        meeting_id: meetingId,
        profile_id: undefined,
        custom_field_values: {},
        assembled_context: {},
        composed_prompt: undefined,
        status: 'pending',
        suggestion_dismissed: false,
      });
    } catch {
      // Non-critical
    }
  }, [meetingId]);

  const handleRefreshContext = useCallback(async () => {
    if (!selectedProfile) return;
    setPanelState('assembling');
    try {
      const context = await assembleContext(meetingId, selectedProfile);
      setAssembledContext(context);
      setPanelState('ready');
    } catch {
      setPanelState('ready');
    }
  }, [meetingId, selectedProfile]);

  // ==================== RENDER ====================

  if (panelState === 'loading') {
    return (
      <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <span className="animate-pulse">🤖</span>
          <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading intelligence...</span>
        </div>
      </div>
    );
  }

  // Dismissed: minimal re-entry point
  if (panelState === 'dismissed') {
    return (
      <button
        onClick={() => setPanelState('suggestions')}
        className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:opacity-80"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}
      >
        🤖 Configure Intelligence Profile
      </button>
    );
  }

  return (
    <div
      className="rounded-xl border overflow-hidden transition-all duration-200"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <span>🤖</span>
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Meeting Intelligence
          </span>
          {selectedProfile && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'var(--accent-primary-dim)', color: 'var(--accent-primary)' }}
            >
              {selectedProfile.icon} {selectedProfile.name}
            </span>
          )}
          {panelState === 'ready' && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'var(--accent-secondary-dim)', color: 'var(--accent-secondary)' }}
            >
              Ready
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {!expanded ? null : (
        <div className="px-4 pb-4 space-y-4">
          {/* Suggestion banner */}
          {panelState === 'suggestions' && suggestions.length > 0 && (
            <SuggestionBanner
              suggestion={suggestions[0]}
              onAccept={handleAcceptSuggestion}
              onCustomize={handleCustomizeSuggestion}
              onDismiss={handleDismiss}
            />
          )}

          {/* Profile selector */}
          {(panelState === 'suggestions' || panelState === 'configuring') && (
            <ProfileSelector
              profiles={profiles}
              selectedProfileId={selectedProfile?.id || null}
              suggestions={suggestions}
              onSelect={handleSelectProfile}
            />
          )}

          {/* Profile description */}
          {selectedProfile && panelState === 'configuring' && (
            <div className="rounded-lg p-3" style={{ background: 'var(--bg-elevated)' }}>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {selectedProfile.description}
              </p>
            </div>
          )}

          {/* Custom fields form */}
          {selectedProfile && panelState === 'configuring' && (
            <ProfileCustomizer
              profile={selectedProfile}
              values={fieldValues}
              onChange={setFieldValues}
              showValidation={showValidation}
            />
          )}

          {/* Context preview */}
          {(panelState === 'ready' || panelState === 'assembling') && (
            <ContextPreview
              context={assembledContext}
              isLoading={panelState === 'assembling'}
              onRefresh={handleRefreshContext}
            />
          )}

          {/* Additional instructions */}
          {selectedProfile && (panelState === 'configuring' || panelState === 'ready') && (
            <div>
              <label className="font-mono text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                Additional Instructions (optional)
              </label>
              <textarea
                value={additionalInstructions}
                onChange={e => setAdditionalInstructions(e.target.value)}
                placeholder="Any specific focus or instructions for this meeting..."
                rows={2}
                className="w-full mt-1.5 px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-1 resize-y"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {panelState === 'configuring' && selectedProfile && (
              <button
                onClick={handleSaveAndPrepare}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--accent-primary, #FF2D6B)' }}
              >
                {saving ? 'Preparing...' : 'Save & Prepare Context'}
              </button>
            )}

            {selectedProfile && (
              <button
                onClick={handleClearProfile}
                className="px-3 py-2 rounded-lg text-sm border transition-all duration-200 hover:opacity-80"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                Clear Profile
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
