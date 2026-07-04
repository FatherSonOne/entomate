/**
 * Search Page — Orchestrates search sub-components
 * Refactored from 1562-line god component into composable pieces
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Sparkles, Search as SearchIcon } from 'lucide-react'
import { searchApi } from '../services/api'
import SearchInput from '../components/search/SearchInput'
import SearchHistoryPanel from '../components/search/SearchHistoryPanel'
import AskAIPanel from '../components/search/AskAIPanel'
import SearchResults from '../components/search/SearchResults'
import SearchAnalytics from '../components/search/SearchAnalytics'

export default function Search() {
  // Search state
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [searchType, setSearchType] = useState('semantic')
  const [executionTime, setExecutionTime] = useState(null)

  // History & saved
  const [searchHistory, setSearchHistory] = useState([])
  const [savedSearches, setSavedSearches] = useState([])

  // Autocomplete
  const [suggestions, setSuggestions] = useState([])
  const [trending, setTrending] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  // Export
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState(null)

  // Filter chips
  const [activeFilters, setActiveFilters] = useState([])

  // Search input ref for keyboard shortcut
  const searchInputRef = useRef(null)

  // Keyboard shortcut: "/" to focus search input
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Load data on mount
  useEffect(() => {
    loadSearchHistory()
    loadSavedSearches()
    loadTrending()
  }, [])

  const loadTrending = async () => {
    try {
      const data = await searchApi.getSuggestions('', true)
      setTrending(data.trending || [])
    } catch (error) {
      console.error('Failed to load trending:', error)
    }
  }

  const loadSuggestions = useCallback(async (prefix) => {
    if (!prefix || prefix.length < 2) { setSuggestions([]); return }
    try {
      setLoadingSuggestions(true)
      const data = await searchApi.getSuggestions(prefix, false)
      setSuggestions(data.suggestions || [])
    } catch (error) {
      console.error('Failed to load suggestions:', error)
    } finally {
      setLoadingSuggestions(false)
    }
  }, [])

  const loadSearchHistory = async () => {
    try {
      const data = await searchApi.getHistory(10)
      setSearchHistory(data.history || [])
    } catch (error) {
      console.error('Failed to load history:', error)
    }
  }

  const loadSavedSearches = async () => {
    try {
      const data = await searchApi.getSavedSearches()
      setSavedSearches(data.saved || [])
    } catch (error) {
      console.error('Failed to load saved searches:', error)
    }
  }

  const handleSearch = async (e, searchQuery = query, type = searchType) => {
    e?.preventDefault()
    if (!searchQuery.trim()) return

    try {
      setLoading(true)
      setHasSearched(true)
      setQuery(searchQuery)

      // Apply filter chips: pass types if any selected
      const typesToSearch = activeFilters.length > 0 ? activeFilters : undefined

      let data
      if (type === 'semantic') {
        data = await searchApi.semantic({ query: searchQuery, limit: 20 })
      } else {
        data = await searchApi.search({
          query: searchQuery,
          types: typesToSearch || ['meetings', 'projects', 'tasks', 'action_items'],
          limit: 50
        })
      }

      setResults(data.results || [])
      setExecutionTime(data.executionTime)
      loadSearchHistory()
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format) => {
    if (results.length === 0) return
    try {
      setExporting(true)
      setExportFormat(format)

      const response = await searchApi.exportResults(results, format, query, searchType)
      const blob = new Blob(
        [format === 'json' ? JSON.stringify(response.data, null, 2) : response.data],
        { type: format === 'json' ? 'application/json' : 'text/csv' }
      )
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = response.filename || `search-results-${Date.now()}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setExporting(false)
      setExportFormat(null)
    }
  }

  const handleSaveSearch = async (name) => {
    try {
      await searchApi.saveSearch({ name, query, searchType })
      loadSavedSearches()
    } catch (error) {
      console.error('Failed to save search:', error)
    }
  }

  const handleDeleteSavedSearch = async (id) => {
    try {
      await searchApi.deleteSavedSearch(id)
      loadSavedSearches()
    } catch (error) {
      console.error('Failed to delete saved search:', error)
    }
  }

  const handleClearHistory = async () => {
    try {
      await searchApi.clearHistory()
      setSearchHistory([])
    } catch (error) {
      console.error('Failed to clear history:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          AI Search &amp; Assistant
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Find anything using semantic search or ask AI questions about your meetings
          <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            Press <kbd className="px-1 py-0.5 rounded" style={{ border: '1px solid var(--b1)', background: 'var(--b0)' }}>/</kbd> to focus
          </span>
        </p>
      </div>

      {/* Search Input with filter chips */}
      <div>
        <SearchInput
          query={query}
          setQuery={setQuery}
          searchType={searchType}
          setSearchType={setSearchType}
          onSearch={handleSearch}
          loading={loading}
          suggestions={suggestions}
          trending={trending}
          loadSuggestions={loadSuggestions}
          loadingSuggestions={loadingSuggestions}
          activeFilters={activeFilters}
          setActiveFilters={setActiveFilters}
          inputRef={searchInputRef}
        />

        <SearchHistoryPanel
          query={query}
          searchHistory={searchHistory}
          savedSearches={savedSearches}
          onSearch={handleSearch}
          onClearHistory={handleClearHistory}
          onSaveSearch={handleSaveSearch}
          onDeleteSavedSearch={handleDeleteSavedSearch}
        />
      </div>

      {/* Ask AI */}
      <AskAIPanel />

      {/* Search Results */}
      <SearchResults
        results={results}
        loading={loading}
        hasSearched={hasSearched}
        query={query}
        searchType={searchType}
        executionTime={executionTime}
        onExport={handleExport}
        exporting={exporting}
        exportFormat={exportFormat}
      />

      {/* Tips (only when no search yet) */}
      {!hasSearched && (
        <div className="vc p-5">
          <h3 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Search Tips</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                <Sparkles className="w-4 h-4" /> Semantic Search
              </h4>
              <ul className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <li>Finds results by meaning, not just keywords</li>
                <li>Try: <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>"budget discussions"</span></li>
                <li>Try: <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>"project delays"</span></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                <SearchIcon className="w-4 h-4" /> Keyword Search
              </h4>
              <ul className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <li>Exact match across all content</li>
                <li>Best for names, project codes, or phrases</li>
                <li>Searches titles, summaries, and transcripts</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Analytics */}
      <SearchAnalytics onSearch={handleSearch} searchType={searchType} />
    </div>
  )
}
