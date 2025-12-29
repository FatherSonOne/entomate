Below is a complete copy/paste Settings implementation pack for React + Node/Express + Postgres, including Appearance (Light/Dark + highlight color + match system), Integrations (Gemini/CRM/Pulse), Workspace governance (RBAC/audit/retention/export), and tests. This pack is aligned to what your scan surfaced (Settings menu item in index.tsx, default accent #00A86B, env-based integration keys, and enterprise permissions/audit/retention needs).​

Folder + file list (create these)
Create these files in your repo (exact paths):​

Backend

server/db/migrations/2025_12_17__settings.sql

server/middleware/auth.js

server/middleware/rbac.js

server/routes/settings.js

server/routes/health.js

server/tests/settings.test.js

Frontend

src/settings/settingsTypes.ts

src/settings/settingsApi.ts

src/settings/SettingsContext.tsx

src/settings/theme.ts

src/settings/SettingsPage.tsx

src/settings/panels/AppearancePanel.tsx

src/settings/panels/IntegrationsPanel.tsx

src/settings/panels/SecurityAccessPanel.tsx

src/settings/panels/AuditLogsPanel.tsx

src/settings/panels/DataControlsPanel.tsx

src/settings/panels/AboutDiagnosticsPanel.tsx

src/settings/__tests__/settings-ui.test.tsx

1) Database (Postgres) — copy/paste
server/db/migrations/2025_12_17__settings.sql​
sql
-- SETTINGS: user + workspace
-- Assumes you already have users + workspaces tables. If not, keep UUIDs and wire later.

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY,
  theme_mode TEXT NOT NULL DEFAULT 'system',     -- system | light | dark
  accent_mode TEXT NOT NULL DEFAULT 'system',    -- system | custom
  accent_color TEXT NOT NULL DEFAULT '#00A86B',  -- hex
  reduce_motion BOOLEAN NOT NULL DEFAULT false,

  notifications_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  meetings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_settings (
  workspace_id UUID PRIMARY KEY,
  integrations_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  security_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_controls_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Minimal audit log table for settings + admin actions (Phase 3 requirement)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  actor_user_id UUID,
  action TEXT NOT NULL,                 -- e.g. 'settings.user.update', 'settings.workspace.update', 'integration.test'
  entity_type TEXT,                     -- 'user_settings' | 'workspace_settings' | 'integration'
  entity_id TEXT,                       -- user_id or workspace_id or integration id
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_time ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
Run it (example):

sql
-- in psql:
\i server/db/migrations/2025_12_17__settings.sql
2) Backend middleware — copy/paste
server/middleware/auth.js​
This is a minimal auth stub that works now. Later you can swap it for Supabase/Auth0/etc.

js
// server/middleware/auth.js
// Minimal auth: expects headers:
// x-user-id, x-workspace-id, x-user-role (admin|member|guest)
// In production: replace with real auth and set req.user based on JWT/session.

function requireAuth(req, res, next) {
  const userId = req.header("x-user-id");
  const workspaceId = req.header("x-workspace-id");
  const role = req.header("x-user-role") || "member";

  if (!userId || !workspaceId) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  req.user = { id: userId, workspaceId, role };
  next();
}

module.exports = { requireAuth };
server/middleware/rbac.js​
js
// server/middleware/rbac.js
function requireWorkspaceAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (req.user.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Forbidden (admin only)" });
  }
  next();
}

module.exports = { requireWorkspaceAdmin };
3) Backend routes — copy/paste
server/routes/health.js​
This supports the Settings “Gemini connection status” + “Health check” button without exposing keys in UI.​

js
// server/routes/health.js
const express = require("express");
const router = express.Router();

