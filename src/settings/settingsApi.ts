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
