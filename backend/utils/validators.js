/**
 * Input Validation Utilities
 * Validates and sanitizes user input
 */

/**
 * Validate UUID format
 */
const isValidUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate date string (YYYY-MM-DD)
 */
const isValidDate = (dateStr) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date);
};

/**
 * Sanitize string input (prevent XSS)
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/[<>]/g, '')
    .trim()
    .substring(0, 10000); // Max length
};

/**
 * Validate meeting input
 */
const validateMeeting = (data) => {
  const errors = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Title is required' });
  } else if (data.title.length > 255) {
    errors.push({ field: 'title', message: 'Title must be less than 255 characters' });
  }

  if (data.attendees && !Array.isArray(data.attendees)) {
    errors.push({ field: 'attendees', message: 'Attendees must be an array' });
  }

  if (data.duration_minutes && (isNaN(data.duration_minutes) || data.duration_minutes < 0)) {
    errors.push({ field: 'duration_minutes', message: 'Duration must be a positive number' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      title: sanitizeString(data.title),
      description: sanitizeString(data.description),
      attendees: data.attendees || [],
      duration_minutes: parseInt(data.duration_minutes) || 0
    }
  };
};

/**
 * Validate project input
 */
const validateProject = (data) => {
  const errors = [];
  const validStatuses = ['planning', 'active', 'completed', 'archived'];

  if (!data.name || data.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Project name is required' });
  }

  if (data.status && !validStatuses.includes(data.status)) {
    errors.push({ field: 'status', message: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  if (data.deal_value && isNaN(parseFloat(data.deal_value))) {
    errors.push({ field: 'deal_value', message: 'Deal value must be a number' });
  }

  if (data.start_date && !isValidDate(data.start_date)) {
    errors.push({ field: 'start_date', message: 'Invalid start date format' });
  }

  if (data.end_date && !isValidDate(data.end_date)) {
    errors.push({ field: 'end_date', message: 'Invalid end date format' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      name: sanitizeString(data.name),
      description: sanitizeString(data.description),
      status: data.status || 'planning',
      crm_deal_id: sanitizeString(data.crm_deal_id),
      deal_value: data.deal_value ? parseFloat(data.deal_value) : null,
      start_date: data.start_date || null,
      end_date: data.end_date || null
    }
  };
};

/**
 * Validate task input
 */
const validateTask = (data) => {
  const errors = [];
  const validStatuses = ['open', 'in_progress', 'review', 'done', 'blocked'];
  const validPriorities = ['high', 'medium', 'low'];

  if (!data.title || data.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Task title is required' });
  }

  if (data.status && !validStatuses.includes(data.status)) {
    errors.push({ field: 'status', message: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  if (data.priority && !validPriorities.includes(data.priority)) {
    errors.push({ field: 'priority', message: `Priority must be one of: ${validPriorities.join(', ')}` });
  }

  if (data.due_date && !isValidDate(data.due_date)) {
    errors.push({ field: 'due_date', message: 'Invalid due date format' });
  }

  if (data.assigned_to && !isValidUUID(data.assigned_to)) {
    errors.push({ field: 'assigned_to', message: 'Invalid user ID format' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      title: sanitizeString(data.title),
      description: sanitizeString(data.description),
      status: data.status || 'open',
      priority: data.priority || 'medium',
      due_date: data.due_date || null,
      assigned_to: data.assigned_to || null,
      project_id: data.project_id || null
    }
  };
};

/**
 * Validate automation input
 */
const validateAutomation = (data) => {
  const errors = [];
  const validTriggers = [
    'meeting_ended', 'meeting_created',
    'action_item_created', 'task_completed', 'task_created',
    'project_created', 'deal_created',
    'scheduled', 'webhook'
  ];

  if (!data.name || data.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Automation name is required' });
  }

  if (!data.trigger_type) {
    errors.push({ field: 'trigger_type', message: 'Trigger type is required' });
  } else if (!validTriggers.includes(data.trigger_type)) {
    errors.push({ field: 'trigger_type', message: `Trigger must be one of: ${validTriggers.join(', ')}` });
  }

  if (!data.actions || !Array.isArray(data.actions) || data.actions.length === 0) {
    errors.push({ field: 'actions', message: 'At least one action is required' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      name: sanitizeString(data.name),
      description: sanitizeString(data.description),
      trigger_type: data.trigger_type,
      trigger_config: data.trigger_config || {},
      actions: data.actions || [],
      enabled: data.enabled !== false
    }
  };
};

/**
 * Validate search query
 */
const validateSearchQuery = (data) => {
  const errors = [];

  if (!data.query || data.query.trim().length < 2) {
    errors.push({ field: 'query', message: 'Search query must be at least 2 characters' });
  }

  if (data.query && data.query.length > 500) {
    errors.push({ field: 'query', message: 'Search query must be less than 500 characters' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      query: sanitizeString(data.query),
      type: data.type || 'all',
      limit: Math.min(Math.max(parseInt(data.limit) || 20, 1), 100),
      offset: Math.max(parseInt(data.offset) || 0, 0)
    }
  };
};

/**
 * Pagination validator
 */
const validatePagination = (query) => {
  return {
    limit: Math.min(Math.max(parseInt(query.limit) || 20, 1), 100),
    offset: Math.max(parseInt(query.offset) || 0, 0),
    page: Math.max(parseInt(query.page) || 1, 1)
  };
};

module.exports = {
  isValidUUID,
  isValidEmail,
  isValidDate,
  sanitizeString,
  validateMeeting,
  validateProject,
  validateTask,
  validateAutomation,
  validateSearchQuery,
  validatePagination
};
