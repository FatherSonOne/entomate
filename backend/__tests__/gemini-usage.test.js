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

test.each([['query', 'RETRIEVAL_QUERY'], ['document', 'RETRIEVAL_DOCUMENT']])(
  'passage embeddings request the %s task with the indexed model and dimensions',
  async (kind, taskType) => {
    const values = Array(768).fill(0.25);
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ embeddings: [{ values }, { values }] }),
    });
    try {
      const { signal } = new AbortController();
      const inputs = ['One passage.', 'Another passage.'];
      expect(await gemini.generatePassageEmbeddings(inputs, kind, signal)).toEqual([values, values]);
      const [url, init] = fetch.mock.calls[0];
      expect(url).toContain('/models/gemini-embedding-001:batchEmbedContents');
      expect(init.signal).toBe(signal);
      expect(JSON.parse(init.body).requests).toEqual(inputs.map((text) => ({
        model: 'models/gemini-embedding-001', content: { parts: [{ text }] }, outputDimensionality: 768, taskType,
      })));
    } finally {
      fetch.mockRestore();
    }
  }
);
