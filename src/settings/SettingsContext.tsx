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
