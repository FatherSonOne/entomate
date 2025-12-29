import React, { useState } from 'react'
import {
  RolesManagement,
  AuditLogViewer,
  WebhooksManagement,
  IntegrationsManagement
} from '../phase3/components'
import { useTheme, HIGHLIGHT_COLORS, type HighlightColorKey, type ThemeMode } from '../context/ThemeContext'

type SettingsSection =
  | 'profile'
  | 'appearance'
  | 'notifications'
  | 'integrations'
  | 'automations'
  | 'security'
  | 'audit'
  | 'webhooks'
  | 'data'

interface SettingsViewProps {
  currentUserId?: string
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUserId = 'demo-user-id'
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile')

  const userSections = [
    { id: 'profile', label: 'Profile', icon: <UserIcon /> },
    { id: 'appearance', label: 'Appearance', icon: <PaletteIcon /> },
    { id: 'notifications', label: 'Notifications', icon: <BellIcon /> },
  ]

  const workspaceSections = [
    { id: 'integrations', label: 'Integrations', icon: <PlugIcon /> },
    { id: 'webhooks', label: 'Webhooks', icon: <WebhookIcon /> },
    { id: 'security', label: 'Security & Access', icon: <ShieldIcon /> },
    { id: 'audit', label: 'Audit Logs', icon: <ClipboardIcon /> },
    { id: 'data', label: 'Data Controls', icon: <DatabaseIcon /> },
  ]

  return (
    <div className="flex h-full gap-6">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl p-4">
          {/* User Settings */}
          <div className="mb-6">
            <span className="font-mono text-[10px] uppercase text-gray-400 dark:text-gray-500 tracking-wider px-3 block mb-2">
              User Settings
            </span>
            <div className="space-y-1">
              {userSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id as SettingsSection)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                    activeSection === section.id
                      ? 'bg-gray-100 dark:bg-gray-800 text-black dark:text-white font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="w-5 h-5 flex items-center justify-center text-gray-400 dark:text-gray-500">
                    {section.icon}
                  </span>
                  {section.label}
                </button>
              ))}
            </div>
          </div>

          {/* Workspace Settings */}
          <div>
            <span className="font-mono text-[10px] uppercase text-gray-400 dark:text-gray-500 tracking-wider px-3 block mb-2">
              Workspace
            </span>
            <div className="space-y-1">
              {workspaceSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id as SettingsSection)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                    activeSection === section.id
                      ? 'bg-gray-100 dark:bg-gray-800 text-black dark:text-white font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="w-5 h-5 flex items-center justify-center text-gray-400 dark:text-gray-500">
                    {section.icon}
                  </span>
                  {section.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === 'profile' && <ProfileSection />}
        {activeSection === 'appearance' && <AppearanceSection />}
        {activeSection === 'notifications' && <NotificationsSection />}
        {activeSection === 'integrations' && <IntegrationsManagement />}
        {activeSection === 'webhooks' && <WebhooksManagement />}
        {activeSection === 'security' && <RolesManagement currentUserId={currentUserId} />}
        {activeSection === 'audit' && <AuditLogViewer />}
        {activeSection === 'data' && <DataControlsSection />}
      </div>
    </div>
  )
}

// Profile Section
const ProfileSection: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Profile</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage your personal information</p>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div>
            <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl text-sm font-medium transition-colors text-gray-900 dark:text-gray-100">
              Upload Photo
            </button>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">JPG, PNG or GIF. Max 2MB.</p>
          </div>
        </div>

        {/* Form */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold mb-2 text-gray-500 dark:text-gray-400">First Name</label>
            <input
              type="text"
              placeholder="John"
              className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-2 text-gray-500 dark:text-gray-400">Last Name</label>
            <input
              type="text"
              placeholder="Doe"
              className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold mb-2 text-gray-500 dark:text-gray-400">Email</label>
            <input
              type="email"
              placeholder="john@company.com"
              className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
          <button className="px-6 py-2 bg-[#2563EB] text-white hover:bg-[#1d4ed8] rounded-xl text-sm font-bold transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

// Appearance Section - CMF Nothing Style with color swatches
const AppearanceSection: React.FC = () => {
  const { mode, setMode, highlightColor, setHighlightColor, isDark } = useTheme()

  const themeOptions: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
        </svg>
      ),
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      ),
    },
    {
      value: 'system',
      label: 'System',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Appearance</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Customize the look and feel of Entomate
        </p>
      </div>

      {/* Theme Mode Card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 space-y-6">
        <div>
          <label className="block text-xs font-bold mb-4 uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
            Theme Mode
          </label>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setMode(option.value)}
                className={`relative p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                  mode === option.value
                    ? 'border-[var(--color-accent)]'
                    : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                style={{
                  backgroundColor: mode === option.value ? 'var(--color-accent-dim)' : 'var(--color-bg-tertiary)',
                }}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                    option.value === 'dark'
                      ? 'bg-gray-900 text-white'
                      : option.value === 'light'
                      ? 'bg-white text-gray-900 border border-gray-200'
                      : 'bg-gradient-to-br from-white to-gray-900 text-gray-600'
                  }`}
                >
                  {option.icon}
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {option.label}
                </span>
                {mode === option.value && (
                  <div
                    className="absolute top-2 right-2 w-2 h-2 rounded-full"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Highlight Color */}
        <div>
          <label className="block text-xs font-bold mb-4 uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
            Highlight Color
          </label>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(HIGHLIGHT_COLORS) as HighlightColorKey[]).map((colorKey) => {
              const color = HIGHLIGHT_COLORS[colorKey]
              const isSelected = highlightColor === colorKey
              return (
                <button
                  key={colorKey}
                  onClick={() => setHighlightColor(colorKey)}
                  className={`relative group transition-all duration-200`}
                  title={color.name}
                >
                  <div
                    className={`w-12 h-12 rounded-full transition-all duration-200 ${
                      isSelected
                        ? 'ring-2 ring-offset-2 scale-110'
                        : 'hover:scale-110'
                    }`}
                    style={{
                      backgroundColor: color.value,
                      ringColor: isDark ? '#fafafa' : '#1a1a1a',
                    }}
                  />
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                  )}
                  <span
                    className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {color.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Preview */}
        <div className="pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <label className="block text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
            Preview
          </label>
          <div
            className="p-4 rounded-xl flex items-center gap-4"
            style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              E
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                Entomate
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Your current theme settings
              </div>
            </div>
            <button
              className="px-4 py-2 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              Action
            </button>
          </div>
        </div>
      </div>

      {/* Quick Toggle Info */}
      <div
        className="p-4 rounded-xl flex items-center gap-3"
        style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
            Quick toggle available in the header
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Click the sun/moon icon in the top-right to quickly switch between light and dark modes
          </p>
        </div>
      </div>
    </div>
  )
}

