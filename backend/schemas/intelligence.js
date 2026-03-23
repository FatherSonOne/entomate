const { z } = require('zod');

const nudge = z.object({
  body: z.object({
    channel: z.enum(['in_app', 'email', 'slack']).optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    itemId: z.string().uuid()
  })
});

const todayQuery = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    timezone: z.string().optional()
  }).passthrough(),
  params: z.object({}).passthrough()
});

const dashboardQuery = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    riskFilter: z.string().optional(),
    meetingHours: z.coerce.number().optional(),
    riskDays: z.coerce.number().optional()
  }).passthrough(),
  params: z.object({}).passthrough()
});

const itemIdParams = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    itemId: z.string().uuid()
  })
});

const dealIdParams = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    dealId: z.string()
  })
});

const meetingIdParams = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    meetingId: z.string()
  })
});

module.exports = {
  nudge,
  todayQuery,
  dashboardQuery,
  itemIdParams,
  dealIdParams,
  meetingIdParams
};
