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
