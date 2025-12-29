/**
 * Expression Functions
 *
 * Built-in functions available in workflow expressions
 * Usage: {{uppercase(nodes.http_request_1.data.name)}}
 */

/**
 * String Functions
 */
export const stringFunctions = {
  uppercase: {
    name: 'uppercase',
    description: 'Converts text to uppercase',
    category: 'String',
    signature: 'uppercase(text)',
    example: '{{uppercase(nodes.x.data.name)}}',
    fn: (value) => {
      if (typeof value !== 'string') return String(value || '').toUpperCase()
      return value.toUpperCase()
    }
  },

  lowercase: {
    name: 'lowercase',
    description: 'Converts text to lowercase',
    category: 'String',
    signature: 'lowercase(text)',
    example: '{{lowercase(nodes.x.data.email)}}',
    fn: (value) => {
      if (typeof value !== 'string') return String(value || '').toLowerCase()
      return value.toLowerCase()
    }
  },

  trim: {
    name: 'trim',
    description: 'Removes leading and trailing whitespace',
    category: 'String',
    signature: 'trim(text)',
    example: '{{trim(nodes.x.data.input)}}',
    fn: (value) => {
      if (typeof value !== 'string') return String(value || '').trim()
      return value.trim()
    }
  },

  substring: {
    name: 'substring',
    description: 'Extracts a portion of text',
    category: 'String',
    signature: 'substring(text, start, end?)',
    example: '{{substring(nodes.x.data.text, 0, 10)}}',
    fn: (value, start, end) => {
      const str = String(value || '')
      return end !== undefined ? str.substring(start, end) : str.substring(start)
    }
  },

  replace: {
    name: 'replace',
    description: 'Replaces occurrences of a pattern',
    category: 'String',
    signature: 'replace(text, search, replacement)',
    example: '{{replace(nodes.x.data.text, "old", "new")}}',
    fn: (value, search, replacement) => {
      const str = String(value || '')
      return str.replaceAll(search, replacement)
    }
  },

  split: {
    name: 'split',
    description: 'Splits text into an array',
    category: 'String',
    signature: 'split(text, delimiter)',
    example: '{{split(nodes.x.data.csv, ",")}}',
    fn: (value, delimiter = ',') => {
      const str = String(value || '')
      return str.split(delimiter)
    }
  },

  join: {
    name: 'join',
    description: 'Joins array elements into text',
    category: 'String',
    signature: 'join(array, delimiter)',
    example: '{{join(nodes.x.data.items, ", ")}}',
    fn: (value, delimiter = ', ') => {
      if (!Array.isArray(value)) return String(value || '')
      return value.join(delimiter)
    }
  },

  length: {
    name: 'length',
    description: 'Returns the length of text or array',
    category: 'String',
    signature: 'length(value)',
    example: '{{length(nodes.x.data.items)}}',
    fn: (value) => {
      if (Array.isArray(value)) return value.length
      return String(value || '').length
    }
  },

  capitalize: {
    name: 'capitalize',
    description: 'Capitalizes the first letter of each word',
    category: 'String',
    signature: 'capitalize(text)',
    example: '{{capitalize(nodes.x.data.name)}}',
    fn: (value) => {
      const str = String(value || '')
      return str.replace(/\b\w/g, (char) => char.toUpperCase())
    }
  },

  slugify: {
    name: 'slugify',
    description: 'Converts text to URL-friendly slug',
    category: 'String',
    signature: 'slugify(text)',
    example: '{{slugify(nodes.x.data.title)}}',
    fn: (value) => {
      const str = String(value || '')
      return str
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
    }
  },

  padStart: {
    name: 'padStart',
    description: 'Pads the start of a string',
    category: 'String',
    signature: 'padStart(text, length, char)',
    example: '{{padStart(nodes.x.data.id, 5, "0")}}',
    fn: (value, length, char = ' ') => {
      return String(value || '').padStart(length, char)
    }
  },

  padEnd: {
    name: 'padEnd',
    description: 'Pads the end of a string',
    category: 'String',
    signature: 'padEnd(text, length, char)',
    example: '{{padEnd(nodes.x.data.code, 10, "-")}}',
    fn: (value, length, char = ' ') => {
      return String(value || '').padEnd(length, char)
    }
  }
}

/**
 * Date/Time Functions
 */
