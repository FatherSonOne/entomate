/**
 * ExpressionEditor Component
 *
 * Smart text editor with autocomplete for workflow expressions.
 * Features:
 * - Triggers autocomplete on {{
 * - Shows dropdown with nodes, secrets, env vars, functions
 * - Syntax highlighting for expressions
 * - Inline validation (red underline for invalid refs)
 * - Preview tooltip showing resolved value
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle
} from 'react'
import {
  AlertCircle, CheckCircle, Eye, EyeOff, Info, Code, Wand2
} from 'lucide-react'
import ExpressionAutocomplete, { useExpressionAutocomplete } from './ExpressionAutocomplete'
import {
  findExpressions,
  validateExpression,
  resolveExpressions,
  getAutocompleteSuggestions,
  tokenizeExpression,
  getCursorContext,
  extractNodeReferences
} from '../../utils/expressionParser'
import { getFunctionSuggestions } from '../../utils/expressionFunctions'

/**
 * Syntax highlighting colors
 */
const TOKEN_COLORS = {
  keyword: '#2563eb',      // blue-600
  function: '#7c3aed',     // violet-600
  'unknown-function': '#dc2626', // red-600
  string: '#059669',       // emerald-600
  number: '#d97706',       // amber-600
  boolean: '#c026d3',      // fuchsia-600
  identifier: '#374151',   // gray-700
  punctuation: '#6b7280',  // gray-500
  whitespace: 'transparent',
  unknown: '#ef4444'       // red-500
}

/**
 * Expression token component for syntax highlighting
 */
function ExpressionToken({ token, isInvalid }) {
  const color = TOKEN_COLORS[token.type] || '#374151'

  return (
    <span
      style={{ color }}
      className={`${isInvalid ? 'underline decoration-red-500 decoration-wavy' : ''}`}
    >
      {token.value}
    </span>
  )
}

/**
 * Highlighted expression display
 */
function HighlightedExpression({ expression, validation }) {
  const tokens = tokenizeExpression(expression)
  const invalidRefs = validation?.errors?.map(e => e.message) || []

  return (
    <span className="font-mono text-sm">
      <span className="text-content-tertiary">{'{'+'{'}</span>
      {tokens.map((token, idx) => {
        const isInvalid = token.type === 'identifier' &&
          invalidRefs.some(err => err.includes(token.value))
        return (
          <ExpressionToken key={idx} token={token} isInvalid={isInvalid} />
        )
      })}
      <span className="text-content-tertiary">{'}'+'}'}</span>
    </span>
  )
}

/**
 * Preview tooltip component
 */
function PreviewTooltip({ value, visible, position }) {
  if (!visible) return null

  const displayValue = useMemo(() => {
    if (value === undefined) return 'undefined'
    if (value === null) return 'null'
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2)
      } catch {
        return '[Object]'
      }
    }
    return String(value)
  }, [value])

  const isLong = displayValue.length > 100

  return (
    <div
      className="fixed z-50 vc-bg-code vc-text-primary text-xs rounded-lg shadow-xl p-3 max-w-sm"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-center gap-2 mb-1 text-content-tertiary">
        <Eye className="w-3 h-3" />
        <span>Preview</span>
      </div>
      <pre className={`font-mono whitespace-pre-wrap break-all ${isLong ? 'max-h-32 overflow-auto' : ''}`}>
        {displayValue}
      </pre>
    </div>
  )
}

/**
 * Validation indicator component
 */
function ValidationIndicator({ validation, compact = false }) {
  if (!validation) return null

  const { valid, errors, warnings } = validation

  if (valid && !warnings.length) {
    if (compact) return null
    return (
      <div className="flex items-center gap-1 text-xs text-semantic-success">
        <CheckCircle className="w-3 h-3" />
        <span>Valid</span>
      </div>
    )
  }

  if (!valid) {
    return (
      <div className="flex items-center gap-1 text-xs text-semantic-error">
        <AlertCircle className="w-3 h-3" />
        <span>{errors[0]?.message || 'Invalid expression'}</span>
      </div>
    )
  }

  if (warnings.length > 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-semantic-warning">
        <Info className="w-3 h-3" />
        <span>{warnings[0]?.message}</span>
      </div>
    )
  }

  return null
}

/**
 * Main ExpressionEditor component
 */
