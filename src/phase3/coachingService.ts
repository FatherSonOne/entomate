/**
 * Real-time Coaching Service
 *
 * Provides live meeting assistance including:
 * - Deal context prompts
 * - Objection handling suggestions
 * - Competitor mention alerts
 * - Talk-time balance warnings
 * - Keyword detection and response
 */

import { GoogleGenAI } from "@google/genai"
import { supabase } from "../lib/supabase"
import type {
  CoachingSession,
  CoachingPrompt,
  CoachingKeyword,
  CoachingContext,
  CoachingStats,
  CoachingPromptType,
  CoachingPromptPriority,
  ServiceResponse
} from "./types"

// Lazy initialization to avoid errors when API key isn't available
let ai: GoogleGenAI | null = null

function getAI(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.API_KEY || import.meta.env?.VITE_GEMINI_API_KEY || ''
    if (!apiKey) {
      throw new Error('Gemini API key not configured')
    }
    ai = new GoogleGenAI({ apiKey })
  }
  return ai
}

// Prompt throttling - max 1 prompt per 30 seconds per session
const PROMPT_THROTTLE_MS = 30000
const lastPromptTime: Map<string, number> = new Map()

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Start a new coaching session
 */
export async function startCoachingSession(
  meetingId: string,
  userId: string
): Promise<ServiceResponse<CoachingSession>> {
  try {
    const { data, error } = await supabase
      .from('coaching_sessions')
      .insert({
        meeting_id: meetingId,
        user_id: userId
      })
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: mapSessionFromDb(data)
    }
  } catch (error) {
    console.error('Start coaching session error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start coaching session'
    }
  }
}

/**
 * End a coaching session
 */
export async function endCoachingSession(
  sessionId: string
): Promise<ServiceResponse<CoachingSession>> {
  try {
    const { data, error } = await supabase.rpc('end_coaching_session', {
      p_session_id: sessionId
    })

    if (error) throw error

    // Fetch updated session
    const { data: session, error: fetchError } = await supabase
      .from('coaching_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (fetchError) throw fetchError

    // Clear throttle tracking
    lastPromptTime.delete(sessionId)

    return {
      success: true,
      data: mapSessionFromDb(session)
    }
  } catch (error) {
    console.error('End coaching session error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to end coaching session'
    }
  }
}

/**
 * Get active session for a meeting
 */
export async function getActiveSession(
  meetingId: string,
  userId: string
): Promise<ServiceResponse<CoachingSession | null>> {
  try {
    const { data, error } = await supabase
      .from('coaching_sessions')
      .select('*')
      .eq('meeting_id', meetingId)
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return {
      success: true,
      data: data ? mapSessionFromDb(data) : null
    }
  } catch (error) {
    console.error('Get active session error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get active session'
    }
  }
}

/**
 * Get coaching statistics for a user
 */
export async function getCoachingStats(
  userId: string,
  days: number = 30
): Promise<ServiceResponse<CoachingStats>> {
  try {
    const { data, error } = await supabase.rpc('get_coaching_stats', {
      p_user_id: userId,
      p_days: days
    })

    if (error) throw error

    return {
      success: true,
      data: {
        totalSessions: data?.total_sessions || 0,
        totalPrompts: data?.total_prompts || 0,
        promptsUsed: data?.prompts_used || 0,
        promptsDismissed: data?.prompts_dismissed || 0,
        avgResponseTime: data?.avg_response_time || null,
        usageRate: data?.total_prompts > 0
          ? (data?.prompts_used / data?.total_prompts) * 100
          : 0
      }
    }
  } catch (error) {
    console.error('Get coaching stats error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get coaching stats'
    }
  }
}

// ============================================================================
// PROMPT MANAGEMENT
// ============================================================================

/**
 * Create a coaching prompt
 */
export async function createPrompt(
  sessionId: string,
  promptType: CoachingPromptType,
  promptText: string,
  priority: CoachingPromptPriority,
  context: Record<string, unknown> = {},
  triggerKeyword?: string,
  triggerContext?: string
): Promise<ServiceResponse<CoachingPrompt | null>> {
  try {
    // Check throttling
    const lastTime = lastPromptTime.get(sessionId) || 0
    const now = Date.now()

    if (now - lastTime < PROMPT_THROTTLE_MS) {
      return {
        success: true,
        data: null // Throttled, no prompt created
      }
    }

    const { data, error } = await supabase
      .from('coaching_prompts')
      .insert({
        session_id: sessionId,
        prompt_type: promptType,
        prompt_text: promptText,
        priority,
        context,
        trigger_keyword: triggerKeyword || null,
        trigger_context: triggerContext || null
      })
      .select()
      .single()

    if (error) throw error

    // Update throttle tracking
    lastPromptTime.set(sessionId, now)

    // Increment session counter
    await supabase.rpc('increment_session_counter', {
      p_session_id: sessionId,
      p_counter_name: 'prompts_shown'
    })

    return {
      success: true,
      data: mapPromptFromDb(data)
    }
  } catch (error) {
    console.error('Create prompt error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create prompt'
    }
  }
}

/**
 * Mark a prompt as used
 */
export async function markPromptUsed(
  promptId: string
): Promise<ServiceResponse<CoachingPrompt>> {
  try {
    const { data, error } = await supabase
      .from('coaching_prompts')
      .update({
        used_at: new Date().toISOString()
      })
      .eq('id', promptId)
      .select()
      .single()

    if (error) throw error

    // Increment session counter
    if (data.session_id) {
      await supabase.rpc('increment_session_counter', {
        p_session_id: data.session_id,
        p_counter_name: 'prompts_used'
      })
    }

    return {
      success: true,
      data: mapPromptFromDb(data)
    }
  } catch (error) {
    console.error('Mark prompt used error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark prompt used'
    }
  }
}

/**
 * Mark a prompt as dismissed
 */
export async function dismissPrompt(
  promptId: string
): Promise<ServiceResponse<CoachingPrompt>> {
  try {
    const { data, error } = await supabase
      .from('coaching_prompts')
      .update({
        dismissed_at: new Date().toISOString()
      })
      .eq('id', promptId)
      .select()
      .single()

    if (error) throw error

    // Increment session counter
    if (data.session_id) {
      await supabase.rpc('increment_session_counter', {
        p_session_id: data.session_id,
        p_counter_name: 'prompts_dismissed'
      })
    }

    return {
      success: true,
      data: mapPromptFromDb(data)
    }
  } catch (error) {
    console.error('Dismiss prompt error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to dismiss prompt'
    }
  }
}

/**
 * Get prompts for a session
 */
export async function getSessionPrompts(
  sessionId: string
): Promise<ServiceResponse<CoachingPrompt[]>> {
  try {
    const { data, error } = await supabase
      .from('coaching_prompts')
      .select('*')
      .eq('session_id', sessionId)
      .order('shown_at', { ascending: false })

    if (error) throw error

    return {
      success: true,
      data: data.map(mapPromptFromDb)
    }
  } catch (error) {
    console.error('Get session prompts error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get session prompts'
    }
  }
}

// ============================================================================
// KEYWORD DETECTION
// ============================================================================

/**
 * Get all active coaching keywords
 */
export async function getActiveKeywords(): Promise<ServiceResponse<CoachingKeyword[]>> {
  try {
    const { data, error } = await supabase
      .from('coaching_keywords')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false })

    if (error) throw error

    return {
      success: true,
      data: data.map(mapKeywordFromDb)
    }
  } catch (error) {
    console.error('Get active keywords error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get keywords'
    }
  }
}

