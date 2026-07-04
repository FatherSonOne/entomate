/**
 * SearchHistoryPanel — Recent searches, saved searches, and save modal
 */
import React, { useState } from 'react'
import {
  History, Bookmark, BookmarkPlus, Clock, X, ChevronDown, ChevronUp
} from 'lucide-react'
import { VCButton } from '../vc'

export default function SearchHistoryPanel({
  query,
  searchHistory,
  savedSearches,
  onSearch,
  onClearHistory,
  onSaveSearch,
  onDeleteSavedSearch,
}) {
  const [showHistory, setShowHistory] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveName, setSaveName] = useState('')

  const handleSave = () => {
    if (!saveName.trim() || !query.trim()) return
    onSaveSearch(saveName)
    setSaveModalOpen(false)
    setSaveName('')
  }

  return (
    <>
      {/* Action buttons */}
      <div className="flex items-center justify-between mt-3 px-5 pb-3">
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
          <button onClick={() => setSaveModalOpen(true)} className="text-sm flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
            <BookmarkPlus className="w-4 h-4" /> Save Search
          </button>
        )}
      </div>

      {/* Recent searches */}
      {showHistory && searchHistory.length > 0 && (
        <div className="mx-5 mb-3 p-3 rounded-lg" style={{ background: 'var(--b0)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium uppercase" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>Recent Searches</span>
            <button onClick={onClearHistory} className="text-xs" style={{ color: 'var(--accent-primary)' }}>Clear</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {searchHistory.map((item, index) => (
              <button
                key={index}
                onClick={(e) => onSearch(e, item.query, item.search_type)}
                className="text-sm px-3 py-1 rounded-full flex items-center gap-1 transition-colors"
                style={{ border: '1px solid var(--b1)', background: 'var(--b0)', color: 'var(--text-secondary)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--b1)'; e.currentTarget.style.borderColor = 'rgba(255,45,107,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--b0)'; e.currentTarget.style.borderColor = 'var(--b1)' }}
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
        <div className="mx-5 mb-3 p-3 rounded-lg" style={{ background: 'var(--b0)' }}>
          <span className="text-xs font-medium uppercase block mb-2" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>Saved Searches</span>
          <div className="flex flex-wrap gap-2">
            {savedSearches.map((item) => (
              <div key={item.id} className="text-sm px-3 py-1 rounded-full flex items-center gap-2" style={{ border: '1px solid var(--b1)', background: 'var(--b0)' }}>
                <button
                  onClick={(e) => onSearch(e, item.query, item.search_type)}
                  className="flex items-center gap-1 transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                >
                  <Bookmark className="w-3 h-3" style={{ color: 'var(--accent-primary)' }} />
                  {item.name}
                </button>
                <button
                  onClick={() => onDeleteSavedSearch(item.id)}
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

      {/* Save modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-lg p-6 w-full max-w-md" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Save Search</h3>
            <input
              type="text"
              className="vinput w-full mb-4"
              placeholder="Name this search..."
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              autoFocus
            />
            <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>Query: "{query}"</p>
            <div className="flex gap-3 justify-end">
              <VCButton variant="ghost" onClick={() => { setSaveModalOpen(false); setSaveName('') }}>Cancel</VCButton>
              <VCButton variant="primary" onClick={handleSave} disabled={!saveName.trim()}>Save</VCButton>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