module.exports = () => {
  // Gemini health check: just checks env is present
  router.get("/health/gemini", (req, res) => {
    const hasKey = !!process.env.GEMINI_API_KEY;
    res.json({ ok: true, gemini: { configured: hasKey } });
  });

  router.get("/health/integrations", (req, res) => {
    res.json({
      ok: true,
      integrations: {
        logosVision: { configured: !!process.env.LOGOS_VISION_API_KEY },
        pulse: { configured: !!process.env.PULSE_API_KEY }
      }
    });
  });

  return router;
};
server/routes/settings.js​
js
// server/routes/settings.js
const express = require("express");
const router = express.Router();

async function writeAudit(pool, { workspaceId, actorUserId, action, entityType, entityId, metadata }) {
  await pool.query(
    `INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [workspaceId, actorUserId, action, entityType, entityId, metadata || {}]
  );
}

module.exports = ({ pool, requireAuth, requireWorkspaceAdmin }) => {
  // USER SETTINGS
  router.get("/settings/user", requireAuth, async (req, res) => {
    const r = await pool.query(`SELECT * FROM user_settings WHERE user_id=$1`, [req.user.id]);
    if (!r.rows[0]) {
      const created = await pool.query(
        `INSERT INTO user_settings (user_id) VALUES ($1) RETURNING *`,
        [req.user.id]
      );
      return res.json({ ok: true, settings: created.rows[0] });
    }
    res.json({ ok: true, settings: r.rows[0] });
  });

  router.put("/settings/user", requireAuth, async (req, res) => {
    const {
      theme_mode,
      accent_mode,
      accent_color,
      reduce_motion,
      notifications_json,
      meetings_json,
      ai_json
    } = req.body || {};

    const r = await pool.query(
      `UPDATE user_settings
       SET theme_mode=COALESCE($2, theme_mode),
           accent_mode=COALESCE($3, accent_mode),
           accent_color=COALESCE($4, accent_color),
           reduce_motion=COALESCE($5, reduce_motion),
           notifications_json=COALESCE($6, notifications_json),
           meetings_json=COALESCE($7, meetings_json),
           ai_json=COALESCE($8, ai_json),
           updated_at=NOW()
       WHERE user_id=$1
       RETURNING *`,
      [req.user.id, theme_mode, accent_mode, accent_color, reduce_motion,
        notifications_json, meetings_json, ai_json]
    );

    await writeAudit(pool, {
      workspaceId: req.user.workspaceId,
      actorUserId: req.user.id,
      action: "settings.user.update",
      entityType: "user_settings",
      entityId: req.user.id,
      metadata: { changed: Object.keys(req.body || {}) }
    });

    res.json({ ok: true, settings: r.rows[0] });
  });

  // WORKSPACE SETTINGS (ADMIN ONLY)
  router.get("/settings/workspace", requireAuth, requireWorkspaceAdmin, async (req, res) => {
    const r = await pool.query(
      `SELECT * FROM workspace_settings WHERE workspace_id=$1`,
      [req.user.workspaceId]
    );

    if (!r.rows[0]) {
      const created = await pool.query(
        `INSERT INTO workspace_settings (workspace_id) VALUES ($1) RETURNING *`,
        [req.user.workspaceId]
      );
      return res.json({ ok: true, settings: created.rows[0] });
    }

    res.json({ ok: true, settings: r.rows[0] });
  });

  router.put("/settings/workspace", requireAuth, requireWorkspaceAdmin, async (req, res) => {
    const { integrations_json, security_json, data_controls_json } = req.body || {};

    const r = await pool.query(
      `UPDATE workspace_settings
       SET integrations_json=COALESCE($2, integrations_json),
           security_json=COALESCE($3, security_json),
           data_controls_json=COALESCE($4, data_controls_json),
           updated_at=NOW()
       WHERE workspace_id=$1
       RETURNING *`,
      [req.user.workspaceId, integrations_json, security_json, data_controls_json]
    );

    await writeAudit(pool, {
      workspaceId: req.user.workspaceId,
      actorUserId: req.user.id,
      action: "settings.workspace.update",
      entityType: "workspace_settings",
      entityId: req.user.workspaceId,
      metadata: { changed: Object.keys(req.body || {}) }
    });

    res.json({ ok: true, settings: r.rows[0] });
  });

  // AUDIT LOGS (ADMIN ONLY)
  router.get("/settings/audit-logs", requireAuth, requireWorkspaceAdmin, async (req, res) => {
    const { limit = 100 } = req.query;
    const r = await pool.query(
      `SELECT * FROM audit_logs
       WHERE workspace_id=$1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.workspaceId, Math.min(Number(limit) || 100, 500)]
    );
    res.json({ ok: true, logs: r.rows });
  });

  return router;
};
4) Frontend — Settings core (React) — copy/paste
This is designed to drop into your existing index.tsx app (you already have a settings nav item and dark classes present).​

