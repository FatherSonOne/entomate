import React from 'react';
import { useKeyboardShortcuts, getModKey } from '../hooks/useKeyboardShortcuts';

interface ShortcutItem {
  keys: string[];
  description: string;
  icon?: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['mod', 'K'], description: 'Open command palette', icon: '⌨️' },
      { keys: ['mod', '/'], description: 'Focus search', icon: '🔍' },
      { keys: ['mod', '?'], description: 'Show keyboard shortcuts', icon: '❓' },
      { keys: ['Esc'], description: 'Close dialogs/modals' },
    ]
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['G', 'then', 'H'], description: 'Go to Home/Dashboard' },
      { keys: ['G', 'then', 'M'], description: 'Go to Meetings' },
      { keys: ['G', 'then', 'P'], description: 'Go to Projects' },
      { keys: ['G', 'then', 'T'], description: 'Go to Tasks' },
      { keys: ['G', 'then', 'S'], description: 'Go to Search' },
    ]
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['mod', 'M'], description: 'New Meeting', icon: '🎤' },
      { keys: ['mod', 'N'], description: 'New Project', icon: '📁' },
    ]
  },
  {
    title: 'Search & Assistant',
    shortcuts: [
      { keys: ['mod', 'Enter'], description: 'Submit search' },
      { keys: ['Tab'], description: 'Switch search type' },
      { keys: ['mod', 'A'], description: 'Open Ask Assistant' },
    ]
  }
];

function KeyDisplay({ keys }: { keys: string[] }) {
  const modKey = getModKey();

  return (
    <div className="flex items-center gap-1">
      {keys.map((key, idx) => {
        if (key === 'then') {
          return <span key={idx} className="text-gray-400 text-xs mx-0.5">then</span>;
        }

        const displayKey = key === 'mod' ? modKey : key;

        return (
          <kbd
            key={idx}
            className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300 rounded shadow-sm"
          >
            {displayKey}
          </kbd>
        );
      })}
    </div>
  );
}

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  // Close on Escape
  useKeyboardShortcuts({
    'escape': { callback: onClose, allowInInput: true }
  }, isOpen);

  if (!isOpen) return null;

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl transform rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">⌨️</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Keyboard Shortcuts</h2>
                <p className="text-sm text-gray-500">Navigate faster with these shortcuts</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            <div className="grid md:grid-cols-2 gap-6">
              {shortcutGroups.map((group) => (
                <div key={group.title}>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">{group.title}</h3>
                  <div className="space-y-2">
                    {group.shortcuts.map((shortcut, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2">
                          {shortcut.icon && <span>{shortcut.icon}</span>}
                          <span className="text-sm text-gray-700">{shortcut.description}</span>
                        </div>
                        <KeyDisplay keys={shortcut.keys} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Press <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs">Esc</kbd> to close
              </p>
              <p className="text-sm text-gray-500">
                {getModKey()} = {isMac ? 'Command' : 'Control'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default KeyboardShortcutsHelp;