/**
 * Detect keywords in text and return matching prompts
 */
export async function detectKeywords(
  text: string,
  sessionId: string,
  context: CoachingContext
): Promise<ServiceResponse<CoachingPrompt[]>> {
  try {
    const keywordsResult = await getActiveKeywords()
    if (!keywordsResult.success || !keywordsResult.data) {
      return { success: true, data: [] }
    }

    const lowerText = text.toLowerCase()
    const createdPrompts: CoachingPrompt[] = []

    for (const keyword of keywordsResult.data) {
      if (lowerText.includes(keyword.keyword.toLowerCase())) {
        // Generate prompt from template
        const promptText = processTemplate(keyword.promptTemplate, context)

        const result = await createPrompt(
          sessionId,
          keyword.promptType,
          promptText,
          keyword.priority,
          context,
          keyword.keyword,
          text.substring(0, 200) // First 200 chars as trigger context
        )

        if (result.success && result.data) {
          createdPrompts.push(result.data)
        }
      }
    }

    return {
      success: true,
      data: createdPrompts
    }
  } catch (error) {
    console.error('Detect keywords error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to detect keywords'
    }
  }
}

// ============================================================================
// AI-POWERED COACHING
// ============================================================================

/**
 * Generate AI-powered coaching suggestion based on conversation context
 */
export async function generateCoachingSuggestion(
  transcriptSnippet: string,
  context: CoachingContext
): Promise<ServiceResponse<{ promptType: CoachingPromptType; promptText: string; priority: CoachingPromptPriority }>> {
  const prompt = `
You are a real-time sales coach. Analyze this conversation snippet and provide a helpful coaching prompt.

CONVERSATION:
${transcriptSnippet}

CONTEXT:
- Deal Stage: ${context.dealStage || 'Unknown'}
- Open Objections: ${context.openObjections.join(', ') || 'None'}
- Competitor Mentions: ${context.competitorMentions.join(', ') || 'None'}
- Current Sentiment: ${context.currentSentiment}

Respond in this exact JSON format:
{
  "promptType": "deal_context" | "objection_handling" | "competitor_alert" | "question_prompt" | "topic_suggestion" | "sentiment_alert",
  "promptText": "A brief, actionable coaching tip (max 100 characters)",
  "priority": "low" | "medium" | "high",
  "reasoning": "Brief explanation of why this coaching is relevant"
}

Guidelines:
- Be concise and actionable
- Focus on the most important insight
- Prioritize objection handling and competitor responses
- Only provide high priority for urgent situations

Only respond with valid JSON, no markdown or extra text.
`

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    })

    const text = response.text || '{}'
    const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(cleanJson)

    return {
      success: true,
      data: {
        promptType: result.promptType || 'topic_suggestion',
        promptText: result.promptText || 'Consider asking a clarifying question.',
        priority: result.priority || 'low'
      }
    }
  } catch (error) {
    console.error('Generate coaching suggestion error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate suggestion'
    }
  }
}

