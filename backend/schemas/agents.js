const { z } = require('zod');

const create = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const fromTemplate = z.object({
  body: z.object({
    templateId: z.string().min(1, 'Template ID is required'),
    customizations: z.record(z.any()).optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const update = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const execute = z.object({
  body: z.object({
    trigger_type: z.string().min(1, 'trigger_type is required'),
    trigger_data: z.any().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const trigger = z.object({
  body: z.object({
    trigger_type: z.string().min(1, 'trigger_type is required'),
    data: z.any().optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const feedback = z.object({
  body: z.object({
    rating: z.number().min(1).max(5),
    notes: z.string().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    executionId: z.string().uuid()
  })
});

const track = z.object({
  body: z.object({
    eventType: z.string().min(1, 'eventType is required'),
    executionId: z.string().uuid('executionId is required'),
    metadata: z.record(z.any()).optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const run = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    agentName: z.string()
  })
});

const orchestrate = z.object({
  body: z.object({
    agents: z.array(z.string()).min(1, 'agents array is required'),
    context: z.record(z.any()).optional(),
    parallel: z.boolean().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const processMeeting = z.object({
  body: z.object({
    meeting: z.any({ message: 'meeting is required' }),
    actionItems: z.any({ message: 'actionItems are required' })
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const applySuggestions = z.object({
  body: z.object({
    actionItemId: z.string().min(1, 'actionItemId is required'),
    suggestions: z.any({ message: 'suggestions are required' }),
    options: z.record(z.any()).optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

module.exports = { create, fromTemplate, update, execute, trigger, feedback, track, run, orchestrate, processMeeting, applySuggestions };