export const dateFunctions = {
  now: {
    name: 'now',
    description: 'Returns current date/time as ISO string',
    category: 'DateTime',
    signature: 'now()',
    example: '{{now()}}',
    fn: () => new Date().toISOString()
  },

  timestamp: {
    name: 'timestamp',
    description: 'Returns current Unix timestamp in milliseconds',
    category: 'DateTime',
    signature: 'timestamp()',
    example: '{{timestamp()}}',
    fn: () => Date.now()
  },

  formatDate: {
    name: 'formatDate',
    description: 'Formats a date using a pattern',
    category: 'DateTime',
    signature: 'formatDate(date, format)',
    example: '{{formatDate(nodes.x.data.date, "YYYY-MM-DD")}}',
    fn: (value, format = 'YYYY-MM-DD') => {
      const date = value ? new Date(value) : new Date()
      if (isNaN(date.getTime())) return 'Invalid Date'

      const pad = (n) => String(n).padStart(2, '0')
      const year = date.getFullYear()
      const month = pad(date.getMonth() + 1)
      const day = pad(date.getDate())
      const hours = pad(date.getHours())
      const minutes = pad(date.getMinutes())
      const seconds = pad(date.getSeconds())

      return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds)
    }
  },

  parseDate: {
    name: 'parseDate',
    description: 'Parses a date string into ISO format',
    category: 'DateTime',
    signature: 'parseDate(dateString)',
    example: '{{parseDate(nodes.x.data.dateStr)}}',
    fn: (value) => {
      const date = new Date(value)
      if (isNaN(date.getTime())) return null
      return date.toISOString()
    }
  },

  addDays: {
    name: 'addDays',
    description: 'Adds days to a date',
    category: 'DateTime',
    signature: 'addDays(date, days)',
    example: '{{addDays(now(), 7)}}',
    fn: (value, days) => {
      const date = value ? new Date(value) : new Date()
      date.setDate(date.getDate() + Number(days))
      return date.toISOString()
    }
  },

  addHours: {
    name: 'addHours',
    description: 'Adds hours to a date',
    category: 'DateTime',
    signature: 'addHours(date, hours)',
    example: '{{addHours(now(), 24)}}',
    fn: (value, hours) => {
      const date = value ? new Date(value) : new Date()
      date.setHours(date.getHours() + Number(hours))
      return date.toISOString()
    }
  },

  dayOfWeek: {
    name: 'dayOfWeek',
    description: 'Returns day of week (0=Sunday)',
    category: 'DateTime',
    signature: 'dayOfWeek(date)',
    example: '{{dayOfWeek(now())}}',
    fn: (value) => {
      const date = value ? new Date(value) : new Date()
      return date.getDay()
    }
  },

  isWeekend: {
    name: 'isWeekend',
    description: 'Checks if date is on weekend',
    category: 'DateTime',
    signature: 'isWeekend(date)',
    example: '{{isWeekend(now())}}',
    fn: (value) => {
      const date = value ? new Date(value) : new Date()
      const day = date.getDay()
      return day === 0 || day === 6
    }
  },

  diffDays: {
    name: 'diffDays',
    description: 'Calculates difference in days between two dates',
    category: 'DateTime',
    signature: 'diffDays(date1, date2)',
    example: '{{diffDays(nodes.x.data.startDate, now())}}',
    fn: (date1, date2) => {
      const d1 = new Date(date1)
      const d2 = date2 ? new Date(date2) : new Date()
      const diffTime = Math.abs(d2 - d1)
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    }
  }
}

/**
 * Number Functions
 */
