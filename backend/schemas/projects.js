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
      .refine((value) => !Object.hasOwn(value, 'brief'), 'Use the project brief endpoint to edit the brief')
      .refine((value) => !Object.hasOwn(value, 'progress'), 'Use the project progress endpoint to edit progress')
      .refine((value) => !Object.hasOwn(value, 'archive'), 'Use the project status or restore endpoint to manage archiving')
      .optional()
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

const briefText = {
  outcome: z.string().trim().max(2000),
  scope: z.string().trim().max(4000),
  successCriteria: z.string().trim().max(4000)
};
const briefField = z.enum(Object.keys(briefText));
const briefSource = z.object({ meetingId: z.uuid(), atMs: z.number().int().nonnegative().nullable() }).strict();
const brief = z.object({
  ...briefText,
  sources: z.partialRecord(briefField, briefSource).optional(),
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

const suggestBrief = z.object({
  params: briefParams,
  body: z.object({ meetingId: z.uuid() }).strict()
});
const suggestions = z.object({
  suggestions: z.array(z.object({
    field: briefField,
    value: z.string().trim().min(1).max(4000),
    evidence: z.number().int().min(1)
  }).strict()).max(3)
}).strict();

const projectVersion = z.iso.datetime({ offset: true }).nullable();
const milestoneFields = {
  title: z.string().trim().min(1).max(160),
  dueDate: z.iso.date(),
  ownerId: z.uuid().nullable()
};
const milestone = z.object({
  id: z.uuid(),
  ...milestoneFields,
  completedAt: projectVersion
}).strict();
const updateFields = {
  health: z.enum(['on_track', 'at_risk', 'off_track']),
  note: z.string().trim().min(1).max(1500)
};
const statusUpdate = z.object({
  id: z.uuid(),
  ...updateFields,
  authorId: z.uuid(),
  authorName: z.string(),
  postedAt: z.iso.datetime({ offset: true }),
  counts: z.object({
    total: z.number().int().nonnegative(),
    done: z.number().int().nonnegative(),
    late: z.number().int().nonnegative(),
    milestones: z.number().int().nonnegative(),
    milestonesDone: z.number().int().nonnegative()
  }).strict()
}).strict();
const getProgress = z.object({ params: briefParams });
const sendHandoff = z.object({
  params: briefParams,
  body: z.object({ channelId: z.uuid() }).strict()
});
const updateProgress = z.object({
  params: briefParams,
  body: z.discriminatedUnion('operation', [
    z.object({ operation: z.literal('addMilestone'), version: projectVersion, ...milestoneFields }).strict(),
    z.object({ operation: z.literal('editMilestone'), version: projectVersion, id: z.uuid(), ...milestoneFields }).strict(),
    z.object({ operation: z.literal('setMilestoneDone'), version: projectVersion, id: z.uuid(), done: z.boolean() }).strict(),
    z.object({ operation: z.literal('postUpdate'), version: projectVersion, ...updateFields }).strict(),
  ])
});

module.exports = {
  create, list, update, fromDeal, brief, briefText, getBrief, updateBrief, suggestBrief, suggestions,
  milestone, statusUpdate, getProgress, updateProgress, sendHandoff
};
