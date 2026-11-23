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
    endDate: z.string().optional(),
    status: z.enum(['all', 'live', 'ready', 'attention']).optional()
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

const carryForwardPreview = z.object({
  body: z.object({
    title: z.string().max(500).optional().nullable(),
    attendees: z.array(z.union([
      z.string().max(320),
      z.object({ name: z.string().max(200).optional().nullable(), email: z.string().max(320).optional().nullable() }),
    ])).max(200).optional(),
    startsAt: z.string().datetime({ offset: true }).optional(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const followUpParams = z.object({ id: z.string().uuid() });

const followUpUpdate = z.object({
  body: z.object({
    recipients: z.array(z.object({
      name: z.string().max(120).optional().nullable(),
      email: z.string().email().max(320),
      source: z.enum(['invite', 'owner', 'added']).optional(),
    })).max(20).optional(),
    subject: z.string().max(200).optional(),
    opening: z.string().max(2000).optional(),
    signoff: z.string().max(300).optional(),
    include: z.object({
      decisions: z.boolean().optional(),
      items: z.boolean().optional(),
      next: z.boolean().optional(),
      summary: z.boolean().optional(),
      copy: z.boolean().optional(),
    }).optional(),
  }),
  query: z.object({}).passthrough(),
  params: followUpParams,
});

const followUpAction = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: followUpParams,
});

const followUpAutoSend = z.object({
  body: z.object({ enabled: z.boolean() }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

module.exports = { process, transcript, list, update, ask, carryForwardPreview, followUpUpdate, followUpAction, followUpAutoSend };