export const numberFunctions = {
  round: {
    name: 'round',
    description: 'Rounds to nearest integer or decimal places',
    category: 'Number',
    signature: 'round(value, decimals?)',
    example: '{{round(nodes.x.data.price, 2)}}',
    fn: (value, decimals = 0) => {
      const num = Number(value)
      if (isNaN(num)) return 0
      const factor = Math.pow(10, decimals)
      return Math.round(num * factor) / factor
    }
  },

  floor: {
    name: 'floor',
    description: 'Rounds down to nearest integer',
    category: 'Number',
    signature: 'floor(value)',
    example: '{{floor(nodes.x.data.amount)}}',
    fn: (value) => Math.floor(Number(value) || 0)
  },

  ceil: {
    name: 'ceil',
    description: 'Rounds up to nearest integer',
    category: 'Number',
    signature: 'ceil(value)',
    example: '{{ceil(nodes.x.data.amount)}}',
    fn: (value) => Math.ceil(Number(value) || 0)
  },

  abs: {
    name: 'abs',
    description: 'Returns absolute value',
    category: 'Number',
    signature: 'abs(value)',
    example: '{{abs(nodes.x.data.difference)}}',
    fn: (value) => Math.abs(Number(value) || 0)
  },

  min: {
    name: 'min',
    description: 'Returns minimum of values',
    category: 'Number',
    signature: 'min(a, b, ...)',
    example: '{{min(nodes.x.data.values)}}',
    fn: (...values) => {
      const nums = values.flat().map(Number).filter(n => !isNaN(n))
      return nums.length ? Math.min(...nums) : 0
    }
  },

  max: {
    name: 'max',
    description: 'Returns maximum of values',
    category: 'Number',
    signature: 'max(a, b, ...)',
    example: '{{max(nodes.x.data.values)}}',
    fn: (...values) => {
      const nums = values.flat().map(Number).filter(n => !isNaN(n))
      return nums.length ? Math.max(...nums) : 0
    }
  },

  sum: {
    name: 'sum',
    description: 'Returns sum of values',
    category: 'Number',
    signature: 'sum(array)',
    example: '{{sum(nodes.x.data.amounts)}}',
    fn: (...values) => {
      const nums = values.flat().map(Number).filter(n => !isNaN(n))
      return nums.reduce((a, b) => a + b, 0)
    }
  },

  avg: {
    name: 'avg',
    description: 'Returns average of values',
    category: 'Number',
    signature: 'avg(array)',
    example: '{{avg(nodes.x.data.scores)}}',
    fn: (...values) => {
      const nums = values.flat().map(Number).filter(n => !isNaN(n))
      if (!nums.length) return 0
      return nums.reduce((a, b) => a + b, 0) / nums.length
    }
  },

  random: {
    name: 'random',
    description: 'Returns random number between min and max',
    category: 'Number',
    signature: 'random(min?, max?)',
    example: '{{random(1, 100)}}',
    fn: (min = 0, max = 1) => {
      return Math.random() * (max - min) + min
    }
  },

  toFixed: {
    name: 'toFixed',
    description: 'Formats number with fixed decimal places',
    category: 'Number',
    signature: 'toFixed(value, decimals)',
    example: '{{toFixed(nodes.x.data.price, 2)}}',
    fn: (value, decimals = 2) => {
      const num = Number(value)
      if (isNaN(num)) return '0.00'
      return num.toFixed(decimals)
    }
  },

  percentage: {
    name: 'percentage',
    description: 'Calculates percentage',
    category: 'Number',
    signature: 'percentage(value, total)',
    example: '{{percentage(nodes.x.data.completed, nodes.x.data.total)}}',
    fn: (value, total) => {
      const num = Number(value)
      const tot = Number(total)
      if (isNaN(num) || isNaN(tot) || tot === 0) return 0
      return (num / tot) * 100
    }
  }
}

/**
 * JSON/Object Functions
 */
