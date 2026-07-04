/**
 * SearchInput — Search bar with autocomplete, type selector, and filter chips
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search as SearchIcon, Sparkles, Loader2, Clock, Mic, FolderKanban,
  Flame, TrendingUp, ChevronDown, ChevronUp, MessageSquare, CheckSquare,
  FileText, Filter
} from 'lucide-react'
import { VCButton, VCSelect } from '../vc'

const SOURCE_TYPE_OPTIONS = [
  { value: 'meetings', label: 'Meetings', icon: Mic },
  { value: 'projects', label: 'Projects', icon: FolderKanban },
  { value: 'tasks', label: 'Tasks', icon: CheckSquare },
  { value: 'action_items', label: 'Actions', icon: FileText },
]

export default function SearchInput({
  query, setQuery,
  searchType, setSearchType,
  onSearch,
  loading,
  suggestions, trending,
  loadSuggestions,
  loadingSuggestions,
  // Filter chips
  activeFilters, setActiveFilters,
  // Keyboard ref
  inputRef: externalInputRef,
}) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const internalInputRef = useRef(null)
  const inputRef = externalInputRef || internalInputRef
  const suggestionsRef = useRef(null)
  const debounceRef = useRef(null)

  const handleQueryChange = (e) => {
    const value = e.target.value
    setQuery(value)
    setSelectedSuggestionIndex(-1)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.length >= 2) {
      debounceRef.current = setTimeout(() => loadSuggestions(value), 200)
      setShowSuggestions(true)
    } else {
      setShowSuggestions(value.length > 0)
    }
  }

  const selectSuggestion = (text) => {
    setQuery(text)
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    onSearch(null, text, searchType)
  }

  const handleKeyDown = (e) => {
    const allSuggestions = [...(suggestions || []), ...(query.length < 2 ? (trending || []) : [])]

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => Math.min(prev + 1, allSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
      e.preventDefault()
      const selected = allSuggestions[selectedSuggestionIndex]
      if (selected) selectSuggestion(selected.text)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setSelectedSuggestionIndex(-1)
    }
  }

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [inputRef])

  const toggleFilter = (type) => {
    setActiveFilters(prev =>
      prev.includes(type) ? prev.filter(f => f !== type) : [...prev, type]
    )
  }

  return (
    <div className="vc p-5">
      <form onSubmit={(e) => { e.preventDefault(); onSearch(e) }}>
        <div className="relative">
          {searchType === 'semantic' ? (
            <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10" style={{ color: 'var(--accent-primary)' }} />
          ) : (
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10" style={{ color: 'var(--text-tertiary)' }} />
          )}
          <input
            ref={inputRef}
            type="text"
            className="vinput pl-12 pr-40 py-3 text-lg w-full"
            placeholder={searchType === 'semantic'
              ? "Search by meaning (e.g., 'budget discussions')"
              : "Search by keywords..."}
            value={query}
            onChange={handleQueryChange}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
            <VCSelect
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              className="py-1.5 px-2 text-sm"
            >
              <option value="semantic">Semantic</option>
              <option value="keyword">Keyword</option>
            </VCSelect>
            <VCButton type="submit" variant="primary" disabled={loading || !query.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </VCButton>
          </div>

          {/* Autocomplete dropdown */}
          {showSuggestions && ((suggestions && suggestions.length > 0) || (query.length < 2 && trending && trending.length > 0)) && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-50 overflow-hidden"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
            >
              {/* Trending */}
              {query.length < 2 && trending && trending.length > 0 && (
                <div className="p-2" style={{ borderBottom: '1px solid var(--b0)' }}>
                  <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium uppercase" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    <Flame className="w-3 h-3" style={{ color: 'var(--accent-tertiary)' }} />
                    Trending Searches
                  </div>
                  {trending.map((item, idx) => (
                    <button
                      key={`trending-${idx}`}
                      type="button"
                      className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors"
                      style={
                        selectedSuggestionIndex === (suggestions?.length || 0) + idx
                          ? { background: 'rgba(255,45,107,0.08)', color: 'var(--text-primary)' }
                          : { color: 'var(--text-secondary)' }
                      }
                      onClick={() => selectSuggestion(item.text)}
                      onMouseEnter={() => setSelectedSuggestionIndex((suggestions?.length || 0) + idx)}
                    >
                      <TrendingUp className="w-4 h-4" style={{ color: 'var(--accent-tertiary)' }} />
                      <span className="flex-1 truncate">{item.text}</span>
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{item.count}x</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Suggestions */}
              {suggestions && suggestions.length > 0 && (
                <div className="p-2">
                  {query.length >= 2 && (
                    <div className="px-2 py-1 text-xs font-medium uppercase flex items-center gap-1" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      {loadingSuggestions ? <Loader2 className="w-3 h-3 animate-spin" /> : <SearchIcon className="w-3 h-3" />}
                      Suggestions
                    </div>
                  )}
                  {suggestions.map((item, idx) => {
                    const Icon = item.type === 'meeting' ? Mic : item.type === 'project' ? FolderKanban : item.type === 'recent' ? Clock : SearchIcon
                    const iconColor = item.type === 'meeting' ? 'var(--accent-tertiary)' : item.type === 'project' ? 'var(--accent-secondary)' : 'var(--text-tertiary)'
                    return (
                      <button
                        key={`suggestion-${idx}`}
                        type="button"
                        className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors"
                        style={selectedSuggestionIndex === idx ? { background: 'rgba(255,45,107,0.08)', color: 'var(--text-primary)' } : { color: 'var(--text-secondary)' }}
                        onClick={() => selectSuggestion(item.text)}
                        onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                      >
                        <Icon className="w-4 h-4" style={{ color: iconColor }} />
                        <span className="flex-1 truncate">{item.text}</span>
                        <span className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>{item.type}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Empty */}
              {query.length >= 2 && (!suggestions || suggestions.length === 0) && !loadingSuggestions && (
                <div className="p-4 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  No suggestions found. Press Enter to search.
                </div>
              )}

              {/* Keyboard hint */}
              <div
                className="px-3 py-2 text-xs flex items-center gap-4"
                style={{ borderTop: '1px solid var(--b0)', background: 'var(--b0)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
              >
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded text-xs" style={{ border: '1px solid var(--b1)', background: 'var(--b0)' }}>↑↓</kbd> navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded text-xs" style={{ border: '1px solid var(--b1)', background: 'var(--b0)' }}>↵</kbd> select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded text-xs" style={{ border: '1px solid var(--b1)', background: 'var(--b0)' }}>esc</kbd> close
                </span>
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Source type filter chips */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <Filter className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
        {SOURCE_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => {
          const isActive = activeFilters.length === 0 || activeFilters.includes(value)
          return (
            <button
              key={value}
              onClick={() => toggleFilter(value)}
              className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors"
              style={
                isActive
                  ? { background: 'rgba(255,45,107,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(255,45,107,0.3)' }
                  : { background: 'var(--b0)', color: 'var(--text-tertiary)', border: '1px solid var(--b1)' }
              }
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          )
        })}
        {activeFilters.length > 0 && (
          <button
            onClick={() => setActiveFilters([])}
            className="text-xs px-2 py-1 transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