/**
 * Generate objection handling response
 */
export async function generateObjectionResponse(
  objection: string,
  context: CoachingContext
): Promise<ServiceResponse<string>> {
  const prompt = `
Generate a brief sales response strategy for this objection:

OBJECTION: "${objection}"

CONTEXT:
- Deal Stage: ${context.dealStage || 'Unknown'}
- Key Topics Discussed: ${context.keyTopics.join(', ') || 'None'}

Provide a 2-3 sentence response strategy that:
1. Acknowledges the concern
2. Provides a value-based counter
3. Suggests a next step

Keep it under 150 characters for display in a coaching prompt.
`

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    })

    return {
      success: true,
      data: response.text || 'Acknowledge the concern, focus on value, and ask a clarifying question.'
    }
  } catch (error) {
    console.error('Generate objection response error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate response'
    }
  }
}

// ============================================================================
// TALK TIME TRACKING
// ============================================================================

/**
 * Calculate talk time balance and generate alert if needed
 */
export async function checkTalkTimeBalance(
  sessionId: string,
  userTalkTime: number,
  customerTalkTime: number
): Promise<ServiceResponse<CoachingPrompt | null>> {
  const totalTime = userTalkTime + customerTalkTime
  if (totalTime === 0) {
    return { success: true, data: null }
  }

  const userPercentage = (userTalkTime / totalTime) * 100

  // Alert if user is speaking more than 70% of the time
  if (userPercentage >= 70) {
    const result = await createPrompt(
      sessionId,
      'talk_time_warning',
      `You've been speaking ${Math.round(userPercentage)}% of the time. Try asking an open-ended question.`,
      'low',
      { userTalkTime, customerTalkTime, userPercentage }
    )

    return result
  }

  return { success: true, data: null }
}

// ============================================================================
// KEYWORD MANAGEMENT
// ============================================================================

/**
 * Add a custom keyword
 */
export async function addKeyword(
  keyword: string,
  category: string,
  promptType: CoachingPromptType,
  promptTemplate: string,
  priority: CoachingPromptPriority
): Promise<ServiceResponse<CoachingKeyword>> {
  try {
    const { data, error } = await supabase
      .from('coaching_keywords')
      .insert({
        keyword,
        category,
        prompt_type: promptType,
        prompt_template: promptTemplate,
        priority,
        is_active: true
      })
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: mapKeywordFromDb(data)
    }
  } catch (error) {
    console.error('Add keyword error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add keyword'
    }
  }
}

/**
 * Toggle keyword active status
 */
export async function toggleKeyword(
  keywordId: string,
  isActive: boolean
): Promise<ServiceResponse<CoachingKeyword>> {
  try {
    const { data, error } = await supabase
      .from('coaching_keywords')
      .update({ is_active: isActive })
      .eq('id', keywordId)
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: mapKeywordFromDb(data)
    }
  } catch (error) {
    console.error('Toggle keyword error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to toggle keyword'
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function processTemplate(template: string, context: CoachingContext): string {
  return template
    .replace(/\{\{dealStage\}\}/g, context.dealStage || 'Unknown')
    .replace(/\{\{competitorMentions\}\}/g, context.competitorMentions.join(', ') || 'None')
    .replace(/\{\{openObjections\}\}/g, context.openObjections.join(', ') || 'None')
}

function mapSessionFromDb(row: Record<string, unknown>): CoachingSession {
  return {
    id: row.id as string,
    meetingId: row.meeting_id as string,
    userId: row.user_id as string,
    startedAt: row.started_at as string,
    endedAt: row.ended_at as string | null,
    promptsShown: row.prompts_shown as number,
    promptsUsed: row.prompts_used as number,
    promptsDismissed: row.prompts_dismissed as number,
    averageResponseTime: row.average_response_time as number | null,
    createdAt: row.created_at as string
  }
}

function mapPromptFromDb(row: Record<string, unknown>): CoachingPrompt {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    promptType: row.prompt_type as CoachingPromptType,
    promptText: row.prompt_text as string,
    context: (row.context || {}) as Record<string, unknown>,
    priority: row.priority as CoachingPromptPriority,
    shownAt: row.shown_at as string,
    usedAt: row.used_at as string | null,
    dismissedAt: row.dismissed_at as string | null,
    triggerKeyword: row.trigger_keyword as string | null,
    triggerContext: row.trigger_context as string | null
  }
}

function mapKeywordFromDb(row: Record<string, unknown>): CoachingKeyword {
  return {
    id: row.id as string,
    keyword: row.keyword as string,
    category: row.category as string,
    promptType: row.prompt_type as CoachingPromptType,
    promptTemplate: row.prompt_template as string,
    priority: row.priority as CoachingPromptPriority,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string
  }
}