export const objectFunctions = {
  jsonPath: {
    name: 'jsonPath',
    description: 'Extracts value using JSON path notation',
    category: 'Object',
    signature: 'jsonPath(object, path)',
    example: '{{jsonPath(nodes.x.data, "users[0].name")}}',
    fn: (obj, path) => {
      if (!obj || !path) return undefined
      const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
      let current = obj
      for (const part of parts) {
        if (current == null) return undefined
        current = current[part]
      }
      return current
    }
  },

  keys: {
    name: 'keys',
    description: 'Returns object keys as array',
    category: 'Object',
    signature: 'keys(object)',
    example: '{{keys(nodes.x.data.response)}}',
    fn: (obj) => {
      if (typeof obj !== 'object' || obj === null) return []
      return Object.keys(obj)
    }
  },

  values: {
    name: 'values',
    description: 'Returns object values as array',
    category: 'Object',
    signature: 'values(object)',
    example: '{{values(nodes.x.data.mapping)}}',
    fn: (obj) => {
      if (typeof obj !== 'object' || obj === null) return []
      return Object.values(obj)
    }
  },

  stringify: {
    name: 'stringify',
    description: 'Converts value to JSON string',
    category: 'Object',
    signature: 'stringify(value, pretty?)',
    example: '{{stringify(nodes.x.data, true)}}',
    fn: (value, pretty = false) => {
      try {
        return pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value)
      } catch {
        return String(value)
      }
    }
  },

  parse: {
    name: 'parse',
    description: 'Parses JSON string to object',
    category: 'Object',
    signature: 'parse(jsonString)',
    example: '{{parse(nodes.x.data.jsonBody)}}',
    fn: (value) => {
      try {
        return JSON.parse(value)
      } catch {
        return null
      }
    }
  },

  merge: {
    name: 'merge',
    description: 'Merges multiple objects',
    category: 'Object',
    signature: 'merge(obj1, obj2, ...)',
    example: '{{merge(nodes.x.data, nodes.y.data)}}',
    fn: (...objects) => {
      return Object.assign({}, ...objects.filter(o => typeof o === 'object'))
    }
  },

  pick: {
    name: 'pick',
    description: 'Creates object with selected properties',
    category: 'Object',
    signature: 'pick(object, ...keys)',
    example: '{{pick(nodes.x.data, "name", "email")}}',
    fn: (obj, ...keys) => {
      if (typeof obj !== 'object' || obj === null) return {}
      const result = {}
      for (const key of keys.flat()) {
        if (key in obj) result[key] = obj[key]
      }
      return result
    }
  },

  omit: {
    name: 'omit',
    description: 'Creates object without specified properties',
    category: 'Object',
    signature: 'omit(object, ...keys)',
    example: '{{omit(nodes.x.data, "password", "secret")}}',
    fn: (obj, ...keys) => {
      if (typeof obj !== 'object' || obj === null) return {}
      const keysToOmit = new Set(keys.flat())
      const result = {}
      for (const [key, value] of Object.entries(obj)) {
        if (!keysToOmit.has(key)) result[key] = value
      }
      return result
    }
  }
}

/**
 * Array Functions
 */
export const arrayFunctions = {
  first: {
    name: 'first',
    description: 'Returns first element of array',
    category: 'Array',
    signature: 'first(array)',
    example: '{{first(nodes.x.data.items)}}',
    fn: (arr) => {
      if (!Array.isArray(arr)) return undefined
      return arr[0]
    }
  },

  last: {
    name: 'last',
    description: 'Returns last element of array',
    category: 'Array',
    signature: 'last(array)',
    example: '{{last(nodes.x.data.items)}}',
    fn: (arr) => {
      if (!Array.isArray(arr)) return undefined
      return arr[arr.length - 1]
    }
  },

  nth: {
    name: 'nth',
    description: 'Returns nth element of array',
    category: 'Array',
    signature: 'nth(array, index)',
    example: '{{nth(nodes.x.data.items, 2)}}',
    fn: (arr, index) => {
      if (!Array.isArray(arr)) return undefined
      return arr[index]
    }
  },

  slice: {
    name: 'slice',
    description: 'Returns a portion of array',
    category: 'Array',
    signature: 'slice(array, start, end?)',
    example: '{{slice(nodes.x.data.items, 0, 5)}}',
    fn: (arr, start, end) => {
      if (!Array.isArray(arr)) return []
      return end !== undefined ? arr.slice(start, end) : arr.slice(start)
    }
  },

  reverse: {
    name: 'reverse',
    description: 'Returns reversed array',
    category: 'Array',
    signature: 'reverse(array)',
    example: '{{reverse(nodes.x.data.items)}}',
    fn: (arr) => {
      if (!Array.isArray(arr)) return []
      return [...arr].reverse()
    }
  },

  sort: {
    name: 'sort',
    description: 'Returns sorted array',
    category: 'Array',
    signature: 'sort(array, key?)',
    example: '{{sort(nodes.x.data.items, "name")}}',
    fn: (arr, key) => {
      if (!Array.isArray(arr)) return []
      const copy = [...arr]
      if (key) {
        return copy.sort((a, b) => {
          const va = a?.[key]
          const vb = b?.[key]
          if (va < vb) return -1
          if (va > vb) return 1
          return 0
        })
      }
      return copy.sort()
    }
  },

  unique: {
    name: 'unique',
    description: 'Returns array with unique values',
    category: 'Array',
    signature: 'unique(array)',
    example: '{{unique(nodes.x.data.tags)}}',
    fn: (arr) => {
      if (!Array.isArray(arr)) return []
      return [...new Set(arr)]
    }
  },

  flatten: {
    name: 'flatten',
    description: 'Flattens nested arrays',
    category: 'Array',
    signature: 'flatten(array, depth?)',
    example: '{{flatten(nodes.x.data.nestedItems)}}',
    fn: (arr, depth = 1) => {
      if (!Array.isArray(arr)) return []
      return arr.flat(depth)
    }
  },

  compact: {
    name: 'compact',
    description: 'Removes null/undefined values',
    category: 'Array',
    signature: 'compact(array)',
    example: '{{compact(nodes.x.data.items)}}',
    fn: (arr) => {
      if (!Array.isArray(arr)) return []
      return arr.filter(item => item != null)
    }
  },

  pluck: {
    name: 'pluck',
    description: 'Extracts property from array of objects',
    category: 'Array',
    signature: 'pluck(array, key)',
    example: '{{pluck(nodes.x.data.users, "email")}}',
    fn: (arr, key) => {
      if (!Array.isArray(arr)) return []
      return arr.map(item => item?.[key])
    }
  },

  groupBy: {
    name: 'groupBy',
    description: 'Groups array items by key',
    category: 'Array',
    signature: 'groupBy(array, key)',
    example: '{{groupBy(nodes.x.data.items, "category")}}',
    fn: (arr, key) => {
      if (!Array.isArray(arr)) return {}
      return arr.reduce((acc, item) => {
        const groupKey = item?.[key] ?? 'undefined'
        if (!acc[groupKey]) acc[groupKey] = []
        acc[groupKey].push(item)
        return acc
      }, {})
    }
  }
}

