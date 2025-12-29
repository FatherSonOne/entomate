import { } from "react";
import { useSettings } from "../SettingsContext";

export function SecurityAccessPanel() {
  const { workspaceSettings, updateWorkspaceSettings } = useSettings();
  if (!workspaceSettings) return null;

  const security = workspaceSettings.security_json || {};
  const setSecurity = (patch: any) =>
    updateWorkspaceSettings({ security_json: { ...security, ...patch } });

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Security & Access</h2>

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

      <div className="text-sm text-gray-600 dark:text-gray-400 mt-4">
        RBAC note: backend must enforce admin-only routes (already done for workspace settings + audit logs).
      </div>
    </div>
  );
}

function Toggle(props: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 mb-2 cursor-pointer">
      <input type="checkbox" checked={props.value} onChange={(e) => props.onChange(e.target.checked)} className="w-4 h-4" />
      <span className="text-sm text-gray-700 dark:text-gray-300">{props.label}</span>
    </label>
  );
}
