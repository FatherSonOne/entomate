/**
 * Settings Module Index
 *
 * Export all settings-related components, hooks, and utilities.
 */

// Context and Provider
export { SettingsProvider, useSettings } from './SettingsContext'

// Types
export type {
  ThemeMode,
  AccentMode,
  UserSettings,
  WorkspaceSettings,
  AuditLogRow
} from './settingsTypes'

// API Factory
export { makeSettingsApi } from './settingsApi'

// Theme Utilities
export {
  getSystemTheme,
  applyThemeToDom,
  applyAccentToDom
} from './theme'

// Components
export { SettingsPage } from './SettingsPage'
export {
  AppearancePanel,
  IntegrationsPanel,
  SecurityAccessPanel,
  AuditLogsPanel,
  DataControlsPanel,
  AboutDiagnosticsPanel
} from './panels'
