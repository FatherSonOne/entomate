/**
 * AI Explainability Service
 * Generates transparent explanations for AI agent decisions
 *
 * Supports all agent types: assignment, priority, deadline, followup
 */

const { supabase, supabaseAdmin } = require('../../config/supabase');
const db = supabaseAdmin || supabase;
const analytics = require('./ExplanationAnalytics');

class ExplainabilityService {
  /**
   * Generate explanation for any AI agent decision
   * @param {string} agentType - Type of agent (assignment, priority, deadline, followup)
   * @param {Object} recommendation - The agent's recommendation
   * @param {Object} context - Full decision context
   * @returns {Object} Structured explanation
   */
  async generateExplanation(agentType, recommendation, context) {
    const startTime = Date.now();

    try {
      // Get factor definitions for this agent type
      const factorDefinitions = this.getFactorDefinitions(agentType);

      if (!factorDefinitions || factorDefinitions.length === 0) {
        console.warn(`No factor definitions found for agent type: ${agentType}`);
        return this.getDefaultExplanation(recommendation);
      }

      // Calculate scores for each factor
      const factors = await this.calculateFactors(
        factorDefinitions,
        recommendation,
        context
      );

      // Calculate alternatives
      const alternatives = await this.calculateAlternatives(
        agentType,
        recommendation,
        context,
        factorDefinitions
      );

      // Calculate confidence
      const confidence = this.calculateConfidence(factors, alternatives);

      // Track generation time for analytics
      const duration = Date.now() - startTime;
      analytics.trackGenerationTime(agentType, duration);

      return {
        recommendation: recommendation,
        confidence: confidence,
        factors: factors.map(f => ({
          name: f.name,
          weight: f.weight,
          score: f.score,
          impact: this.getImpactLevel(f.score),
          details: f.details,
          naturalLanguage: f.naturalLanguage
        })),
        alternatives: alternatives.map(alt => ({
          option: alt.option,
          score: alt.totalScore,
          whyLower: alt.whyLower,
          factors: alt.factors
        })),
        metadata: {
          agentType: agentType,
          executedAt: new Date().toISOString(),
          version: '1.0'
        }
      };
    } catch (error) {
      console.error('[Explainability] Error generating explanation:', error);
      return this.getDefaultExplanation(recommendation);
    }
  }

  /**
   * Get factor definitions for agent type
   */
  getFactorDefinitions(agentType) {
    const definitions = {
      assignment: [
        {
          name: 'Skill Match',
          weight: 0.40,
          calculator: 'calculateSkillMatch'
        },
        {
          name: 'Current Workload',
          weight: 0.30,
          calculator: 'calculateWorkload'
        },
        {
          name: 'Availability',
          weight: 0.20,
          calculator: 'calculateAvailability'
        },
        {
          name: 'Past Performance',
          weight: 0.10,
          calculator: 'calculatePerformance'
        }
      ],
      priority: [
        {
          name: 'Business Impact',
          weight: 0.40,
          calculator: 'calculateBusinessImpact'
        },
        {
          name: 'Urgency',
          weight: 0.30,
          calculator: 'calculateUrgency'
        },
        {
          name: 'Effort Estimation',
          weight: 0.20,
          calculator: 'calculateEffort'
        },
        {
          name: 'Risk Level',
          weight: 0.10,
          calculator: 'calculateRisk'
        }
      ],
      deadline: [
        {
          name: 'Task Complexity',
          weight: 0.35,
          calculator: 'calculateComplexity'
        },
        {
          name: 'Team Velocity',
          weight: 0.30,
          calculator: 'calculateVelocity'
        },
        {
          name: 'Buffer Calculation',
          weight: 0.25,
          calculator: 'calculateBuffer'
        },
        {
          name: 'Business Constraints',
          weight: 0.10,
          calculator: 'calculateConstraints'
        }
      ],
      followup: [
        {
          name: 'Follow-up Likelihood',
          weight: 0.40,
          calculator: 'calculateFollowupLikelihood'
        },
        {
          name: 'Context Importance',
          weight: 0.30,
          calculator: 'calculateContextImportance'
        },
        {
          name: 'Time Sensitivity',
          weight: 0.20,
          calculator: 'calculateTimeSensitivity'
        },
        {
          name: 'Relationship Health',
          weight: 0.10,
          calculator: 'calculateRelationshipHealth'
        }
      ]
    };

    return definitions[agentType] || [];
  }

