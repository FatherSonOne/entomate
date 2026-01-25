import { useState, useCallback } from 'react';
import api from '../services/api';

/**
 * React hook for managing AI feedback prompts
 * Usage:
 *
 * const { showFeedbackPrompt, FeedbackPromptComponent } = useFeedbackPrompt();
 *
 * // When user overrides AI recommendation:
 * showFeedbackPrompt({
 *   agentType: 'assignment',
 *   agentExecutionId: '...',
 *   originalRecommendation: { id: 'user-1', name: 'John' },
 *   userChoice: { id: 'user-2', name: 'Jane' },
 *   context: { task: {...}, deal: {...} }
 * });
 *
 * // Render the component somewhere in your JSX:
 * <FeedbackPromptComponent />
 */
export function useFeedbackPrompt() {
  const [feedbackData, setFeedbackData] = useState(null);
  const [shouldPrompt, setShouldPrompt] = useState(true);

  /**
   * Check if feedback prompts are enabled for an agent type
   */
  const checkShouldPrompt = useCallback(async (agentType) => {
    try {
      const response = await api.learning.shouldPromptForFeedback(agentType);
      return response?.data?.shouldPrompt ?? true;
    } catch (error) {
      console.error('Failed to check feedback preference:', error);
      return true; // Default to showing prompts
    }
  }, []);

  /**
   * Show the feedback prompt
   * @param {Object} data - Override data
   * @param {string} data.agentType - Type of agent (assignment, priority, deadline, followup)
   * @param {string} data.agentExecutionId - ID of the agent execution (optional)
   * @param {Object} data.originalRecommendation - The AI's original recommendation
   * @param {Object} data.userChoice - What the user chose instead
   * @param {Object} data.context - Context data (task, deal, etc.)
   */
  const showFeedbackPrompt = useCallback(async (data) => {
    // Check if user wants to see prompts for this agent type
    const shouldShow = await checkShouldPrompt(data.agentType);

    if (shouldShow) {
      setFeedbackData(data);
    } else {
      // Still capture the override without showing prompt
      try {
        await api.learning.captureOverride({
          agentType: data.agentType,
          agentExecutionId: data.agentExecutionId,
          originalRecommendation: data.originalRecommendation,
          userChoice: data.userChoice,
          feedbackReason: null,
          feedbackText: null,
          context: data.context
        });
      } catch (error) {
        console.error('Failed to capture override silently:', error);
      }
    }
  }, [checkShouldPrompt]);

  /**
   * Hide the feedback prompt
   */
  const hideFeedbackPrompt = useCallback(() => {
    setFeedbackData(null);
  }, []);

  /**
   * Component to render the feedback prompt
   */
  const FeedbackPromptComponent = useCallback(() => {
    if (!feedbackData) return null;

    // Dynamically import the FeedbackPrompt component to avoid circular dependencies
    const FeedbackPrompt = require('../components/learning/FeedbackPrompt').default;

    return (
      <FeedbackPrompt
        agentType={feedbackData.agentType}
        agentExecutionId={feedbackData.agentExecutionId}
        originalRecommendation={feedbackData.originalRecommendation}
        userChoice={feedbackData.userChoice}
        context={feedbackData.context}
        onClose={hideFeedbackPrompt}
        onSubmit={hideFeedbackPrompt}
      />
    );
  }, [feedbackData, hideFeedbackPrompt]);

  return {
    showFeedbackPrompt,
    hideFeedbackPrompt,
    FeedbackPromptComponent,
    isShowing: !!feedbackData
  };
}

/**
 * Helper function to capture override without showing prompt
 * Useful for silent background capture
 */
export async function captureOverrideSilently(data) {
  try {
    await api.learning.captureOverride({
      agentType: data.agentType,
      agentExecutionId: data.agentExecutionId || null,
      originalRecommendation: data.originalRecommendation,
      userChoice: data.userChoice,
      feedbackReason: null,
      feedbackText: null,
      context: data.context
    });
  } catch (error) {
    console.error('Failed to capture override:', error);
  }
}

/**
 * Helper function to create context snapshot for learning
 * Captures relevant context data for pattern detection
 */
export function createContextSnapshot(task = null, deal = null, meeting = null, additionalContext = {}) {
  const context = {
    timestamp: new Date().toISOString(),
    ...additionalContext
  };

  if (task) {
    context.task = {
      id: task.id,
      title: task.title,
      description: task.description,
      type: task.type,
      status: task.status,
      priority: task.priority,
      dueDate: task.due_date || task.dueDate,
      estimatedHours: task.estimated_hours || task.estimatedHours,
      tags: task.tags
    };
  }

  if (deal) {
    context.deal = {
      id: deal.id,
      name: deal.name,
      value: deal.value,
      stage: deal.stage,
      probability: deal.probability,
      expectedCloseDate: deal.expected_close_date || deal.expectedCloseDate,
      accountType: deal.account_type || deal.accountType
    };
  }

  if (meeting) {
    context.meeting = {
      id: meeting.id,
      title: meeting.title,
      type: meeting.type,
      attendees: meeting.attendees,
      duration: meeting.duration
    };
  }

  return context;
}

export default useFeedbackPrompt;
