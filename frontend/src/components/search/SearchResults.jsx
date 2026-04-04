/**
 * SearchResults — Results list with highlighting, pagination, and type icons
 */
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search as SearchIcon, MessageSquare, FolderKanban, CheckSquare,
  FileText, Loader2, Download, ChevronLeft, ChevronRight
} from 'lucide-react'
import { VCButton, VCBadge } from '../vc'

const PAGE_SIZE = 20

/**
 * Highlight query terms in text
 */
function HighlightedText({ text, query }) {
  if (!text || !query || query.length < 2) return <>{text}</>

  const terms = query.trim().split(/\s+/).filter(t => t.length >= 2)
  if (terms.length === 0) return <>{text}</>

  const pattern = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(pattern)

  return (
    <>
      {parts.map((part, i) =>
        pattern.test(part)
          ? <mark key={i} className="rounded px-0.5" style={{ background: 'rgba(255,45,107,0.2)', color: 'var(--text-primary)' }}>{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

function getTypeIcon(type) {
  switch (type) {
    case 'meeting': return <MessageSquare className="w-5 h-5" style={{ color: 'var(--accent-tertiary)' }} />
    case 'project': return <FolderKanban className="w-5 h-5" style={{ color: 'var(--accent-secondary)' }} />
    case 'task': return <CheckSquare className="w-5 h-5" style={{ color: 'var(--accent-secondary)' }} />
    case 'action_item': return <FileText className="w-5 h-5" style={{ color: 'var(--accent-tertiary)' }} />
    default: return <SearchIcon className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
  }
}

function getTypeLink(result) {
  switch (result.type) {
    case 'meeting': return `/meetings/${result.id}`
    case 'project': return `/projects/${result.id}`
    case 'task': return `/tasks`
    default: return '#'
  }
}

function getBadgeColor(type) {
  switch (type) {
    case 'meeting': return 'amber'
    case 'project': case 'task': return 'mint'
    case 'action_item': return 'amber'
    default: return 'neutral'
  }
}

function getSentimentColor(s) { return s === 'positive' ? 'mint' : s === 'negative' ? 'crimson' : 'neutral' }
function getPriorityColor(p) { return p === 'high' ? 'crimson' : p === 'medium' ? 'amber' : 'mint' }

export default function SearchResults({
  results,
  loading,
  hasSearched,
  query,
  searchType,
  executionTime,
  onExport,
  exporting,
  exportFormat,
}) {
  const [page, setPage] = useState(0)

  // Reset page when results change
  React.useEffect(() => { setPage(0) }, [results])

  if (!hasSearched) return null

  const totalPages = Math.ceil(results.length / PAGE_SIZE)
  const pageResults = results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="vc">
      <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(248,240,242,.08)' }}>
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
          {results.length > 0 && !loading && (
            <div className="flex items-center gap-1 mr-2">
              <VCButton variant="ghost" size="sm" onClick={() => onExport('csv')} disabled={exporting} title="Export as CSV">
                {exporting && exportFormat === 'csv' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                CSV
              </VCButton>
              <VCButton variant="ghost" size="sm" onClick={() => onExport('json')} disabled={exporting} title="Export as JSON">
                {exporting && exportFormat === 'json' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
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
        <>
          <div style={{ borderTop: '1px solid rgba(248,240,242,.04)' }}>
            {pageResults.map((result, index) => (
              <Link
                key={`${result.type}-${result.id}-${index}`}
                to={getTypeLink(result)}
                className="block p-4 transition-colors"
                style={{ borderBottom: '1px solid rgba(248,240,242,.04)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,240,242,.04)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getTypeIcon(result.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        <HighlightedText text={result.title} query={query} />
                      </h4>
                      <VCBadge color={getBadgeColor(result.type)}>{result.type}</VCBadge>
                      {result.similarity && (
                        <span className="text-xs font-bold" style={{ color: 'var(--accent-primary)' }}>
                          {Math.round(result.similarity * 100)}% match
                        </span>
                      )}
                    </div>
                    {result.preview && (
                      <p className="text-sm line-clamp-2 mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        <HighlightedText text={result.preview} query={query} />
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs flex-wrap" style={{ color: 'var(--text-tertiary)' }}>
                      {result.metadata?.date && <span>{new Date(result.metadata.date).toLocaleDateString()}</span>}
                      {result.metadata?.status && <VCBadge color="neutral">{result.metadata.status}</VCBadge>}
                      {result.metadata?.sentiment && <VCBadge color={getSentimentColor(result.metadata.sentiment)}>{result.metadata.sentiment}</VCBadge>}
                      {result.metadata?.priority && <VCBadge color={getPriorityColor(result.metadata.priority)}>{result.metadata.priority}</VCBadge>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid rgba(248,240,242,.08)' }}>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Page {page + 1} of {totalPages} ({results.length} results)
              </span>
              <div className="flex items-center gap-2">
                <VCButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </VCButton>
                <VCButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </VCButton>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
