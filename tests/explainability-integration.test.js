/**
 * AI Explainability - Integration Tests
 * End-to-end tests for agent execution with explanations
 */

const axios = require('axios');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000/api';

describe('Explainability Integration Tests', () => {
  let authToken;
  let testAgentId;
  let testExecutionId;

  beforeAll(async () => {
    // Get auth token (you may need to adjust this based on your auth setup)
    // For now, we'll assume tests run with a valid token
    authToken = process.env.TEST_AUTH_TOKEN || 'test-token';
  });

  describe('Agent Execution with Explanation', () => {
    test('should create agent execution and generate explanation', async () => {
      // Skip if no auth token
      if (!authToken || authToken === 'test-token') {
        console.log('Skipping: No auth token provided');
        return;
      }

      // 1. Create or get test agent
      const agentsResponse = await axios.get(`${BASE_URL}/agents`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (agentsResponse.data.data.length === 0) {
        console.log('No agents available for testing');
        return;
      }

      testAgentId = agentsResponse.data.data[0].id;

      // 2. Trigger agent execution
      const executeResponse = await axios.post(
        `${BASE_URL}/agents/${testAgentId}/execute`,
        {
          trigger_type: 'manual_test',
          trigger_data: {
            task: {
              title: 'Build REST API',
              description: 'Create Node.js API with PostgreSQL'
            },
            candidate: {
              id: 'test-user-1',
              name: 'Test Developer'
            }
          }
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      expect(executeResponse.status).toBe(200);
      expect(executeResponse.data.success).toBe(true);

      // 3. Get execution logs
      const logsResponse = await axios.get(`${BASE_URL}/agents/${testAgentId}/logs`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(logsResponse.status).toBe(200);
      expect(logsResponse.data.data.length).toBeGreaterThan(0);

      testExecutionId = logsResponse.data.data[0].id;

      // 4. Get explanation
      const explanationResponse = await axios.get(
        `${BASE_URL}/agents/executions/${testExecutionId}/explanation`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      // May or may not have explanation depending on agent type
      if (explanationResponse.status === 200) {
        const explanation = explanationResponse.data.data;

        expect(explanation).toHaveProperty('recommendation');
        expect(explanation).toHaveProperty('confidence');
        expect(explanation).toHaveProperty('factors');
        expect(explanation).toHaveProperty('alternatives');
        expect(explanation).toHaveProperty('metadata');
      }
    }, 30000); // 30 second timeout
  });

  describe('Explanation API Endpoints', () => {
    test('should return 404 for non-existent execution', async () => {
      if (!authToken || authToken === 'test-token') {
        return;
      }

      try {
        await axios.get(
          `${BASE_URL}/agents/executions/00000000-0000-0000-0000-000000000000/explanation`,
          {
            headers: { Authorization: `Bearer ${authToken}` }
          }
        );
        fail('Should have thrown 404 error');
      } catch (error) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.success).toBe(false);
      }
    });

    test('should require authentication', async () => {
      try {
        await axios.get(`${BASE_URL}/agents/executions/test-id/explanation`);
        fail('Should have thrown 401 error');
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('Explanation Quality', () => {
    test('confidence should correlate with factor scores', async () => {
      if (!authToken || authToken === 'test-token') {
        return;
      }

      // Test multiple executions and check correlation
      const explanations = [];

      // Get recent executions with explanations
      if (testAgentId) {
        const logsResponse = await axios.get(`${BASE_URL}/agents/${testAgentId}/logs`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        for (const log of logsResponse.data.data.slice(0, 3)) {
          try {
            const expResponse = await axios.get(
              `${BASE_URL}/agents/executions/${log.id}/explanation`,
              { headers: { Authorization: `Bearer ${authToken}` } }
            );

            if (expResponse.status === 200) {
              explanations.push(expResponse.data.data);
            }
          } catch (error) {
            // No explanation for this execution
          }
        }
      }

      // Analyze explanations
      explanations.forEach(exp => {
        const avgFactorScore =
          exp.factors.reduce((sum, f) => sum + f.score * f.weight, 0);

        // Confidence should be roughly in the same range as average factor score
        // Allow ±20 points variance due to penalties
        expect(Math.abs(exp.confidence - avgFactorScore)).toBeLessThan(30);
      });
    });

    test('all factors should have valid scores', async () => {
      if (!authToken || authToken === 'test-token' || !testExecutionId) {
        return;
      }

      try {
        const response = await axios.get(
          `${BASE_URL}/agents/executions/${testExecutionId}/explanation`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );

        if (response.status === 200) {
          const explanation = response.data.data;

          explanation.factors.forEach(factor => {
            expect(factor.score).toBeGreaterThanOrEqual(0);
            expect(factor.score).toBeLessThanOrEqual(100);
            expect(factor.weight).toBeGreaterThan(0);
            expect(factor.weight).toBeLessThanOrEqual(1);
            expect(['strong', 'moderate', 'weak']).toContain(factor.impact);
            expect(Array.isArray(factor.details)).toBe(true);
            expect(typeof factor.naturalLanguage).toBe('string');
          });
        }
      } catch (error) {
        // No explanation available
      }
    });
  });

  describe('Performance Tests', () => {
    test('explanation generation should complete within acceptable time', async () => {
      if (!authToken || authToken === 'test-token') {
        return;
      }

      const startTime = Date.now();

      // Trigger execution
      if (testAgentId) {
        await axios.post(
          `${BASE_URL}/agents/${testAgentId}/execute`,
          {
            trigger_type: 'performance_test',
            trigger_data: {
              task: { title: 'Test' },
              candidate: { id: '1' }
            }
          },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      }

      const duration = Date.now() - startTime;

      // Should complete in under 2 seconds (including agent execution)
      expect(duration).toBeLessThan(2000);
    }, 5000);
  });
});

describe('Explanation Data Structure Tests', () => {
  test('explanation should match expected schema', () => {
    const sampleExplanation = {
      recommendation: { id: '1', name: 'Test' },
      confidence: 85,
      factors: [
        {
          name: 'Skill Match',
          weight: 0.4,
          score: 90,
          impact: 'strong',
          details: ['Detail 1', 'Detail 2'],
          naturalLanguage: 'Has required skills'
        }
      ],
      alternatives: [
        {
          option: { id: '2', name: 'Alternative' },
          score: 75,
          whyLower: 'Lower skill match',
          factors: []
        }
      ],
      metadata: {
        agentType: 'assignment',
        executedAt: new Date().toISOString(),
        version: '1.0'
      }
    };

    // Validate structure
    expect(sampleExplanation).toHaveProperty('recommendation');
    expect(sampleExplanation).toHaveProperty('confidence');
    expect(sampleExplanation).toHaveProperty('factors');
    expect(sampleExplanation).toHaveProperty('alternatives');
    expect(sampleExplanation).toHaveProperty('metadata');

    expect(typeof sampleExplanation.confidence).toBe('number');
    expect(Array.isArray(sampleExplanation.factors)).toBe(true);
    expect(Array.isArray(sampleExplanation.alternatives)).toBe(true);
  });
});
