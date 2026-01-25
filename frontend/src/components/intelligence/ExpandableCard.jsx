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
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden transition-all hover:shadow-md ${className}`}>
      {/* Card Header */}
      {title && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
            {badge && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
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
        <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50 animate-fadeIn">
          <div className="pt-4">
            {expandedContent}
          </div>
        </div>
      )}

      {/* Card Actions */}
      {(actions.length > 0 || expandedContent) && (
        <div className="px-4 py-3 border-t border-gray-100 bg-white flex items-center gap-2 flex-wrap">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.handler}
              disabled={action.disabled}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                action.primary
                  ? 'bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400'
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
              className="ml-auto px-3 py-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors flex items-center gap-1"
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
