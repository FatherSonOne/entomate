import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Search as SearchIcon, MessageSquare, FolderKanban, CheckSquare,
  FileText, Loader2, Send, Sparkles, Clock, Bookmark, BookmarkPlus,
  X, ChevronDown, ChevronUp, History, RefreshCw, BarChart3, TrendingUp,
  AlertCircle, Zap, Target, Mic, Flame, Download
} from 'lucide-react'
import { searchApi } from '../services/api'

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
      case 'meeting': return <MessageSquare className="w-5 h-5 text-purple-600" />
      case 'project': return <FolderKanban className="w-5 h-5 text-blue-600" />
      case 'task': return <CheckSquare className="w-5 h-5 text-green-600" />
      case 'action_item': return <FileText className="w-5 h-5 text-orange-600" />
      default: return <SearchIcon className="w-5 h-5 text-gray-600" />
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Search & Assistant</h1>
        <p className="text-gray-600">Find anything using semantic search or ask AI questions about your meetings</p>
      </div>

      {/* Search form */}
      <div className="card p-5">
        <form onSubmit={handleSearch}>
          <div className="relative">
            {searchType === 'semantic' ? (
              <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-500 z-10" />
            ) : (
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
            )}
            <input
              ref={searchInputRef}
              type="text"
              className="input pl-12 pr-40 py-3 text-lg"
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
                className="input py-1.5 px-2 text-sm bg-gray-100 border-0"
              >
                <option value="semantic">Semantic</option>
                <option value="keyword">Keyword</option>
              </select>
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="btn btn-primary"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Search'
                )}
              </button>
            </div>

            {/* Autocomplete dropdown */}
            {showSuggestions && (suggestions.length > 0 || (query.length < 2 && trending.length > 0)) && (
              <div
                ref={suggestionsRef}
                className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden"
              >
                {/* Trending topics (shown when no query or short query) */}
                {query.length < 2 && trending.length > 0 && (
                  <div className="p-2 border-b border-gray-100">
                    <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 uppercase">
                      <Flame className="w-3 h-3 text-orange-500" />
                      Trending Searches
                    </div>
                    {trending.map((item, idx) => (
                      <button
                        key={`trending-${idx}`}
                        type="button"
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors ${
                          selectedSuggestionIndex === suggestions.length + idx
                            ? 'bg-primary-50 text-primary-900'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => selectSuggestion(item.text)}
                        onMouseEnter={() => setSelectedSuggestionIndex(suggestions.length + idx)}
                      >
                        <TrendingUp className="w-4 h-4 text-orange-500" />
                        <span className="flex-1 truncate">{item.text}</span>
                        <span className="text-xs text-gray-400">{item.count}x</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Search suggestions */}
                {suggestions.length > 0 && (
                  <div className="p-2">
                    {query.length >= 2 && (
                      <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
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
                      const iconColor = item.type === 'meeting' ? 'text-purple-500' :
                                        item.type === 'project' ? 'text-blue-500' :
                                        item.type === 'recent' ? 'text-gray-400' : 'text-gray-400'

                      return (
                        <button
                          key={`suggestion-${idx}`}
                          type="button"
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors ${
                            selectedSuggestionIndex === idx
                              ? 'bg-primary-50 text-primary-900'
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => selectSuggestion(item.text)}
                          onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                        >
                          <Icon className={`w-4 h-4 ${iconColor}`} />
                          <span className="flex-1 truncate">{item.text}</span>
                          <span className="text-xs text-gray-400 capitalize">{item.type}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Empty state */}
                {query.length >= 2 && suggestions.length === 0 && !loadingSuggestions && (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No suggestions found. Press Enter to search.
                  </div>
                )}

                {/* Keyboard hint */}
                <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-white border border-gray-200 rounded">↑↓</kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-white border border-gray-200 rounded">↵</kbd>
                    select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-white border border-gray-200 rounded">esc</kbd>
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
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <History className="w-4 h-4" />
              Recent
              {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <button
              onClick={() => setShowSaved(!showSaved)}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <Bookmark className="w-4 h-4" />
              Saved
              {showSaved ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
          {query && (
            <button
              onClick={() => setSaveModalOpen(true)}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <BookmarkPlus className="w-4 h-4" />
              Save Search
            </button>
          )}
        </div>

        {/* Recent searches */}
        {showHistory && searchHistory.length > 0 && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">Recent Searches</span>
              <button
                onClick={handleClearHistory}
                className="text-xs text-red-500 hover:text-red-600"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {searchHistory.map((item, index) => (
                <button
                  key={index}
                  onClick={(e) => handleSearch(e, item.query, item.search_type)}
                  className="text-sm px-3 py-1 bg-white rounded-full border border-gray-200 hover:border-primary-300 hover:bg-primary-50 flex items-center gap-1"
                >
                  <Clock className="w-3 h-3 text-gray-400" />
                  {item.query}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Saved searches */}
        {showSaved && savedSearches.length > 0 && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-xs font-medium text-gray-500 block mb-2">Saved Searches</span>
            <div className="flex flex-wrap gap-2">
              {savedSearches.map((item) => (
                <div
                  key={item.id}
                  className="text-sm px-3 py-1 bg-white rounded-full border border-gray-200 flex items-center gap-2"
                >
                  <button
                    onClick={(e) => handleSearch(e, item.query, item.search_type)}
                    className="flex items-center gap-1 hover:text-primary-600"
                  >
                    <Bookmark className="w-3 h-3 text-primary-500" />
                    {item.name}
                  </button>
                  <button
                    onClick={() => handleDeleteSavedSearch(item.id)}
                    className="text-gray-400 hover:text-red-500"
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
      <div className="card">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary-500" />
            Ask AI About Your Meetings
          </h3>
          {messages.length > 0 && (
            <button
              onClick={clearConversation}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
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
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Ask me anything about your meetings!</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {[
                  "What did we discuss about budget?",
                  "Who owns the website project?",
                  "What decisions were made recently?"
                ].map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => setAskQuestion(suggestion)}
                    className="text-sm px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full hover:bg-primary-100"
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
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === 'user'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {msg.confidence !== undefined && (
                      <p className={`text-xs mt-2 ${msg.role === 'user' ? 'text-primary-200' : 'text-gray-500'}`}>
                        Confidence: {Math.round(msg.confidence * 100)}%
                      </p>
                    )}

                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Sources:</p>
                        <div className="flex flex-wrap gap-1">
                          {msg.citations.map((cite, cidx) => (
                            <Link
                              key={cidx}
                              to={`/meetings/${cite.id}`}
                              className="text-xs text-primary-600 hover:underline bg-white px-2 py-0.5 rounded"
                            >
                              {cite.title}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.followUp && msg.followUp.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Follow-up:</p>
                        <div className="flex flex-wrap gap-1">
                          {msg.followUp.map((q, qidx) => (
                            <button
                              key={qidx}
                              onClick={() => setAskQuestion(q)}
                              className="text-xs bg-white text-gray-700 px-2 py-0.5 rounded hover:bg-gray-50"
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
                  <div className="max-w-[80%] rounded-lg p-3 bg-gray-100 text-gray-900">
                    <p className="whitespace-pre-wrap">{streamingContent}<span className="inline-block w-2 h-4 bg-primary-500 animate-pulse ml-1"></span></p>
                  </div>
                </div>
              )}
              {/* Show loading spinner only when waiting for first chunk */}
              {askingQuestion && !streamingContent && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-3 flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                    <span className="text-sm text-gray-500">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200">
          <form onSubmit={handleAskQuestion} className="flex gap-3">
            <input
              type="text"
              className="input flex-1"
              placeholder="Ask a question about your meetings..."
              value={askQuestion}
              onChange={(e) => setAskQuestion(e.target.value)}
              disabled={askingQuestion}
            />
            <button
              type="submit"
              disabled={askingQuestion || !askQuestion.trim()}
              className="btn btn-primary"
            >
              {askingQuestion ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="card">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">
                {loading ? 'Searching...' : `${results.length} result${results.length !== 1 ? 's' : ''} found`}
              </h3>
              {executionTime && !loading && (
                <p className="text-xs text-gray-500">Search completed in {executionTime}ms</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Export buttons */}
              {results.length > 0 && !loading && (
                <div className="flex items-center gap-1 mr-2">
                  <button
                    onClick={() => handleExport('csv')}
                    disabled={exporting}
                    className="btn btn-secondary text-xs py-1 px-2 flex items-center gap-1"
                    title="Export as CSV"
                  >
                    {exporting && exportFormat === 'csv' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    CSV
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    disabled={exporting}
                    className="btn btn-secondary text-xs py-1 px-2 flex items-center gap-1"
                    title="Export as JSON"
                  >
                    {exporting && exportFormat === 'json' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    JSON
                  </button>
                </div>
              )}
              <span className={`badge ${searchType === 'semantic' ? 'badge-primary' : 'badge-gray'}`}>
                {searchType === 'semantic' ? 'Semantic Search' : 'Keyword Search'}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="spinner mx-auto mb-4" />
              <p className="text-gray-500">Searching...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center">
              <SearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No results found</h3>
              <p className="text-gray-500">Try a different search term or switch search type</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {results.map((result, index) => (
                <Link
                  key={`${result.type}-${result.id}-${index}`}
                  to={getTypeLink(result)}
                  className="block p-4 hover:bg-gray-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getTypeIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">{result.title}</h4>
                        <span className="badge badge-gray text-xs">{result.type}</span>
                        {result.similarity && (
                          <span className="text-xs text-primary-600">
                            {Math.round(result.similarity * 100)}% match
                          </span>
                        )}
                      </div>
                      {result.preview && (
                        <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                          {result.preview}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        {result.metadata?.date && (
                          <span>{new Date(result.metadata.date).toLocaleDateString()}</span>
                        )}
                        {result.metadata?.status && (
                          <span className="badge badge-gray">{result.metadata.status}</span>
                        )}
                        {result.metadata?.sentiment && (
                          <span className={`badge ${
                            result.metadata.sentiment === 'positive' ? 'badge-success' :
                            result.metadata.sentiment === 'negative' ? 'badge-error' :
                            'badge-gray'
                          }`}>
                            {result.metadata.sentiment}
                          </span>
                        )}
                        {result.metadata?.priority && (
                          <span className={`badge ${
                            result.metadata.priority === 'high' ? 'badge-error' :
                            result.metadata.priority === 'medium' ? 'badge-warning' :
                            'badge-success'
                          }`}>
                            {result.metadata.priority}
                          </span>
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
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Search Tips</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-primary-600 mb-2 flex items-center gap-1">
                <Sparkles className="w-4 h-4" /> Semantic Search
              </h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>Finds results by meaning, not just keywords</li>
                <li>Try: "budget discussions" to find all finance-related meetings</li>
                <li>Try: "project delays" to find meetings about timeline issues</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                <SearchIcon className="w-4 h-4" /> Keyword Search
              </h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>Exact match search across all content</li>
                <li>Best for specific names, project codes, or phrases</li>
                <li>Searches meeting titles, summaries, and transcripts</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Search Analytics Dashboard */}
      <div className="card">
        <button
          onClick={() => setShowAnalytics(!showAnalytics)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-500" />
            <span className="font-semibold text-gray-900">Search Analytics</span>
          </div>
          {showAnalytics ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>

        {showAnalytics && (
          <div className="p-4 border-t border-gray-200">
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
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      analyticsPeriod === period.value
                        ? 'bg-primary-100 text-primary-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => loadAnalytics(analyticsPeriod)}
                disabled={analyticsLoading}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <RefreshCw className={`w-4 h-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {analyticsLoading ? (
              <div className="py-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Loading analytics...</p>
              </div>
            ) : analytics ? (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-primary-600 mb-1">
                      <SearchIcon className="w-4 h-4" />
                      <span className="text-xs font-medium">Total Searches</span>
                    </div>
                    <p className="text-2xl font-bold text-primary-900">{analytics.totalSearches || 0}</p>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-600 mb-1">
                      <Target className="w-4 h-4" />
                      <span className="text-xs font-medium">Success Rate</span>
                    </div>
                    <p className="text-2xl font-bold text-green-900">{analytics.successRate || 0}%</p>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-blue-600 mb-1">
                      <Zap className="w-4 h-4" />
                      <span className="text-xs font-medium">Avg. Speed</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-900">{analytics.avgExecutionTime || 0}ms</p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-purple-600 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs font-medium">Avg. Results</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-900">{analytics.avgResultsPerSearch || 0}</p>
                  </div>
                </div>

                {/* Charts Row */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Search Types */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Searches by Type</h4>
                    {analytics.searchesByType && analytics.searchesByType.length > 0 ? (
                      <div className="space-y-2">
                        {analytics.searchesByType.map(item => {
                          const total = analytics.totalSearches || 1
                          const percentage = Math.round((item.count / total) * 100)
                          return (
                            <div key={item.type} className="flex items-center gap-3">
                              <span className="text-sm text-gray-600 w-20 capitalize">{item.type}</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    item.type === 'semantic' ? 'bg-primary-500' : 'bg-gray-500'
                                  }`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-500 w-16 text-right">{item.count} ({percentage}%)</span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No data yet</p>
                    )}
                  </div>

                  {/* Daily Trend */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Daily Trend</h4>
                    {analytics.dailyTrend && analytics.dailyTrend.length > 0 ? (
                      <div className="flex items-end gap-1 h-20">
                        {analytics.dailyTrend.map((day, idx) => {
                          const maxCount = Math.max(...analytics.dailyTrend.map(d => d.count), 1)
                          const height = (day.count / maxCount) * 100
                          return (
                            <div
                              key={idx}
                              className="flex-1 bg-primary-400 rounded-t hover:bg-primary-500 transition-colors cursor-default group relative"
                              style={{ height: `${Math.max(height, 5)}%` }}
                              title={`${new Date(day.date).toLocaleDateString()}: ${day.count} searches`}
                            >
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                                {day.count}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No data yet</p>
                    )}
                  </div>
                </div>

                {/* Top Queries & Zero Results */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Top Queries */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      Top Searches
                    </h4>
                    {analytics.topQueries && analytics.topQueries.length > 0 ? (
                      <div className="space-y-2">
                        {analytics.topQueries.slice(0, 5).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <button
                              onClick={(e) => handleSearch(e, item.query, searchType)}
                              className="text-sm text-gray-700 hover:text-primary-600 truncate max-w-[200px]"
                            >
                              {item.query}
                            </button>
                            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                              {item.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No searches yet</p>
                    )}
                  </div>

                  {/* Zero Result Queries */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                      Zero Results
                    </h4>
                    {analytics.zeroResultQueries && analytics.zeroResultQueries.length > 0 ? (
                      <div className="space-y-2">
                        {analytics.zeroResultQueries.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 truncate max-w-[200px]">
                              {item.query}
                            </span>
                            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                              {item.count}x
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <span className="text-green-500">All searches found results</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Peak Hour */}
                {analytics.peakHour !== undefined && analytics.totalSearches > 0 && (
                  <div className="bg-blue-50 rounded-lg p-3 flex items-center gap-3">
                    <Clock className="w-5 h-5 text-blue-500" />
                    <span className="text-sm text-blue-700">
                      Peak search activity: <strong>{analytics.peakHour}:00 - {analytics.peakHour + 1}:00</strong>
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center">
                <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No analytics data available</p>
                <p className="text-sm text-gray-400">Start searching to see your analytics</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save search modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Save Search</h3>
            <input
              type="text"
              className="input w-full mb-4"
              placeholder="Name this search..."
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              autoFocus
            />
            <p className="text-sm text-gray-500 mb-4">
              Query: "{query}" ({searchType} search)
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setSaveModalOpen(false); setSaveName('') }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSearch}
                disabled={!saveName.trim()}
                className="btn btn-primary"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
