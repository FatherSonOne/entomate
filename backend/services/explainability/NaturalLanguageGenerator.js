/**
 * Natural Language Generator
 * Produces human-friendly explanations for AI decisions
 */

class NaturalLanguageGenerator {
  /**
   * Generate natural language for skill match
   */
  generateSkillMatchText(score, matchedSkills, requiredSkills) {
    const matchCount = matchedSkills.length;
    const totalRequired = requiredSkills.length;
    const matchRate = totalRequired > 0 ? (matchCount / totalRequired) * 100 : 0;

    if (matchRate >= 90) {
      return `Excellent match - has ${matchedSkills.slice(0, 2).join(' and ')} expertise`;
    } else if (matchRate >= 75) {
      return `Strong fit with ${matchedSkills[0]} experience${matchedSkills[1] ? ' and ' + matchedSkills[1] : ''}`;
    } else if (matchRate >= 50) {
      return matchedSkills.length > 0
        ? `Has ${matchedSkills[0]} skills, learning others`
        : 'Some relevant experience';
    } else {
      return 'Limited direct experience, but capable of learning';
    }
  }

  /**
   * Generate natural language for workload
   */
  generateWorkloadText(score, taskCount, teamAvg) {
    const workloadLevel = score >= 80 ? 'light' : score >= 60 ? 'moderate' : 'heavy';

    if (score >= 90) {
      return `Light workload (${taskCount} task${taskCount !== 1 ? 's' : ''}) - plenty of capacity`;
    } else if (score >= 75) {
      return `Below team average (${taskCount} vs ${Math.round(teamAvg)} tasks)`;
    } else if (score >= 50) {
      return `Moderate workload (${taskCount} active tasks)`;
    } else {
      return `Heavy workload (${taskCount} tasks) - may need support`;
    }
  }

  /**
   * Generate natural language for availability
   */
  generateAvailabilityText(score, availableHours, ptoScheduled) {
    if (ptoScheduled) {
      return `Limited availability - PTO scheduled soon`;
    }

    if (score >= 85) {
      return `Fully available for immediate start`;
    } else if (score >= 70) {
      return `Available with some scheduling constraints`;
    } else {
      return `Limited availability - conflicts exist`;
    }
  }

  /**
   * Generate natural language for performance
   */
  generatePerformanceText(score, onTimeRate, taskCount) {
    if (taskCount === 0) {
      return `New team member - no track record yet`;
    }

    if (score >= 90) {
      return `Excellent track record (${Math.round(onTimeRate)}% on-time delivery)`;
    } else if (score >= 75) {
      return `Strong performer with ${Math.round(onTimeRate)}% success rate`;
    } else if (score >= 60) {
      return `Reliable performer (${Math.round(onTimeRate)}% on-time)`;
    } else {
      return `Inconsistent delivery (${Math.round(onTimeRate)}% on-time)`;
    }
  }

  /**
   * Generate natural language for business impact
   */
  generateBusinessImpactText(score, keywords) {
    const hasRevenue = keywords.includes('revenue') || keywords.includes('customer');
    const hasCritical = keywords.includes('critical') || keywords.includes('urgent');

    if (score >= 85 && hasRevenue) {
      return `High revenue impact - critical for business`;
    } else if (score >= 70) {
      return hasCritical
        ? `Important for operations and customer satisfaction`
        : `Moderate business value`;
    } else {
      return `Standard business priority`;
    }
  }

  /**
   * Generate natural language for urgency
   */
  generateUrgencyText(score, daysUntilDue) {
    if (daysUntilDue === null) {
      return `No deadline set - flexible timing`;
    }

    if (daysUntilDue < 1) {
      return `Urgent - due today!`;
    } else if (daysUntilDue < 3) {
      return `Very urgent - due in ${Math.ceil(daysUntilDue)} day${daysUntilDue > 1 ? 's' : ''}`;
    } else if (daysUntilDue < 7) {
      return `Moderately urgent - due this week`;
    } else {
      return `Standard timeline - due in ${Math.ceil(daysUntilDue)} days`;
    }
  }

  /**
   * Generate natural language for effort
   */
  generateEffortText(score, estimatedHours) {
    if (estimatedHours <= 2) {
      return `Quick task - ${estimatedHours}h estimated`;
    } else if (estimatedHours <= 8) {
      return `Moderate effort - about ${estimatedHours} hours`;
    } else if (estimatedHours <= 40) {
      return `Substantial task - ${estimatedHours}h of work`;
    } else {
      return `Major project - ${estimatedHours}h estimated`;
    }
  }