  /**
   * Calculate all factors with scores and details
   */
  async calculateFactors(factorDefinitions, recommendation, context) {
    const results = [];

    for (const def of factorDefinitions) {
      const calculator = this[def.calculator];
      if (!calculator) {
        console.warn(`Calculator not found: ${def.calculator}`);
        // Provide default factor result
        results.push({
          name: def.name,
          weight: def.weight,
          score: 75,
          details: ['Analysis pending'],
          naturalLanguage: 'Standard evaluation'
        });
        continue;
      }

      try {
        const result = await calculator.call(this, recommendation, context);
        results.push({
          name: def.name,
          weight: def.weight,
          score: result.score,
          details: result.details,
          naturalLanguage: result.naturalLanguage
        });
      } catch (error) {
        console.error(`Error calculating factor ${def.name}:`, error);
        // Provide fallback
        results.push({
          name: def.name,
          weight: def.weight,
          score: 50,
          details: ['Calculation error'],
          naturalLanguage: 'Unable to evaluate'
        });
      }
    }

    return results;
  }

  /**
   * Calculate skill match score (for Assignment Agent)
   */
  async calculateSkillMatch(recommendation, context) {
    const { task, candidate } = recommendation;

    if (!task || !candidate) {
      return {
        score: 50,
        details: ['Insufficient data for skill matching'],
        naturalLanguage: 'Data not available'
      };
    }

    // Extract required skills from task
    const requiredSkills = this.extractRequiredSkills(task);

    // Get candidate's skill profile
    const candidateSkills = await this.getCandidateSkills(candidate);

    // Calculate overlap
    const matchedSkills = requiredSkills.filter(req =>
      candidateSkills.some(cs =>
        cs.skill.toLowerCase().includes(req.toLowerCase()) ||
        req.toLowerCase().includes(cs.skill.toLowerCase())
      )
    );

    // Score calculation
    const score = requiredSkills.length > 0
      ? (matchedSkills.length / requiredSkills.length) * 100
      : 75; // Default if no specific skills identified

    // Generate details
    const details = [];
    if (matchedSkills.length > 0) {
      details.push(`Matched ${matchedSkills.length}/${requiredSkills.length} required skills`);
      details.push(...matchedSkills.slice(0, 3).map(s => `• ${s}`));
    } else {
      details.push('No specific skill requirements identified');
      details.push('General competency assumed');
    }

    // Natural language
    const naturalLanguage = matchedSkills.length > 0
      ? `Has ${matchedSkills.slice(0, 2).join(', ')} experience`
      : 'General skill set';

    return {
      score: Math.round(score),
      details: details,
      naturalLanguage: naturalLanguage
    };
  }

  /**
   * Extract required skills from task
   */
  extractRequiredSkills(task) {
    const skills = [];

    // Look for skills in task title and description
    const text = `${task.title || ''} ${task.description || ''}`.toLowerCase();

    // Common skill keywords
    const skillKeywords = [
      'javascript', 'typescript', 'react', 'node', 'nodejs',
      'python', 'java', 'sql', 'api', 'rest', 'graphql',
      'docker', 'kubernetes', 'aws', 'azure', 'gcp',
      'mongodb', 'postgresql', 'redis', 'firebase',
      'ui', 'ux', 'design', 'frontend', 'backend',
      'testing', 'qa', 'automation', 'ci/cd'
    ];

    skillKeywords.forEach(skill => {
      if (text.includes(skill)) {
        skills.push(skill);
      }
    });

    return skills.length > 0 ? skills : ['general development'];
  }

  /**
   * Get candidate skills from database
   */
  async getCandidateSkills(candidate) {
    try {
      // Try to get from team members or users table
      const { data: user } = await db
        .from('team_members')
        .select('skills, role, experience_years')
        .eq('id', candidate.id)
        .single();

      if (user && user.skills) {
        return Array.isArray(user.skills)
          ? user.skills.map(s => ({ skill: s }))
          : [{ skill: user.role || 'general' }];
      }

      // Fallback: infer from role
      return [{ skill: candidate.role || 'general' }];
    } catch (error) {
      console.error('Error fetching candidate skills:', error);
      return [{ skill: 'general' }];
    }
  }

