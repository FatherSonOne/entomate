const { z } = require('zod');

const create = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional().nullable(),
    nodes: z.array(z.any()).optional(),
    connections: z.array(z.any()).optional(),
    settings: z.record(z.any()).optional(),
    active: z.boolean().optional(),
    is_template: z.boolean().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const update = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional().nullable(),
    nodes: z.array(z.any()).optional(),
    connections: z.array(z.any()).optional(),
    settings: z.record(z.any()).optional(),
    active: z.boolean().optional(),
    change_summary: z.string().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const execute = z.object({
  body: z.object({
    inputData: z.record(z.any()).optional(),
    mode: z.enum(['production', 'test']).optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const test = z.object({
  body: z.object({
    inputData: z.record(z.any()).optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const toggle = z.object({
  body: z.object({
    active: z.boolean().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const pin = z.object({
  body: z.object({
    data: z.any()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid(),
    nodeId: z.string()
  })
});

module.exports = { create, update, execute, test, toggle, pin };
