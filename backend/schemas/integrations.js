const { z } = require('zod');

const syncActionItems = z.object({
  body: z.object({
    actionItemIds: z.array(z.string().uuid()).optional(),
    syncAll: z.boolean().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const createDeal = z.object({
  body: z.object({
    name: z.string().min(1, 'Deal name is required'),
    value: z.number().optional().nullable(),
    contactEmail: z.string().email().optional().nullable(),
    contactName: z.string().optional().nullable(),
    stage: z.string().optional(),
    notes: z.string().optional().nullable()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const postRecap = z.object({
  body: z.object({
    meetingId: z.string().uuid('Meeting ID is required'),
    channelId: z.string().optional(),
    customMessage: z.string().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const sendMessage = z.object({
  body: z.object({
    channelId: z.string().optional(),
    message: z.string().min(1, 'Message is required'),
    attachments: z.any().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const lookup = z.object({
  body: z.object({
    email: z.string().email('Valid email is required')
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const retry = z.object({
  body: z.object({
    logIds: z.array(z.string().uuid()).optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

module.exports = { syncActionItems, createDeal, postRecap, sendMessage, lookup, retry };
