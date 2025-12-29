import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useKeyboardShortcuts, formatShortcut } from '../hooks/useKeyboardShortcuts';

interface Command {
  id: string;
  name: string;
  icon: string;
  action: 'navigate' | 'showShortcuts' | 'openDocs';
  tabId?: string;
  category: string;
  shortcut?: string;
}

const commands: Command[] = [
  // Navigation
  { id: 'nav-home', name: 'Go to Dashboard', icon: '🏠', action: 'navigate', tabId: 'home', category: 'Navigation' },
  { id: 'nav-meetings', name: 'Go to Meetings', icon: '🎤', action: 'navigate', tabId: 'meetings', category: 'Navigation' },
  { id: 'nav-projects', name: 'Go to Projects', icon: '📁', action: 'navigate', tabId: 'projects', category: 'Navigation' },
  { id: 'nav-automations', name: 'Go to Automations', icon: '⚡', action: 'navigate', tabId: 'automations', category: 'Navigation' },
  { id: 'nav-agents', name: 'Go to AI Agents', icon: '🤖', action: 'navigate', tabId: 'agents', category: 'Navigation' },
  { id: 'nav-search', name: 'Go to Search', icon: '🔍', action: 'navigate', tabId: 'search', category: 'Navigation' },
  { id: 'nav-assistant', name: 'Go to Ask Assistant', icon: '💬', action: 'navigate', tabId: 'ask-assistant', category: 'Navigation' },
  { id: 'nav-inbox', name: 'Go to Inbox', icon: '📥', action: 'navigate', tabId: 'inbox', category: 'Navigation' },
  { id: 'nav-settings', name: 'Go to Settings', icon: '⚙️', action: 'navigate', tabId: 'settings', category: 'Navigation' },

  // Actions
  { id: 'action-new-meeting', name: 'New Meeting', icon: '🎤', action: 'navigate', tabId: 'meetings', category: 'Actions', shortcut: 'mod+m' },
  { id: 'action-search', name: 'Search Everything', icon: '🔍', action: 'navigate', tabId: 'search', category: 'Actions', shortcut: 'mod+/' },

  // Help
  { id: 'help-shortcuts', name: 'Keyboard Shortcuts', icon: '⌨️', action: 'showShortcuts', category: 'Help', shortcut: 'mod+?' },
  { id: 'help-docs', name: 'Documentation', icon: '📚', action: 'openDocs', category: 'Help' },
];

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tabId: string) => void;
  onShowShortcuts: () => void;
}

export function CommandPalette({ isOpen, onClose, onNavigate, onShowShortcuts }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;

    const searchTerm = query.toLowerCase();
    return commands.filter(cmd =>
      cmd.name.toLowerCase().includes(searchTerm) ||
      cmd.category.toLowerCase().includes(searchTerm)
    );
  }, [query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Flatten for keyboard navigation
  const flatCommands = useMemo(() => {
    return Object.values(groupedCommands).flat();
  }, [groupedCommands]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && flatCommands.length > 0) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, flatCommands.length]);

  // Handle keyboard navigation
  useKeyboardShortcuts({
    'escape': { callback: onClose, allowInInput: true },
    'ArrowDown': {
      callback: () => setSelectedIndex(i => Math.min(i + 1, flatCommands.length - 1)),
      allowInInput: true,
    },
    'ArrowUp': {
      callback: () => setSelectedIndex(i => Math.max(i - 1, 0)),
      allowInInput: true,
    },
    'Enter': {
      callback: () => {
        if (flatCommands[selectedIndex]) {
          executeCommand(flatCommands[selectedIndex]);
        }
      },
      allowInInput: true,
    }
  }, isOpen);

  const executeCommand = (command: Command) => {
    onClose();

    switch (command.action) {
      case 'navigate':
        if (command.tabId) {
          onNavigate(command.tabId);
        }
        break;
      case 'showShortcuts':
        onShowShortcuts?.();
        break;
      case 'openDocs':
        window.open('https://docs.entomate.com', '_blank');
        break;
      default:
        console.log('Unknown action:', command.action);
    }
  };

  if (!isOpen) return null;

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="flex min-h-full items-start justify-center p-4 pt-[15vh]">
        <div className="relative w-full max-w-xl transform rounded-xl bg-white shadow-2xl ring-1 ring-black/5 transition-all">
          {/* Search input */}
          <div className="flex items-center border-b border-gray-200 px-4">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              className="flex-1 border-0 bg-transparent py-4 px-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0"
              placeholder="Type a command or search..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
            />
            <button
              onClick={onClose}
              className="rounded p-1 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Commands list */}
          <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
            {flatCommands.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p>No commands found</p>
              </div>
            ) : (
              Object.entries(groupedCommands).map(([category, cmds]) => (
                <div key={category} className="mb-2">
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {category}
                  </div>
                  {cmds.map((cmd) => {
                    const currentIndex = flatIndex++;
                    const isSelected = currentIndex === selectedIndex;

                    return (
                      <button
                        key={cmd.id}
                        data-index={currentIndex}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          isSelected
                            ? 'bg-blue-50 text-blue-900'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                        onClick={() => executeCommand(cmd)}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                      >
                        <span className="text-lg">{cmd.icon}</span>
                        <span className="flex-1">{cmd.name}</span>
                        {cmd.shortcut && (
                          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded border border-gray-200">
                            {formatShortcut(cmd.shortcut)}
                          </kbd>
                        )}
                        {isSelected && (
                          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-200">↑↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-200">↵</kbd>
                to select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-200">esc</kbd>
                to close
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
