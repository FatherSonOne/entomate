import { GoogleGenAI } from "@google/genai"

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY })

// ==================== TRANSCRIPTION ====================

export async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType, data: audioBase64 } },
          { text: "Transcribe this audio exactly. Include speaker labels if multiple speakers are detected (e.g., Speaker 1:, Speaker 2:). Preserve the natural flow of conversation." }
        ]
      }
    })
    return response.text || ""
  } catch (error) {
    console.error('Transcription error:', error)
    throw error
  }
}

// ==================== SUMMARIZATION ====================

export interface MeetingSummary {
  summary: string
  key_points: string[]
  decisions: string[]
  sentiment_label: 'positive' | 'neutral' | 'negative'
  sentiment_score: number
}

export async function summarizeMeeting(transcript: string): Promise<MeetingSummary> {
  const prompt = `
Analyze this meeting transcript and provide a structured summary.

TRANSCRIPT:
${transcript}

Respond in this exact JSON format:
{
  "summary": "A 2-3 sentence executive summary of the meeting",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "decisions": ["Decision 1", "Decision 2"],
  "sentiment_label": "positive" | "neutral" | "negative",
  "sentiment_score": 0.0 to 1.0 (0 = very negative, 1 = very positive)
}

Only respond with valid JSON, no markdown or extra text.
`

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    })

    const text = response.text || '{}'
    // Clean up potential markdown code blocks
    const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleanJson)
  } catch (error) {
    console.error('Summarization error:', error)
    return {
      summary: "Unable to generate summary",
      key_points: [],
      decisions: [],
      sentiment_label: 'neutral',
      sentiment_score: 0.5
    }
  }
}

// ==================== ACTION ITEM EXTRACTION ====================

export interface ExtractedActionItem {
  task_description: string
  assigned_to_name: string | null
  due_date: string | null
  priority: 'low' | 'medium' | 'high'
}

export async function extractActionItems(transcript: string): Promise<ExtractedActionItem[]> {
  const prompt = `
Analyze this meeting transcript and extract all action items, tasks, and follow-ups that were mentioned or assigned.

TRANSCRIPT:
${transcript}

For each action item, identify:
1. The specific task or action to be done
2. Who it was assigned to (if mentioned, otherwise null)
3. Any deadline or due date mentioned (in YYYY-MM-DD format, or null if not specified)
4. Priority level based on urgency language used (low/medium/high)

Respond in this exact JSON format:
{
  "action_items": [
    {
      "task_description": "Clear description of the task",
      "assigned_to_name": "Person's name or null",
      "due_date": "YYYY-MM-DD or null",
      "priority": "low" | "medium" | "high"
    }
  ]
}

Look for phrases like:
- "I'll do...", "Can you...", "We need to...", "Action item:", "Let's make sure to..."
- "By Friday", "End of week", "ASAP", "When you get a chance"
- Names followed by action verbs

Only respond with valid JSON, no markdown or extra text.
`

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    })

    const text = response.text || '{"action_items": []}'
    const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleanJson)
    return parsed.action_items || []
  } catch (error) {
    console.error('Action item extraction error:', error)
    return []
  }
}

// ==================== ASK ASSISTANT ====================

export async function askAboutMeeting(transcript: string, question: string): Promise<string> {
  const prompt = `
You are an AI assistant helping answer questions about a meeting. Use the transcript below to answer the user's question accurately.

MEETING TRANSCRIPT:
${transcript}

USER QUESTION: ${question}

Provide a clear, concise answer based only on information from the transcript. If the answer isn't in the transcript, say so.
`

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    })
    return response.text || "I couldn't find an answer to that question in the meeting transcript."
  } catch (error) {
    console.error('Ask assistant error:', error)
    throw error
  }
}

// ==================== FULL MEETING PROCESSING ====================

export interface ProcessedMeeting {
  transcript: string
  summary: string
  key_points: string[]
  decisions: string[]
  sentiment_label: string
  sentiment_score: number
  action_items: ExtractedActionItem[]
}

export async function processMeetingAudio(audioBase64: string, mimeType: string): Promise<ProcessedMeeting> {
  // Step 1: Transcribe
  const transcript = await transcribeAudio(audioBase64, mimeType)

  // Step 2: Summarize and extract action items in parallel
  const [summaryResult, actionItems] = await Promise.all([
    summarizeMeeting(transcript),
    extractActionItems(transcript)
  ])

  return {
    transcript,
    summary: summaryResult.summary,
    key_points: summaryResult.key_points,
    decisions: summaryResult.decisions,
    sentiment_label: summaryResult.sentiment_label,
    sentiment_score: summaryResult.sentiment_score,
    action_items: actionItems
  }
}
