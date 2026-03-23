/**
 * BaseNode - Abstract base class for all node handlers
 *
 * Provides common utilities and interface definition
 */

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
      return curr[key];
    }, obj);
  }

  /**
   * Set nested value in object using dot notation
   */
  static setNestedValue(obj, path, value) {
    const keys = path.split('.');
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
   * Parse expression and return result
   * Supports basic JavaScript expressions in a safe context
   */
  static evaluateExpression(expression, data) {
    // Simple expression evaluation for safe operations
    try {
      // Replace variable references with actual values
      const resolved = expression.replace(/\$([a-zA-Z_][a-zA-Z0-9_.]*)/g, (match, path) => {
        const value = this.getNestedValue(data, path);
        return JSON.stringify(value);
      });

      // Only allow safe operations
      if (/[;{}]/.test(resolved)) {
        throw new Error('Invalid expression: contains forbidden characters');
      }

      // Use Function constructor for evaluation (safer than eval)
      // eslint-disable-next-line no-new-func
      const fn = new Function('data', `return ${resolved}`);
      return fn(data);
    } catch (error) {
      log.warn('Expression evaluation failed:', error.message);
      return expression;
    }
  }
}

module.exports = BaseNode;
