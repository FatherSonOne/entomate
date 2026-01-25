/**
 * ExpressionAutocomplete Component
 *
 * Dropdown component showing autocomplete suggestions for workflow expressions.
 * Supports categories: Nodes, Secrets, Environment, Functions
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Database, Key, Settings, Code, Hash, Box, ChevronRight,
  Type, Calendar, List, Braces, Filter, Zap, Lock, Globe,
  ArrowRight, Layers, Search
} from 'lucide-react'

// Category configuration with icons and colors
const CATEGORIES = {
  Nodes: {
    icon: Database,
    color: 'text-semantic-info',
    bgColor: 'bg-semantic-info-dim',
    description: 'Output from workflow nodes'
  },
  Secrets: {
    icon: Key,
    color: 'text-semantic-warning',
    bgColor: 'bg-semantic-warning-dim',
    description: 'Stored secret values'
  },
  Environment: {
    icon: Globe,
    color: 'text-semantic-success',
    bgColor: 'bg-semantic-success-dim',
    description: 'Environment variables'
  },
  Trigger: {
    icon: Zap,
    color: 'text-accent-tertiary',
    bgColor: 'bg-accent-tertiary-dim',
    description: 'Trigger payload data'
  },
  Workflow: {
    icon: Layers,
    color: 'text-accent-primary',
    bgColor: 'bg-accent-primary-dim',
    description: 'Workflow metadata'
  },
  String: {
    icon: Type,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    description: 'String manipulation functions'
  },
  DateTime: {
    icon: Calendar,
    color: 'text-semantic-warning',
    bgColor: 'bg-orange-50',
    description: 'Date and time functions'
  },
  Number: {
    icon: Hash,
    color: 'text-semantic-error',
    bgColor: 'bg-semantic-error-dim',
    description: 'Number functions'
  },
  Array: {
    icon: List,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    description: 'Array manipulation functions'
  },
  Object: {
    icon: Braces,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    description: 'Object manipulation functions'
  },
  Logic: {
    icon: Filter,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    description: 'Conditional and logic functions'
  },
  Encoding: {
    icon: Lock,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    description: 'Encoding and decoding functions'
  }
}

// Item type icons
const TYPE_ICONS = {
  node: Database,
  secret: Key,
  env: Globe,
  function: Code,
  property: Box,
  object: Braces,
  category: ChevronRight
}

/**
 * Single suggestion item component
 */
function SuggestionItem({ item, isSelected, onClick, onHover }) {
  const Icon = TYPE_ICONS[item.type] || Box
  const category = CATEGORIES[item.category] || {}
  const CategoryIcon = category.icon || Box

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors
        ${isSelected ? 'bg-primary-50 text-primary-900' : 'hover:bg-surface-muted'}
      `}
      onClick={onClick}
      onMouseEnter={onHover}
      role="option"
      aria-selected={isSelected}
    >
      {/* Type icon */}
      <div className={`
        flex-shrink-0 w-6 h-6 rounded flex items-center justify-center
        ${category.bgColor || 'bg-surface-muted'}
      `}>
        {item.type === 'function' ? (
          <CategoryIcon className={`w-3.5 h-3.5 ${category.color || 'text-content-secondary'}`} />
        ) : (
          <Icon className={`w-3.5 h-3.5 ${category.color || 'text-content-secondary'}`} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-mono text-sm ${isSelected ? 'font-medium' : ''}`}>
            {item.label}
          </span>
          {item.nodeType && (
            <span className="text-xs text-content-tertiary bg-surface-muted px-1.5 py-0.5 rounded">
              {item.nodeType}
            </span>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-content-tertiary truncate">{item.description}</p>
        )}
      </div>

      {/* Preview value */}
      {item.preview && (
        <div className="flex-shrink-0 text-xs text-content-tertiary font-mono max-w-[100px] truncate">
          {item.preview}
        </div>
      )}

      {/* Indicator for objects/arrays that can be expanded */}
      {(item.type === 'object' || item.type === 'node') && (
        <ChevronRight className="w-3 h-3 text-content-tertiary" />
      )}
    </div>
  )
}

/**
 * Category header component
 */
function CategoryHeader({ name, count }) {
  const category = CATEGORIES[name] || {}
  const Icon = category.icon || Box

  return (
    <div className={`
      sticky top-0 flex items-center gap-2 px-3 py-1.5 text-xs font-medium
      border-b border-line-subtle ${category.bgColor || 'bg-surface-muted'}
    `}>
      <Icon className={`w-3.5 h-3.5 ${category.color || 'text-content-secondary'}`} />
      <span className={category.color || 'text-content-secondary'}>{name}</span>
      <span className="text-content-tertiary">({count})</span>
    </div>
  )
}

/**
 * Main ExpressionAutocomplete component
 */
