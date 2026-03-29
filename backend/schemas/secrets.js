const { z } = require('zod');

const create = z.object({
  body: z.object({
    name: z.string().min(1, 'Secret name is required'),
    value: z.string().min(1, 'Secret value is required'),
    description: z.string().optional(),
    scope: z.string().optional(),
    environment: z.string().optional(),
    valueType: z.string().optional(),
    workflowId: z.string().uuid().optional(),
    organizationId: z.string().optional(),
    expiresAt: z.string().optional().nullable()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const list = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    scope: z.string().optional(),
    environment: z.string().optional(),
    workflowId: z.string().uuid().optional(),
    organizationId: z.string().optional(),
    search: z.string().optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    offset: z.string().regex(/^\d+$/).optional()
  }).passthrough(),
  params: z.object({}).passthrough()
});

const update = z.object({
  body: z.object({
    value: z.string().optional(),
    description: z.string().optional(),
    expiresAt: z.string().optional().nullable()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const validateName = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required')
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const resolve = z.object({
  body: z.object({
    template: z.string().min(1, 'Template is required'),
    environment: z.string().optional(),
    workflowId: z.string().uuid().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

module.exports = { create, list, update, validateName, resolve };
