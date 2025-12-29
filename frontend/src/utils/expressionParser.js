/**
 * Expression Parser
 *
 * Parses and validates workflow expressions like:
 * - {{nodes.http_request_1.data.body.users[0].name}}
 * - {{uppercase(nodes.x.data.name)}}
 * - {{secrets.API_KEY}}
 * - {{env.NODE_ENV}}
 */

import { allFunctions, executeFunction } from './expressionFunctions'

// Regular expression to match expressions: {{...}}
const EXPRESSION_REGEX = /\{\{([^}]+)\}\}/g

// Pattern to match individual expression parts
const PATH_PART_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const ARRAY_INDEX_REGEX = /\[(\d+)\]/g
const FUNCTION_CALL_REGEX = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/

/**
 * Expression validation result
 */
export class ValidationResult {
  constructor() {
    this.valid = true
    this.errors = []
    this.warnings = []
    this.references = []
  }

  addError(message, position = null) {
    this.valid = false
    this.errors.push({ message, position })
  }

  addWarning(message, position = null) {
    this.warnings.push({ message, position })
  }

  addReference(ref) {
    this.references.push(ref)
  }
}

/**
 * Parse a path expression like "nodes.http_request_1.data.body.users[0].name"
 */
export function parsePath(pathStr) {
  if (!pathStr || typeof pathStr !== 'string') {
    return { valid: false, parts: [], error: 'Invalid path' }
  }

  const normalized = pathStr.replace(ARRAY_INDEX_REGEX, '.$1')
  const parts = normalized.split('.').filter(Boolean)

  const parsed = parts.map((part) => {
    if (/^\d+$/.test(part)) {
      return { type: 'index', value: parseInt(part, 10) }
    }
    return { type: 'property', value: part }
  })

  return { valid: true, parts: parsed }
}

/**
 * Resolve a path against an object
 */
export function resolvePath(obj, pathStr) {
  const { valid, parts } = parsePath(pathStr)
  if (!valid) return undefined

  let current = obj
  for (const part of parts) {
    if (current == null) return undefined
    current = current[part.value]
  }
  return current
}

/**
 * Parse function call expression
 */
export function parseFunctionCall(expression) {
  const match = expression.match(FUNCTION_CALL_REGEX)
  if (!match) return null

  const [, funcName, argsStr] = match
  const args = parseArguments(argsStr)

  return {
    type: 'function',
    name: funcName,
    arguments: args
  }
}

/**
 * Parse function arguments (handles nested parentheses)
 */
export function parseArguments(argsStr) {
  if (!argsStr.trim()) return []

  const args = []
  let current = ''
  let depth = 0
  let inString = false
  let stringChar = null

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i]

    if (inString) {
      current += char
      if (char === stringChar && argsStr[i - 1] !== '\\') {
        inString = false
      }
    } else if (char === '"' || char === "'") {
      inString = true
      stringChar = char
      current += char
    } else if (char === '(') {
      depth++
      current += char
    } else if (char === ')') {
      depth--
      current += char
    } else if (char === ',' && depth === 0) {
      args.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  if (current.trim()) {
    args.push(current.trim())
  }

  return args.map(arg => parseArgumentValue(arg))
}

/**
 * Parse a single argument value
 */
export function parseArgumentValue(arg) {
  const trimmed = arg.trim()

  // String literal
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return {
      type: 'literal',
      dataType: 'string',
      value: trimmed.slice(1, -1)
    }
  }

  // Number literal
  if (!isNaN(Number(trimmed)) && trimmed !== '') {
    return {
      type: 'literal',
      dataType: 'number',
      value: Number(trimmed)
    }
  }

  // Boolean literal
  if (trimmed === 'true' || trimmed === 'false') {
    return {
      type: 'literal',
      dataType: 'boolean',
      value: trimmed === 'true'
    }
  }

  // Null literal
  if (trimmed === 'null') {
    return {
      type: 'literal',
      dataType: 'null',
      value: null
    }
  }

  // Nested function call
  const funcCall = parseFunctionCall(trimmed)
  if (funcCall) {
    return funcCall
  }

  // Path reference
  return {
    type: 'reference',
    path: trimmed
  }
}