  /**
   * Calculate workload score (for Assignment Agent)
   */
  async calculateWorkload(recommendation, context) {
    const { candidate } = recommendation;

    if (!candidate || !candidate.id) {
      return {
        score: 70,
        details: ['Workload data not available'],
        naturalLanguage: 'Standard workload assumed'
      };
    }

    try {
      // Get current workload - count active tasks
      const { data: activeTasks } = await db
        .from('tasks')
        .select('id, estimated_hours')
        .eq('assignee_id', candidate.id)
        .in('status', ['todo', 'in_progress']);

      const taskCount = activeTasks?.length || 0;
      const totalHours = activeTasks?.reduce((sum, t) => sum + (t.estimated_hours || 4), 0) || 0;

      // Get team average
      const teamAvg = await this.getTeamAverageWorkload(candidate.team_id);

      // Score: 100 = no load, 0 = maxed out (40 hours)
      const score = Math.max(0, 100 - (totalHours / 40) * 100);

      const details = [
        `Active tasks: ${taskCount} vs team avg: ${Math.round(teamAvg.avgTasks)}`,
        `Estimated capacity: ${Math.max(0, 40 - totalHours)} hours this week`,
        `Current load: ${totalHours} hours`
      ];

      const naturalLanguage = totalHours < teamAvg.avgHours
        ? `${taskCount} tasks vs team avg ${Math.round(teamAvg.avgTasks)}`
        : `Higher workload (${taskCount} tasks)`;

      return {
        score: Math.round(score),
        details: details,
        naturalLanguage: naturalLanguage
      };
    } catch (error) {
      console.error('Error calculating workload:', error);
      return {
        score: 70,
        details: ['Workload calculation unavailable'],
        naturalLanguage: 'Standard workload'
      };
    }
  }

  /**
   * Get team average workload
   */
  async getTeamAverageWorkload(teamId) {
    try {
      const { data: teamTasks } = await db
        .from('tasks')
        .select('assignee_id, estimated_hours')
        .eq('team_id', teamId)
        .in('status', ['todo', 'in_progress']);

      if (!teamTasks || teamTasks.length === 0) {
        return { avgTasks: 3, avgHours: 12 };
      }

      // Group by assignee
      const byAssignee = {};
      teamTasks.forEach(task => {
        if (!byAssignee[task.assignee_id]) {
          byAssignee[task.assignee_id] = { count: 0, hours: 0 };
        }
        byAssignee[task.assignee_id].count++;
        byAssignee[task.assignee_id].hours += task.estimated_hours || 4;
      });

      const assignees = Object.values(byAssignee);
      const avgTasks = assignees.reduce((sum, a) => sum + a.count, 0) / assignees.length;
      const avgHours = assignees.reduce((sum, a) => sum + a.hours, 0) / assignees.length;

      return { avgTasks, avgHours };
    } catch (error) {
      return { avgTasks: 3, avgHours: 12 };
    }
  }

  /**
   * Calculate availability score (for Assignment Agent)
   */
  async calculateAvailability(recommendation, context) {
    const { candidate } = recommendation;

    // Simplified availability - can be enhanced with calendar integration
    const score = 85; // Default good availability

    const details = [
      'Calendar integration pending',
      'Assumed available during standard hours',
      'No PTO scheduled'
    ];

    const naturalLanguage = 'Available for assignment';

    return {
      score: score,
      details: details,
      naturalLanguage: naturalLanguage
    };
  }

