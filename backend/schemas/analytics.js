const { z } = require('zod');

const record = z.object({
  body: z.object({
    metric_type: z.string().min(1, 'metric_type is required'),
    value: z.number({ message: 'value is required' }),
    unit: z.string().optional(),
    source_type: z.string().optional(),
    source_id: z.string().optional(),
    metadata: z.record(z.any()).optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const insights = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    days: z.enum(['7', '30', '90']).optional()
  }).passthrough(),
  params: z.object({}).passthrough()
});

module.exports = { record, insights };