/**
 * Logic/Conditional Functions
 */
export const logicFunctions = {
  if: {
    name: 'if',
    description: 'Conditional expression',
    category: 'Logic',
    signature: 'if(condition, thenValue, elseValue)',
    example: '{{if(nodes.x.data.status === "active", "Yes", "No")}}',
    fn: (condition, thenValue, elseValue) => {
      return condition ? thenValue : elseValue
    }
  },

  coalesce: {
    name: 'coalesce',
    description: 'Returns first non-null value',
    category: 'Logic',
    signature: 'coalesce(value1, value2, ...)',
    example: '{{coalesce(nodes.x.data.name, nodes.y.data.name, "Unknown")}}',
    fn: (...values) => {
      for (const value of values) {
        if (value != null && value !== '') return value
      }
      return null
    }
  },

  default: {
    name: 'default',
    description: 'Returns default if value is null/undefined',
    category: 'Logic',
    signature: 'default(value, defaultValue)',
    example: '{{default(nodes.x.data.count, 0)}}',
    fn: (value, defaultValue) => {
      return value ?? defaultValue
    }
  },

  isEmpty: {
    name: 'isEmpty',
    description: 'Checks if value is empty',
    category: 'Logic',
    signature: 'isEmpty(value)',
    example: '{{isEmpty(nodes.x.data.items)}}',
    fn: (value) => {
      if (value == null) return true
      if (typeof value === 'string') return value.trim() === ''
      if (Array.isArray(value)) return value.length === 0
      if (typeof value === 'object') return Object.keys(value).length === 0
      return false
    }
  },

  isNotEmpty: {
    name: 'isNotEmpty',
    description: 'Checks if value is not empty',
    category: 'Logic',
    signature: 'isNotEmpty(value)',
    example: '{{isNotEmpty(nodes.x.data.items)}}',
    fn: (value) => {
      if (value == null) return false
      if (typeof value === 'string') return value.trim() !== ''
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'object') return Object.keys(value).length > 0
      return true
    }
  },

  equals: {
    name: 'equals',
    description: 'Checks if two values are equal',
    category: 'Logic',
    signature: 'equals(a, b)',
    example: '{{equals(nodes.x.data.status, "active")}}',
    fn: (a, b) => {
      return JSON.stringify(a) === JSON.stringify(b)
    }
  },

  contains: {
    name: 'contains',
    description: 'Checks if string/array contains value',
    category: 'Logic',
    signature: 'contains(haystack, needle)',
    example: '{{contains(nodes.x.data.tags, "important")}}',
    fn: (haystack, needle) => {
      if (typeof haystack === 'string') return haystack.includes(needle)
      if (Array.isArray(haystack)) return haystack.includes(needle)
      return false
    }
  },

  not: {
    name: 'not',
    description: 'Logical NOT',
    category: 'Logic',
    signature: 'not(value)',
    example: '{{not(nodes.x.data.isDisabled)}}',
    fn: (value) => !value
  },

  and: {
    name: 'and',
    description: 'Logical AND',
    category: 'Logic',
    signature: 'and(a, b, ...)',
    example: '{{and(nodes.x.data.isActive, nodes.x.data.isVerified)}}',
    fn: (...values) => values.every(Boolean)
  },

  or: {
    name: 'or',
    description: 'Logical OR',
    category: 'Logic',
    signature: 'or(a, b, ...)',
    example: '{{or(nodes.x.data.isAdmin, nodes.x.data.isModerator)}}',
    fn: (...values) => values.some(Boolean)
  }
}