  /**
   * Generate natural language for risk
   */
  generateRiskText(score, complexity, dependencies) {
    const riskLevel = score >= 75 ? 'low' : score >= 50 ? 'moderate' : 'high';

    if (riskLevel === 'low') {
      return `Low risk - straightforward implementation`;
    } else if (riskLevel === 'moderate') {
      return `Moderate risk - some complexity involved`;
    } else {
      return dependencies > 0
        ? `Higher risk - complex with ${dependencies} dependencies`
        : `Higher risk - technical complexity`;
    }
  }

  /**
   * Generate natural language for complexity
   */
  generateComplexityText(score, estimatedHours, dependencies) {
    if (score >= 75) {
      return `Complex task - ${estimatedHours}h with multiple dependencies`;
    } else if (score >= 50) {
      return `Moderate complexity - ${estimatedHours}h estimated`;
    } else {
      return `Simple task - ${estimatedHours}h straightforward work`;
    }
  }

  /**
   * Generate natural language for team velocity
   */
  generateVelocityText(score, completionRate) {
    if (score >= 85) {
      return `Excellent team velocity (${Math.round(completionRate)}% completion rate)`;
    } else if (score >= 70) {
      return `Good team velocity - ${Math.round(completionRate)}% on track`;
    } else {
      return `Team capacity constrained - ${Math.round(completionRate)}% completion`;
    }
  }

  /**
   * Generate natural language for buffer calculation
   */
  generateBufferText(score, bufferPercentage) {
    if (score >= 80) {
      return `Generous buffer (${Math.round(bufferPercentage)}%) for quality`;
    } else if (score >= 60) {
      return `Standard buffer included (${Math.round(bufferPercentage)}%)`;
    } else {
      return `Tight timeline - minimal buffer`;
    }
  }

  /**
   * Generate natural language for constraints
   */
  generateConstraintsText(score, hasDueDate, milestone) {
    if (hasDueDate && milestone) {
      return `Hard deadline for ${milestone} milestone`;
    } else if (hasDueDate) {
      return `Fixed deadline - must complete on time`;
    } else {
      return `Flexible timeline - no hard constraints`;
    }
  }

  /**
   * Generate natural language for follow-up likelihood
   */
  generateFollowupLikelihoodText(score, patterns) {
    if (score >= 85) {
      return `High likelihood - clear action items detected`;
    } else if (score >= 65) {
      return `Probable follow-up needed based on discussion`;
    } else {
      return `Some follow-up possible`;
    }
  }

  /**
   * Generate natural language for context importance
   */
  generateContextImportanceText(score, dealValue, stage) {
    if (score >= 85 && dealValue) {
      return `Critical context - high-value ${stage} deal`;
    } else if (score >= 70) {
      return `Important ${stage} opportunity`;
    } else {
      return `Standard context`;
    }
  }

  /**
   * Generate natural language for time sensitivity
   */
  generateTimeSensitivityText(score, daysSince) {
    if (score >= 85) {
      return `Very time-sensitive - action needed within 24h`;
    } else if (score >= 65) {
      return `Moderately urgent - follow up within 48h`;
    } else {
      return `Standard timeline for follow-up`;
    }
  }

  /**
   * Generate natural language for relationship health
   */
  generateRelationshipHealthText(score, engagementLevel, sentiment) {
    if (score >= 85) {
      return `Strong relationship - highly engaged`;
    } else if (score >= 70) {
      return `Healthy relationship - positive engagement`;
    } else if (score >= 50) {
      return `Moderate engagement`;
    } else {
      return `Limited engagement - needs attention`;
    }
  }

  /**
   * Generate explanation for why an alternative ranked lower
   */
  generateWhyLowerText(weakestFactor, scoreDifference) {
    const factorName = weakestFactor.name;
    const factorScore = weakestFactor.score;

    if (scoreDifference > 20) {
      return `Significantly lower ${factorName} (${factorScore}/100)`;
    } else if (scoreDifference > 10) {
      return `Lower ${factorName} - ${weakestFactor.naturalLanguage}`;
    } else {
      return `Slightly lower ${factorName}`;
    }
  }

  /**
   * Generate confidence explanation
   */
  generateConfidenceExplanation(confidence, factors, alternatives) {
    if (confidence >= 90) {
      return `Very confident - all factors align strongly`;
    } else if (confidence >= 80) {
      return `Highly confident - strong match across key factors`;
    } else if (confidence >= 65) {
      const weakFactors = factors.filter(f => f.score < 60);
      if (weakFactors.length > 0) {
        return `Moderately confident - ${weakFactors[0].name} could be stronger`;
      }
      return `Moderately confident - good overall fit`;
    } else {
      const topAlt = alternatives[0];
      if (topAlt && (factors[0].score - topAlt.totalScore) < 10) {
        return `Lower confidence - alternatives are close`;
      }
      return `Lower confidence - review factors carefully`;
    }
  }
}

module.exports = new NaturalLanguageGenerator();
