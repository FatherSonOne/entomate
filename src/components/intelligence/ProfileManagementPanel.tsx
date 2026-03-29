/**
 * ProfileManagementPanel
 * Settings panel for managing all intelligence profiles — view, create, edit, clone, export, import, delete.
 */

import React, { useState, useEffect, useRef } from 'react';
import { getActiveProfiles, deleteProfile } from '../../intelligence/profileService';
import { getAllProfileEffectiveness } from '../../intelligence/analyticsService';
import { downloadProfile, validateImport, importProfile } from '../../intelligence/profileExport';
import { CreateProfileModal } from './CreateProfileModal';
import { ProfileEffectivenessCard } from './ProfileEffectivenessCard';
import type { IntelligenceProfile } from '../../intelligence/types';
import type { ProfileEffectiveness } from '../../intelligence/analyticsService';

type SortKey = 'name' | 'usage' | 'effectiveness' | 'last_used';

export const ProfileManagementPanel: React.FC = () => {
  const [profiles, setProfiles] = useState<IntelligenceProfile[]>([]);
  const [effectiveness, setEffectiveness] = useState<Map<string, ProfileEffectiveness>>(new Map());
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editProfile, setEditProfile] = useState<IntelligenceProfile | undefined>();
  const [cloneProfile, setCloneProfile] = useState<IntelligenceProfile | undefined>();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [allProfiles, allEffectiveness] = await Promise.all([
      getActiveProfiles(),
      getAllProfileEffectiveness(),
    ]);
    setProfiles(allProfiles);
    setEffectiveness(new Map(allEffectiveness.map(e => [e.profileId, e])));
  };

  const categories = ['all', ...new Set(profiles.map(p => p.category))];

  const filtered = profiles
    .filter(p => categoryFilter === 'all' || p.category === categoryFilter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'usage': {
          const ea = effectiveness.get(a.id);
          const eb = effectiveness.get(b.id);
          return ((eb?.timesCompleted || 0) - (ea?.timesCompleted || 0));
        }
        case 'effectiveness': {
          const ea = effectiveness.get(a.id);
          const eb = effectiveness.get(b.id);
          return ((eb?.avgOutputQuality || 0) - (ea?.avgOutputQuality || 0));
        }
        case 'last_used': {
          const ea = effectiveness.get(a.id);
          const eb = effectiveness.get(b.id);
          return new Date(eb?.lastUsedAt || 0).getTime() - new Date(ea?.lastUsedAt || 0).getTime();
        }
        default:
          return a.name.localeCompare(b.name);
      }
    });

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const validation = validateImport(data);

      if (!validation.valid) {
        setImportError(validation.errors.join(', '));
        return;
      }

      const result = await importProfile(data);
      if (result) {
        await loadData();
        setImportError(null);
      } else {
        setImportError('Import failed — check console for details');
      }
    } catch (err) {
      setImportError('Invalid JSON file');
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (id: string) => {
    const success = await deleteProfile(id);
    if (success) {
      await loadData();
    }
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Meeting Intelligence Profiles
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 rounded-lg text-sm border transition-all hover:opacity-80"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            Import
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <button
            onClick={() => { setEditProfile(undefined); setCloneProfile(undefined); setShowCreateModal(true); }}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--accent-primary)' }}
          >
            + Create Profile
          </button>
        </div>
      </div>

      {importError && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'var(--semantic-error-dim)', color: 'var(--semantic-error)' }}>
          Import error: {importError}
          <button onClick={() => setImportError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)}
              className="px-3 py-1 rounded-full text-xs transition-all"
              style={{
                background: categoryFilter === cat ? 'var(--accent-primary-dim)' : 'transparent',
                color: categoryFilter === cat ? 'var(--accent-primary)' : 'var(--text-tertiary)',
              }}>
              {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}
          className="ml-auto px-2 py-1 rounded-lg border text-xs"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
          <option value="name">Sort: Name</option>
          <option value="usage">Sort: Usage</option>
          <option value="effectiveness">Sort: Quality</option>
          <option value="last_used">Sort: Recent</option>
        </select>
      </div>

      {/* Profile grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(profile => {
          const eff = effectiveness.get(profile.id);
          const isDeleteConfirm = deleteConfirmId === profile.id;

          return (
            <div key={profile.id} className="rounded-xl border p-4 space-y-3"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-start gap-2">
                <span className="text-2xl">{profile.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{profile.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{profile.category}</p>
                </div>
                {profile.isBuiltin && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-elevated)', color: 'var(--text-tertiary)' }}>
                    Built-in
                  </span>
                )}
              </div>

              <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{profile.description}</p>

              {eff && (
                <div className="flex gap-3 text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                  <span>{eff.timesCompleted} uses</span>
                  {eff.avgUserRating != null && <span>★ {eff.avgUserRating.toFixed(1)}</span>}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-1.5 flex-wrap pt-1">
                {!profile.isBuiltin && (
                  <ActionBtn label="Edit" onClick={() => { setEditProfile(profile); setCloneProfile(undefined); setShowCreateModal(true); }} />
                )}
                <ActionBtn label="Clone" onClick={() => { setCloneProfile(profile); setEditProfile(undefined); setShowCreateModal(true); }} />
                <ActionBtn label="Export" onClick={() => downloadProfile(profile)} />
                {!profile.isBuiltin && (
                  isDeleteConfirm ? (
                    <>
                      <ActionBtn label="Confirm" onClick={() => handleDelete(profile.id)} color="var(--semantic-error)" />
                      <ActionBtn label="Cancel" onClick={() => setDeleteConfirmId(null)} />
                    </>
                  ) : (
                    <ActionBtn label="Delete" onClick={() => setDeleteConfirmId(profile.id)} color="var(--semantic-error)" />
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Effectiveness section */}
      {effectiveness.size > 0 && (
        <div>
          <p className="font-mono text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Profile Effectiveness
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.filter(p => effectiveness.has(p.id)).map(p => (
              <ProfileEffectivenessCard
                key={p.id}
                profileName={p.name}
                profileIcon={p.icon}
                effectiveness={effectiveness.get(p.id)!}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit modal */}
      <CreateProfileModal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setEditProfile(undefined); setCloneProfile(undefined); }}
        onCreated={async () => { await loadData(); }}
        templateProfile={cloneProfile}
        editProfile={editProfile}
      />
    </div>
  );
};

const ActionBtn: React.FC<{ label: string; onClick: () => void; color?: string }> = ({ label, onClick, color }) => (
  <button onClick={onClick} className="px-2 py-1 rounded text-[11px] border transition-all hover:opacity-80"
    style={{ borderColor: 'var(--border-subtle)', color: color || 'var(--text-secondary)' }}>
    {label}
  </button>
);
