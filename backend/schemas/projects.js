const { z } = require('zod');

const create = z.object({
  body: z.object({
    name: z.string().min(1, 'Project name is required'),
    description: z.string().optional().nullable(),
    crmDealId: z.string().optional().nullable(),
    dealValue: z.number().optional().nullable(),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    teamIds: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional()
  }).strict(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const list = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    limit: z.string().regex(/^\d+$/).optional(),
    offset: z.string().regex(/^\d+$/).optional(),
    status: z.string().optional(),
    search: z.string().optional(),
    ownerId: z.string().optional()
  }).passthrough(),
  params: z.object({}).passthrough()
});

const update = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional().nullable(),
    status: z.enum(['planning', 'active', 'completed', 'archived']).optional(),
    crm_deal_id: z.string().optional().nullable(),
    deal_value: z.number().optional().nullable(),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    team_ids: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    settings: z.record(z.string(), z.unknown())
      .refine((value) => !Object.hasOwn(value, 'brief'), 'Use the project brief endpoint to edit the brief').optional()
  }).strict(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const fromDeal = z.object({
  body: z.object({
    dealId: z.string().min(1, 'Deal ID is required'),
    dealName: z.string().min(1, 'Deal name is required'),
    dealValue: z.number().optional().nullable(),
    contactName: z.string().optional().nullable(),
    expectedCloseDate: z.string().optional().nullable()
  }).strict(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const brief = z.object({
  outcome: z.string().trim().max(2000),
  scope: z.string().trim().max(4000),
  successCriteria: z.string().trim().max(4000),
  ownerId: z.uuid().nullable(),
  resources: z.array(z.string().trim().max(2048).refine((value) => {
    if (!/^https?:\/\//i.test(value)) return false;
    try {
      const url = new URL(value);
      return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'Enter an HTTP or HTTPS link without credentials')).max(10)
}).strict();

const briefParams = z.object({ id: z.uuid() });
const getBrief = z.object({ params: briefParams });
const updateBrief = z.object({
  params: briefParams,
  body: z.object({ brief, version: z.iso.datetime({ offset: true }).nullable() }).strict()
});

module.exports = { create, list, update, fromDeal, brief, getBrief, updateBrief };
