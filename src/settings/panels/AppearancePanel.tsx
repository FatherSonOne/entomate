import { } from "react";
import { useSettings } from "../SettingsContext";
import type { ThemeMode, AccentMode } from "../settingsTypes";

export function AppearancePanel() {
  const { userSettings, updateUserSettings } = useSettings();
  if (!userSettings) return null;

  const themeMode = userSettings.theme_mode;
  const accentMode = userSettings.accent_mode;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Appearance</h2>

      <div className="mb-6">
        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Theme</label>
        <select
          value={themeMode}
          onChange={(e) => updateUserSettings({ theme_mode: e.target.value as ThemeMode })}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md w-72 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="system">Match system</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>

      <div className="mb-3">
        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Highlight / Accent</label>
        <select
          value={accentMode}
          onChange={(e) => updateUserSettings({ accent_mode: e.target.value as AccentMode })}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md w-72 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="system">Match system (default app accent)</option>
          <option value="custom">Custom color</option>
        </select>
      </div>

      {accentMode === "custom" && (
        <div className="mb-6 flex items-center gap-3">
          <input
            type="color"
            value={userSettings.accent_color || "#2563EB"}
            onChange={(e) => updateUserSettings({ accent_color: e.target.value })}
            className="w-12 h-10"
            aria-label="Accent color"
          />
          <div className="text-sm text-gray-600 dark:text-gray-400">{userSettings.accent_color}</div>
          <div className="w-6 h-6 rounded" style={{ background: "var(--color-accent)" }} />
        </div>
      )}

      <div className="mt-6">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!userSettings.reduce_motion}
            onChange={(e) => updateUserSettings({ reduce_motion: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Reduce motion</span>
        </label>
      </div>
    </div>
  );
}