// Notifications Section
const NotificationsSection: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notifications</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Configure how you receive alerts</p>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 space-y-4">
        {[
          { id: 'meetings', label: 'Meeting notifications', description: 'Get notified when meetings are processed' },
          { id: 'alerts', label: 'Customer alerts', description: 'Receive alerts for at-risk customers' },
          { id: 'tasks', label: 'Task reminders', description: 'Get reminded about upcoming tasks' },
          { id: 'agents', label: 'Agent completions', description: 'Notification when AI agents finish' },
        ].map((item) => (
          <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div>
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{item.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{item.description}</div>
            </div>
            <label className="relative inline-flex cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:ring-2 peer-focus:ring-green-300 dark:peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2563EB]"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}

// Data Controls Section
const DataControlsSection: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Data Controls</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage data retention and exports</p>
      </div>

      {/* Retention Policies */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl p-6">
        <h3 className="font-bold mb-4 text-gray-900 dark:text-gray-100">Retention Policies</h3>
        <div className="space-y-4">
          {[
            { label: 'Meeting Transcripts', days: 365 },
            { label: 'Meeting Recordings', days: 90 },
            { label: 'Audit Logs', days: 730 },
            { label: 'Agent Runs', days: 180 },
            { label: 'Pulse Messages', days: 365 },
            { label: 'Customer Sentiment', days: 365 },
          ].map((policy) => (
            <div key={policy.label} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <span className="text-sm text-gray-900 dark:text-gray-100">{policy.label}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  defaultValue={policy.days}
                  className="w-20 p-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">days</span>
              </div>
            </div>
          ))}
        </div>
        <button className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl text-sm font-medium transition-colors text-gray-900 dark:text-gray-100">
          Save Policies
        </button>
      </div>

      {/* Export */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl p-6">
        <h3 className="font-bold mb-4 text-gray-900 dark:text-gray-100">Export Data</h3>
        <div className="grid grid-cols-2 gap-3">
          <button className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl hover:border-gray-300 dark:hover:border-gray-500 transition-colors text-left bg-white dark:bg-gray-800">
            <div className="font-medium text-sm text-gray-900 dark:text-gray-100">Export Meetings</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Download all meeting data</div>
          </button>
          <button className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl hover:border-gray-300 dark:hover:border-gray-500 transition-colors text-left bg-white dark:bg-gray-800">
            <div className="font-medium text-sm text-gray-900 dark:text-gray-100">Export Audit Logs</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Download audit history</div>
          </button>
          <button className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl hover:border-gray-300 dark:hover:border-gray-500 transition-colors text-left bg-white dark:bg-gray-800">
            <div className="font-medium text-sm text-gray-900 dark:text-gray-100">Export Customers</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Download customer data</div>
          </button>
          <button className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl hover:border-gray-300 dark:hover:border-gray-500 transition-colors text-left bg-white dark:bg-gray-800">
            <div className="font-medium text-sm text-gray-900 dark:text-gray-100">Export Everything</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Full data export</div>
          </button>
        </div>
      </div>
    </div>
  )
}

// Icons
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
)

const PaletteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="13.5" cy="6.5" r=".5"></circle>
    <circle cx="17.5" cy="10.5" r=".5"></circle>
    <circle cx="8.5" cy="7.5" r=".5"></circle>
    <circle cx="6.5" cy="12.5" r=".5"></circle>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"></path>
  </svg>
)

const BellIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
)

const PlugIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22v-5"></path>
    <path d="M9 8V2"></path>
    <path d="M15 8V2"></path>
    <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"></path>
  </svg>
)

const WebhookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"></path>
    <path d="m6 17 3.13-5.78c.53-.97.43-2.17-.26-3.07a4 4 0 0 1 6.92-4.01c.32.55.55 1.16.67 1.79"></path>
    <path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8H12"></path>
  </svg>
)

const ShieldIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
  </svg>
)

const ClipboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
  </svg>
)

const DatabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
  </svg>
)

export default SettingsView