/**
 * Encoding Functions
 */
export const encodingFunctions = {
  base64Encode: {
    name: 'base64Encode',
    description: 'Encodes string to Base64',
    category: 'Encoding',
    signature: 'base64Encode(text)',
    example: '{{base64Encode(nodes.x.data.content)}}',
    fn: (value) => {
      try {
        return btoa(String(value || ''))
      } catch {
        return ''
      }
    }
  },

  base64Decode: {
    name: 'base64Decode',
    description: 'Decodes Base64 to string',
    category: 'Encoding',
    signature: 'base64Decode(encoded)',
    example: '{{base64Decode(nodes.x.data.encoded)}}',
    fn: (value) => {
      try {
        return atob(String(value || ''))
      } catch {
        return ''
      }
    }
  },

  urlEncode: {
    name: 'urlEncode',
    description: 'URL encodes a string',
    category: 'Encoding',
    signature: 'urlEncode(text)',
    example: '{{urlEncode(nodes.x.data.query)}}',
    fn: (value) => encodeURIComponent(String(value || ''))
  },

  urlDecode: {
    name: 'urlDecode',
    description: 'URL decodes a string',
    category: 'Encoding',
    signature: 'urlDecode(encoded)',
    example: '{{urlDecode(nodes.x.data.param)}}',
    fn: (value) => {
      try {
        return decodeURIComponent(String(value || ''))
      } catch {
        return value
      }
    }
  },

  escapeHtml: {
    name: 'escapeHtml',
    description: 'Escapes HTML special characters',
    category: 'Encoding',
    signature: 'escapeHtml(text)',
    example: '{{escapeHtml(nodes.x.data.userInput)}}',
    fn: (value) => {
      const str = String(value || '')
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
    }
  }
}

/**
 * Combine all functions into a single registry
 */
export const allFunctions = {
  ...stringFunctions,
  ...dateFunctions,
  ...numberFunctions,
  ...objectFunctions,
  ...arrayFunctions,
  ...logicFunctions,
  ...encodingFunctions
}

/**
 * Get function by name
 */
export function getFunction(name) {
  return allFunctions[name] || null
}

/**
 * Execute a function by name with arguments
 */
export function executeFunction(name, ...args) {
  const func = allFunctions[name]
  if (!func) {
    throw new Error(`Unknown function: ${name}`)
  }
  return func.fn(...args)
}

/**
 * Get all functions grouped by category
 */
export function getFunctionsByCategory() {
  const categories = {}
  for (const [name, func] of Object.entries(allFunctions)) {
    const category = func.category
    if (!categories[category]) {
      categories[category] = []
    }
    categories[category].push({ name, ...func })
  }
  return categories
}

/**
 * Get function suggestions for autocomplete
 */
export function getFunctionSuggestions(searchTerm = '') {
  const term = searchTerm.toLowerCase()
  return Object.entries(allFunctions)
    .filter(([name, func]) =>
      name.toLowerCase().includes(term) ||
      func.description.toLowerCase().includes(term)
    )
    .map(([name, func]) => ({
      type: 'function',
      label: func.signature,
      value: name,
      description: func.description,
      category: func.category,
      example: func.example
    }))
}

export default allFunctions
