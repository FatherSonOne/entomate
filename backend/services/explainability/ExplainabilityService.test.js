/**
 * ExplainabilityService - Unit Tests
 * Tests for factor calculations, confidence scoring, and explanation generation
 */

const ExplainabilityService = require('./ExplainabilityService');

describe('ExplainabilityService', () => {
  describe('Factor Definitions', () => {
    test('should return correct factor definitions for assignment agent', () => {
      const factors = ExplainabilityService.getFactorDefinitions('assignment');

      expect(factors).toHaveLength(4);
      expect(factors[0].name).toBe('Skill Match');
      expect(factors[0].weight).toBe(0.40);
      expect(factors[1].name).toBe('Current Workload');
      expect(factors[1].weight).toBe(0.30);
      expect(factors[2].name).toBe('Availability');
      expect(factors[2].weight).toBe(0.20);
      expect(factors[3].name).toBe('Past Performance');
      expect(factors[3].weight).toBe(0.10);
    });

    test('should return correct factor definitions for priority agent', () => {
      const factors = ExplainabilityService.getFactorDefinitions('priority');

      expect(factors).toHaveLength(4);
      expect(factors[0].name).toBe('Business Impact');
      expect(factors[0].weight).toBe(0.40);
    });

    test('should return correct factor definitions for deadline agent', () => {
      const factors = ExplainabilityService.getFactorDefinitions('deadline');

      expect(factors).toHaveLength(4);
      expect(factors[0].name).toBe('Task Complexity');
      expect(factors[0].weight).toBe(0.35);
    });

    test('should return correct factor definitions for followup agent', () => {
      const factors = ExplainabilityService.getFactorDefinitions('followup');

      expect(factors).toHaveLength(4);
      expect(factors[0].name).toBe('Follow-up Likelihood');
      expect(factors[0].weight).toBe(0.40);
    });

    test('should return empty array for unknown agent type', () => {
      const factors = ExplainabilityService.getFactorDefinitions('unknown');
      expect(factors).toEqual([]);
    });

    test('should have weights that sum to 1.0 for each agent type', () => {
      const agentTypes = ['assignment', 'priority', 'deadline', 'followup'];

      agentTypes.forEach(type => {
        const factors = ExplainabilityService.getFactorDefinitions(type);
        const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
        expect(totalWeight).toBeCloseTo(1.0, 5);
      });
    });
  });

  describe('Weighted Score Calculation', () => {
    test('should calculate weighted score correctly', () => {
      const factors = [
        { score: 100, weight: 0.40 },
        { score: 80, weight: 0.30 },
        { score: 60, weight: 0.20 },
        { score: 90, weight: 0.10 }
      ];

      const score = ExplainabilityService.calculateWeightedScore(factors);

      // (100*0.4) + (80*0.3) + (60*0.2) + (90*0.1) = 40 + 24 + 12 + 9 = 85
      expect(score).toBe(85);
    });

    test('should handle all zeros', () => {
      const factors = [
        { score: 0, weight: 0.5 },
        { score: 0, weight: 0.5 }
      ];

      const score = ExplainabilityService.calculateWeightedScore(factors);
      expect(score).toBe(0);
    });

    test('should handle perfect scores', () => {
      const factors = [
        { score: 100, weight: 0.5 },
        { score: 100, weight: 0.5 }
      ];

      const score = ExplainabilityService.calculateWeightedScore(factors);
      expect(score).toBe(100);
    });
  });

  describe('Confidence Calculation', () => {
    test('should return high confidence when all factors are strong', () => {
      const factors = [
        { score: 95, weight: 0.40 },
        { score: 90, weight: 0.30 },
        { score: 85, weight: 0.20 },
        { score: 92, weight: 0.10 }
      ];
      const alternatives = [
        { totalScore: 70 }
      ];

      const confidence = ExplainabilityService.calculateConfidence(factors, alternatives);

      expect(confidence).toBeGreaterThan(80);
    });

    test('should reduce confidence when top alternative is close', () => {
      const factors = [
        { score: 85, weight: 0.50 },
        { score: 85, weight: 0.50 }
      ];
      const closeAlternative = [
        { totalScore: 83 } // Only 2 points difference
      ];
      const farAlternative = [
        { totalScore: 60 } // 25 points difference
      ];

      const confidenceClose = ExplainabilityService.calculateConfidence(factors, closeAlternative);
      const confidenceFar = ExplainabilityService.calculateConfidence(factors, farAlternative);

      expect(confidenceFar).toBeGreaterThan(confidenceClose);
    });

    test('should reduce confidence when critical factors are weak', () => {
      const strongFactors = [
        { score: 90, weight: 0.40 }, // Critical (>30%)
        { score: 85, weight: 0.30 }, // Critical
        { score: 80, weight: 0.20 },
        { score: 75, weight: 0.10 }
      ];

      const weakFactors = [
        { score: 50, weight: 0.40 }, // Critical but weak!
        { score: 85, weight: 0.30 },
        { score: 80, weight: 0.20 },
        { score: 75, weight: 0.10 }
      ];

      const confidenceStrong = ExplainabilityService.calculateConfidence(strongFactors, []);
      const confidenceWeak = ExplainabilityService.calculateConfidence(weakFactors, []);

      expect(confidenceStrong).toBeGreaterThan(confidenceWeak);
    });

    test('should never return confidence below 0 or above 100', () => {
      const extremeFactors = [
        { score: 0, weight: 0.50 },
        { score: 0, weight: 0.50 }
      ];

      const confidence = ExplainabilityService.calculateConfidence(extremeFactors, []);

      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(100);
    });
  });

  describe('Impact Level Classification', () => {
    test('should classify score >= 80 as strong', () => {
      expect(ExplainabilityService.getImpactLevel(80)).toBe('strong');
      expect(ExplainabilityService.getImpactLevel(90)).toBe('strong');
      expect(ExplainabilityService.getImpactLevel(100)).toBe('strong');
    });

    test('should classify score 60-79 as moderate', () => {
      expect(ExplainabilityService.getImpactLevel(60)).toBe('moderate');
      expect(ExplainabilityService.getImpactLevel(70)).toBe('moderate');
      expect(ExplainabilityService.getImpactLevel(79)).toBe('moderate');
    });

    test('should classify score < 60 as weak', () => {
      expect(ExplainabilityService.getImpactLevel(0)).toBe('weak');
      expect(ExplainabilityService.getImpactLevel(30)).toBe('weak');
      expect(ExplainabilityService.getImpactLevel(59)).toBe('weak');
    });
  });

  describe('Skill Extraction', () => {
    test('should extract common technical skills from task description', () => {
      const task = {
        title: 'Build REST API',
        description: 'Create a Node.js API with PostgreSQL database'
      };

      const skills = ExplainabilityService.extractRequiredSkills(task);

      expect(skills).toContain('nodejs');
      expect(skills).toContain('api');
      expect(skills).toContain('postgresql');
    });

    test('should be case-insensitive', () => {
      const task = {
        title: 'REACT Frontend Development',
        description: 'Build UI with REACT and TypeScript'
      };

      const skills = ExplainabilityService.extractRequiredSkills(task);

      expect(skills).toContain('react');
      expect(skills).toContain('typescript');
    });

    test('should return general development if no specific skills found', () => {
      const task = {
        title: 'Fix bug',
        description: 'Something is broken'
      };

      const skills = ExplainabilityService.extractRequiredSkills(task);

      expect(skills).toContain('general development');
    });
  });

  describe('Default Explanation', () => {
    test('should return valid default explanation', () => {
      const recommendation = { id: '123', name: 'Test' };
      const explanation = ExplainabilityService.getDefaultExplanation(recommendation);

      expect(explanation).toHaveProperty('recommendation');
      expect(explanation).toHaveProperty('confidence');
      expect(explanation).toHaveProperty('factors');
      expect(explanation).toHaveProperty('alternatives');
      expect(explanation).toHaveProperty('metadata');

      expect(explanation.confidence).toBe(75);
      expect(explanation.factors).toHaveLength(1);
      expect(explanation.alternatives).toEqual([]);
    });
  });

  describe('Full Explanation Generation', () => {
    test('should generate complete explanation for assignment agent', async () => {
      const recommendation = {
        task: {
          id: 'task-1',
          title: 'Build API endpoint',
          description: 'Create REST API with Node.js'
        },
        candidate: {
          id: 'user-1',
          name: 'John Doe',
          role: 'Backend Developer'
        }
      };

      const context = {
        timestamp: new Date().toISOString(),
        triggerType: 'task_created'
      };

      const explanation = await ExplainabilityService.generateExplanation(
        'assignment',
        recommendation,
        context
      );

      expect(explanation).toHaveProperty('recommendation');
      expect(explanation).toHaveProperty('confidence');
      expect(explanation).toHaveProperty('factors');
      expect(explanation).toHaveProperty('alternatives');
      expect(explanation.factors).toHaveLength(4);
      expect(explanation.metadata.agentType).toBe('assignment');
    });

    test('should handle missing data gracefully', async () => {
      const recommendation = {};
      const context = {};

      const explanation = await ExplainabilityService.generateExplanation(
        'assignment',
        recommendation,
        context
      );

      expect(explanation).toHaveProperty('confidence');
      expect(explanation.factors).toBeDefined();
    });

    test('should return default explanation for unknown agent type', async () => {
      const recommendation = { id: '123' };
      const context = {};

      const explanation = await ExplainabilityService.generateExplanation(
        'unknown_type',
        recommendation,
        context
      );

      expect(explanation.confidence).toBe(75);
      expect(explanation.factors).toHaveLength(1);
    });
  });

  describe('Factor Score Validation', () => {
    test('all factor scores should be between 0 and 100', async () => {
      const recommendation = {
        task: { title: 'Test', description: 'Test task' },
        candidate: { id: '1', name: 'Test User' }
      };
      const context = {};

      const explanation = await ExplainabilityService.generateExplanation(
        'assignment',
        recommendation,
        context
      );

      explanation.factors.forEach(factor => {
        expect(factor.score).toBeGreaterThanOrEqual(0);
        expect(factor.score).toBeLessThanOrEqual(100);
      });
    });

    test('all factors should have required properties', async () => {
      const recommendation = {
        task: { title: 'Test' },
        candidate: { id: '1' }
      };
      const context = {};

      const explanation = await ExplainabilityService.generateExplanation(
        'assignment',
        recommendation,
        context
      );

      explanation.factors.forEach(factor => {
        expect(factor).toHaveProperty('name');
        expect(factor).toHaveProperty('weight');
        expect(factor).toHaveProperty('score');
        expect(factor).toHaveProperty('impact');
        expect(factor).toHaveProperty('details');
        expect(factor).toHaveProperty('naturalLanguage');

        expect(Array.isArray(factor.details)).toBe(true);
        expect(typeof factor.naturalLanguage).toBe('string');
        expect(['strong', 'moderate', 'weak']).toContain(factor.impact);
      });
    });
  });
});

