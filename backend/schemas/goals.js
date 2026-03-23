const { z } = require('zod');

const create = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional().nullable(),
    goal_type: z.enum(['company', 'team', 'individual']),
    parent_goal_id: z.string().uuid().optional().nullable(),
    quarter: z.string().optional(),
    start_date: z.string().optional().nullable(),
    target_date: z.string().optional().nullable(),
    key_results: z.array(z.any()).optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const list = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    type: z.string().optional(),
    status: z.string().optional(),
    quarter: z.string().optional(),
    owner_id: z.string().optional(),
    team_id: z.string().optional()
  }).passthrough(),
  params: z.object({}).passthrough()
});

const update = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const createKeyResult = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    target: z.number({ message: 'Target is required' }),
    unit: z.string().optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const updateKeyResult = z.object({
  body: z.object({
    current: z.number().optional(),
    title: z.string().optional(),
    target: z.number().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid(),
    krId: z.string()
  })
});

const linkTask = z.object({
  body: z.object({
    task_id: z.string().uuid('Valid task_id is required')
  }),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

module.exports = { create, list, update, createKeyResult, updateKeyResult, linkTask };
