import React from 'react';
import ProgressBar from './ProgressBar';
import Tooltip from './Tooltip';

/**
 * FactorDetail - Displays a single decision factor with score and details
 *
 * Props:
 * - factor: Factor object with name, weight, score, impact, details, naturalLanguage
 * - rank: Numeric rank of the factor
 * - compact: Boolean for compact view
 * - showWeight: Boolean to show weight percentage
 * - showProgressBar: Boolean to show progress bar
 */
export default function FactorDetail({
  factor,
  rank,
  compact = false,
  showWeight = false,
  showProgressBar = false
}) {
  const { name, weight, score, impact, details, naturalLanguage } = factor;

  // Impact icon mapping
  const impactIcon = {
    strong: '✓',
    moderate: '⚠',
    weak: '✗'
  }[impact] || '•';

  // Factor explanations for tooltips
  const factorExplanations = {
    'Skill Match': 'How well the candidate\'s skills and experience match the task requirements',
    'Current Workload': 'The candidate\'s current task load compared to team average',
    'Availability': 'Whether the candidate is available to start work immediately',
    'Past Performance': 'Historical on-time delivery and quality metrics',
    'Business Impact': 'Expected revenue or strategic value of this task',
    'Urgency': 'Time sensitivity based on due date and dependencies',
    'Effort Estimation': 'Estimated hours required to complete the task',
    'Risk Level': 'Technical complexity and dependency risks',
    'Task Complexity': 'Overall difficulty and number of dependencies',
    'Team Velocity': 'Team\'s historical completion rate and capacity',
    'Buffer Calculation': 'Additional time built in for quality and contingencies',
    'Business Constraints': 'Hard deadlines or milestone requirements',
    'Follow-up Likelihood': 'Probability that follow-up action is needed',
    'Context Importance': 'Strategic value and deal stage importance',
    'Time Sensitivity': 'Urgency of required follow-up action',
    'Relationship Health': 'Engagement level and sentiment of the relationship'
  };

  const explanation = factorExplanations[name] || 'AI decision factor';

  // Compact view for concise display
  if (compact) {
    return (
      <div className="factor-compact">
        <span className="factor-name">{name}: {score}%</span>
        <span className={`impact-icon impact-${impact}`}>{impactIcon}</span>
        <span className="factor-summary">{naturalLanguage}</span>
      </div>
    );
  }

  // Detailed view for expanded display
  return (
    <div className="factor-detailed">
      <div className="factor-header">
        <span className="factor-rank">{rank}.</span>
        <Tooltip content={explanation} position="top">
          <span className="factor-name">{name}</span>
        </Tooltip>
        {showWeight && (
          <Tooltip content="How much this factor influences the final decision" position="top">
            <span className="factor-weight">
              ({Math.round(weight * 100)}% weight)
            </span>
          </Tooltip>
        )}
        <span className="factor-score">
          {score}/100 <span className={`impact-icon impact-${impact}`}>{impactIcon}</span>
        </span>
      </div>

      {showProgressBar && (
        <ProgressBar value={score} max={100} />
      )}

      {details && details.length > 0 && (
        <div className="factor-details">
          {details.map((detail, i) => (
            <div key={i} className="detail-item">
              • {detail}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
