import { useState } from "react";
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

  if (loading) return <div className="p-6 text-gray-700 dark:text-gray-300">Loading settings…</div>;
  if (error) return <div className="p-6 text-red-600 dark:text-red-400">Settings error: {error}</div>;

  return (
    <div className="p-6 flex gap-6">
      <aside className="w-72">
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">User</div>
        <NavButton active={section === "appearance"} onClick={() => setSection("appearance")} label="Appearance" />
        <NavButton active={section === "about"} onClick={() => setSection("about")} label="About / Diagnostics" />

        {isAdmin && (
          <>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-6 mb-2">Workspace (Admin)</div>
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
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-gray-700 dark:text-gray-300">Admin permission required.</div>
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
        "w-full text-left px-3 py-2 rounded-md mb-1 text-gray-700 dark:text-gray-300",
        props.active ? "bg-gray-100 dark:bg-gray-800 border-l-4" : "hover:bg-gray-50 dark:hover:bg-gray-800",
      ].join(" ")}
      style={props.active ? { borderLeftColor: "var(--color-accent)" } : undefined}
    >
      {props.label}
    </button>
  );
}
