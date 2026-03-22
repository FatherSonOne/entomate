import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Search as SearchIcon, MessageSquare, FolderKanban, CheckSquare,
  FileText, Loader2, Send, Sparkles, Clock, Bookmark, BookmarkPlus,
  X, ChevronDown, ChevronUp, History, RefreshCw, BarChart3, TrendingUp,
  AlertCircle, Zap, Target, Mic, Flame, Download
} from 'lucide-react'
import { searchApi } from '../services/api'
import { VCButton, VCBadge } from '../components/vc'

export default function Search() {
  // Search state
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [searchType, setSearchType] = useState('semantic') // 'semantic' or 'keyword'
  const [executionTime, setExecutionTime] = useState(null)

  // Ask AI state
  const [askQuestion, setAskQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [askingQuestion, setAskingQuestion] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const messagesEndRef = useRef(null)

  // History & saved searches
  const [searchHistory, setSearchHistory] = useState([])
  const [savedSearches, setSavedSearches] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveName, setSaveName] = useState('')

  // Analytics state
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsPeriod, setAnalyticsPeriod] = useState('7d')

  // Autocomplete state
  const [suggestions, setSuggestions] = useState([])
  const [trending, setTrending] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const searchInputRef = useRef(null)
  const suggestionsRef = useRef(null)

  // Export state
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState(null) // 'csv' or 'json'

  // Load history and saved searches on mount
  useEffect(() => {
    loadSearchHistory()
    loadSavedSearches()
    loadTrending()
  }, [])

  // Load trending topics
  const loadTrending = async () => {
    try {
      const data = await searchApi.getSuggestions('', true)
      setTrending(data.trending || [])
    } catch (error) {
      console.error('Failed to load trending:', error)
    }
  }

  // Debounced autocomplete
  const debounceTimeout = useRef(null)
  const loadSuggestions = useCallback(async (prefix) => {
    if (!prefix || prefix.length < 2) {
      setSuggestions([])
      return
    }

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

  // Handle query change with debounce
  const handleQueryChange = (e) => {
    const value = e.target.value
    setQuery(value)
    setSelectedSuggestionIndex(-1)

    // Debounce suggestions loading
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current)
    }

    if (value.length >= 2) {
      debounceTimeout.current = setTimeout(() => {
        loadSuggestions(value)
      }, 200)
      setShowSuggestions(true)
    } else {
      setSuggestions([])
      setShowSuggestions(value.length > 0)
    }
  }

  // Handle keyboard navigation in suggestions
  const handleKeyDown = (e) => {
    const allSuggestions = [...suggestions, ...(query.length < 2 ? trending : [])]

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev =>
        prev < allSuggestions.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1)
    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
      e.preventDefault()
      const selected = allSuggestions[selectedSuggestionIndex]
      if (selected) {
        selectSuggestion(selected.text)
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setSelectedSuggestionIndex(-1)
    }
  }

  // Select a suggestion
  const selectSuggestion = (text) => {
    setQuery(text)
    setShowSuggestions(false)
    setSuggestions([])
    setSelectedSuggestionIndex(-1)
    // Trigger search
    handleSearch(null, text, searchType)
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

  const loadAnalytics = async (period = analyticsPeriod) => {
    try {
      setAnalyticsLoading(true)
      const data = await searchApi.getAnalytics(period)
      setAnalytics(data.analytics)
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  // Load analytics when panel is opened or period changes
  useEffect(() => {
    if (showAnalytics) {
      loadAnalytics(analyticsPeriod)
    }
  }, [showAnalytics, analyticsPeriod])

  const handleSearch = async (e, searchQuery = query, type = searchType) => {
    e?.preventDefault()
    if (!searchQuery.trim()) return

    try {
      setLoading(true)
      setHasSearched(true)
      setQuery(searchQuery)

      let data
      if (type === 'semantic') {
        data = await searchApi.semantic({ query: searchQuery, limit: 20 })
      } else {
        data = await searchApi.search({
          query: searchQuery,
          types: ['meetings', 'projects', 'tasks', 'action_items'],
          limit: 30
        })
      }

      setResults(data.results || [])
      setExecutionTime(data.executionTime)
      loadSearchHistory() // Refresh history
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  // Streaming state
  const [streamingContent, setStreamingContent] = useState('')
  const [useStreaming, setUseStreaming] = useState(true) // Toggle for streaming

  const handleAskQuestion = async (e) => {
    e.preventDefault()
    if (!askQuestion.trim()) return

    const userMessage = {
      role: 'user',
      content: askQuestion,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    const currentQuestion = askQuestion
    setAskQuestion('')

    try {
      setAskingQuestion(true)

      if (useStreaming) {
        // Use streaming for typing effect
        setStreamingContent('')
        let streamedCitations = []
        let streamedFollowUp = []

        await searchApi.askStream(
          { question: currentQuestion, conversationId },
          {
            onChunk: (chunk) => {
              setStreamingContent(prev => prev + chunk)
            },
            onCitations: (citations) => {
              streamedCitations = citations
            },
            onFollowUp: (suggestions) => {
              streamedFollowUp = suggestions
            },
            onComplete: (result) => {
              if (result.conversationId) {
                setConversationId(result.conversationId)
              }

              const assistantMessage = {
                role: 'assistant',
                content: result.answer,
                citations: streamedCitations,
                followUp: streamedFollowUp,
                confidence: result.confidence,
                timestamp: new Date()
              }
              setMessages(prev => [...prev, assistantMessage])
              setStreamingContent('')
              setAskingQuestion(false)
            },
            onError: (error) => {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Sorry, I encountered an error: ${error.message}`,
                timestamp: new Date()
              }])
              setStreamingContent('')
              setAskingQuestion(false)
            }
          }
        )
      } else {
        // Non-streaming fallback
        const data = conversationId
          ? await searchApi.askFollowUp({ question: currentQuestion, conversationId })
          : await searchApi.ask({ question: currentQuestion })

        if (data.conversationId) {
          setConversationId(data.conversationId)
        }

        const assistantMessage = {
          role: 'assistant',
          content: data.answer,
          citations: data.citations,
          followUp: data.followUpSuggestions,
          confidence: data.confidence,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
        setAskingQuestion(false)
      }
    } catch (error) {
      console.error('Question failed:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date()
      }])
      setAskingQuestion(false)
    }
  }

  const handleSaveSearch = async () => {
    if (!saveName.trim() || !query.trim()) return

    try {
      await searchApi.saveSearch({
        name: saveName,
        query: query,
        searchType: searchType
      })
      setSaveModalOpen(false)
      setSaveName('')
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

  const clearConversation = () => {
    setMessages([])
    setConversationId(null)
  }

  // Export search results
  const handleExport = async (format) => {
    if (results.length === 0) return

    try {
      setExporting(true)
      setExportFormat(format)

      const response = await searchApi.exportResults(results, format, query, searchType)

      // Create blob and download
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

  const getTypeIcon = (type) => {
    switch (type) {
      case 'meeting': return <MessageSquare className="w-5 h-5" style={{ color: 'var(--accent-tertiary)' }} />
      case 'project': return <FolderKanban className="w-5 h-5" style={{ color: 'var(--accent-secondary)' }} />
      case 'task': return <CheckSquare className="w-5 h-5" style={{ color: 'var(--accent-secondary)' }} />
      case 'action_item': return <FileText className="w-5 h-5" style={{ color: 'var(--accent-tertiary)' }} />
      default: return <SearchIcon className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
    }
  }

  const getTypeLink = (result) => {
    switch (result.type) {
      case 'meeting': return `/meetings/${result.id}`
      case 'project': return `/projects/${result.id}`
      case 'task': return `/tasks`
      default: return '#'
    }
  }

  const getResultBadgeColor = (type) => {
    switch (type) {
      case 'meeting': return 'amber'
      case 'project': return 'mint'
      case 'task': return 'mint'
      case 'action_item': return 'amber'
      default: return 'neutral'
    }
  }

  const getSentimentBadgeColor = (sentiment) => {
    if (sentiment === 'positive') return 'mint'
    if (sentiment === 'negative') return 'crimson'
    return 'neutral'
  }

  const getPriorityBadgeColor = (priority) => {
    if (priority === 'high') return 'crimson'
    if (priority === 'medium') return 'amber'
    return 'mint'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
        >
          AI Search &amp; Assistant
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Find anything using semantic search or ask AI questions about your meetings
        </p>
      </div>

      {/* Search form */}
      <div className="vc p-5">
        <form onSubmit={handleSearch}>
          <div className="relative">
            {searchType === 'semantic' ? (
              <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10" style={{ color: 'var(--accent-primary)' }} />
            ) : (
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10" style={{ color: 'var(--text-tertiary)' }} />
            )}
            <input
              ref={searchInputRef}
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
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                className="input py-1.5 px-2 text-sm border-0"
                style={{ background: 'rgba(248,240,242,0.06)' }}
              >
                <option value="semantic">Semantic</option>
                <option value="keyword">Keyword</option>
              </select>
              <VCButton
                type="submit"
                variant="primary"
                disabled={loading || !query.trim()}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Search'
                )}
              </VCButton>
            </div>

            {/* Autocomplete dropdown */}
            {showSuggestions && (suggestions.length > 0 || (query.length < 2 && trending.length > 0)) && (
              <div
                ref={suggestionsRef}
                className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-50 overflow-hidden"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid rgba(248,240,242,.1)',
                }}
              >
                {/* Trending topics (shown when no query or short query) */}
                {query.length < 2 && trending.length > 0 && (
                  <div className="p-2" style={{ borderBottom: '1px solid rgba(248,240,242,.06)' }}>
                    <div
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium uppercase"
                      style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
                    >
                      <Flame className="w-3 h-3" style={{ color: 'var(--accent-tertiary)' }} />
                      Trending Searches
                    </div>
                    {trending.map((item, idx) => (
                      <button
                        key={`trending-${idx}`}
                        type="button"
                        className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors"
                        style={
                          selectedSuggestionIndex === suggestions.length + idx
                            ? { background: 'rgba(255,45,107,0.08)', color: 'var(--text-primary)' }
                            : { color: 'var(--text-secondary)' }
                        }
                        onClick={() => selectSuggestion(item.text)}
                        onMouseEnter={() => setSelectedSuggestionIndex(suggestions.length + idx)}
                      >
                        <TrendingUp className="w-4 h-4" style={{ color: 'var(--accent-tertiary)' }} />
                        <span className="flex-1 truncate">{item.text}</span>
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{item.count}x</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Search suggestions */}
                {suggestions.length > 0 && (
                  <div className="p-2">
                    {query.length >= 2 && (
                      <div
                        className="px-2 py-1 text-xs font-medium uppercase flex items-center gap-1"
                        style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
                      >
                        {loadingSuggestions ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <SearchIcon className="w-3 h-3" />
                        )}
                        Suggestions
                      </div>
                    )}
                    {suggestions.map((item, idx) => {
                      const Icon = item.type === 'meeting' ? Mic :
                                   item.type === 'project' ? FolderKanban :
                                   item.type === 'recent' ? Clock : SearchIcon
                      const iconColor = item.type === 'meeting' ? 'var(--accent-tertiary)' :
                                        item.type === 'project' ? 'var(--accent-secondary)' :
                                        'var(--text-tertiary)'

                      return (
                        <button
                          key={`suggestion-${idx}`}
                          type="button"
                          className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors"
                          style={
                            selectedSuggestionIndex === idx
                              ? { background: 'rgba(255,45,107,0.08)', color: 'var(--text-primary)' }
                              : { color: 'var(--text-secondary)' }
                          }
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

                {/* Empty state */}
                {query.length >= 2 && suggestions.length === 0 && !loadingSuggestions && (
                  <div className="p-4 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    No suggestions found. Press Enter to search.
                  </div>
                )}

                {/* Keyboard hint */}
                <div
                  className="px-3 py-2 text-xs flex items-center gap-4"
                  style={{
                    borderTop: '1px solid rgba(248,240,242,.06)',
                    background: 'rgba(248,240,242,0.03)',
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <span className="flex items-center gap-1">
                    <kbd
                      className="px-1 py-0.5 rounded text-xs"
                      style={{ border: '1px solid rgba(248,240,242,.12)', background: 'rgba(248,240,242,0.06)' }}
                    >
                      ↑↓
                    </kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd
                      className="px-1 py-0.5 rounded text-xs"
                      style={{ border: '1px solid rgba(248,240,242,.12)', background: 'rgba(248,240,242,0.06)' }}
                    >
                      ↵
                    </kbd>
                    select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd
                      className="px-1 py-0.5 rounded text-xs"
                      style={{ border: '1px solid rgba(248,240,242,.12)', background: 'rgba(248,240,242,0.06)' }}
                    >
                      esc
                    </kbd>
                    close
                  </span>
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Search actions */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm flex items-center gap-1 transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              <History className="w-4 h-4" />
              Recent
              {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <button
              onClick={() => setShowSaved(!showSaved)}
              className="text-sm flex items-center gap-1 transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              <Bookmark className="w-4 h-4" />
              Saved
              {showSaved ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
          {query && (
            <button
              onClick={() => setSaveModalOpen(true)}
              className="text-sm flex items-center gap-1"
              style={{ color: 'var(--accent-primary)' }}
            >
              <BookmarkPlus className="w-4 h-4" />
              Save Search
            </button>
          )}
        </div>

        {/* Recent searches */}
        {showHistory && searchHistory.length > 0 && (
          <div
            className="mt-3 p-3 rounded-lg"
            style={{ background: 'rgba(248,240,242,0.04)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-xs font-medium uppercase"
                style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
              >
                Recent Searches
              </span>
              <button
                onClick={handleClearHistory}
                className="text-xs"
                style={{ color: 'var(--accent-primary)' }}
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {searchHistory.map((item, index) => (
                <button
                  key={index}
                  onClick={(e) => handleSearch(e, item.query, item.search_type)}
                  className="text-sm px-3 py-1 rounded-full flex items-center gap-1 transition-colors"
                  style={{
                    border: '1px solid rgba(248,240,242,.1)',
                    background: 'rgba(248,240,242,0.04)',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(248,240,242,.08)'
                    e.currentTarget.style.borderColor = 'rgba(255,45,107,0.3)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(248,240,242,0.04)'
                    e.currentTarget.style.borderColor = 'rgba(248,240,242,.1)'
                  }}
                >
                  <Clock className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                  {item.query}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Saved searches */}
        {showSaved && savedSearches.length > 0 && (
          <div
            className="mt-3 p-3 rounded-lg"
            style={{ background: 'rgba(248,240,242,0.04)' }}
          >
            <span
              className="text-xs font-medium uppercase block mb-2"
              style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
            >
              Saved Searches
            </span>
            <div className="flex flex-wrap gap-2">
              {savedSearches.map((item) => (
                <div
                  key={item.id}
                  className="text-sm px-3 py-1 rounded-full flex items-center gap-2"
                  style={{
                    border: '1px solid rgba(248,240,242,.1)',
                    background: 'rgba(248,240,242,0.04)',
                  }}
                >
                  <button
                    onClick={(e) => handleSearch(e, item.query, item.search_type)}
                    className="flex items-center gap-1 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                  >
                    <Bookmark className="w-3 h-3" style={{ color: 'var(--accent-primary)' }} />
                    {item.name}
                  </button>
                  <button
                    onClick={() => handleDeleteSavedSearch(item.id)}
                    className="transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Ask AI section */}
      <div className="vc">
        <div
          className="p-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(248,240,242,.08)' }}
        >
          <h3
            className="font-semibold flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <Sparkles className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            Ask AI About Your Meetings
          </h3>
          {messages.length > 0 && (
            <button
              onClick={clearConversation}
              className="text-sm flex items-center gap-1 transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              <RefreshCw className="w-4 h-4" />
              New Chat
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="max-h-96 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
              <p style={{ color: 'var(--text-tertiary)' }}>Ask me anything about your meetings!</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {[
                  "What did we discuss about budget?",
                  "Who owns the website project?",
                  "What decisions were made recently?"
                ].map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => setAskQuestion(suggestion)}
                    className="text-sm px-3 py-1.5 rounded-full transition-colors"
                    style={{
                      background: 'rgba(255,45,107,0.08)',
                      color: 'var(--accent-primary)',
                      border: '1px solid rgba(255,45,107,0.2)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,45,107,0.14)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,45,107,0.08)' }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className="max-w-[80%] rounded-lg p-3"
                    style={
                      msg.role === 'user'
                        ? { background: 'var(--accent-primary)', color: '#fff' }
                        : { background: 'rgba(248,240,242,0.06)', color: 'var(--text-primary)' }
                    }
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {msg.confidence !== undefined && (
                      <p
                        className="text-xs mt-2"
                        style={{
                          color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : 'var(--text-tertiary)',
                        }}
                      >
                        Confidence: {Math.round(msg.confidence * 100)}%
                      </p>
                    )}

                    {msg.citations && msg.citations.length > 0 && (
                      <div
                        className="mt-3 pt-2"
                        style={{ borderTop: '1px solid rgba(248,240,242,.1)' }}
                      >
                        <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Sources:</p>
                        <div className="flex flex-wrap gap-1">
                          {msg.citations.map((cite, cidx) => (
                            <Link
                              key={cidx}
                              to={`/meetings/${cite.id}`}
                              className="text-xs px-2 py-0.5 rounded hover:underline"
                              style={{
                                color: 'var(--accent-primary)',
                                background: 'rgba(255,45,107,0.08)',
                              }}
                            >
                              {cite.title}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.followUp && msg.followUp.length > 0 && (
                      <div
                        className="mt-3 pt-2"
                        style={{ borderTop: '1px solid rgba(248,240,242,.1)' }}
                      >
                        <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Follow-up:</p>
                        <div className="flex flex-wrap gap-1">
                          {msg.followUp.map((q, qidx) => (
                            <button
                              key={qidx}
                              onClick={() => setAskQuestion(q)}
                              className="text-xs px-2 py-0.5 rounded transition-colors"
                              style={{
                                background: 'rgba(248,240,242,0.06)',
                                color: 'var(--text-secondary)',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,240,242,0.1)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(248,240,242,0.06)' }}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {/* Show streaming content while typing */}
              {askingQuestion && streamingContent && (
                <div className="flex justify-start">
                  <div
                    className="max-w-[80%] rounded-lg p-3"
                    style={{ background: 'rgba(248,240,242,0.06)', color: 'var(--text-primary)' }}
                  >
                    <p className="whitespace-pre-wrap">
                      {streamingContent}
                      <span
                        className="inline-block w-2 h-4 animate-pulse ml-1"
                        style={{ background: 'var(--accent-primary)' }}
                      />
                    </p>
                  </div>
                </div>
              )}
              {/* Show loading spinner only when waiting for first chunk */}
              {askingQuestion && !streamingContent && (
                <div className="flex justify-start">
                  <div
                    className="rounded-lg p-3 flex items-center gap-2"
                    style={{ background: 'rgba(248,240,242,0.06)' }}
                  >
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                    <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4" style={{ borderTop: '1px solid rgba(248,240,242,.08)' }}>
          <form onSubmit={handleAskQuestion} className="flex gap-3">
            <input
              type="text"
              className="vinput flex-1"
              placeholder="Ask a question about your meetings..."
              value={askQuestion}
              onChange={(e) => setAskQuestion(e.target.value)}
              disabled={askingQuestion}
            />
            <VCButton
              type="submit"
              variant="primary"
              disabled={askingQuestion || !askQuestion.trim()}
            >
              {askingQuestion ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </VCButton>
          </form>
        </div>
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="vc">
          <div
            className="p-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(248,240,242,.08)' }}
          >
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {loading ? 'Searching...' : `${results.length} result${results.length !== 1 ? 's' : ''} found`}
              </h3>
              {executionTime && !loading && (
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Search completed in {executionTime}ms
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Export buttons */}
              {results.length > 0 && !loading && (
                <div className="flex items-center gap-1 mr-2">
                  <VCButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExport('csv')}
                    disabled={exporting}
                    title="Export as CSV"
                  >
                    {exporting && exportFormat === 'csv' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    CSV
                  </VCButton>
                  <VCButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExport('json')}
                    disabled={exporting}
                    title="Export as JSON"
                  >
                    {exporting && exportFormat === 'json' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    JSON
                  </VCButton>
                </div>
              )}
              <VCBadge color={searchType === 'semantic' ? 'crimson' : 'neutral'}>
                {searchType === 'semantic' ? 'Semantic Search' : 'Keyword Search'}
              </VCBadge>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="spinner mx-auto mb-4" />
              <p style={{ color: 'var(--text-tertiary)' }}>Searching...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center">
              <SearchIcon className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
              <h3 className="text-lg font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No results found</h3>
              <p style={{ color: 'var(--text-tertiary)' }}>Try a different search term or switch search type</p>
            </div>
          ) : (
            <div style={{ borderTop: '1px solid rgba(248,240,242,.04)' }}>
              {results.map((result, index) => (
                <Link
                  key={`${result.type}-${result.id}-${index}`}
                  to={getTypeLink(result)}
                  className="block p-4 transition-colors"
                  style={{ borderBottom: '1px solid rgba(248,240,242,.04)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,240,242,.04)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getTypeIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>{result.title}</h4>
                        <VCBadge color={getResultBadgeColor(result.type)}>
                          {result.type}
                        </VCBadge>
                        {result.similarity && (
                          <span className="text-xs font-bold" style={{ color: 'var(--accent-primary)' }}>
                            {Math.round(result.similarity * 100)}% match
                          </span>
                        )}
                      </div>
                      {result.preview && (
                        <p className="text-sm line-clamp-2 mt-1" style={{ color: 'var(--text-tertiary)' }}>
                          {result.preview}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs flex-wrap" style={{ color: 'var(--text-tertiary)' }}>
                        {result.metadata?.date && (
                          <span>{new Date(result.metadata.date).toLocaleDateString()}</span>
                        )}
                        {result.metadata?.status && (
                          <VCBadge color="neutral">{result.metadata.status}</VCBadge>
                        )}
                        {result.metadata?.sentiment && (
                          <VCBadge color={getSentimentBadgeColor(result.metadata.sentiment)}>
                            {result.metadata.sentiment}
                          </VCBadge>
                        )}
                        {result.metadata?.priority && (
                          <VCBadge color={getPriorityBadgeColor(result.metadata.priority)}>
                            {result.metadata.priority}
                          </VCBadge>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick tips (only show when no search) */}
      {!hasSearched && (
        <div className="vc p-5">
          <h3
            className="font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            Search Tips
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4
                className="text-sm font-medium mb-2 flex items-center gap-1"
                style={{ color: 'var(--accent-primary)' }}
              >
                <Sparkles className="w-4 h-4" /> Semantic Search
              </h4>
              <ul className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <li>Finds results by meaning, not just keywords</li>
                <li>Try: <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>"budget discussions"</span> to find all finance-related meetings</li>
                <li>Try: <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>"project delays"</span> to find meetings about timeline issues</li>
              </ul>
            </div>
            <div>
              <h4
                className="text-sm font-medium mb-2 flex items-center gap-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                <SearchIcon className="w-4 h-4" /> Keyword Search
              </h4>
              <ul className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <li>Exact match search across all content</li>
                <li>Best for specific names, project codes, or phrases</li>
                <li>Searches meeting titles, summaries, and transcripts</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Search Analytics Dashboard */}
      <div className="vc">
        <button
          onClick={() => setShowAnalytics(!showAnalytics)}
          className="w-full p-4 flex items-center justify-between text-left transition-colors"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,240,242,.03)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Search Analytics</span>
          </div>
          {showAnalytics
            ? <ChevronUp className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
            : <ChevronDown className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
          }
        </button>

        {showAnalytics && (
          <div className="p-4" style={{ borderTop: '1px solid rgba(248,240,242,.08)' }}>
            {/* Period selector */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                {[
                  { value: '24h', label: '24 Hours' },
                  { value: '7d', label: '7 Days' },
                  { value: '30d', label: '30 Days' },
                  { value: 'all', label: 'All Time' }
                ].map(period => (
                  <button
                    key={period.value}
                    onClick={() => setAnalyticsPeriod(period.value)}
                    className="px-3 py-1.5 text-sm rounded-lg transition-colors"
                    style={
                      analyticsPeriod === period.value
                        ? { background: 'rgba(255,45,107,0.12)', color: 'var(--accent-primary)' }
                        : { background: 'rgba(248,240,242,0.05)', color: 'var(--text-secondary)' }
                    }
                  >
                    {period.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => loadAnalytics(analyticsPeriod)}
                disabled={analyticsLoading}
                className="text-sm flex items-center gap-1 transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
              >
                <RefreshCw className={`w-4 h-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {analyticsLoading ? (
              <div className="py-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: 'var(--accent-primary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading analytics...</p>
              </div>
            ) : analytics ? (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div
                    className="rounded-lg p-4"
                    style={{ background: 'rgba(255,45,107,0.08)', border: '1px solid rgba(255,45,107,0.15)' }}
                  >
                    <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--accent-primary)' }}>
                      <SearchIcon className="w-4 h-4" />
                      <span
                        className="text-xs font-medium uppercase"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        Total Searches
                      </span>
                    </div>
                    <p
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: 24,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {analytics.totalSearches || 0}
                    </p>
                  </div>

                  <div
                    className="rounded-lg p-4"
                    style={{ background: 'rgba(0,245,212,0.07)', border: '1px solid rgba(0,245,212,0.15)' }}
                  >
                    <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--accent-secondary)' }}>
                      <Target className="w-4 h-4" />
                      <span
                        className="text-xs font-medium uppercase"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        Success Rate
                      </span>
                    </div>
                    <p
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: 24,
                        color: 'var(--accent-secondary)',
                      }}
                    >
                      {analytics.successRate || 0}%
                    </p>
                  </div>

                  <div
                    className="rounded-lg p-4"
                    style={{ background: 'rgba(0,245,212,0.05)', border: '1px solid rgba(0,245,212,0.1)' }}
                  >
                    <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--accent-secondary)' }}>
                      <Zap className="w-4 h-4" />
                      <span
                        className="text-xs font-medium uppercase"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        Avg. Speed
                      </span>
                    </div>
                    <p
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: 24,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {analytics.avgExecutionTime || 0}ms
                    </p>
                  </div>

                  <div
                    className="rounded-lg p-4"
                    style={{ background: 'rgba(255,184,0,0.07)', border: '1px solid rgba(255,184,0,0.15)' }}
                  >
                    <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--accent-tertiary)' }}>
                      <TrendingUp className="w-4 h-4" />
                      <span
                        className="text-xs font-medium uppercase"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        Avg. Results
                      </span>
                    </div>
                    <p
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: 24,
                        color: 'var(--accent-tertiary)',
                      }}
                    >
                      {analytics.avgResultsPerSearch || 0}
                    </p>
                  </div>
                </div>

                {/* Charts Row */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Search Types */}
                  <div
                    className="rounded-lg p-4"
                    style={{ background: 'rgba(248,240,242,0.04)' }}
                  >
                    <h4
                      className="text-sm font-medium mb-3"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Searches by Type
                    </h4>
                    {analytics.searchesByType && analytics.searchesByType.length > 0 ? (
                      <div className="space-y-2">
                        {analytics.searchesByType.map(item => {
                          const total = analytics.totalSearches || 1
                          const percentage = Math.round((item.count / total) * 100)
                          return (
                            <div key={item.type} className="flex items-center gap-3">
                              <span
                                className="text-sm capitalize w-20"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {item.type}
                              </span>
                              <div
                                className="flex-1 rounded-full h-2"
                                style={{ background: 'rgba(248,240,242,0.08)' }}
                              >
                                <div
                                  className="h-2 rounded-full"
                                  style={{
                                    width: `${percentage}%`,
                                    background: item.type === 'semantic'
                                      ? 'var(--accent-primary)'
                                      : 'rgba(248,240,242,0.3)',
                                  }}
                                />
                              </div>
                              <span
                                className="text-sm w-16 text-right"
                                style={{ color: 'var(--text-tertiary)' }}
                              >
                                {item.count} ({percentage}%)
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No data yet</p>
                    )}
                  </div>

                  {/* Daily Trend */}
                  <div
                    className="rounded-lg p-4"
                    style={{ background: 'rgba(248,240,242,0.04)' }}
                  >
                    <h4
                      className="text-sm font-medium mb-3"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Daily Trend
                    </h4>
                    {analytics.dailyTrend && analytics.dailyTrend.length > 0 ? (
                      <div className="flex items-end gap-1 h-20">
                        {analytics.dailyTrend.map((day, idx) => {
                          const maxCount = Math.max(...analytics.dailyTrend.map(d => d.count), 1)
                          const height = (day.count / maxCount) * 100
                          return (
                            <div
                              key={idx}
                              className="flex-1 rounded-t cursor-default group relative transition-opacity"
                              style={{
                                height: `${Math.max(height, 5)}%`,
                                background: 'var(--accent-primary)',
                                opacity: 0.6,
                              }}
                              title={`${new Date(day.date).toLocaleDateString()}: ${day.count} searches`}
                              onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = '0.6' }}
                            >
                              <div
                                className="absolute -top-6 left-1/2 -translate-x-1/2 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10"
                                style={{ background: 'rgba(16,16,16,0.95)', border: '1px solid rgba(248,240,242,.1)' }}
                              >
                                {day.count}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No data yet</p>
                    )}
                  </div>
                </div>

                {/* Top Queries & Zero Results */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Top Queries */}
                  <div
                    className="rounded-lg p-4"
                    style={{ background: 'rgba(248,240,242,0.04)' }}
                  >
                    <h4
                      className="text-sm font-medium mb-3 flex items-center gap-2"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <TrendingUp className="w-4 h-4" style={{ color: 'var(--accent-secondary)' }} />
                      Top Searches
                    </h4>
                    {analytics.topQueries && analytics.topQueries.length > 0 ? (
                      <div className="space-y-2">
                        {analytics.topQueries.slice(0, 5).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <button
                              onClick={(e) => handleSearch(e, item.query, searchType)}
                              className="text-sm truncate max-w-[200px] transition-colors text-left"
                              style={{ color: 'var(--text-secondary)' }}
                              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-primary)' }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                            >
                              {item.query}
                            </button>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: 'rgba(248,240,242,0.06)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {item.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No searches yet</p>
                    )}
                  </div>

                  {/* Zero Result Queries */}
                  <div
                    className="rounded-lg p-4"
                    style={{ background: 'rgba(248,240,242,0.04)' }}
                  >
                    <h4
                      className="text-sm font-medium mb-3 flex items-center gap-2"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <AlertCircle className="w-4 h-4" style={{ color: 'var(--accent-tertiary)' }} />
                      Zero Results
                    </h4>
                    {analytics.zeroResultQueries && analytics.zeroResultQueries.length > 0 ? (
                      <div className="space-y-2">
                        {analytics.zeroResultQueries.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <span
                              className="text-sm truncate max-w-[200px]"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {item.query}
                            </span>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: 'rgba(255,184,0,0.1)',
                                color: 'var(--accent-tertiary)',
                              }}
                            >
                              {item.count}x
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--accent-secondary)' }}>
                        All searches found results
                      </p>
                    )}
                  </div>
                </div>

                {/* Peak Hour */}
                {analytics.peakHour !== undefined && analytics.totalSearches > 0 && (
                  <div
                    className="rounded-lg p-3 flex items-center gap-3"
                    style={{ background: 'rgba(0,245,212,0.06)', border: '1px solid rgba(0,245,212,0.15)' }}
                  >
                    <Clock className="w-5 h-5" style={{ color: 'var(--accent-secondary)' }} />
                    <span className="text-sm" style={{ color: 'var(--accent-secondary)' }}>
                      Peak search activity: <strong>{analytics.peakHour}:00 - {analytics.peakHour + 1}:00</strong>
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                <p style={{ color: 'var(--text-tertiary)' }}>No analytics data available</p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Start searching to see your analytics</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save search modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div
            className="rounded-lg p-6 w-full max-w-md"
            style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(248,240,242,.1)' }}
          >
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
            >
              Save Search
            </h3>
            <input
              type="text"
              className="vinput w-full mb-4"
              placeholder="Name this search..."
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              autoFocus
            />
            <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>
              Query: "{query}" ({searchType} search)
            </p>
            <div className="flex gap-3 justify-end">
              <VCButton
                variant="ghost"
                onClick={() => { setSaveModalOpen(false); setSaveName('') }}
              >
                Cancel
              </VCButton>
              <VCButton
                variant="primary"
                onClick={handleSaveSearch}
                disabled={!saveName.trim()}
              >
                Save
              </VCButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
