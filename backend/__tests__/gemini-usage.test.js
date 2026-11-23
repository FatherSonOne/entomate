/**
 * EAI-07: the fallback answer path (gemini.answerQuestion, used by
 * /api/assistant/query and /api/search/ask*) reports Gemini's usageMetadata,
 * so a question answered by a fallback route is still counted.
 */

'use strict';

process.env.GEMINI_API_KEY = 'test-key';

const META = { promptTokenCount: 321, candidatesTokenCount: 12 };
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: async () => ({
          response: { text: () => '{"answer":"Two meetings.","confidence":0.9}', usageMetadata: { promptTokenCount: 321, candidatesTokenCount: 12 } },
        }),
      };
    }
  },
}));
jest.mock('../services/aiUsage', () => ({ addUsage: jest.fn() }));
jest.mock('../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const gemini = require('../config/gemini');
const { addUsage } = require('../services/aiUsage');

test('answerQuestion reports the response usageMetadata once', async () => {
  const result = await gemini.answerQuestion('How many meetings?', 'ctx');
  expect(result.answer).toBe('Two meetings.');
  expect(addUsage.mock.calls).toEqual([[META]]);
});
