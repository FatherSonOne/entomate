/**
 * BaseNode - Abstract base class for all node handlers
 *
 * Provides common utilities and interface definition
 */

const log = require('../../../utils/log');

class BaseNode {
  /**
   * Execute the node
   * @param {Object} config - Node configuration
   * @param {Object} inputData - Input data from previous node
   * @param {Object} context - Execution context
   * @returns {Object} { output: string, data: any }
   */
  static async execute(config, inputData, context) {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * Get test data for this node type
   * @returns {Object} Sample input data
   */
  static getTestData() {
    return {};
  }

  /**
   * Validate node configuration
   * @param {Object} config - Node configuration
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  static validate(config) {
    return { valid: true, errors: [] };
  }

  /**
   * Interpolate variables in a string
   * Supports: {{field}}, {{nested.field}}, {{$input.field}}
   */
  static interpolate(template, data) {
    if (!template || typeof template !== 'string') return template;

    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(data, path.trim());
      return value !== undefined ? value : match;
    });
  }

  /**
   * Get nested value from object using dot notation
   */
  static getNestedValue(obj, path) {
    if (!obj || !path) return undefined;

    // Handle special prefixes
    if (path.startsWith('$input.')) {
      path = path.substring(7);
    }

    return path.split('.').reduce((curr, key) => {
      if (curr === undefined || curr === null) return undefined;
      if (FORBIDDEN_KEYS.has(key)) return undefined;
      return curr[key];
    }, obj);
  }

  /**
   * Set nested value in object using dot notation
   */
  static setNestedValue(obj, path, value) {
    const keys = path.split('.');
    // Block prototype pollution: `__proto__.x` would change every object in
    // the server process.
    if (keys.some(k => FORBIDDEN_KEYS.has(k))) {
      throw new Error(`Invalid path: ${path}`);
    }
    const lastKey = keys.pop();
    let current = obj;

    for (const key of keys) {
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    current[lastKey] = value;
    return obj;
  }

  /**
   * Deep clone an object
   */
  static deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Merge objects deeply
   */
  static deepMerge(target, source) {
    const output = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = this.deepMerge(output[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    }

    return output;
  }

  /**
   * Evaluate a condition
   */
  static evaluateCondition(condition, data) {
    const { field, operator, value } = condition;
    const fieldValue = this.getNestedValue(data, field);

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'contains':
        return String(fieldValue).includes(value);
      case 'not_contains':
        return !String(fieldValue).includes(value);
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      case 'greater_than_or_equals':
        return Number(fieldValue) >= Number(value);
      case 'less_than_or_equals':
        return Number(fieldValue) <= Number(value);
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;
      case 'is_empty':
        return !fieldValue || (Array.isArray(fieldValue) && fieldValue.length === 0) ||
               (typeof fieldValue === 'string' && fieldValue.trim() === '');
      case 'is_not_empty':
        return fieldValue && (!Array.isArray(fieldValue) || fieldValue.length > 0) &&
               (typeof fieldValue !== 'string' || fieldValue.trim() !== '');
      case 'starts_with':
        return String(fieldValue).startsWith(value);
      case 'ends_with':
        return String(fieldValue).endsWith(value);
      case 'regex':
        try {
          return new RegExp(value).test(String(fieldValue));
        } catch {
          return false;
        }
      case 'in':
        return Array.isArray(value) ? value.includes(fieldValue) : false;
      case 'not_in':
        return Array.isArray(value) ? !value.includes(fieldValue) : true;
      default:
        log.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Evaluate multiple conditions with AND/OR logic
   */
  static evaluateConditions(conditions, data) {
    if (!conditions || conditions.length === 0) return true;

    let result = this.evaluateCondition(conditions[0], data);

    for (let i = 1; i < conditions.length; i++) {
      const condition = conditions[i];
      const condResult = this.evaluateCondition(condition, data);
      const combineWith = condition.combineWith || 'AND';

      if (combineWith === 'AND') {
        result = result && condResult;
      } else {
        result = result || condResult;
      }
    }

    return result;
  }

  /**
   * Wait for specified duration
   */
  static async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry an operation with exponential backoff
   */
  static async retry(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          log.info(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
          await this.wait(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Format date using simple patterns
   */
  static formatDate(date, format = 'YYYY-MM-DD') {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');

    const replacements = {
      'YYYY': d.getFullYear(),
      'YY': String(d.getFullYear()).slice(-2),
      'MM': pad(d.getMonth() + 1),
      'DD': pad(d.getDate()),
      'HH': pad(d.getHours()),
      'mm': pad(d.getMinutes()),
      'ss': pad(d.getSeconds()),
      'SSS': String(d.getMilliseconds()).padStart(3, '0')
    };

    let result = format;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(key, value);
    }

    return result;
  }

  /**
   * Evaluate a small expression such as `$item.price * 2` or
   * `$item.status == "open" && $item.count > 0`.
   *
   * This is a tiny interpreter, not JavaScript: it only knows numbers,
   * strings, true/false/null, `$path` lookups, arithmetic, comparisons,
   * `&& || !` and parentheses. User text is never compiled or run as code
   * (the old version used `new Function`, which gave workflows full server
   * access). On any parse error the original string is returned, as before.
   */
  static evaluateExpression(expression, data) {
    try {
      if (typeof expression !== 'string') return expression;
      const tokens = tokenizeExpression(expression);
      const parser = new ExpressionParser(tokens, (path) => this.getNestedValue(data, path));
      const result = parser.parseExpression();
      if (parser.pos !== tokens.length) throw new Error('Unexpected token');
      return result;
    } catch (error) {
      log.warn('Expression evaluation failed:', error.message);
      return expression;
    }
  }
}


// ----------------------------------------------------------------------------
// Safe expression interpreter used by BaseNode.evaluateExpression
// ----------------------------------------------------------------------------

const MAX_EXPRESSION_LENGTH = 500;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function tokenizeExpression(src) {
  if (src.length > MAX_EXPRESSION_LENGTH) throw new Error('Expression too long');
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }

    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/.exec(src.slice(i));
      tokens.push({ type: 'value', value: Number(m[0]) });
      i += m[0].length;
      continue;
    }

    if (ch === '"' || ch === "'") {
      let j = i + 1;
      let str = '';
      while (j < src.length && src[j] !== ch) {
        if (src[j] === '\\' && j + 1 < src.length) { str += src[j + 1]; j += 2; continue; }
        str += src[j++];
      }
      if (j >= src.length) throw new Error('Unterminated string');
      tokens.push({ type: 'value', value: str });
      i = j + 1;
      continue;
    }

    if (ch === '$') {
      const m = /^\$([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*)/.exec(src.slice(i));
      if (!m) throw new Error('Invalid variable');
      tokens.push({ type: 'var', path: m[1] });
      i += m[0].length;
      continue;
    }

    const word = /^[a-zA-Z_]+/.exec(src.slice(i));
    if (word) {
      const literals = { true: true, false: false, null: null };
      if (!(word[0] in literals)) throw new Error(`Unknown word: ${word[0]}`);
      tokens.push({ type: 'value', value: literals[word[0]] });
      i += word[0].length;
      continue;
    }

    const op = /^(===|!==|==|!=|<=|>=|&&|\|\||[-+*/%<>!()])/.exec(src.slice(i));
    if (!op) throw new Error(`Unexpected character: ${ch}`);
    tokens.push({ type: 'op', value: op[0] });
    i += op[0].length;
  }
  return tokens;
}

class ExpressionParser {
  constructor(tokens, lookup) {
    this.tokens = tokens;
    this.lookup = lookup;
    this.pos = 0;
  }

  peekOp(...ops) {
    const t = this.tokens[this.pos];
    return t && t.type === 'op' && ops.includes(t.value) ? t.value : null;
  }

  binary(next, ops, apply) {
    let left = next();
    let op;
    while ((op = this.peekOp(...ops))) {
      this.pos++;
      left = apply(op, left, next());
    }
    return left;
  }

  parseExpression() {
    return this.binary(() => this.parseAnd(), ['||'], (_, a, b) => a || b);
  }

  parseAnd() {
    return this.binary(() => this.parseEquality(), ['&&'], (_, a, b) => a && b);
  }

  parseEquality() {
    return this.binary(() => this.parseComparison(), ['===', '!==', '==', '!='], (op, a, b) => {
      // == and != compare strictly so "1" == 1 can't surprise anyone.
      const equal = a === b;
      return op === '===' || op === '==' ? equal : !equal;
    });
  }

  parseComparison() {
    return this.binary(() => this.parseAdditive(), ['<', '<=', '>', '>='], (op, a, b) => {
      if (op === '<') return a < b;
      if (op === '<=') return a <= b;
      if (op === '>') return a > b;
      return a >= b;
    });
  }

  parseAdditive() {
    return this.binary(() => this.parseMultiplicative(), ['+', '-'], (op, a, b) => (
      op === '+' ? a + b : a - b
    ));
  }

  parseMultiplicative() {
    return this.binary(() => this.parseUnary(), ['*', '/', '%'], (op, a, b) => {
      if (op === '*') return a * b;
      if (op === '/') return a / b;
      return a % b;
    });
  }

  parseUnary() {
    const op = this.peekOp('!', '-');
    if (op) {
      this.pos++;
      const v = this.parseUnary();
      return op === '!' ? !v : -v;
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const t = this.tokens[this.pos];
    if (!t) throw new Error('Unexpected end of expression');
    if (t.type === 'op' && t.value === '(') {
      this.pos++;
      const v = this.parseExpression();
      if (!this.peekOp(')')) throw new Error('Missing )');
      this.pos++;
      return v;
    }
    if (t.type === 'value') { this.pos++; return t.value; }
    if (t.type === 'var') {
      this.pos++;
      if (t.path.split('.').some(k => FORBIDDEN_KEYS.has(k))) throw new Error('Forbidden path');
      return this.lookup(t.path);
    }
    throw new Error(`Unexpected token: ${t.value}`);
  }
}

module.exports = BaseNode;