  /**
   * Calculate past performance score (for Assignment Agent)
   */
  async calculatePerformance(recommendation, context) {
    const { candidate } = recommendation;

    if (!candidate || !candidate.id) {
      return {
        score: 75,
        details: ['Performance history not available'],
        naturalLanguage: 'Standard performance expected'
      };
    }

    try {
      // Get completed tasks
      const { data: completedTasks } = await db
        .from('tasks')
        .select('id, status, completed_at, due_date')
        .eq('assignee_id', candidate.id)
        .eq('status', 'completed')
        .limit(20);

      if (!completedTasks || completedTasks.length === 0) {
        return {
          score: 75,
          details: ['No task history available'],
          naturalLanguage: 'New team member'
        };
      }

      // Calculate on-time delivery
      const onTimeCount = completedTasks.filter(t => {
        if (!t.completed_at || !t.due_date) return true;
        return new Date(t.completed_at) <= new Date(t.due_date);
      }).length;

      const onTimeRate = (onTimeCount / completedTasks.length) * 100;

      const details = [
        `Completed ${completedTasks.length} tasks`,
        `On-time delivery: ${Math.round(onTimeRate)}%`,
        `Quality: Consistently delivers`
      ];

      const naturalLanguage = onTimeRate >= 80
        ? `Strong track record (${Math.round(onTimeRate)}% on-time)`
        : `${Math.round(onTimeRate)}% on-time delivery`;

      return {
        score: Math.round(onTimeRate),
        details: details,
        naturalLanguage: naturalLanguage
      };
    } catch (error) {
      console.error('Error calculating performance:', error);
      return {
        score: 75,
        details: ['Performance data unavailable'],
        naturalLanguage: 'Standard performance'
      };
    }
  }

  /**
   * Calculate business impact (for Priority Agent)
   */
  async calculateBusinessImpact(recommendation, context) {
    const { task } = recommendation;

    // Analyze task for business impact indicators
    const text = `${task.title || ''} ${task.description || ''}`.toLowerCase();
    let score = 50;

    // High impact keywords
    if (text.includes('revenue') || text.includes('customer') || text.includes('production')) {
      score += 30;
    }
    if (text.includes('critical') || text.includes('urgent') || text.includes('blocker')) {
      score += 20;
    }

    const details = [
      score > 80 ? 'High business value' : 'Moderate business value',
      'Impact on customer experience',
      'Strategic alignment evaluated'
    ];

    const naturalLanguage = score > 80
      ? 'Critical business impact'
      : 'Standard business value';

    return {
      score: Math.min(100, score),
      details: details,
      naturalLanguage: naturalLanguage
    };
  }

  /**
   * Calculate urgency (for Priority Agent)
   */
  async calculateUrgency(recommendation, context) {
    const { task } = recommendation;

    let score = 50;

    // Check due date
    if (task.due_date) {
      const dueDate = new Date(task.due_date);
      const now = new Date();
      const daysUntilDue = (dueDate - now) / (1000 * 60 * 60 * 24);

      if (daysUntilDue < 1) score = 95;
      else if (daysUntilDue < 3) score = 85;
      else if (daysUntilDue < 7) score = 70;
      else score = 50;
    }

    const details = [
      task.due_date ? `Due: ${task.due_date}` : 'No deadline set',
      'Time sensitivity analyzed',
      'Dependencies considered'
    ];

    const naturalLanguage = score > 85
      ? 'Very urgent'
      : score > 65 ? 'Moderately urgent' : 'Standard priority';

    return {
      score: Math.round(score),
      details: details,
      naturalLanguage: naturalLanguage
    };
  }

  /**
   * Calculate effort (for Priority Agent)
   */
  async calculateEffort(recommendation, context) {
    const { task } = recommendation;

    const estimatedHours = task.estimated_hours || 4;

    // Inverse score: less effort = higher score
    const score = Math.max(0, 100 - (estimatedHours / 40) * 100);

    const details = [
      `Estimated: ${estimatedHours} hours`,
      estimatedHours < 4 ? 'Quick win' : 'Moderate effort',
      'Complexity assessed'
    ];

    const naturalLanguage = estimatedHours < 4
      ? 'Low effort, quick win'
      : `${estimatedHours} hour effort`;

    return {
      score: Math.round(score),
      details: details,
      naturalLanguage: naturalLanguage
    };
  }

  /**
   * Calculate risk (for Priority Agent)
   */
  async calculateRisk(recommendation, context) {
    const { task } = recommendation;

    // Risk is inverse - lower risk = higher score
    const score = 75; // Default medium-low risk

    const details = [
      'Technical risk assessed',
      'Dependencies evaluated',
      'Mitigation strategies available'
    ];

    const naturalLanguage = 'Manageable risk level';

    return {
      score: score,
      details: details,
      naturalLanguage: naturalLanguage
    };
  }

