import React, { useEffect, useState } from "react";
import { useSettings } from "../SettingsContext";

export function IntegrationsPanel() {
  const { workspaceSettings, updateWorkspaceSettings, api } = useSettings();
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    api.integrationsHealth().then(setHealth).catch(() => setHealth(null));
  }, [api]);

  if (!workspaceSettings) return null;

  const integrations = workspaceSettings.integrations_json || {};
  const setIntegrations = (patch: any) =>
    updateWorkspaceSettings({ integrations_json: { ...integrations, ...patch } });

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Integrations</h2>

      <Section title="Google Gemini">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Status: {health?.gemini ? (health.gemini.configured ? "Configured" : "Missing key") : "Unknown"}
        </div>
        <button className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={async () => alert(JSON.stringify(await api.geminiHealth()))}>
          Run Gemini health check
        </button>
      </Section>

      <Section title="Logos Vision CRM">
        <Toggle
          label="Enable Logos Vision sync"
          value={!!integrations.logosVisionEnabled}
          onChange={(v) => setIntegrations({ logosVisionEnabled: v })}
        />
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Env key configured: {health?.logosVision ? (health.logosVision.configured ? "Yes" : "No") : "Unknown"}
        </div>
      </Section>

      <Section title="Pulse Chat">
        <Toggle
          label="Enable Pulse notifications"
          value={!!integrations.pulseEnabled}
          onChange={(v) => setIntegrations({ pulseEnabled: v })}
        />
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Env key configured: {health?.pulse ? (health.pulse.configured ? "Yes" : "No") : "Unknown"}
        </div>
      </Section>
    </div>
  );
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="font-semibold mb-2 text-gray-800 dark:text-gray-200">{props.title}</h3>
      {props.children}
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
