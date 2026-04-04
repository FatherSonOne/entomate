/**
 * @deprecated This component is not mounted in the frontend router.
 * RAG citation rendering and search features have been ported to:
 *   - frontend/src/components/search/AskAIPanel.jsx (citation badges, streaming)
 *   - frontend/src/components/search/SearchResults.jsx (result highlighting, pagination)
 *   - frontend/src/pages/Search.jsx (orchestrator)
 *
 * The src/search/ modules (embedder, retriever, indexer, citations, ragAnswer)
 * remain functional for backend/service use. This UI component can be removed
 * once all features are verified in the frontend Search page.
 *
 * Original: Search View Component — Ask Assistant with RAG-powered answers and citations
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ask, searchOnly, getIndexingStats, reindexAll } from '../search';
import type { SearchFilters, SearchResponse, Citation, ContextItem } from '../search/types';

// Source type labels and icons
const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  meeting: { label: 'Meeting', color: 'bg-purple-100 text-purple-700' },
  task: { label: 'Task', color: 'bg-blue-100 text-blue-700' },
  project: { label: 'Project', color: 'bg-green-100 text-green-700' },
  crm_deal: { label: 'Deal', color: 'bg-orange-100 text-orange-700' },
  crm_contact: { label: 'Contact', color: 'bg-pink-100 text-pink-700' },
  pulse_message: { label: 'Pulse', color: 'bg-indigo-100 text-indigo-700' }
};

interface SearchHistoryItem {
  question: string;
  response: SearchResponse;
  timestamp: Date;
}

export const SearchView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Filters
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Indexing state
  const [indexingStats, setIndexingStats] = useState<{
    totalDocuments: number;
    bySourceType: Record<string, number>;
    lastIndexedAt: string | null;
  } | null>(null);
  const [isReindexing, setIsReindexing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Load indexing stats on mount
  useEffect(() => {
    loadIndexingStats();
  }, []);

  const loadIndexingStats = async () => {
    try {
      const stats = await getIndexingStats();
      setIndexingStats(stats);
    } catch (err) {
      console.error('Failed to load indexing stats:', err);
    }
  };

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);

    // Build filters
    const searchFilters: SearchFilters = {};
    if (selectedSources.length > 0) {
      searchFilters.sourceTypes = selectedSources as any[];
    }
    if (dateFrom) {
      searchFilters.dateFrom = dateFrom;
    }
    if (dateTo) {
      searchFilters.dateTo = dateTo;
    }

    try {
      const result = await ask(query, searchFilters);
      setResponse(result);

      // Add to history
      setHistory(prev => [{
        question: query,
        response: result,
        timestamp: new Date()
      }, ...prev.slice(0, 19)]); // Keep last 20

    } catch (err) {
      console.error('Search failed:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [query, selectedSources, dateFrom, dateTo]);

  // Handle reindex
  const handleReindex = async () => {
    if (isReindexing) return;

    setIsReindexing(true);
    try {
      await reindexAll();
      await loadIndexingStats();
    } catch (err) {
      console.error('Reindex failed:', err);
      setError('Failed to reindex documents');
    } finally {
      setIsReindexing(false);
    }
  };

  // Toggle source filter
  const toggleSource = (source: string) => {
    setSelectedSources(prev =>
      prev.includes(source)
        ? prev.filter(s => s !== source)
        : [...prev, source]
    );
  };

  // Clear filters
  const clearFilters = () => {
    setSelectedSources([]);
    setDateFrom('');
    setDateTo('');
  };

  // Render citation badge
  const renderCitation = (citation: Citation) => {
    const sourceInfo = SOURCE_LABELS[citation.sourceType] || { label: citation.sourceType, color: 'bg-gray-100 text-gray-700' };

    return (
      <a
        key={citation.id}
        href={citation.url}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${sourceInfo.color} hover:opacity-80 transition-opacity`}
        title={citation.title}
      >
        <span className="font-bold">[{citation.id}]</span>
        <span className="truncate max-w-[150px]">{citation.title}</span>
      </a>
    );
  };

  // Render answer with highlighted citations
  const renderAnswer = (answer: string, citations: Citation[]) => {
    // Simple citation highlighting - wrap [XX] in styled spans
    const parts = answer.split(/(\[[A-Z]+\d+\])/g);

    return (
      <div className="prose prose-sm max-w-none">
        {parts.map((part, i) => {
          const match = part.match(/^\[([A-Z]+)(\d+)\]$/);
          if (match) {
            const citation = citations.find(c => c.id === part.slice(1, -1));
            if (citation) {
              const sourceInfo = SOURCE_LABELS[citation.sourceType] || { color: 'bg-gray-100 text-gray-700' };
              return (
                <a
                  key={i}
                  href={citation.url}
                  className={`inline-block px-1 rounded text-xs font-bold ${sourceInfo.color} hover:opacity-80`}
                  title={citation.title}
                >
                  {part}
                </a>
              );
            }
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Ask Assistant</h2>
          <p className="text-gray-500 text-sm">Search across meetings, tasks, deals, and more</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            History ({history.length})
          </button>

          <button
            onClick={handleReindex}
            disabled={isReindexing}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
          >
            {isReindexing ? (
              <>
                <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                Indexing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                  <path d="M16 16h5v5"/>
                </svg>
                Reindex
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {indexingStats && (
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{indexingStats.totalDocuments} documents indexed</span>
          <span className="text-gray-300">|</span>
          {Object.entries(indexingStats.bySourceType).map(([type, count]) => (
            <span key={type} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${SOURCE_LABELS[type]?.color.split(' ')[0] || 'bg-gray-200'}`}></span>
              {count} {SOURCE_LABELS[type]?.label || type}
            </span>
          ))}
          {indexingStats.lastIndexedAt && (
            <>
              <span className="text-gray-300">|</span>
              <span>Last indexed: {new Date(indexingStats.lastIndexedAt).toLocaleString()}</span>
            </>
          )}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ask a question about your meetings, tasks, or deals..."
              className="w-full px-4 py-3 pr-12 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent text-lg"
              disabled={isSearching}
            />
            {isSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3 rounded-xl border ${showFilters ? 'bg-gray-100 border-gray-300' : 'border-gray-200'} hover:bg-gray-50 transition-colors`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
          </button>

          <button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="px-6 py-3 bg-[#2563EB] text-white rounded-xl font-bold hover:bg-[#008f5b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Search
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">Filters</span>
              <button
                onClick={clearFilters}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear all
              </button>
            </div>

            <div className="space-y-4">
              {/* Source Types */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Source Types</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(SOURCE_LABELS).map(([key, { label, color }]) => (
                    <button
                      key={key}
                      onClick={() => toggleSource(key)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        selectedSources.includes(key)
                          ? color
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div className="flex gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <p className="font-medium">Search Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Answer Panel */}
        <div className="flex-1 flex flex-col min-h-0">
          {response ? (
            <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-6 overflow-auto">
              {/* Question */}
              <div className="mb-4">
                <span className="text-xs font-mono uppercase text-gray-400">Question</span>
                <p className="text-lg font-medium">{response.question}</p>
              </div>

              {/* Answer */}
              <div className="mb-6">
                <span className="text-xs font-mono uppercase text-gray-400">Answer</span>
                <div className="mt-2 text-gray-800 leading-relaxed">
                  {renderAnswer(response.answer, response.citations)}
                </div>
              </div>

              {/* Sources Used */}
              {response.retrieval.count > 0 && (
                <div className="pt-4 border-t border-gray-100">
                  <span className="text-xs font-mono uppercase text-gray-400">
                    Sources ({response.retrieval.count} documents searched)
                  </span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {response.retrieval.topSources.map(({ sourceType, count }) => {
                      const info = SOURCE_LABELS[sourceType] || { label: sourceType, color: 'bg-gray-100 text-gray-700' };
                      return (
                        <span
                          key={sourceType}
                          className={`px-2 py-0.5 rounded text-xs ${info.color}`}
                        >
                          {count} {info.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <div className="text-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-50">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <p className="font-medium">Ask a question to get started</p>
                <p className="text-sm mt-1">Your answer will appear here with citations</p>
              </div>
            </div>
          )}
        </div>

        {/* Citations Sidebar */}
        {response && response.citations.length > 0 && (
          <div className="w-80 flex flex-col min-h-0">
            <div className="text-xs font-mono uppercase text-gray-400 mb-3">
              Citations ({response.citations.length})
            </div>
            <div className="flex-1 overflow-auto space-y-3">
              {response.citations.map((citation) => (
                <a
                  key={citation.id}
                  href={citation.url}
                  className="block p-3 bg-white border border-gray-100 rounded-xl hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${SOURCE_LABELS[citation.sourceType]?.color || 'bg-gray-100 text-gray-700'}`}>
                      {citation.id}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{citation.title}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{citation.snippet}</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* History Sidebar */}
        {showHistory && (
          <div className="w-80 flex flex-col min-h-0 bg-white border border-gray-100 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase text-gray-400">Search History</span>
              <button
                onClick={() => setHistory([])}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-auto space-y-2">
              {history.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No search history yet</p>
              ) : (
                history.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(item.question);
                      setResponse(item.response);
                    }}
                    className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <p className="text-sm font-medium truncate">{item.question}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {item.timestamp.toLocaleTimeString()}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchView;