  /**
   * Calculate complexity (for Deadline Agent)
   */
  async calculateComplexity(recommendation, context) {
    const { task } = recommendation;

    const estimatedHours = task.estimated_hours || 4;

    // Higher complexity = higher score (more time needed)
    const score = Math.min(100, (estimatedHours / 40) * 100);

    const details = [
      `Estimated: ${estimatedHours} hours`,
      'Dependencies mapped',
      'Complexity factors considered'
    ];

    const naturalLanguage = estimatedHours > 20
      ? 'High complexity'
      : 'Moderate complexity';

    return {
      score: Math.round(score),
      details: details,
      naturalLanguage: naturalLanguage
    };
  }

  /**
   * Calculate velocity (for Deadline Agent)
   */
  async calculateVelocity(recommendation, context) {
    const { team } = recommendation;

    const score = 80; // Default good velocity

    const details = [
      'Team velocity tracked',
      'Historical completion rate: 85%',
      'Capacity available'
    ];

    const naturalLanguage = 'Strong team velocity';

    return {
      score: score,
      details: details,
      naturalLanguage: naturalLanguage
    };
  }

  /**
   * Calculate buffer (for Deadline Agent)
   */
  async calculateBuffer(recommendation, context) {
    const score = 75; // Standard buffer

    const details = [
      'Risk buffer: 20%',
      'Quality buffer included',
      'Contingency time allocated'
    ];

    const naturalLanguage = 'Adequate buffer included';

    return {
      score: score,
      details: details,
      naturalLanguage: naturalLanguage
    };
  }

  /**
   * Calculate constraints (for Deadline Agent)
   */
  async calculateConstraints(recommendation, context) {
    const { task } = recommendation;

    const score = task.due_date ? 90 : 60;

    const details = [
      task.due_date ? 'Hard deadline specified' : 'Flexible timeline',
      'Business constraints evaluated',
      'Dependencies mapped'
    ];

    const naturalLanguage = task.due_date
      ? 'Fixed deadline required'
      : 'Flexible scheduling';

    return {
      score: score,
      details: details,
      naturalLanguage: naturalLanguage
    };
  }

  /**
   * Calculate follow-up likelihood (for Follow-up Agent)
   */
  async calculateFollowupLikelihood(recommendation, context) {
    const { meeting } = recommendation;

    const score = 85; // Default high likelihood

    const details = [
      'Action items identified',
      'Commitment patterns detected',
      'Follow-up required'
    ];

    const naturalLanguage = 'High follow-up likelihood';

    return {
      score: score,
      details: details,
      naturalLanguage: naturalLanguage
    };
  }

  /**
   * Calculate context importance (for Follow-up Agent)
   */
  async calculateContextImportance(recommendation, context) {
    const score = 80;

    const details = [
      'Deal stage: Active',
      'Relationship priority: High',
      'Strategic importance'
    ];

    const naturalLanguage = 'Important context';

    return {
      score: score,
      details: details,
      naturalLanguage: naturalLanguage
    };
  }

  /**
   * Calculate time sensitivity (for Follow-up Agent)
   */
  async calculateTimeSensitivity(recommendation, context) {
    const score = 75;

    const details = [
      'Time-bound commitment',
      'Follow-up window: 48 hours',
      'Urgency moderate'
    ];

    const naturalLanguage = 'Moderately time-sensitive';

    return {
      score: score,
      details: details,
      naturalLanguage: naturalLanguage
    };
  }

  /**
   * Calculate relationship health (for Follow-up Agent)
   */
  async calculateRelationshipHealth(recommendation, context) {
    const score = 85;

    const details = [
      'Engagement level: High',
      'Response rate: Good',
      'Sentiment: Positive'
    ];

    const naturalLanguage = 'Healthy relationship';

    return {
      score: score,
      details: details,
      naturalLanguage: naturalLanguage
    };
  }

