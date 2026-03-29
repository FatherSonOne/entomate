const { z } = require('zod');

const override = z.object({
  body: z.object({
    agentType: z.string().min(1, 'agentType is required'),
    agentExecutionId: z.string().optional(),
    originalRecommendation: z.any({ message: 'originalRecommendation is required' }),
    userChoice: z.any({ message: 'userChoice is required' }),
    feedbackReason: z.string().optional(),
    feedbackText: z.string().optional(),
    context: z.any({ message: 'context is required' })
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const preference = z.object({
  body: z.object({
    agentType: z.string().min(1, 'agentType is required'),
    enabled: z.boolean({ message: 'enabled is required' })
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const approve = z.object({
  body: z.object({
    customization: z.any().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    patternId: z.string().uuid()
  })
});

const reject = z.object({
  body: z.object({
    reason: z.string().optional()
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    patternId: z.string().uuid()
  })
});

const outcome = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    overrideId: z.string().uuid()
  })
});

module.exports = { override, preference, approve, reject, outcome };