src/settings/settingsTypes.ts​
ts
export type ThemeMode = "system" | "light" | "dark";
export type AccentMode = "system" | "custom";

export interface UserSettings {
  user_id: string;
  theme_mode: ThemeMode;
  accent_mode: AccentMode;
  accent_color: string;
  reduce_motion: boolean;
  notifications_json: Record<string, any>;
  meetings_json: Record<string, any>;
  ai_json: Record<string, any>;
}

export interface WorkspaceSettings {
  workspace_id: string;
  integrations_json: Record<string, any>;
  security_json: Record<string, any>;
  data_controls_json: Record<string, any>;
}

export interface AuditLogRow {
  id: string;
  workspace_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: any;
  created_at: string;
}
src/settings/settingsApi.ts​
ts
import type { UserSettings, WorkspaceSettings, AuditLogRow } from "./settingsTypes";

const jsonHeaders = (headers?: Record<string, string>) => ({
  "Content-Type": "application/json",
  ...(headers || {})
});

export function makeSettingsApi(baseUrl: string, authHeaders: Record<string, string>) {
  return {
    async getUserSettings(): Promise<UserSettings> {
      const r = await fetch(`${baseUrl}/settings/user`, { headers: { ...authHeaders } });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed to load user settings");
      return j.settings;
    },

    async updateUserSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
      const r = await fetch(`${baseUrl}/settings/user`, {
        method: "PUT",
        headers: { ...jsonHeaders(), ...authHeaders },
        body: JSON.stringify(patch)
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed to update user settings");
      return j.settings;
    },

    async getWorkspaceSettings(): Promise<WorkspaceSettings> {
      const r = await fetch(`${baseUrl}/settings/workspace`, { headers: { ...authHeaders } });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed to load workspace settings");
      return j.settings;
    },

    async updateWorkspaceSettings(patch: Partial<WorkspaceSettings>): Promise<WorkspaceSettings> {
      const r = await fetch(`${baseUrl}/settings/workspace`, {
        method: "PUT",
        headers: { ...jsonHeaders(), ...authHeaders },
        body: JSON.stringify(patch)
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed to update workspace settings");
      return j.settings;
    },

    async getAuditLogs(limit = 200): Promise<AuditLogRow[]> {
      const r = await fetch(`${baseUrl}/settings/audit-logs?limit=${limit}`, { headers: { ...authHeaders } });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed to load audit logs");
      return j.logs;
    },

    async geminiHealth(): Promise<{ configured: boolean }> {
      const r = await fetch(`${baseUrl}/health/gemini`);
      const j = await r.json();
      return j.gemini;
    },

    async integrationsHealth(): Promise<any> {
      const r = await fetch(`${baseUrl}/health/integrations`);
      const j = await r.json();
      return j.integrations;
    }
  };
}
src/settings/theme.ts​
Implements: Light/Dark/System + Accent custom/system; persists via backend (SettingsContext).​

ts
import type { AccentMode, ThemeMode } from "./settingsTypes";

export function getSystemTheme(): "light" | "dark" {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyThemeToDom(themeMode: ThemeMode) {
  const root = document.documentElement;
  const actual = themeMode === "system" ? getSystemTheme() : themeMode;
  root.dataset.theme = actual; // CSS can key off [data-theme="dark"]
  if (actual === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function applyAccentToDom(accentMode: AccentMode, accentColor: string) {
  const root = document.documentElement;

  // "Match system color" for accent == 'system' means: default app accent.
  // Default chosen based on your existing teal usage.
  const color = accentMode === "system" ? "#00A86B" : (accentColor || "#00A86B");

  root.style.setProperty("--color-accent", color);
}
src/settings/SettingsContext.tsx​
tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { UserSettings, WorkspaceSettings } from "./settingsTypes";
import { applyAccentToDom, applyThemeToDom } from "./theme";
import { makeSettingsApi } from "./settingsApi";

type SettingsContextValue = {
  userSettings: UserSettings | null;
  workspaceSettings: WorkspaceSettings | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;

  updateUserSettings: (patch: Partial<UserSettings>) => Promise<void>;
  updateWorkspaceSettings: (patch: Partial<WorkspaceSettings>) => Promise<void>;
  refreshAll: () => Promise<void>;

  api: ReturnType<typeof makeSettingsApi>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider(props: {
  children: React.ReactNode;
  baseUrl: string;
  authHeaders: Record<string, string>;
  userRole: "admin" | "member" | "guest";
}) {
  const api = useMemo(() => makeSettingsApi(props.baseUrl, props.authHeaders), [props.baseUrl, props.authHeaders]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = props.userRole === "admin";

  async function refreshAll() {
    setLoading(true);
    setError(null);
    try {
      const us = await api.getUserSettings();
      setUserSettings(us);
      applyThemeToDom(us.theme_mode);
      applyAccentToDom(us.accent_mode, us.accent_color);

      if (isAdmin) {
        const ws = await api.getWorkspaceSettings();
        setWorkspaceSettings(ws);
      } else {
        setWorkspaceSettings(null);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refreshAll(); }, [isAdmin]);

  // Keep system theme in sync when Theme Mode = system
  useEffect(() => {
    if (!userSettings) return;
    if (userSettings.theme_mode !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeToDom("system");
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, [userSettings?.theme_mode]);

  async function updateUserSettings(patch: Partial<UserSettings>) {
    if (!userSettings) return;
    const updated = await api.updateUserSettings(patch);
    setUserSettings(updated);
    applyThemeToDom(updated.theme_mode);
    applyAccentToDom(updated.accent_mode, updated.accent_color);
  }

  async function updateWorkspaceSettings(patch: Partial<WorkspaceSettings>) {
    if (!isAdmin) throw new Error("Admin only");
    const updated = await api.updateWorkspaceSettings(patch);
    setWorkspaceSettings(updated);
  }

  return (
    <SettingsContext.Provider value={{
      userSettings, workspaceSettings, isAdmin, loading, error,
      updateUserSettings, updateWorkspaceSettings, refreshAll, api
    }}>
      {props.children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
5) Settings UI page + panels — copy/paste
src/settings/SettingsPage.tsx​
tsx
import React, { useState } from "react";
import { useSettings } from "./SettingsContext";

import { AppearancePanel } from "./panels/AppearancePanel";
import { IntegrationsPanel } from "./panels/IntegrationsPanel";
import { SecurityAccessPanel } from "./panels/SecurityAccessPanel";
import { AuditLogsPanel } from "./panels/AuditLogsPanel";
import { DataControlsPanel } from "./panels/DataControlsPanel";
import { AboutDiagnosticsPanel } from "./panels/AboutDiagnosticsPanel";

type SectionId =
  | "appearance"
  | "integrations"
  | "security"
  | "audit"
  | "data"
  | "about";

export function SettingsPage() {
  const { loading, error, isAdmin } = useSettings();
  const [section, setSection] = useState<SectionId>("appearance");

  if (loading) return <div className="p-6">Loading settings…</div>;
  if (error) return <div className="p-6 text-red-600">Settings error: {error}</div>;

  return (
    <div className="p-6 flex gap-6">
      <aside className="w-72">
        <div className="text-sm text-gray-500 mb-2">User</div>
        <NavButton active={section === "appearance"} onClick={() => setSection("appearance")} label="Appearance" />
        <NavButton active={section === "about"} onClick={() => setSection("about")} label="About / Diagnostics" />

        {isAdmin && (
          <>
            <div className="text-sm text-gray-500 mt-6 mb-2">Workspace (Admin)</div>
            <NavButton active={section === "integrations"} onClick={() => setSection("integrations")} label="Integrations" />
            <NavButton active={section === "security"} onClick={() => setSection("security")} label="Security & Access" />
            <NavButton active={section === "audit"} onClick={() => setSection("audit")} label="Audit Logs" />
            <NavButton active={section === "data"} onClick={() => setSection("data")} label="Data Controls" />
          </>
        )}
      </aside>

      <main className="flex-1">
        {section === "appearance" && <AppearancePanel />}
        {section === "about" && <AboutDiagnosticsPanel />}

        {isAdmin && section === "integrations" && <IntegrationsPanel />}
        {isAdmin && section === "security" && <SecurityAccessPanel />}
        {isAdmin && section === "audit" && <AuditLogsPanel />}
        {isAdmin && section === "data" && <DataControlsPanel />}

        {!isAdmin && section !== "appearance" && section !== "about" && (
          <div className="cmf-card p-6">Admin permission required.</div>
        )}
      </main>
    </div>
  );
}

function NavButton(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      className={[
        "w-full text-left px-3 py-2 rounded-md mb-1",
        props.active ? "bg-gray-100 border-l-4" : "hover:bg-gray-50",
      ].join(" ")}
      style={props.active ? { borderLeftColor: "var(--color-accent)" } : undefined}
    >
      {props.label}
    </button>
  );
}
src/settings/panels/AppearancePanel.tsx​
tsx
import React from "react";
import { useSettings } from "../SettingsContext";
import type { ThemeMode, AccentMode } from "../settingsTypes";

export function AppearancePanel() {
  const { userSettings, updateUserSettings } = useSettings();
  if (!userSettings) return null;

  const themeMode = userSettings.theme_mode;
  const accentMode = userSettings.accent_mode;

  return (
    <div className="cmf-card p-6">
      <h2 className="text-xl font-semibold mb-4">Appearance</h2>

      <div className="mb-6">
        <label className="block text-sm text-gray-600 mb-1">Theme</label>
        <select
          value={themeMode}
          onChange={(e) => updateUserSettings({ theme_mode: e.target.value as ThemeMode })}
          className="px-3 py-2 border rounded-md w-72"
        >
          <option value="system">Match system</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>

      <div className="mb-3">
        <label className="block text-sm text-gray-600 mb-1">Highlight / Accent</label>
        <select
          value={accentMode}
          onChange={(e) => updateUserSettings({ accent_mode: e.target.value as AccentMode })}
          className="px-3 py-2 border rounded-md w-72"
        >
          <option value="system">Match system (default app accent)</option>
          <option value="custom">Custom color</option>
        </select>
      </div>

      {accentMode === "custom" && (
        <div className="mb-6 flex items-center gap-3">
          <input
            type="color"
            value={userSettings.accent_color || "#00A86B"}
            onChange={(e) => updateUserSettings({ accent_color: e.target.value })}
            className="w-12 h-10"
            aria-label="Accent color"
          />
          <div className="text-sm text-gray-600">{userSettings.accent_color}</div>
          <div className="w-6 h-6 rounded" style={{ background: "var(--color-accent)" }} />
        </div>
      )}

      <div className="mt-6">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!userSettings.reduce_motion}
            onChange={(e) => updateUserSettings({ reduce_motion: e.target.checked })}
          />
          <span className="text-sm">Reduce motion</span>
        </label>
      </div>
    </div>
  );
}
src/settings/panels/IntegrationsPanel.tsx​
tsx
import React, { useEffect, useState } from "react";
import { useSettings } from "../SettingsContext";

export function IntegrationsPanel() {
  const { workspaceSettings, updateWorkspaceSettings, api } = useSettings();
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    api.integrationsHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  if (!workspaceSettings) return null;

  const integrations = workspaceSettings.integrations_json || {};
  const setIntegrations = (patch: any) =>
    updateWorkspaceSettings({ integrations_json: { ...integrations, ...patch } });

  return (
    <div className="cmf-card p-6">
      <h2 className="text-xl font-semibold mb-4">Integrations</h2>

      <Section title="Google Gemini">
        <div className="text-sm text-gray-600 mb-2">
          Status: {health?.gemini ? (health.gemini.configured ? "Configured" : "Missing key") : "Unknown"}
        </div>
        <button className="px-3 py-2 border rounded-md" onClick={async () => alert(JSON.stringify(await api.geminiHealth()))}>
          Run Gemini health check
        </button>
      </Section>

      <Section title="Logos Vision CRM">
        <Toggle
          label="Enable Logos Vision sync"
          value={!!integrations.logosVisionEnabled}
          onChange={(v) => setIntegrations({ logosVisionEnabled: v })}
        />
        <div className="text-sm text-gray-600">
          Env key configured: {health?.logosVision ? (health.logosVision.configured ? "Yes" : "No") : "Unknown"}
        </div>
      </Section>

      <Section title="Pulse Chat">
        <Toggle
          label="Enable Pulse notifications"
          value={!!integrations.pulseEnabled}
          onChange={(v) => setIntegrations({ pulseEnabled: v })}
        />
        <div className="text-sm text-gray-600">
          Env key configured: {health?.pulse ? (health.pulse.configured ? "Yes" : "No") : "Unknown"}
        </div>
      </Section>
    </div>
  );
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="font-semibold mb-2">{props.title}</h3>
      {props.children}
    </div>
  );
}

function Toggle(props: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 mb-2">
      <input type="checkbox" checked={props.value} onChange={(e) => props.onChange(e.target.checked)} />
      <span className="text-sm">{props.label}</span>
    </label>
  );
}
src/settings/panels/SecurityAccessPanel.tsx​
tsx
import React from "react";
import { useSettings } from "../SettingsContext";

export function SecurityAccessPanel() {
  const { workspaceSettings, updateWorkspaceSettings } = useSettings();
  if (!workspaceSettings) return null;

  const security = workspaceSettings.security_json || {};
  const setSecurity = (patch: any) =>
    updateWorkspaceSettings({ security_json: { ...security, ...patch } });

  return (
    <div className="cmf-card p-6">
      <h2 className="text-xl font-semibold mb-4">Security & Access</h2>

      <Toggle
        label="Disable public share links (DLP MVP)"
        value={!!security.disablePublicSharing}
        onChange={(v) => setSecurity({ disablePublicSharing: v })}
      />

      <Toggle
        label="Restrict exports to admins only"
        value={!!security.exportsAdminOnly}
        onChange={(v) => setSecurity({ exportsAdminOnly: v })}
      />

      <div className="text-sm text-gray-600 mt-4">
        RBAC note: backend must enforce admin-only routes (already done for workspace settings + audit logs).
      </div>
    </div>
  );
}

function Toggle(props: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 mb-2">
      <input type="checkbox" checked={props.value} onChange={(e) => props.onChange(e.target.checked)} />
      <span className="text-sm">{props.label}</span>
    </label>
  );
}
src/settings/panels/AuditLogsPanel.tsx​
tsx
import React, { useEffect, useState } from "react";
import { useSettings } from "../SettingsContext";
import type { AuditLogRow } from "../settingsTypes";

export function AuditLogsPanel() {
  const { api } = useSettings();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.getAuditLogs(200).then(setLogs).catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="cmf-card p-6">
      <h2 className="text-xl font-semibold mb-4">Audit Logs</h2>
      {err && <div className="text-red-600 mb-3">{err}</div>}

      <div className="text-sm text-gray-600 mb-3">
        Shows recent admin and settings actions for this workspace.
      </div>

      <div className="border rounded-md overflow-hidden">
        <div className="grid grid-cols-4 gap-2 bg-gray-50 p-2 text-xs font-semibold">
          <div>Time</div>
          <div>Action</div>
          <div>Actor</div>
          <div>Entity</div>
        </div>

        {logs.map((l) => (
          <div key={l.id} className="grid grid-cols-4 gap-2 p-2 text-xs border-t">
            <div>{new Date(l.created_at).toLocaleString()}</div>
            <div>{l.action}</div>
            <div>{l.actor_user_id || "-"}</div>
            <div>{l.entity_type}:{l.entity_id}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
src/settings/panels/DataControlsPanel.tsx​
tsx
import React from "react";
import { useSettings } from "../SettingsContext";

export function DataControlsPanel() {
  const { workspaceSettings, updateWorkspaceSettings } = useSettings();
  if (!workspaceSettings) return null;

  const dc = workspaceSettings.data_controls_json || {};
  const setDc = (patch: any) =>
    updateWorkspaceSettings({ data_controls_json: { ...dc, ...patch } });

  return (
    <div className="cmf-card p-6">
      <h2 className="text-xl font-semibold mb-4">Data Controls</h2>

      <h3 className="font-semibold mb-2">Retention (days)</h3>
      <NumberField
        label="Meeting audio retention"
        value={dc.meetingAudioDays ?? 30}
        onChange={(v) => setDc({ meetingAudioDays: v })}
      />
      <NumberField
        label="Transcript retention"
        value={dc.transcriptDays ?? 365}
        onChange={(v) => setDc({ transcriptDays: v })}
      />
      <NumberField
        label="Pulse messages retention"
        value={dc.pulseDays ?? 180}
        onChange={(v) => setDc({ pulseDays: v })}
      />

      <div className="text-sm text-gray-600 mt-4">
        Export jobs (CSV/JSON) can be added next; this panel already persists the policy values.
      </div>
    </div>
  );
}

function NumberField(props: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block mb-3">
      <div className="text-sm text-gray-600 mb-1">{props.label}</div>
      <input
        type="number"
        value={props.value}
        min={1}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="px-3 py-2 border rounded-md w-72"
      />
    </label>
  );
}
src/settings/panels/AboutDiagnosticsPanel.tsx​
tsx
import React, { useEffect, useState } from "react";
import { useSettings } from "../SettingsContext";

export function AboutDiagnosticsPanel() {
  const { api, refreshAll } = useSettings();
  const [gemini, setGemini] = useState<any>(null);

  useEffect(() => { api.geminiHealth().then(setGemini).catch(() => setGemini(null)); }, []);

  return (
    <div className="cmf-card p-6">
      <h2 className="text-xl font-semibold mb-4">About / Diagnostics</h2>

      <div className="text-sm text-gray-600 mb-2">Gemini configured: {gemini?.configured ? "Yes" : "No / Unknown"}</div>

      <button className="px-3 py-2 border rounded-md" onClick={refreshAll}>
        Refresh settings
      </button>
    </div>
  );
}
6) Tests (backend + frontend) — copy/paste
Backend test — server/tests/settings.test.js​
(Uses supertest. If you don’t have it yet, install: npm i -D supertest jest)​

js
const request = require("supertest");
const express = require("express");

const { requireAuth } = require("../middleware/auth");
const { requireWorkspaceAdmin } = require("../middleware/rbac");

test("non-admin cannot access workspace settings", async () => {
  const app = express();
  app.use(express.json());

  // Fake pool
  const pool = { query: async () => ({ rows: [] }) };

  const settingsRoutes = require("../routes/settings")({ pool, requireAuth, requireWorkspaceAdmin });
  app.use(settingsRoutes);

  const res = await request(app)
    .get("/settings/workspace")
    .set("x-user-id", "00000000-0000-0000-0000-000000000001")
    .set("x-workspace-id", "00000000-0000-0000-0000-000000000010")
    .set("x-user-role", "member");

  expect(res.status).toBe(403);
});
Frontend test — src/settings/__tests__/settings-ui.test.tsx​
(Uses React Testing Library. Install: npm i -D @testing-library/react @testing-library/jest-dom)​

tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { SettingsProvider } from "../SettingsContext";
import { SettingsPage } from "../SettingsPage";

test("settings renders Appearance section", async () => {
  // Minimal fake fetch
  // @ts-ignore
  global.fetch = async (url: string, opts?: any) => {
    if (url.endsWith("/settings/user")) {
      return {
        json: async () => ({
          ok: true,
          settings: {
            user_id: "u1",
            theme_mode: "system",
            accent_mode: "system",
            accent_color: "#00A86B",
            reduce_motion: false,
            notifications_json: {},
            meetings_json: {},
            ai_json: {}
          }
        })
      } as any;
    }
    return { json: async () => ({ ok: true }) } as any;
  };

  render(
    <SettingsProvider baseUrl="http://localhost:3001" authHeaders={{ "x-user-id": "u1", "x-workspace-id": "w1" }} userRole="member">
      <SettingsPage />
    </SettingsProvider>
  );

  expect(await screen.findByText("Appearance")).toBeInTheDocument();
});
7) How to wire it into your existing app
In your main React entry (where you render pages), wrap your app with SettingsProvider and pass headers. You already have a Settings nav item in index.tsx, so route that menu to render <SettingsPage />.​

Example integration (pseudocode):

tsx
<SettingsProvider
  baseUrl="http://localhost:3001"
  authHeaders={{ "x-user-id": userId, "x-workspace-id": workspaceId, "x-user-role": role }}
  userRole={role}
>
  {activePage === "settings" ? <SettingsPage /> : <OtherPages />}
</SettingsProvider>
If you paste your current server/index.js (or equivalent) and how you currently start Express + connect Postgres, this pack can be adjusted to match your exact server layout and ports.​

There isn’t a server/index.js in what’s currently visible here—your project files we can see look more like a single Vite/React app bundle (the paste.txt snapshot shows Vite-built modules, React UI code, and env templates, but not an Express entry file).​

What this means (in plain terms)
The Settings pack you asked for includes a Node/Express API, but your repo (as currently shared) doesn’t appear to have a backend folder yet, so there’s nowhere for server/index.js to exist.​
So you have two valid options: (A) add a backend (recommended for Postgres persistence + admin controls), or (B) keep Settings frontend-only using local storage / Supabase directly later.​

Option A (recommended): create the backend now
Create a new folder named server/ at the root of your project and add an Express entry file.

Create this file: server/index.js
Copy/paste this (minimal working Express server):​

js
// server/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const { requireAuth } = require("./middleware/auth");
const { requireWorkspaceAdmin } = require("./middleware/rbac");

const makeSettingsRoutes = require("./routes/settings");
const makeHealthRoutes = require("./routes/health");

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Postgres connection (set DATABASE_URL in .env)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(makeHealthRoutes());
app.use(makeSettingsRoutes({ pool, requireAuth, requireWorkspaceAdmin }));

app.get("/health", (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
Add env vars in your .env
These keys are referenced in your existing docs/templates (Gemini + integrations), so keep the same names:​

text
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/entomate

GEMINI_API_KEY=...
LOGOS_VISION_API_KEY=...
PULSE_API_KEY=...
Add server scripts (package.json)
If you have only one package.json at root, add:​

json
{
  "scripts": {
    "server": "node server/index.js"
  }
}
Then run:

text
npm run server