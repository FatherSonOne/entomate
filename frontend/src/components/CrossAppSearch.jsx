/**
 * Cross-App Search Component
 *
 * A unified search modal that searches across all connected apps in the Entomate ecosystem.
 * Triggered by Cmd/Ctrl+K keyboard shortcut.
 *
 * Features:
 * - Keyboard shortcut activation (Cmd/Ctrl+K)
 * - Search across contacts, meetings, deals, events
 * - Results grouped by type with source app icons
 * - Deep links to source app/page
 * - Recent searches history
 * - Keyboard navigation
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import {
  Search, X, Loader2, User, Video, DollarSign, Bell, Bot, GitBranch,
  CheckSquare, Clock, ArrowRight, ExternalLink, Building2, AlertCircle
} from 'lucide-react'
import { useKeyboardShortcuts, formatShortcut } from '../hooks/useKeyboardShortcuts'

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Type icons mapping
const TYPE_ICONS = {
  contact: User,
  meeting: Video,
  deal: DollarSign,
  event: Bell,
  agent: Bot,
  workflow: GitBranch,
  action_item: CheckSquare
}

// Source app colors
const APP_COLORS = {
  entomate: '#6366f1',
  pulse: '#10b981',
  agentica: '#8b5cf6',
  logos_crm: '#f59e0b'
}

/**
 * Search API helper
 */
