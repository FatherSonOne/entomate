/**
 * Customer Sentiment Analysis Service
 *
 * Provides AI-powered sentiment analysis using Gemini for:
 * - Meeting transcripts
 * - Pulse messages
 * - Email content
 * - Customer communications
 */

import { GoogleGenAI } from "@google/genai"
import { supabase } from "../lib/supabase"
import type {
  CustomerSentiment,
  SentimentAnalysisResult,
  SentimentLabel,
  SentimentSourceType,
  SentimentTrend,
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

// ============================================================================
// SENTIMENT ANALYSIS
// ============================================================================

/**
 * Analyze sentiment of text content using Gemini
 */
export async function analyzeSentiment(text: string): Promise<SentimentAnalysisResult> {
  const prompt = `
Analyze the sentiment of this text and provide a detailed breakdown.

TEXT:
${text}

Respond in this exact JSON format:
{
  "score": <number from -1.0 (very negative) to 1.0 (very positive)>,
  "label": "positive" | "neutral" | "negative",
  "confidence": <number from 0.0 to 1.0>,
  "keyPhrases": ["phrase1", "phrase2", "phrase3"],
  "emotions": {
    "joy": <0.0-1.0>,
    "trust": <0.0-1.0>,
    "fear": <0.0-1.0>,
    "surprise": <0.0-1.0>,
    "sadness": <0.0-1.0>,
    "disgust": <0.0-1.0>,
    "anger": <0.0-1.0>,
    "anticipation": <0.0-1.0>
  },
  "summary": "Brief explanation of the sentiment"
}

Guidelines:
- Score thresholds: < -0.3 = negative, -0.3 to 0.3 = neutral, > 0.3 = positive
- Key phrases should highlight sentiment-driving content
- Emotions should sum to approximately 1.0 (distribute based on detected emotions)
- Consider context, sarcasm, and business communication norms

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
      score: Math.max(-1, Math.min(1, result.score || 0)),
      label: result.label || 'neutral',
      confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
      keyPhrases: result.keyPhrases || [],
      emotions: {
        joy: result.emotions?.joy || 0,
        trust: result.emotions?.trust || 0,
        fear: result.emotions?.fear || 0,
        surprise: result.emotions?.surprise || 0,
        sadness: result.emotions?.sadness || 0,
        disgust: result.emotions?.disgust || 0,
        anger: result.emotions?.anger || 0,
        anticipation: result.emotions?.anticipation || 0
      },
      summary: result.summary || ''
    }
  } catch (error) {
    console.error('Sentiment analysis error:', error)
    return {
      score: 0,
      label: 'neutral',
      confidence: 0,
      keyPhrases: [],
      emotions: {
        joy: 0,
        trust: 0,
        fear: 0,
        surprise: 0,
        sadness: 0,
        disgust: 0,
        anger: 0,
        anticipation: 0
      },
      summary: 'Unable to analyze sentiment'
    }
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Store sentiment analysis result in the database
 */
export async function storeSentiment(
  customerId: string,
  sourceType: SentimentSourceType,
  sourceId: string,
  result: SentimentAnalysisResult
): Promise<ServiceResponse<CustomerSentiment>> {
  try {
    const { data, error } = await supabase
      .from('customer_sentiment')
      .insert({
        customer_id: customerId,
        source_type: sourceType,
        source_id: sourceId,
        sentiment_score: result.score,
        sentiment_label: result.label,
        confidence: result.confidence,
        key_phrases: result.keyPhrases,
        emotions: result.emotions
      })
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: mapSentimentFromDb(data)
    }
  } catch (error) {
    console.error('Store sentiment error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to store sentiment'
    }
  }
}

/**
 * Analyze and store sentiment for content
 */
export async function analyzeAndStoreSentiment(
  customerId: string,
  sourceType: SentimentSourceType,
  sourceId: string,
  text: string
): Promise<ServiceResponse<CustomerSentiment>> {
  const result = await analyzeSentiment(text)
  return storeSentiment(customerId, sourceType, sourceId, result)
}

/**
 * Get sentiment history for a customer
 */
export async function getCustomerSentimentHistory(
  customerId: string,
  limit: number = 50
): Promise<ServiceResponse<CustomerSentiment[]>> {
  try {
    const { data, error } = await supabase
      .from('customer_sentiment')
      .select('*')
      .eq('customer_id', customerId)
      .order('analyzed_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return {
      success: true,
      data: data.map(mapSentimentFromDb)
    }
  } catch (error) {
    console.error('Get sentiment history error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sentiment history'
    }
  }
}

/**
 * Get average sentiment for a customer over a time period
 */
export async function getAverageSentiment(
  customerId: string,
  days: number = 30
): Promise<ServiceResponse<{ average: number; count: number; label: SentimentLabel }>> {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from('customer_sentiment')
      .select('sentiment_score')
      .eq('customer_id', customerId)
      .gte('analyzed_at', startDate.toISOString())

    if (error) throw error

    if (!data || data.length === 0) {
      return {
        success: true,
        data: { average: 0, count: 0, label: 'neutral' }
      }
    }

    const sum = data.reduce((acc, row) => acc + row.sentiment_score, 0)
    const average = sum / data.length
    const label = scoreToLabel(average)

    return {
      success: true,
      data: { average, count: data.length, label }
    }
  } catch (error) {
    console.error('Get average sentiment error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get average sentiment'
    }
  }
}

/**
 * Get sentiment trend over time periods
 */
export async function getSentimentTrend(
  customerId: string,
  periods: number = 4,
  periodDays: number = 7
): Promise<ServiceResponse<SentimentTrend[]>> {
  try {
    const trends: SentimentTrend[] = []
    const now = new Date()

    for (let i = 0; i < periods; i++) {
      const endDate = new Date(now)
      endDate.setDate(endDate.getDate() - (i * periodDays))

      const startDate = new Date(endDate)
      startDate.setDate(startDate.getDate() - periodDays)

      const { data, error } = await supabase
        .from('customer_sentiment')
        .select('sentiment_score')
        .eq('customer_id', customerId)
        .gte('analyzed_at', startDate.toISOString())
        .lt('analyzed_at', endDate.toISOString())

      if (error) throw error

      const count = data?.length || 0
      const avgScore = count > 0
        ? data.reduce((acc, row) => acc + row.sentiment_score, 0) / count
        : 0

      trends.unshift({
        period: startDate.toISOString().split('T')[0],
        averageScore: avgScore,
        label: scoreToLabel(avgScore),
        dataPoints: count,
        trend: 'stable' // Will be calculated after
      })
    }

    // Calculate trends by comparing adjacent periods
    for (let i = 1; i < trends.length; i++) {
      const diff = trends[i].averageScore - trends[i - 1].averageScore
      if (diff > 0.1) {
        trends[i].trend = 'improving'
      } else if (diff < -0.1) {
        trends[i].trend = 'declining'
      } else {
        trends[i].trend = 'stable'
      }
    }

    return {
      success: true,
      data: trends
    }
  } catch (error) {
    console.error('Get sentiment trend error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sentiment trend'
    }
  }
}

/**
 * Get recent negative sentiments for a customer
 */
export async function getRecentNegativeSentiments(
  customerId: string,
  days: number = 14,
  limit: number = 10
): Promise<ServiceResponse<CustomerSentiment[]>> {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from('customer_sentiment')
      .select('*')
      .eq('customer_id', customerId)
      .eq('sentiment_label', 'negative')
      .gte('analyzed_at', startDate.toISOString())
      .order('sentiment_score', { ascending: true })
      .limit(limit)

    if (error) throw error

    return {
      success: true,
      data: data.map(mapSentimentFromDb)
    }
  } catch (error) {
    console.error('Get negative sentiments error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get negative sentiments'
    }
  }
}

/**
 * Get sentiment by source
 */
export async function getSentimentBySource(
  sourceType: SentimentSourceType,
  sourceId: string
): Promise<ServiceResponse<CustomerSentiment | null>> {
  try {
    const { data, error } = await supabase
      .from('customer_sentiment')
      .select('*')
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return {
      success: true,
      data: data ? mapSentimentFromDb(data) : null
    }
  } catch (error) {
    console.error('Get sentiment by source error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sentiment'
    }
  }
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Batch analyze and store sentiment for multiple items
 */
export async function batchAnalyzeSentiment(
  items: Array<{
    customerId: string
    sourceType: SentimentSourceType
    sourceId: string
    text: string
  }>
): Promise<ServiceResponse<{ processed: number; failed: number }>> {
  let processed = 0
  let failed = 0

  for (const item of items) {
    const result = await analyzeAndStoreSentiment(
      item.customerId,
      item.sourceType,
      item.sourceId,
      item.text
    )

    if (result.success) {
      processed++
    } else {
      failed++
    }
  }

  return {
    success: true,
    data: { processed, failed }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function scoreToLabel(score: number): SentimentLabel {
  if (score < -0.3) return 'negative'
  if (score > 0.3) return 'positive'
  return 'neutral'
}

function mapSentimentFromDb(row: Record<string, unknown>): CustomerSentiment {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    sourceType: row.source_type as SentimentSourceType,
    sourceId: row.source_id as string,
    sentimentScore: row.sentiment_score as number,
    sentimentLabel: row.sentiment_label as SentimentLabel,
    confidence: row.confidence as number,
    keyPhrases: (row.key_phrases || []) as string[],
    emotions: (row.emotions || {}) as Record<string, number>,
    analyzedAt: row.analyzed_at as string,
    createdAt: row.created_at as string
  }
}

// ============================================================================
// EXPORTS FOR MEETING INTEGRATION
// ============================================================================

/**
 * Analyze meeting transcript sentiment (for integration with existing meeting processing)
 */
export async function analyzeMeetingSentiment(
  meetingId: string,
  customerId: string,
  transcript: string
): Promise<ServiceResponse<CustomerSentiment>> {
  return analyzeAndStoreSentiment(customerId, 'meeting', meetingId, transcript)
}

/**
 * Analyze pulse message sentiment
 */
export async function analyzePulseMessageSentiment(
  messageId: string,
  customerId: string,
  message: string
): Promise<ServiceResponse<CustomerSentiment>> {
  return analyzeAndStoreSentiment(customerId, 'pulse_message', messageId, message)
}
