const { z } = require('zod');

const createEvent = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    startDate: z.string().min(1, 'startDate is required'),
    endDate: z.string().optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    calendarId: z.string().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const updateEvent = z.object({
  body: z.object({
    calendarId: z.string().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    eventId: z.string()
  })
});

module.exports = { createEvent, updateEvent };
