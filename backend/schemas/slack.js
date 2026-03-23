const { z } = require('zod');

const notify = z.object({
  body: z.object({
    type: z.string().min(1, 'Notification type is required'),
    channel: z.string().optional(),
    data: z.record(z.any()).optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const settings = z.object({
  body: z.object({
    defaultChannel: z.string().optional(),
    meetingCompleted: z.boolean().optional(),
    dealWon: z.boolean().optional(),
    overdueReminder: z.boolean().optional(),
    actionItemCreated: z.boolean().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

module.exports = { notify, settings };