async function searchCrossApp(query, options = {}, getToken) {
  const token = await getToken()
  const params = new URLSearchParams({
    q: query,
    limit: options.limit || 20,
    ...(options.types ? { types: options.types.join(',') } : {})
  })

  const response = await fetch(`${API_BASE_URL}/api/cross-search?${params}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    }
  })

  if (!response.ok) {
    throw new Error('Search failed')
  }

  return response.json()
}

/**
 * Get recent searches
 */
async function getRecentSearches(getToken) {
  try {
    const token = await getToken()
    const response = await fetch(`${API_BASE_URL}/api/cross-search/recent`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    })

    if (!response.ok) return []
    const data = await response.json()
    return data.searches || []
  } catch {
    return []
  }
}

export default function CrossAppSearch({ isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [grouped, setGrouped] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentSearches, setRecentSearches] = useState([])
  const [searchStats, setSearchStats] = useState(null)

  const inputRef = useRef(null)
  const listRef = useRef(null)
  const debounceRef = useRef(null)
  const navigate = useNavigate()

  const { getToken } = useAuth()

  // Load recent searches when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setGrouped([])
      setSelectedIndex(0)
      setError(null)
      getRecentSearches(getToken).then(setRecentSearches)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen, getToken])

  // Debounced search
  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults([])
      setGrouped([])
      setSearchStats(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await searchCrossApp(searchQuery, {}, getToken)
      setResults(data.results || [])
      setGrouped(data.grouped || [])
      setSearchStats({
        totalCount: data.totalCount,
        executionTime: data.executionTime,
        sources: data.sources
      })
      setSelectedIndex(0)
    } catch (err) {
      setError(err.message)
      setResults([])
      setGrouped([])
    } finally {
      setLoading(false)
    }
  }, [getToken])

  // Handle query change with debounce
  const handleQueryChange = (e) => {
    const value = e.target.value
    setQuery(value)
    setSelectedIndex(0)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      performSearch(value)
    }, 200)
  }

  // Flat list of all results for keyboard navigation
  const flatResults = useMemo(() => results, [results])

  // Keyboard navigation
  useKeyboardShortcuts({
    'escape': { callback: onClose, allowInInput: true },
    'ArrowDown': {
      callback: () => setSelectedIndex(i => Math.min(i + 1, flatResults.length - 1)),
      allowInInput: true,
      requireMod: false
    },
    'ArrowUp': {
      callback: () => setSelectedIndex(i => Math.max(i - 1, 0)),
      allowInInput: true,
      requireMod: false
    },
    'Enter': {
      callback: () => {
        if (flatResults[selectedIndex]) {
          handleResultClick(flatResults[selectedIndex])
        }
      },
      allowInInput: true,
      requireMod: false
    }
  }, isOpen)

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && flatResults.length > 0) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, flatResults.length])

  // Handle result click
  const handleResultClick = (result) => {
    onClose()

    // Check if it's an internal link (same app) or external
    const isInternal = result.sourceApp === 'entomate' || result.deepLink?.startsWith('/')

    if (isInternal) {
      // Navigate within the app
      const path = result.deepLink?.replace(/^https?:\/\/[^/]+/, '') || '/'
      navigate(path)
    } else if (result.deepLink) {
      // Open in new tab for external apps
      window.open(result.deepLink, '_blank')
    }
  }

  // Handle recent search click
  const handleRecentClick = (recent) => {
    setQuery(recent.query)
    performSearch(recent.query)
  }

  // Get icon component for result type
  const getTypeIcon = (type) => {
    return TYPE_ICONS[type] || Bell
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="flex min-h-full items-start justify-center p-4 pt-[10vh]">
        <div
          className="relative w-full max-w-2xl transform rounded-xl bg-white shadow-2xl ring-1 ring-black/5 transition-all"
          role="dialog"
          aria-modal="true"
          aria-label="Cross-app search"
        >
          {/* Search input */}
          <div className="flex items-center border-b border-gray-200 px-4">
            <Search className="w-5 h-5 text-gray-400" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              className="flex-1 border-0 bg-transparent py-4 px-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 text-lg"
              placeholder="Search across all apps..."
              value={query}
              onChange={handleQueryChange}
              autoComplete="off"
              aria-label="Search query"
            />
            {loading && <Loader2 className="w-5 h-5 text-primary-500 animate-spin" aria-hidden="true" />}
            <button
              onClick={onClose}
              className="rounded p-1 text-gray-400 hover:text-gray-600 ml-2"
              aria-label="Close search"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Results area */}
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
            {/* Error state */}
            {error && (
              <div className="p-4 text-center">
                <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
                <p className="text-red-600">{error}</p>
              </div>
            )}

            {/* Empty state with recent searches */}
            {!loading && !error && results.length === 0 && query.length < 2 && (
              <div className="p-4">
                {recentSearches.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 px-2">
                      Recent Searches
                    </h3>
                    <div className="space-y-1">
                      {recentSearches.slice(0, 5).map((recent, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleRecentClick(recent)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-gray-100 transition-colors"
                        >
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">{recent.query}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-center py-6 text-gray-500">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm">
                    Search across <span className="font-medium text-gray-700">contacts</span>,{' '}
                    <span className="font-medium text-gray-700">meetings</span>,{' '}
                    <span className="font-medium text-gray-700">deals</span>, and more
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Type at least 2 characters to search
                  </p>
                </div>
              </div>
            )}

            {/* No results */}
            {!loading && !error && results.length === 0 && query.length >= 2 && (
              <div className="p-8 text-center">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No results found</p>
                <p className="text-sm text-gray-400 mt-1">
                  Try different keywords or check your spelling
                </p>
              </div>
            )}

            {/* Grouped results */}
            {!loading && !error && grouped.length > 0 && (
              <div className="p-2">
                {grouped.map((group) => {
                  const TypeIcon = getTypeIcon(group.type)
                  return (
                    <div key={group.type} className="mb-3">
                      {/* Group header */}
                      <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        <TypeIcon className="w-4 h-4" style={{ color: group.typeInfo?.color }} />
                        {group.typeInfo?.label || group.type}
                        <span className="text-gray-400">({group.items.length})</span>
                      </div>

                      {/* Group items */}
                      {group.items.map((result) => {
                        const itemIndex = flatResults.findIndex(r => r.id === result.id)
                        const isSelected = itemIndex === selectedIndex
                        const ResultIcon = getTypeIcon(result.type)

                        return (
                          <button
                            key={result.id}
                            data-index={itemIndex}
                            onClick={() => handleResultClick(result)}
                            onMouseEnter={() => setSelectedIndex(itemIndex)}
                            className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                              isSelected
                                ? 'bg-primary-50 ring-1 ring-primary-200'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            {/* Icon */}
                            <div
                              className="mt-0.5 p-1.5 rounded-lg"
                              style={{
                                backgroundColor: result.typeInfo?.color + '15',
                                color: result.typeInfo?.color
                              }}
                            >
                              <ResultIcon className="w-4 h-4" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-gray-900 truncate">
                                  {result.title}
                                </h4>
                                {result.sourceAppInfo && (
                                  <span
                                    className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                                    style={{
                                      backgroundColor: APP_COLORS[result.sourceApp] + '20',
                                      color: APP_COLORS[result.sourceApp]
                                    }}
                                  >
                                    {result.sourceAppInfo.name}
                                  </span>
                                )}
                              </div>
                              {result.subtitle && (
                                <p className="text-sm text-gray-500 truncate">
                                  {result.subtitle}
                                </p>
                              )}
                              {result.description && (
                                <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">
                                  {result.description}
                                </p>
                              )}
                            </div>

                            {/* Action indicator */}
                            <div className="flex items-center gap-1 text-gray-400">
                              {result.sourceApp !== 'entomate' && (
                                <ExternalLink className="w-3.5 h-3.5" />
                              )}
                              {isSelected && (
                                <ArrowRight className="w-4 h-4 text-primary-500" />
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-200 font-mono">
                  ↑↓
                </kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-200 font-mono">
                  ↵
                </kbd>
                open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-200 font-mono">
                  esc
                </kbd>
                close
              </span>
            </div>

            {/* Stats */}
            {searchStats && (
              <div className="text-xs text-gray-400">
                {searchStats.totalCount} result{searchStats.totalCount !== 1 ? 's' : ''} in {searchStats.executionTime}ms
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook to manage CrossAppSearch modal state
 * Usage:
 *   const { isOpen, open, close } = useCrossAppSearch()
 *   // Then use with: <CrossAppSearch isOpen={isOpen} onClose={close} />
 */
export function useCrossAppSearch() {
  const [isOpen, setIsOpen] = useState(false)

  // Register global keyboard shortcut (Cmd/Ctrl+K)
  useKeyboardShortcuts({
    'mod+k': {
      callback: () => setIsOpen(true),
      allowInInput: false
    }
  }, true)

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev)
  }
}