const ExpressionEditor = forwardRef(function ExpressionEditor({
  value = '',
  onChange,
  placeholder = 'Enter value or type {{ for expressions',
  multiline = false,
  rows = 3,
  disabled = false,
  context = {},
  showPreview = true,
  showValidation = true,
  className = '',
  onFocus,
  onBlur,
  label,
  help,
  required = false
}, ref) {
  const [isFocused, setIsFocused] = useState(false)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [showPreviewTooltip, setShowPreviewTooltip] = useState(false)
  const [previewPosition, setPreviewPosition] = useState({ top: 0, left: 0 })
  const [previewValue, setPreviewValue] = useState(null)

  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const highlightRef = useRef(null)

  const autocomplete = useExpressionAutocomplete()

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
    getValue: () => value,
    insertExpression: (expr) => insertAtCursor(expr)
  }), [value])

  // Parse expressions in the value
  const expressions = useMemo(() => findExpressions(value), [value])

  // Validate all expressions
  const validations = useMemo(() => {
    const results = {}
    for (const expr of expressions) {
      results[expr.start] = validateExpression(expr.content, context)
    }
    return results
  }, [expressions, context])

  // Overall validation state
  const overallValidation = useMemo(() => {
    const hasErrors = Object.values(validations).some(v => !v.valid)
    const allWarnings = Object.values(validations).flatMap(v => v.warnings)
    return {
      valid: !hasErrors,
      errors: Object.values(validations).flatMap(v => v.errors),
      warnings: allWarnings
    }
  }, [validations])

  // Resolved preview value
  const resolvedValue = useMemo(() => {
    if (!showPreview || !isFocused) return null
    try {
      return resolveExpressions(value, context.executionData || {})
    } catch {
      return null
    }
  }, [value, context.executionData, showPreview, isFocused])

  // Handle cursor context for autocomplete
  const cursorContext = useMemo(() => {
    return getCursorContext(value, cursorPosition)
  }, [value, cursorPosition])

  // Get suggestions based on cursor context
  const getSuggestions = useCallback(() => {
    if (!cursorContext.inExpression) return []

    const path = cursorContext.fullPath || ''

    // Check if typing a function
    if (!path.includes('.') && !path.includes('(')) {
      // Could be typing a function or top-level reference
      const funcSuggestions = getFunctionSuggestions(path)
      const pathSuggestions = getAutocompleteSuggestions(path, context)
      return [...pathSuggestions, ...funcSuggestions]
    }

    return getAutocompleteSuggestions(path, context)
  }, [cursorContext, context])

  // Handle input change
  const handleChange = useCallback((e) => {
    const newValue = e.target.value
    const newCursor = e.target.selectionStart

    onChange?.(newValue)
    setCursorPosition(newCursor)

    // Check if we should show autocomplete
    const ctx = getCursorContext(newValue, newCursor)

    if (ctx.inExpression) {
      // Calculate position for dropdown
      const inputRect = inputRef.current?.getBoundingClientRect()
      if (inputRect) {
        const lineHeight = 24
        const charWidth = 8
        const offsetX = Math.min((ctx.cursorOffset || 0) * charWidth, inputRect.width - 100)

        autocomplete.show(
          getAutocompleteSuggestions(ctx.fullPath || '', context),
          {
            top: inputRect.bottom + 4,
            left: inputRect.left + offsetX
          }
        )
      }
    } else {
      // Check if user just typed {{
      const beforeCursor = newValue.slice(0, newCursor)
      if (beforeCursor.endsWith('{{')) {
        const inputRect = inputRef.current?.getBoundingClientRect()
        if (inputRect) {
          autocomplete.show(
            getAutocompleteSuggestions('', context),
            {
              top: inputRect.bottom + 4,
              left: inputRect.left
            }
          )
        }
      } else {
        autocomplete.hide()
      }
    }
  }, [onChange, context, autocomplete])

  // Handle selection change
  const handleSelect = useCallback((e) => {
    setCursorPosition(e.target.selectionStart)
  }, [])

  // Handle autocomplete selection
  const handleAutocompleteSelect = useCallback((item) => {
    if (!item) {
      autocomplete.hide()
      return
    }

    const ctx = getCursorContext(value, cursorPosition)
    if (!ctx.inExpression) {
      autocomplete.hide()
      return
    }

    // Determine what to insert
    let insertValue = item.value

    // For functions, add parentheses
    if (item.type === 'function') {
      insertValue = `${item.value}(`
    }

    // For objects/nodes, add dot for drilling down
    if (item.type === 'object' || item.type === 'node') {
      insertValue = `${item.value}.`
    }

    // Calculate replacement range
    const pathStart = ctx.expressionStart + (ctx.fullPath ? ctx.beforeCursor.length - ctx.fullPath.length : 0)
    const pathEnd = ctx.expressionStart + ctx.cursorOffset

    // Replace the current segment
    const newValue =
      value.slice(0, pathStart) +
      insertValue +
      value.slice(pathEnd)

    onChange?.(newValue)

    // Move cursor to end of inserted value
    const newCursorPos = pathStart + insertValue.length
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos)
        inputRef.current.focus()
      }
    }, 0)

    // Update suggestions for new position
    const newCtx = getCursorContext(newValue, newCursorPos)
    if (newCtx.inExpression && (item.type === 'object' || item.type === 'node' || item.type === 'function')) {
      setTimeout(() => {
        const inputRect = inputRef.current?.getBoundingClientRect()
        if (inputRect) {
          autocomplete.show(
            getAutocompleteSuggestions(newCtx.fullPath || '', context),
            {
              top: inputRect.bottom + 4,
              left: inputRect.left
            }
          )
        }
      }, 10)
    } else {
      autocomplete.hide()
    }
  }, [value, cursorPosition, onChange, context, autocomplete])

  // Handle keyboard in input
  const handleKeyDown = useCallback((e) => {
    if (autocomplete.visible) {
      if (['ArrowDown', 'ArrowUp', 'Tab', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault()
        e.stopPropagation()

        if (e.key === 'ArrowDown') {
          autocomplete.navigate(Math.min(autocomplete.selectedIndex + 1, autocomplete.suggestions.length - 1))
        } else if (e.key === 'ArrowUp') {
          autocomplete.navigate(Math.max(autocomplete.selectedIndex - 1, 0))
        } else if (e.key === 'Tab' || e.key === 'Enter') {
          handleAutocompleteSelect(autocomplete.suggestions[autocomplete.selectedIndex])
        } else if (e.key === 'Escape') {
          autocomplete.hide()
        }
      }
    }
  }, [autocomplete, handleAutocompleteSelect])

  // Handle focus
  const handleFocus = useCallback((e) => {
    setIsFocused(true)
    onFocus?.(e)
  }, [onFocus])

  // Handle blur
  const handleBlur = useCallback((e) => {
    // Delay hiding autocomplete to allow click selection
    setTimeout(() => {
      setIsFocused(false)
      autocomplete.hide()
    }, 200)
    onBlur?.(e)
  }, [onBlur, autocomplete])

  // Insert expression helper
  const insertAtCursor = useCallback((expr) => {
    const input = inputRef.current
    if (!input) return

    const start = input.selectionStart
    const end = input.selectionEnd
    const newValue = value.slice(0, start) + expr + value.slice(end)

    onChange?.(newValue)

    setTimeout(() => {
      const newPos = start + expr.length
      input.setSelectionRange(newPos, newPos)
      input.focus()
    }, 0)
  }, [value, onChange])

  // Toggle preview tooltip
  const handleTogglePreview = useCallback(() => {
    if (!showPreviewTooltip) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        setPreviewPosition({
          top: rect.bottom + 8,
          left: rect.left
        })
        setPreviewValue(resolvedValue)
      }
    }
    setShowPreviewTooltip(!showPreviewTooltip)
  }, [showPreviewTooltip, resolvedValue])

  // Quick insert expression button
  const handleQuickInsert = useCallback(() => {
    insertAtCursor('{{}}')
    setTimeout(() => {
      const input = inputRef.current
      if (input) {
        const pos = input.selectionStart - 2
        input.setSelectionRange(pos, pos)

        // Trigger autocomplete
        const inputRect = input.getBoundingClientRect()
        autocomplete.show(
          getAutocompleteSuggestions('', context),
          {
            top: inputRect.bottom + 4,
            left: inputRect.left
          }
        )
      }
    }, 0)
  }, [insertAtCursor, context, autocomplete])

  // Create highlighted overlay content
  const renderHighlightedContent = useCallback(() => {
    if (!value) return null

    const parts = []
    let lastIndex = 0

    for (const expr of expressions) {
      // Add text before expression
      if (expr.start > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`} className="text-transparent">
            {value.slice(lastIndex, expr.start)}
          </span>
        )
      }

      // Add highlighted expression
      const validation = validations[expr.start]
      parts.push(
        <HighlightedExpression
          key={`expr-${expr.start}`}
          expression={expr.content}
          validation={validation}
        />
      )

      lastIndex = expr.end
    }

    // Add remaining text
    if (lastIndex < value.length) {
      parts.push(
        <span key={`text-${lastIndex}`} className="text-transparent">
          {value.slice(lastIndex)}
        </span>
      )
    }

    return parts
  }, [value, expressions, validations])

  const InputComponent = multiline ? 'textarea' : 'input'

  return (
    <div ref={containerRef} className={`expression-editor ${className}`}>
      {/* Label */}
      {label && (
        <label className="flex items-center gap-1 text-xs font-medium text-content-secondary mb-1">
          {label}
          {required && <span className="text-semantic-error">*</span>}
        </label>
      )}

      {/* Input container with overlay */}
      <div className="relative">
        {/* Highlight overlay */}
        {expressions.length > 0 && (
          <div
            ref={highlightRef}
            className={`
              absolute inset-0 pointer-events-none overflow-hidden
              px-3 py-2 font-mono text-sm whitespace-pre-wrap break-words
              ${multiline ? '' : 'whitespace-nowrap'}
            `}
            aria-hidden="true"
          >
            {renderHighlightedContent()}
          </div>
        )}

        {/* Actual input */}
        <InputComponent
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onSelect={handleSelect}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          rows={multiline ? rows : undefined}
          className={`
            w-full px-3 py-2 text-sm border rounded-md font-mono
            focus:outline-none focus:ring-2 focus:ring-primary-500
            ${expressions.length > 0 ? 'caret-gray-900 text-transparent selection:bg-primary-200' : ''}
            ${disabled ? 'bg-surface-muted cursor-not-allowed' : 'bg-surface'}
            ${!overallValidation.valid ? 'border-semantic-error' : 'border-line-default'}
            ${multiline ? 'resize-y min-h-[80px]' : ''}
          `}
          style={{
            // Make text invisible when we have expressions (overlay shows colored version)
            color: expressions.length > 0 ? 'transparent' : undefined
          }}
          aria-invalid={!overallValidation.valid}
          aria-describedby={help ? 'expression-help' : undefined}
        />

        {/* Action buttons */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* Quick insert expression button */}
          <button
            type="button"
            onClick={handleQuickInsert}
            className="p-1 text-content-tertiary hover:text-accent-primary rounded"
            title="Insert expression"
            tabIndex={-1}
          >
            <Code className="w-4 h-4" />
          </button>

          {/* Preview toggle */}
          {showPreview && resolvedValue !== null && resolvedValue !== value && (
            <button
              type="button"
              onClick={handleTogglePreview}
              className={`p-1 rounded ${showPreviewTooltip ? 'text-accent-primary' : 'text-content-tertiary hover:text-accent-primary'}`}
              title="Toggle preview"
              tabIndex={-1}
            >
              {showPreviewTooltip ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Validation and help */}
      <div className="mt-1 flex items-center justify-between">
        {showValidation && expressions.length > 0 && (
          <ValidationIndicator validation={overallValidation} compact />
        )}
        {help && !overallValidation.errors.length && (
          <p id="expression-help" className="text-xs text-content-tertiary">{help}</p>
        )}
      </div>

      {/* Autocomplete dropdown */}
      <ExpressionAutocomplete
        visible={autocomplete.visible}
        suggestions={autocomplete.suggestions}
        selectedIndex={autocomplete.selectedIndex}
        position={autocomplete.position}
        onSelect={handleAutocompleteSelect}
        onNavigate={autocomplete.navigate}
        showCategories={true}
      />

      {/* Preview tooltip */}
      <PreviewTooltip
        value={previewValue}
        visible={showPreviewTooltip}
        position={previewPosition}
      />
    </div>
  )
})

/**
 * Field wrapper for use in NodeConfigPanel
 */
export function ExpressionField({
  field,
  value,
  onChange,
  context
}) {
  return (
    <ExpressionEditor
      value={value || ''}
      onChange={(newValue) => onChange(field.name, newValue)}
      label={field.label}
      placeholder={field.placeholder}
      help={field.help}
      required={field.required}
      multiline={field.type === 'textarea' || field.multiline}
      rows={field.rows}
      context={context}
    />
  )
}

export default ExpressionEditor
