const { z } = require('zod');

const create = z.object({
  body: z.object({
    title: z.string().min(1, 'Task title is required'),
    description: z.string().optional().nullable(),
    projectId: z.string().uuid().optional().nullable(),
    assignedTo: z.string().optional().nullable(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    dueDate: z.string().optional().nullable(),
    startDate: z.string().optional().nullable(),
    tags: z.array(z.string()).optional(),
    parentTaskId: z.string().uuid().optional().nullable()
  }).strict(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const list = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    limit: z.string().regex(/^\d+$/).optional(),
    offset: z.string().regex(/^\d+$/).optional(),
    projectId: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    assignedTo: z.string().optional(),
    search: z.string().optional(),
    overdue: z.enum(['true', 'false']).optional()
  }).passthrough(),
  params: z.object({}).passthrough()
});

const update = z.object({
  body: z.object({
    title: z.string().optional(),
    description: z.string().optional().nullable(),
    assigned_to: z.string().optional().nullable(),
    status: z.enum(['open', 'in_progress', 'review', 'done', 'blocked']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    due_date: z.string().optional().nullable(),
    start_date: z.string().optional().nullable(),
    project_id: z.string().uuid().optional().nullable(),
    tags: z.array(z.string()).optional(),
    custom_fields: z.record(z.any()).optional()
  }).strict(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const assign = z.object({
  body: z.object({
    assignedTo: z.string().nullable()
  }).strict(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const bulkCreate = z.object({
  body: z.object({
    tasks: z.array(z.object({
      title: z.string().min(1),
      description: z.string().optional().nullable(),
      assignedTo: z.string().optional().nullable(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      dueDate: z.string().optional().nullable(),
      tags: z.array(z.string()).optional(),
      projectId: z.string().uuid().optional().nullable()
    })).min(1, 'Tasks array is required'),
    projectId: z.string().uuid().optional().nullable()
  }).strict(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const bulkStatus = z.object({
  body: z.object({
    taskIds: z.array(z.string().uuid()).min(1, 'Task IDs array is required'),
    status: z.enum(['open', 'in_progress', 'review', 'done', 'blocked'])
  }).strict(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

module.exports = { create, list, update, assign, bulkCreate, bulkStatus };
