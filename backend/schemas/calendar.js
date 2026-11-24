const { z } = require('zod');
const { MAX_LEAD_MINUTES } = require('../services/calendarAutoJoin');

const isoDateString = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Must be a valid ISO date string' }
);

const createEvent = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    startDate: isoDateString,
    endDate: isoDateString.optional(),
    description: z.string().max(8000).optional(),
    location: z.string().max(500).optional(),
    calendarId: z.string().optional(),
    allDay: z.boolean().optional(),
    timeZone: z.string().optional(),
    attendees: z.array(z.string().email()).optional(),
    colorId: z.string().optional(),
    sendNotifications: z.boolean().optional(),
    recurrence: z.string().regex(/^RRULE:/).optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const updateEvent = z.object({
  body: z.object({
    title: z.string().min(1).optional(),
    startDate: isoDateString.optional(),
    endDate: isoDateString.optional(),
    description: z.string().max(8000).optional(),
    location: z.string().max(500).optional(),
    calendarId: z.string().optional(),
    allDay: z.boolean().optional(),
    timeZone: z.string().optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({
    eventId: z.string().min(1)
  })
});

const syncActionItem = z.object({
  body: z.object({
    calendarId: z.string().optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const syncActionItems = z.object({
  body: z.object({
    calendarId: z.string().optional(),
    meetingId: z.string().uuid().optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const syncMeeting = z.object({
  body: z.object({
    calendarId: z.string().optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const autoJoin = z.object({
  body: z.object({
    enabled: z.boolean(),
    scope: z.enum(['organized', 'all']).optional(),
    leadMinutes: z.number().int().min(0).max(MAX_LEAD_MINUTES).optional(),
    orgId: z.string().uuid().optional(),
    consentAcknowledged: z.boolean().optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const autoJoinOverride = z.object({
  body: z.object({
    eventKey: z.string().min(3).max(300),
    decision: z.enum(['skip', 'join']).nullable()
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

module.exports = { createEvent, updateEvent, syncActionItem, syncActionItems, syncMeeting, autoJoin, autoJoinOverride };
