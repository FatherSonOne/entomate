const { z } = require('zod');

const process = z.object({
  body: z.object({
    title: z.string().optional(),
    attendees: z.union([z.array(z.any()), z.string()]).optional(),
    projectId: z.string().uuid().optional().nullable(),
    crmDealId: z.string().optional().nullable()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const transcript = z.object({
  body: z.object({
    title: z.string().optional(),
    transcript: z.string().min(1, 'Transcript is required'),
    attendees: z.union([z.array(z.any()), z.string()]).optional(),
    projectId: z.string().uuid().optional().nullable(),
    crmDealId: z.string().optional().nullable()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const list = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    limit: z.string().regex(/^\d+$/).optional(),
    offset: z.string().regex(/^\d+$/).optional(),
    projectId: z.string().uuid().optional(),
    search: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional()
  }).passthrough(),
  params: z.object({}).passthrough()
});

const update = z.object({
  body: z.object({
    title: z.string().optional(),
    summary: z.string().optional(),
    key_points: z.array(z.string()).optional(),
    decisions: z.array(z.string()).optional(),
    project_id: z.string().uuid().optional().nullable(),
    crm_deal_id: z.string().optional().nullable()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const ask = z.object({
  body: z.object({
    question: z.string().min(1, 'Question is required')
  }),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

module.exports = { process, transcript, list, update, ask };