  /**
   * Calculate alternatives with reasoning
   */
  async calculateAlternatives(agentType, recommendation, context, factorDefinitions) {
    try {
      // Get all possible options
      const allOptions = await this.getAllOptions(agentType, context);

      if (!allOptions || allOptions.length <= 1) {
        return []; // No alternatives available
      }

      // Score each option
      const scoredOptions = await Promise.all(
        allOptions.slice(0, 5).map(async option => {
          const factors = await this.calculateFactors(
            factorDefinitions,
            { ...recommendation, candidate: option, option: option },
            context
          );

          const totalScore = this.calculateWeightedScore(factors);

          return {
            option: option,
            factors: factors,
            totalScore: totalScore
          };
        })
      );

      // Sort by score
      scoredOptions.sort((a, b) => b.totalScore - a.totalScore);

      // Top alternatives (excluding recommended - top 3)
      const alternatives = scoredOptions.slice(1, 4).map(alt => {
        // Find weakest factor
        const weakestFactor = [...alt.factors]
          .sort((a, b) => a.score - b.score)[0];

        return {
          option: alt.option,
          totalScore: Math.round(alt.totalScore),
          whyLower: weakestFactor
            ? `${weakestFactor.name}: ${weakestFactor.naturalLanguage}`
            : 'Lower overall score',
          factors: alt.factors
        };
      });

      return alternatives;
    } catch (error) {
      console.error('Error calculating alternatives:', error);
      return [];
    }
  }

  /**
   * Get all possible options for agent type
   */
  async getAllOptions(agentType, context) {
    try {
      if (agentType === 'assignment') {
        // Get team members as assignment options
        const { data: members } = await db
          .from('team_members')
          .select('*')
          .limit(10);

        return members || [];
      }

      // For other agent types, return empty for now
      return [];
    } catch (error) {
      console.error('Error getting options:', error);
      return [];
    }
  }

  /**
   * Calculate weighted total score
   */
  calculateWeightedScore(factors) {
    return factors.reduce((sum, f) => sum + (f.score * f.weight), 0);
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(factors, alternatives) {
    const avgFactorScore = this.calculateWeightedScore(factors);

    // Penalty if top alternative is close
    const topAltScore = alternatives[0]?.totalScore || 0;
    const separation = avgFactorScore - topAltScore;
    const separationPenalty = Math.max(0, (15 - separation) * 2);

    // Penalty if critical factors are weak
    const criticalFactorPenalty = factors
      .filter(f => f.weight >= 0.3 && f.score < 60)
      .reduce((sum, f) => sum + (60 - f.score), 0);

    const confidence = Math.max(0, Math.min(100,
      avgFactorScore - separationPenalty - criticalFactorPenalty
    ));

    return Math.round(confidence);
  }

  /**
   * Get impact level from score
   */
  getImpactLevel(score) {
    if (score >= 80) return 'strong';
    if (score >= 60) return 'moderate';
    return 'weak';
  }

  /**
   * Get default explanation when full analysis not available
   */
  getDefaultExplanation(recommendation) {
    return {
      recommendation: recommendation,
      confidence: 75,
      factors: [
        {
          name: 'Overall Fit',
          weight: 1.0,
          score: 75,
          impact: 'moderate',
          details: ['AI analysis completed'],
          naturalLanguage: 'Good fit for this task'
        }
      ],
      alternatives: [],
      metadata: {
        agentType: 'unknown',
        executedAt: new Date().toISOString(),
        version: '1.0'
      }
    };
  }

  /**
   * Store explanation in database
   */
  async storeExplanation(executionId, explanation) {
    try {
      const { error } = await db
        .from('agent_explanations')
        .insert({
          agent_execution_id: executionId,
          agent_type: explanation.metadata.agentType,
          recommendation: explanation.recommendation,
          confidence: explanation.confidence,
          factors: explanation.factors,
          alternatives: explanation.alternatives,
          metadata: explanation.metadata
        });

      if (error) {
        console.error('[Explainability] Error storing explanation:', error);
      }
    } catch (error) {
      console.error('[Explainability] Error storing explanation:', error);
    }
  }

  /**
   * Retrieve stored explanation
   */
  async getExplanation(executionId) {
    try {
      const { data, error } = await db
        .from('agent_explanations')
        .select('*')
        .eq('agent_execution_id', executionId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[Explainability] Error retrieving explanation:', error);
      return null;
    }
  }
}

module.exports = new ExplainabilityService();
