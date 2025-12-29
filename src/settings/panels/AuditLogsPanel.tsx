import { useEffect, useState } from "react";
import { useSettings } from "../SettingsContext";
import type { AuditLogRow } from "../settingsTypes";

export function AuditLogsPanel() {
  const { api } = useSettings();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.getAuditLogs(200).then(setLogs).catch((e) => setErr(e.message));
  }, [api]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Audit Logs</h2>
      {err && <div className="text-red-600 dark:text-red-400 mb-3">{err}</div>}

      <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        Shows recent admin and settings actions for this workspace.
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
        <div className="grid grid-cols-4 gap-2 bg-gray-50 dark:bg-gray-800 p-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
          <div>Time</div>
          <div>Action</div>
          <div>Actor</div>
          <div>Entity</div>
        </div>

        {logs.map((l) => (
          <div key={l.id} className="grid grid-cols-4 gap-2 p-2 text-xs border-t border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
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
