const { z } = require('zod');

const create = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional().nullable(),
    triggerType: z.string().min(1, 'Trigger type is required'),
    triggerConfig: z.record(z.any()).optional(),
    actions: z.array(z.any()).min(1, 'Actions are required'),
    enabled: z.boolean().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const list = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    limit: z.string().regex(/^\d+$/).optional(),
    offset: z.string().regex(/^\d+$/).optional(),
    enabled: z.enum(['true', 'false']).optional(),
    triggerType: z.string().optional()
  }).passthrough(),
  params: z.object({}).passthrough()
});

const update = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional().nullable(),
    trigger_type: z.string().optional(),
    trigger_config: z.record(z.any()).optional(),
    actions: z.array(z.any()).optional(),
    enabled: z.boolean().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const toggle = z.object({
  body: z.object({
    enabled: z.boolean().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const execute = z.object({
  body: z.object({
    triggerData: z.any().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const test = z.object({
  body: z.object({
    sampleData: z.record(z.any()).optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const trigger = z.object({
  body: z.object({
    triggerType: z.string().min(1, 'Trigger type is required'),
    triggerData: z.any().optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

module.exports = { create, list, update, toggle, execute, test, trigger };
