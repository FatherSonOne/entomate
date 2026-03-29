/**
 * Data Node Handlers
 *
 * Data transformation, manipulation, and formatting
 */

const BaseNode = require('./BaseNode');
const log = require('../../../utils/log');

/**
 * Transform Node - Map and transform data structure
 */
class TransformNode extends BaseNode {
  static async execute(config, inputData, context) {
    const { mappings = [] } = config;

    log.info(`[TransformNode] Applying ${mappings.length} mappings`);

    const result = {};

    for (const mapping of mappings) {
      const { source, target, transform } = mapping;

      // Get source value
      let value = this.getNestedValue(inputData, source);

      // Apply transformation if specified
      if (transform && value !== undefined) {
        value = this.applyTransform(value, transform);
      }

      // Set target value
      this.setNestedValue(result, target, value);
    }

    return {
      output: 'main',
      data: result
    };
  }

  static applyTransform(value, transform) {
    switch (transform.type) {
      case 'uppercase':
        return String(value).toUpperCase();

      case 'lowercase':
        return String(value).toLowerCase();

      case 'trim':
        return String(value).trim();

      case 'number':
        return Number(value);

      case 'string':
        return String(value);

      case 'boolean':
        return Boolean(value);

      case 'json_parse':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }

      case 'json_stringify':
        return JSON.stringify(value);

      case 'split':
        return String(value).split(transform.delimiter || ',');

      case 'join':
        return Array.isArray(value) ? value.join(transform.delimiter || ', ') : value;

      case 'replace':
        return String(value).replace(new RegExp(transform.find, 'g'), transform.replace);

      case 'slice':
        if (Array.isArray(value) || typeof value === 'string') {
          return value.slice(transform.start, transform.end);
        }
        return value;

      case 'default':
        return value ?? transform.defaultValue;

      case 'map':
        if (Array.isArray(value) && transform.expression) {
          return value.map(item => this.evaluateExpression(transform.expression, { item }));
        }
        return value;

      case 'filter':
        if (Array.isArray(value) && transform.condition) {
          return value.filter(item => this.evaluateCondition(transform.condition, { item }));
        }
        return value;

      default:
        return value;
    }
  }
}

/**
 * Split Node - Split string into array or explode array to items
 */
class SplitNode extends BaseNode {
  static async execute(config, inputData, context) {
    const { field, delimiter = ',' } = config;

    const value = this.getNestedValue(inputData, field);

    if (typeof value === 'string') {
      // Split string
      const items = value.split(delimiter).map(s => s.trim()).filter(s => s);
      log.info(`[SplitNode] Split string into ${items.length} items`);

      return {
        output: 'main',
        data: {
          ...inputData,
          items
        }
      };
    } else if (Array.isArray(value)) {
      // Return individual items (will be used with loop)
      log.info(`[SplitNode] Array has ${value.length} items`);

      return {
        output: 'main',
        data: {
          ...inputData,
          items: value,
          itemCount: value.length
        }
      };
    }

    return {
      output: 'main',
      data: inputData
    };
  }
}

/**
 * Set Node - Set or modify data fields
 */
class SetNode extends BaseNode {
  static async execute(config, inputData, context) {
    const { values = {}, mode = 'set' } = config;

    let result;

    switch (mode) {
      case 'set':
        // Merge values into input
        result = { ...inputData };
        for (const [key, value] of Object.entries(values)) {
          const resolvedValue = typeof value === 'string'
            ? this.interpolate(value, inputData)
            : value;
          this.setNestedValue(result, key, resolvedValue);
        }
        break;

      case 'append':
        // Append to arrays
        result = { ...inputData };
        for (const [key, value] of Object.entries(values)) {
          const existing = this.getNestedValue(result, key);
          if (Array.isArray(existing)) {
            this.setNestedValue(result, key, [...existing, value]);
          } else {
            this.setNestedValue(result, key, [existing, value].filter(v => v !== undefined));
          }
        }
        break;

      case 'remove':
        // Remove specified fields
        result = this.deepClone(inputData);
        for (const key of Object.keys(values)) {
          const keys = key.split('.');
          let current = result;
          for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
            if (!current) break;
          }
          if (current) {
            delete current[keys[keys.length - 1]];
          }
        }
        break;

      default:
        result = inputData;
    }

    log.info(`[SetNode] ${mode} ${Object.keys(values).length} fields`);

    return {
      output: 'main',
      data: result
    };
  }
}

/**
 * Date Time Node - Date manipulation and formatting
 */
class DateTimeNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      operation = 'now',
      inputField,
      format = 'YYYY-MM-DD',
      amount,
      unit,
      outputField = 'date'
    } = config;

    let result;

    switch (operation) {
      case 'now':
        result = new Date();
        break;

      case 'format':
        const dateValue = inputField ? this.getNestedValue(inputData, inputField) : new Date();
        const date = new Date(dateValue);
        result = this.formatDate(date, format);
        break;

      case 'add':
        const addDate = new Date(inputField ? this.getNestedValue(inputData, inputField) : Date.now());
        result = this.addToDate(addDate, amount, unit);
        break;

      case 'subtract':
        const subDate = new Date(inputField ? this.getNestedValue(inputData, inputField) : Date.now());
        result = this.addToDate(subDate, -amount, unit);
        break;

      case 'diff':
        const date1 = new Date(this.getNestedValue(inputData, config.date1Field));
        const date2 = new Date(this.getNestedValue(inputData, config.date2Field));
        result = this.dateDiff(date1, date2, unit);
        break;

      case 'parse':
        const parseValue = this.getNestedValue(inputData, inputField);
        result = new Date(parseValue).toISOString();
        break;

      case 'start_of':
        const startDate = new Date(inputField ? this.getNestedValue(inputData, inputField) : Date.now());
        result = this.startOf(startDate, unit);
        break;

      case 'end_of':
        const endDate = new Date(inputField ? this.getNestedValue(inputData, inputField) : Date.now());
        result = this.endOf(endDate, unit);
        break;

      default:
        result = new Date().toISOString();
    }

    log.info(`[DateTimeNode] ${operation}: ${result}`);

    return {
      output: 'main',
      data: {
        ...inputData,
        [outputField]: result
      }
    };
  }

  static addToDate(date, amount, unit) {
    const d = new Date(date);

    switch (unit) {
      case 'milliseconds':
        d.setMilliseconds(d.getMilliseconds() + amount);
        break;
      case 'seconds':
        d.setSeconds(d.getSeconds() + amount);
        break;
      case 'minutes':
        d.setMinutes(d.getMinutes() + amount);
        break;
      case 'hours':
        d.setHours(d.getHours() + amount);
        break;
      case 'days':
        d.setDate(d.getDate() + amount);
        break;
      case 'weeks':
        d.setDate(d.getDate() + (amount * 7));
        break;
      case 'months':
        d.setMonth(d.getMonth() + amount);
        break;
      case 'years':
        d.setFullYear(d.getFullYear() + amount);
        break;
    }

    return d.toISOString();
  }

  static dateDiff(date1, date2, unit) {
    const diff = date2.getTime() - date1.getTime();

    switch (unit) {
      case 'milliseconds':
        return diff;
      case 'seconds':
        return Math.floor(diff / 1000);
      case 'minutes':
        return Math.floor(diff / (1000 * 60));
      case 'hours':
        return Math.floor(diff / (1000 * 60 * 60));
      case 'days':
        return Math.floor(diff / (1000 * 60 * 60 * 24));
      case 'weeks':
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
      default:
        return diff;
    }
  }

  static startOf(date, unit) {
    const d = new Date(date);

    switch (unit) {
      case 'day':
        d.setHours(0, 0, 0, 0);
        break;
      case 'week':
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay());
        break;
      case 'month':
        d.setHours(0, 0, 0, 0);
        d.setDate(1);
        break;
      case 'year':
        d.setHours(0, 0, 0, 0);
        d.setMonth(0, 1);
        break;
    }

    return d.toISOString();
  }

  static endOf(date, unit) {
    const d = new Date(date);

    switch (unit) {
      case 'day':
        d.setHours(23, 59, 59, 999);
        break;
      case 'week':
        d.setHours(23, 59, 59, 999);
        d.setDate(d.getDate() + (6 - d.getDay()));
        break;
      case 'month':
        d.setMonth(d.getMonth() + 1, 0);
        d.setHours(23, 59, 59, 999);
        break;
      case 'year':
        d.setMonth(11, 31);
        d.setHours(23, 59, 59, 999);
        break;
    }

    return d.toISOString();
  }
}

/**
 * JSON Node - Parse, stringify, and manipulate JSON
 */
class JsonNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      operation = 'parse',
      inputField,
      outputField = 'json'
    } = config;

    const value = inputField ? this.getNestedValue(inputData, inputField) : inputData;

    let result;

    switch (operation) {
      case 'parse':
        if (typeof value === 'string') {
          result = JSON.parse(value);
        } else {
          result = value;
        }
        break;

      case 'stringify':
        result = JSON.stringify(value, null, 2);
        break;

      case 'query':
        // Simple JSON path query
        if (config.path) {
          result = this.getNestedValue(value, config.path);
        } else {
          result = value;
        }
        break;

      case 'merge':
        // Merge multiple JSON objects
        const sources = config.sources?.map(s => this.getNestedValue(inputData, s)) || [];
        result = Object.assign({}, ...sources);
        break;

      default:
        result = value;
    }

    log.info(`[JsonNode] ${operation}`);

    return {
      output: 'main',
      data: {
        ...inputData,
        [outputField]: result
      }
    };
  }
}

/**
 * Crypto Node - Hashing and encoding
 */
class CryptoNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      operation = 'hash',
      inputField,
      algorithm = 'sha256',
      encoding = 'hex',
      outputField = 'result'
    } = config;

    const crypto = require('crypto');
    const value = this.getNestedValue(inputData, inputField);

    let result;

    switch (operation) {
      case 'hash':
        const hash = crypto.createHash(algorithm);
        hash.update(String(value));
        result = hash.digest(encoding);
        break;

      case 'hmac':
        const hmac = crypto.createHmac(algorithm, config.secret);
        hmac.update(String(value));
        result = hmac.digest(encoding);
        break;

      case 'base64_encode':
        result = Buffer.from(String(value)).toString('base64');
        break;

      case 'base64_decode':
        result = Buffer.from(String(value), 'base64').toString('utf8');
        break;

      case 'uuid':
        result = crypto.randomUUID();
        break;

      case 'random':
        result = crypto.randomBytes(config.bytes || 32).toString(encoding);
        break;

      default:
        result = value;
    }

    log.info(`[CryptoNode] ${operation}`);

    return {
      output: 'main',
      data: {
        ...inputData,
        [outputField]: result
      }
    };
  }
}

module.exports = {
  TransformNode,
  SplitNode,
  SetNode,
  DateTimeNode,
  JsonNode,
  CryptoNode
};