/**
 * Parse a complete expression (without the {{ }})
 */
export function parseExpression(expression) {
  const trimmed = expression.trim()

  // Check for function call
  const funcCall = parseFunctionCall(trimmed)
  if (funcCall) {
    return funcCall
  }

  // Otherwise it's a path reference
  return {
    type: 'reference',
    path: trimmed
  }
}

/**
 * Find all expressions in a string
 */
export function findExpressions(text) {
  if (!text || typeof text !== 'string') return []

  const expressions = []
  let match

  const regex = new RegExp(EXPRESSION_REGEX.source, 'g')
  while ((match = regex.exec(text)) !== null) {
    expressions.push({
      full: match[0],
      content: match[1],
      start: match.index,
      end: match.index + match[0].length,
      parsed: parseExpression(match[1])
    })
  }

  return expressions
}

/**
 * Extract all node references from an expression
 */
export function extractNodeReferences(expression) {
  const refs = []
  const content = expression.replace(/^\{\{|\}\}$/g, '').trim()

  // Pattern for node references: nodes.node_id or nodes["node_id"]
  const nodeRefRegex = /nodes\.([a-zA-Z_][a-zA-Z0-9_]*)|nodes\["([^"]+)"\]|nodes\['([^']+)'\]/g
  let match

  while ((match = nodeRefRegex.exec(content)) !== null) {
    const nodeId = match[1] || match[2] || match[3]
    if (nodeId && !refs.includes(nodeId)) {
      refs.push(nodeId)
    }
  }

  return refs
}

/**
 * Validate an expression against available context
 */
export function validateExpression(expression, context = {}) {
  const result = new ValidationResult()
  const expressions = findExpressions(`{{${expression}}}`)

  if (expressions.length === 0) {
    result.addError('Invalid expression syntax')
    return result
  }

  const parsed = expressions[0].parsed

  if (parsed.type === 'function') {
    validateFunctionCall(parsed, context, result)
  } else if (parsed.type === 'reference') {
    validateReference(parsed.path, context, result)
  }

  return result
}

/**
 * Validate a function call
 */
function validateFunctionCall(funcCall, context, result) {
  const func = allFunctions[funcCall.name]

  if (!func) {
    result.addError(`Unknown function: ${funcCall.name}`)
    return
  }

  // Validate arguments recursively
  for (const arg of funcCall.arguments) {
    if (arg.type === 'reference') {
      validateReference(arg.path, context, result)
    } else if (arg.type === 'function') {
      validateFunctionCall(arg, context, result)
    }
  }
}

/**
 * Validate a path reference
 */
function validateReference(path, context, result) {
  const { nodes = {}, secrets = {}, env = {}, upstreamNodes = [] } = context
  const parts = path.split('.')

  if (parts[0] === 'nodes') {
    const nodeId = parts[1]
    if (nodeId) {
      result.addReference({ type: 'node', id: nodeId, path })

      // Check if node exists
      if (!nodes[nodeId] && !upstreamNodes.includes(nodeId)) {
        result.addWarning(`Node "${nodeId}" may not exist or be upstream`)
      }
    }
  } else if (parts[0] === 'secrets') {
    const secretName = parts[1]
    result.addReference({ type: 'secret', name: secretName, path })

    if (secretName && !secrets[secretName] && !context.availableSecrets?.includes(secretName)) {
      result.addWarning(`Secret "${secretName}" may not be defined`)
    }
  } else if (parts[0] === 'env') {
    const envVar = parts[1]
    result.addReference({ type: 'env', name: envVar, path })
  } else if (parts[0] === 'trigger') {
    result.addReference({ type: 'trigger', path })
  } else if (parts[0] === 'workflow') {
    result.addReference({ type: 'workflow', path })
  } else {
    result.addError(`Unknown reference type: ${parts[0]}. Expected: nodes, secrets, env, trigger, or workflow`)
  }
}

