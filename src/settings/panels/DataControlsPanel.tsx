import { } from "react";
import { useSettings } from "../SettingsContext";

export function DataControlsPanel() {
  const { workspaceSettings, updateWorkspaceSettings } = useSettings();
  if (!workspaceSettings) return null;

  const dc = workspaceSettings.data_controls_json || {};
  const setDc = (patch: any) =>
    updateWorkspaceSettings({ data_controls_json: { ...dc, ...patch } });

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Data Controls</h2>

      <h3 className="font-semibold mb-2 text-gray-800 dark:text-gray-200">Retention Policies</h3>
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

      <div className="text-sm text-gray-600 dark:text-gray-400 mt-4">
        Export jobs (CSV/JSON) can be added next; this panel already persists the policy values.
      </div>
    </div>
  );
}

function NumberField(props: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block mb-3">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{props.label}</div>
      <input
        type="number"
        value={props.value}
        min={1}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md w-72 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
      />
    </label>
  );
}