export default function ExpressionAutocomplete({
  suggestions = [],
  selectedIndex = 0,
  onSelect,
  onNavigate,
  position = { top: 0, left: 0 },
  visible = false,
  searchTerm = '',
  showCategories = true,
  maxHeight = 300,
  width = 350
}) {
  const containerRef = useRef(null)
  const selectedRef = useRef(null)
  const [filter, setFilter] = useState('')
  const [activeCategory, setActiveCategory] = useState(null)

  // Filter suggestions based on search
  const filteredSuggestions = useMemo(() => {
    if (!filter && !searchTerm) return suggestions

    const term = (filter || searchTerm).toLowerCase()
    return suggestions.filter(item =>
      item.label?.toLowerCase().includes(term) ||
      item.description?.toLowerCase().includes(term) ||
      item.value?.toLowerCase().includes(term)
    )
  }, [suggestions, filter, searchTerm])

  // Group suggestions by category
  const groupedSuggestions = useMemo(() => {
    if (!showCategories) {
      return { all: filteredSuggestions }
    }

    const groups = {}
    for (const item of filteredSuggestions) {
      const category = item.category || getItemCategory(item)
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(item)
    }
    return groups
  }, [filteredSuggestions, showCategories])

  // Flatten for keyboard navigation
  const flatSuggestions = useMemo(() => {
    if (!showCategories) return filteredSuggestions

    const flat = []
    for (const [, items] of Object.entries(groupedSuggestions)) {
      flat.push(...items)
    }
    return flat
  }, [groupedSuggestions, showCategories, filteredSuggestions])

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      })
    }
  }, [selectedIndex])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!visible) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        onNavigate?.(Math.min(selectedIndex + 1, flatSuggestions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        onNavigate?.(Math.max(selectedIndex - 1, 0))
        break
      case 'Enter':
      case 'Tab':
        e.preventDefault()
        if (flatSuggestions[selectedIndex]) {
          onSelect?.(flatSuggestions[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        onSelect?.(null)
        break
    }
  }, [visible, selectedIndex, flatSuggestions, onNavigate, onSelect])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!visible || flatSuggestions.length === 0) {
    return null
  }

  const categoryOrder = [
    'Nodes', 'Trigger', 'Workflow', 'Secrets', 'Environment',
    'String', 'Number', 'DateTime', 'Array', 'Object', 'Logic', 'Encoding'
  ]

  return (
    <div
      ref={containerRef}
      className="fixed z-50 bg-surface rounded-lg shadow-xl border border-line-default overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
        width: `${width}px`,
        maxHeight: `${maxHeight}px`
      }}
      role="listbox"
      aria-label="Expression suggestions"
    >
      {/* Search filter */}
      {suggestions.length > 10 && (
        <div className="p-2 border-b border-line-subtle">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter suggestions..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-line-default rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus={false}
            />
          </div>
        </div>
      )}

      {/* Suggestions list */}
      <div className="overflow-y-auto" style={{ maxHeight: `${maxHeight - 50}px` }}>
        {showCategories ? (
          // Grouped by category
          categoryOrder
            .filter(cat => groupedSuggestions[cat])
            .map((categoryName) => {
              const items = groupedSuggestions[categoryName]
              if (!items || items.length === 0) return null

              return (
                <div key={categoryName}>
                  <CategoryHeader name={categoryName} count={items.length} />
                  {items.map((item, idx) => {
                    const globalIndex = flatSuggestions.indexOf(item)
                    return (
                      <div
                        key={`${item.value}-${idx}`}
                        ref={globalIndex === selectedIndex ? selectedRef : null}
                      >
                        <SuggestionItem
                          item={item}
                          isSelected={globalIndex === selectedIndex}
                          onClick={() => onSelect?.(item)}
                          onHover={() => onNavigate?.(globalIndex)}
                        />
                      </div>
                    )
                  })}
                </div>
              )
            })
        ) : (
          // Flat list
          flatSuggestions.map((item, idx) => (
            <div
              key={`${item.value}-${idx}`}
              ref={idx === selectedIndex ? selectedRef : null}
            >
              <SuggestionItem
                item={item}
                isSelected={idx === selectedIndex}
                onClick={() => onSelect?.(item)}
                onHover={() => onNavigate?.(idx)}
              />
            </div>
          ))
        )}

        {/* Also show uncategorized items */}
        {showCategories && groupedSuggestions['undefined'] && (
          <div>
            {groupedSuggestions['undefined'].map((item, idx) => {
              const globalIndex = flatSuggestions.indexOf(item)
              return (
                <div
                  key={`uncategorized-${idx}`}
                  ref={globalIndex === selectedIndex ? selectedRef : null}
                >
                  <SuggestionItem
                    item={item}
                    isSelected={globalIndex === selectedIndex}
                    onClick={() => onSelect?.(item)}
                    onHover={() => onNavigate?.(globalIndex)}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer with keyboard hints */}
      <div className="px-3 py-1.5 bg-surface-muted border-t border-line-subtle flex items-center justify-between text-xs text-content-tertiary">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-surface-muted rounded text-[10px]">Up</kbd>
            <kbd className="px-1 py-0.5 bg-surface-muted rounded text-[10px]">Down</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-surface-muted rounded text-[10px]">Tab</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-surface-muted rounded text-[10px]">Esc</kbd>
            dismiss
          </span>
        </div>
        <span>{flatSuggestions.length} suggestions</span>
      </div>
    </div>
  )
}

/**
 * Helper to determine category from item type
 */
function getItemCategory(item) {
  switch (item.type) {
    case 'node':
      return 'Nodes'
    case 'secret':
      return 'Secrets'
    case 'env':
      return 'Environment'
    case 'function':
      return item.category || 'Functions'
    case 'trigger':
      return 'Trigger'
    case 'workflow':
      return 'Workflow'
    default:
      return item.category || 'Other'
  }
}

/**
 * Hook for managing autocomplete state
 */
export function useExpressionAutocomplete(initialSuggestions = []) {
  const [visible, setVisible] = useState(false)
  const [suggestions, setSuggestions] = useState(initialSuggestions)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const show = useCallback((newSuggestions, pos) => {
    setSuggestions(newSuggestions)
    setPosition(pos)
    setSelectedIndex(0)
    setVisible(true)
  }, [])

  const hide = useCallback(() => {
    setVisible(false)
  }, [])

  const navigate = useCallback((index) => {
    setSelectedIndex(index)
  }, [])

  const select = useCallback((item) => {
    setVisible(false)
    return item
  }, [])

  return {
    visible,
    suggestions,
    selectedIndex,
    position,
    show,
    hide,
    navigate,
    select,
    setSuggestions,
    setPosition
  }
}