/**
 * Evaluate an expression against data
 */
export function evaluateExpression(expression, data = {}) {
  try {
    const parsed = parseExpression(expression)
    return evaluateParsed(parsed, data)
  } catch (error) {
    return { error: error.message }
  }
}

/**
 * Evaluate a parsed expression
 */
function evaluateParsed(parsed, data) {
  if (parsed.type === 'literal') {
    return parsed.value
  }

  if (parsed.type === 'reference') {
    return resolvePath(data, parsed.path)
  }

  if (parsed.type === 'function') {
    const args = parsed.arguments.map(arg => evaluateParsed(arg, data))
    return executeFunction(parsed.name, ...args)
  }

  return undefined
}

/**
 * Resolve all expressions in a string
 */
export function resolveExpressions(text, data = {}) {
  if (!text || typeof text !== 'string') return text

  return text.replace(EXPRESSION_REGEX, (match, expression) => {
    try {
      const result = evaluateExpression(expression, data)
      if (result && typeof result === 'object') {
        if (result.error) return match // Keep original if error
        return JSON.stringify(result)
      }
      return result ?? ''
    } catch {
      return match // Keep original expression on error
    }
  })
}

/**
 * Get autocomplete suggestions for a partial expression
 */
export function getAutocompleteSuggestions(partialPath, context = {}) {
  const suggestions = []
  const parts = partialPath.split('.')
  const prefix = parts.slice(0, -1).join('.')
  const search = parts[parts.length - 1] || ''

  // Top-level suggestions
  if (parts.length === 1) {
    const topLevel = [
      { type: 'category', value: 'nodes', label: 'nodes', description: 'Access output from other nodes' },
      { type: 'category', value: 'secrets', label: 'secrets', description: 'Access stored secrets' },
      { type: 'category', value: 'env', label: 'env', description: 'Access environment variables' },
      { type: 'category', value: 'trigger', label: 'trigger', description: 'Access trigger data' },
      { type: 'category', value: 'workflow', label: 'workflow', description: 'Access workflow metadata' }
    ]

    return topLevel.filter(s =>
      s.value.toLowerCase().startsWith(search.toLowerCase())
    )
  }

  // Node suggestions
  if (parts[0] === 'nodes') {
    if (parts.length === 2) {
      // Suggest available upstream nodes
      const upstreamNodes = context.upstreamNodes || []
      const allNodes = context.nodes || {}

      const nodeList = upstreamNodes.length > 0
        ? upstreamNodes
        : Object.keys(allNodes)

      return nodeList
        .filter(nodeId => nodeId.toLowerCase().includes(search.toLowerCase()))
        .map(nodeId => ({
          type: 'node',
          value: nodeId,
          label: nodeId,
          description: allNodes[nodeId]?.label || 'Node',
          nodeType: allNodes[nodeId]?.type
        }))
    }

    // Suggest node output schema
    if (parts.length >= 3) {
      const nodeId = parts[1]
      const nodePath = parts.slice(2, -1).join('.')
      const nodeData = context.nodeOutputs?.[nodeId]

      if (nodeData) {
        const resolved = nodePath ? resolvePath(nodeData, nodePath) : nodeData
        if (resolved && typeof resolved === 'object') {
          return Object.keys(resolved)
            .filter(key => key.toLowerCase().includes(search.toLowerCase()))
            .map(key => ({
              type: typeof resolved[key] === 'object' ? 'object' : 'property',
              value: key,
              label: key,
              description: getTypeDescription(resolved[key]),
              preview: getPreview(resolved[key])
            }))
        }
      }

      // Suggest common data paths
      if (parts[2] === 'data' || parts.length === 3) {
        return [
          { type: 'property', value: 'data', label: 'data', description: 'Node output data' },
          { type: 'property', value: 'status', label: 'status', description: 'Execution status' },
          { type: 'property', value: 'error', label: 'error', description: 'Error message if failed' },
          { type: 'property', value: 'executedAt', label: 'executedAt', description: 'Execution timestamp' }
        ].filter(s => s.value.toLowerCase().startsWith(search.toLowerCase()))
      }
    }
  }

  // Secret suggestions
  if (parts[0] === 'secrets' && parts.length === 2) {
    const availableSecrets = context.availableSecrets || []
    return availableSecrets
      .filter(name => name.toLowerCase().includes(search.toLowerCase()))
      .map(name => ({
        type: 'secret',
        value: name,
        label: name,
        description: 'Secret value (hidden)'
      }))
  }

  // Environment variable suggestions
  if (parts[0] === 'env' && parts.length === 2) {
    const availableEnv = context.availableEnv || ['NODE_ENV', 'API_URL', 'DEBUG']
    return availableEnv
      .filter(name => name.toLowerCase().includes(search.toLowerCase()))
      .map(name => ({
        type: 'env',
        value: name,
        label: name,
        description: 'Environment variable'
      }))
  }

  // Trigger data suggestions
  if (parts[0] === 'trigger') {
    const triggerSchema = context.triggerSchema || {
      data: 'Trigger payload data',
      headers: 'Request headers (for webhook)',
      params: 'URL parameters (for webhook)',
      query: 'Query parameters (for webhook)'
    }

    if (parts.length === 2) {
      return Object.entries(triggerSchema)
        .filter(([key]) => key.toLowerCase().includes(search.toLowerCase()))
        .map(([key, desc]) => ({
          type: 'property',
          value: key,
          label: key,
          description: desc
        }))
    }
  }

  // Workflow metadata suggestions
  if (parts[0] === 'workflow' && parts.length === 2) {
    return [
      { type: 'property', value: 'id', label: 'id', description: 'Workflow ID' },
      { type: 'property', value: 'name', label: 'name', description: 'Workflow name' },
      { type: 'property', value: 'executionId', label: 'executionId', description: 'Current execution ID' },
      { type: 'property', value: 'startedAt', label: 'startedAt', description: 'Execution start time' }
    ].filter(s => s.value.toLowerCase().includes(search.toLowerCase()))
  }

  return suggestions
}

