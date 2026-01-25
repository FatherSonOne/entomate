import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

/**
 * ExpandableCard - Reusable adaptive expansion component
 *
 * Features:
 * - Compact view by default
 * - Smooth expand/collapse animations
 * - Accessible keyboard navigation
 * - ARIA labels for screen readers
 */
export default function ExpandableCard({
  title,
  badge,
  compactContent,
  expandedContent,
  actions = [],
  defaultExpanded = false,
  className = ''
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <div className={`bg-surface border border-line-default rounded-lg shadow-sm overflow-hidden transition-all hover:shadow-md ${className}`}>
      {/* Card Header */}
      {title && (
        <div className="px-4 py-3 border-b border-line-subtle bg-surface-muted">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-content-primary text-sm">{title}</h3>
            {badge && (
              <span className="px-2 py-0.5 bg-accent-tertiary-dim text-accent-tertiary text-xs rounded-full font-medium">
                {badge}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Compact Content (Always Visible) */}
      <div className="p-4">
        {compactContent}
      </div>

      {/* Expanded Content (Conditionally Visible) */}
      {isExpanded && expandedContent && (
        <div className="px-4 pb-4 border-t border-line-subtle bg-surface-muted animate-fadeIn">
          <div className="pt-4">
            {expandedContent}
          </div>
        </div>
      )}

      {/* Card Actions */}
      {(actions.length > 0 || expandedContent) && (
        <div className="px-4 py-3 border-t border-line-subtle bg-surface flex items-center gap-2 flex-wrap">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.handler}
              disabled={action.disabled}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                action.primary
                  ? 'bg-accent-primary text-white hover:opacity-90 disabled:bg-surface-muted disabled:text-content-muted'
                  : 'bg-surface-muted text-content-secondary hover:bg-surface-elevated disabled:bg-surface-muted disabled:text-content-muted'
              } disabled:cursor-not-allowed`}
              aria-label={action.label}
            >
              {action.label}
            </button>
          ))}

          {/* Expand/Collapse Toggle */}
          {expandedContent && (
            <button
              onClick={toggleExpanded}
              className="ml-auto px-3 py-1.5 text-xs font-medium text-accent-primary hover:text-accent-primary hover:bg-accent-primary-dim rounded-lg transition-colors flex items-center gap-1"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Hide details' : 'Show details'}
            >
              {isExpanded ? (
                <>
                  Hide Details <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  Show Details <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
