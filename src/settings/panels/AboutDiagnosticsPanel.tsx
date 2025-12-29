import { useEffect, useState } from "react";
import { useSettings } from "../SettingsContext";

export function AboutDiagnosticsPanel() {
  const { api, refreshAll } = useSettings();
  const [gemini, setGemini] = useState<any>(null);

  useEffect(() => { api.geminiHealth().then(setGemini).catch(() => setGemini(null)); }, [api]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">About / Diagnostics</h2>

      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Gemini configured: {gemini?.configured ? "Yes" : "No / Unknown"}</div>

      <button className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={refreshAll}>
        Refresh settings
      </button>
    </div>
  );
}