/**
 * Helper to get type description
 */
function getTypeDescription(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return `Array (${value.length} items)`
  if (typeof value === 'object') return `Object (${Object.keys(value).length} keys)`
  return typeof value
}

/**
 * Helper to get preview of value
 */
function getPreview(value, maxLength = 50) {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') {
    return value.length > maxLength ? `"${value.slice(0, maxLength)}..."` : `"${value}"`
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value)
    return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`
  }
  return String(value)
}

/**
 * Syntax highlighting tokens for an expression
 */
export function tokenizeExpression(expression) {
  const tokens = []
  let remaining = expression
  let offset = 0

  // Match function names
  const funcMatch = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/)
  if (funcMatch) {
    const funcName = funcMatch[1]
    const isKnownFunc = allFunctions[funcName]
    tokens.push({
      type: isKnownFunc ? 'function' : 'unknown-function',
      value: funcName,
      start: offset,
      end: offset + funcName.length
    })
    offset += funcName.length
    remaining = remaining.slice(funcName.length)
  }

  // Continue tokenizing
  while (remaining.length > 0) {
    // Whitespace
    let match = remaining.match(/^\s+/)
    if (match) {
      tokens.push({ type: 'whitespace', value: match[0], start: offset, end: offset + match[0].length })
      offset += match[0].length
      remaining = remaining.slice(match[0].length)
      continue
    }

    // Operators and punctuation
    match = remaining.match(/^[().,\[\]]/)
    if (match) {
      tokens.push({ type: 'punctuation', value: match[0], start: offset, end: offset + 1 })
      offset += 1
      remaining = remaining.slice(1)
      continue
    }

    // String literals
    match = remaining.match(/^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'/)
    if (match) {
      tokens.push({ type: 'string', value: match[0], start: offset, end: offset + match[0].length })
      offset += match[0].length
      remaining = remaining.slice(match[0].length)
      continue
    }

    // Numbers
    match = remaining.match(/^-?\d+\.?\d*/)
    if (match) {
      tokens.push({ type: 'number', value: match[0], start: offset, end: offset + match[0].length })
      offset += match[0].length
      remaining = remaining.slice(match[0].length)
      continue
    }

    // Keywords (nodes, secrets, env, trigger, workflow)
    match = remaining.match(/^(nodes|secrets|env|trigger|workflow)\b/)
    if (match) {
      tokens.push({ type: 'keyword', value: match[0], start: offset, end: offset + match[0].length })
      offset += match[0].length
      remaining = remaining.slice(match[0].length)
      continue
    }

    // Booleans and null
    match = remaining.match(/^(true|false|null)\b/)
    if (match) {
      tokens.push({ type: 'boolean', value: match[0], start: offset, end: offset + match[0].length })
      offset += match[0].length
      remaining = remaining.slice(match[0].length)
      continue
    }

    // Identifiers
    match = remaining.match(/^[a-zA-Z_][a-zA-Z0-9_]*/)
    if (match) {
      tokens.push({ type: 'identifier', value: match[0], start: offset, end: offset + match[0].length })
      offset += match[0].length
      remaining = remaining.slice(match[0].length)
      continue
    }

    // Unknown character
    tokens.push({ type: 'unknown', value: remaining[0], start: offset, end: offset + 1 })
    offset += 1
    remaining = remaining.slice(1)
  }

  return tokens
}

/**
 * Check if cursor is inside an expression
 */
export function getCursorContext(text, cursorPosition) {
  // Find if we're inside {{...}}
  let depth = 0
  let expressionStart = -1
  let expressionEnd = -1

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{' && text[i + 1] === '{') {
      if (depth === 0 && i < cursorPosition) {
        expressionStart = i + 2
      }
      depth++
      i++
    } else if (text[i] === '}' && text[i + 1] === '}') {
      depth--
      if (depth === 0 && expressionStart !== -1) {
        if (cursorPosition <= i) {
          expressionEnd = i
          break
        } else {
          expressionStart = -1
        }
      }
      i++
    }
  }

  if (expressionStart === -1 || cursorPosition < expressionStart) {
    return { inExpression: false }
  }

  const expressionContent = text.slice(expressionStart, expressionEnd !== -1 ? expressionEnd : cursorPosition)
  const cursorOffset = cursorPosition - expressionStart

  // Find what part of the expression we're in
  const beforeCursor = expressionContent.slice(0, cursorOffset)

  // Check if we're in a function call
  const lastOpenParen = beforeCursor.lastIndexOf('(')
  const lastCloseParen = beforeCursor.lastIndexOf(')')

  const inFunctionArgs = lastOpenParen > lastCloseParen

  // Find the current path segment
  const lastDot = beforeCursor.lastIndexOf('.')
  const lastComma = beforeCursor.lastIndexOf(',')
  const lastParen = Math.max(beforeCursor.lastIndexOf('('), beforeCursor.lastIndexOf(')'))

  const segmentStart = Math.max(lastDot, lastComma, lastParen) + 1
  const currentSegment = beforeCursor.slice(segmentStart).trim()

  // Get full path to current position
  let pathStart = 0
  if (inFunctionArgs) {
    pathStart = Math.max(lastOpenParen, lastComma) + 1
  }
  const fullPath = beforeCursor.slice(pathStart).trim()

  return {
    inExpression: true,
    expressionStart,
    expressionEnd,
    expressionContent,
    cursorOffset,
    beforeCursor,
    currentSegment,
    fullPath,
    inFunctionArgs
  }
}

export default {
  findExpressions,
  parseExpression,
  parsePath,
  resolvePath,
  validateExpression,
  evaluateExpression,
  resolveExpressions,
  getAutocompleteSuggestions,
  tokenizeExpression,
  getCursorContext,
  extractNodeReferences
}