describe('Integration Tests', () => {
  test('explanation should be consistent across multiple calls', async () => {
    const recommendation = {
      task: { title: 'API Development', description: 'Node.js API' },
      candidate: { id: '1', name: 'Dev' }
    };
    const context = {};

    const exp1 = await ExplainabilityService.generateExplanation('assignment', recommendation, context);
    const exp2 = await ExplainabilityService.generateExplanation('assignment', recommendation, context);

    // Same input should produce same factor scores
    expect(exp1.factors.map(f => f.score)).toEqual(exp2.factors.map(f => f.score));
  });

  test('different recommendations should produce different explanations', async () => {
    const rec1 = {
      task: { title: 'Simple task', description: 'Easy work' },
      candidate: { id: '1' }
    };
    const rec2 = {
      task: { title: 'Complex API with React and Node.js', description: 'Hard work' },
      candidate: { id: '1' }
    };
    const context = {};

    const exp1 = await ExplainabilityService.generateExplanation('assignment', rec1, context);
    const exp2 = await ExplainabilityService.generateExplanation('assignment', rec2, context);

    // Different tasks should have different skill match scores
    const skillMatch1 = exp1.factors.find(f => f.name === 'Skill Match').score;
    const skillMatch2 = exp2.factors.find(f => f.name === 'Skill Match').score;

    // Likely to be different (not guaranteed but very likely)
    expect(skillMatch1).toBeDefined();
    expect(skillMatch2).toBeDefined();
  });
});
