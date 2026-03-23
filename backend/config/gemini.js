const { GoogleGenerativeAI } = require('@google/generative-ai');
const log = require('../utils/log');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.genAI = null;
    this.model = null;
    this.embeddingModel = null;

    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      this.embeddingModel = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
    } else {
      log.warn('GEMINI_API_KEY not set in environment');
    }
  }

  /**
   * Check if Gemini is configured
   */
  isConfigured() {
    return !!this.apiKey && !!this.model;
  }

  /**
   * Transcribe audio to text
   * @param {Buffer} audioBuffer - Audio file buffer
   * @param {string} mimeType - Audio MIME type (e.g., 'audio/wav', 'audio/mp3')
   * @returns {Promise<string>} Transcript text
   */
  async transcribeAudio(audioBuffer, mimeType = 'audio/wav') {
    if (!this.isConfigured()) {
      throw new Error('Gemini API not configured');
    }

    try {
      log.info('Starting transcription...');

      const audioData = audioBuffer.toString('base64');

      const response = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: audioData
              }
            },
            {
              text: `Transcribe this meeting audio carefully. Include:
- Speaker identification when possible (Speaker 1, Speaker 2, etc.)
- Timestamps in format [MM:SS] at the start of each speaker turn
- Preserve exact wording as spoken
- Note any unclear sections with [UNCLEAR]
- Note any significant pauses with [PAUSE]

Format the transcript clearly with each speaker turn on a new line.`
            }
          ]
        }]
      });

      const transcript = response.response.text();
      log.info('Transcription complete');

      return transcript;
    } catch (error) {
      log.error('Transcription error:', { error: error.message || error });
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  /**
   * Generate meeting summary
   * @param {string} transcript - Meeting transcript
   * @returns {Promise<Object>} Summary with keyPoints, decisions, sentiment
   */
  async generateSummary(transcript) {
    if (!this.isConfigured()) {
      throw new Error('Gemini API not configured');
    }

    try {
      log.info('Generating summary...');

      const response = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{
            text: `Analyze this meeting transcript and return ONLY valid JSON (no markdown code blocks):

TRANSCRIPT:
${transcript}

Return JSON with this exact structure:
{
  "summary": "2-3 sentence overview of the meeting",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "decisions": ["decision 1", "decision 2"],
  "sentiment": "Positive" or "Neutral" or "Negative",
  "sentimentScore": 0.0 to 1.0 (1.0 = very positive),
  "topics": ["topic 1", "topic 2"],
  "nextSteps": ["step 1", "step 2"],
  "participantCount": number or null if unclear,
  "estimatedDuration": "X minutes" or null if unclear
}`
          }]
        }]
      });

      const text = response.response.text();

      // Extract JSON from response (handle potential markdown wrapping)
      let jsonText = text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const summary = JSON.parse(jsonText);
      log.info('Summary generated');

      return summary;
    } catch (error) {
      log.error('Summary error:', { error: error.message || error });
      throw new Error(`Summary generation failed: ${error.message}`);
    }
  }

  /**
   * Extract action items from transcript
   * @param {string} transcript - Meeting transcript
   * @returns {Promise<Array>} Action items with owner, due date, priority
   */
  async extractActionItems(transcript) {
    if (!this.isConfigured()) {
      throw new Error('Gemini API not configured');
    }

    try {
      log.info('Extracting action items...');

      const today = new Date().toISOString().split('T')[0];

      const response = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{
            text: `Extract action items from this meeting transcript. Return ONLY valid JSON (no markdown code blocks):

TRANSCRIPT:
${transcript}

Today's date is: ${today}

Return JSON with this exact structure:
{
  "actionItems": [
    {
      "task": "what needs to be done (concise, actionable)",
      "owner": "person's name or 'Unassigned' if unclear",
      "ownerEmail": "email@company.com or null if unknown",
      "dueDate": "YYYY-MM-DD format",
      "priority": "high" or "medium" or "low",
      "context": "brief context about why this task exists",
      "dependencies": ["other task if any"] or []
    }
  ]
}

Rules:
- Only include items with clear actions (not vague statements)
- If no date mentioned, infer: "ASAP"=+2 days, "soon"=+7 days, "next week"=next Monday
- Priority: "high" if deadline ≤3 days or marked urgent, "medium" if ≤7 days, "low" otherwise
- Extract 3-10 action items maximum (focus on the important ones)
- If no clear action items found, return empty array`
          }]
        }]
      });

      const text = response.response.text();
      let jsonText = text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const result = JSON.parse(jsonText);
      log.info(`Extracted ${result.actionItems?.length || 0} action items`);

      return result.actionItems || [];
    } catch (error) {
      log.error('Action items error:', { error: error.message || error });
      throw new Error(`Action item extraction failed: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for semantic search
   * @param {string} text - Text to embed
   * @returns {Promise<Array<number>>} Embedding vector
   */
  async generateEmbedding(text) {
    if (!this.isConfigured()) {
      throw new Error('Gemini API not configured');
    }

    try {
      const result = await this.embeddingModel.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      log.error('Embedding error:', { error: error.message || error });
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Answer questions about meeting context
   * @param {string} question - User question
   * @param {string} context - Meeting transcript or combined context
   * @returns {Promise<Object>} Answer with confidence and sources
   */
  async answerQuestion(question, context) {
    if (!this.isConfigured()) {
      throw new Error('Gemini API not configured');
    }

    try {
      log.info('Processing question...');

      const response = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{
            text: `You are a helpful assistant that answers questions based on meeting transcripts and context.

CONTEXT:
${context}

QUESTION:
${question}

Provide a helpful, accurate answer based ONLY on the context provided. If the answer is not in the context, say "I couldn't find information about that in the provided context."

Return ONLY valid JSON:
{
  "answer": "your detailed answer here",
  "confidence": 0.0 to 1.0,
  "relevantExcerpts": ["relevant quote 1", "relevant quote 2"]
}`
          }]
        }]
      });

      const text = response.response.text();
      let jsonText = text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const result = JSON.parse(jsonText);
      log.info('Question answered');

      return result;
    } catch (error) {
      log.error('Question error:', { error: error.message || error });
      throw new Error(`Question answering failed: ${error.message}`);
    }
  }

  /**
   * Format meeting recap for chat posting
   * @param {Object} meeting - Meeting object with summary, action items, etc.
   * @returns {Promise<string>} Formatted message for chat
   */
  async formatChatRecap(meeting) {
    if (!this.isConfigured()) {
      throw new Error('Gemini API not configured');
    }

    try {
      const response = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{
            text: `Format this meeting information into a clean, professional chat message recap.

Meeting Title: ${meeting.title}
Summary: ${meeting.summary}
Key Points: ${JSON.stringify(meeting.keyPoints)}
Decisions: ${JSON.stringify(meeting.decisions)}
Action Items: ${JSON.stringify(meeting.actionItems)}
Sentiment: ${meeting.sentiment}

Create a well-formatted message using:
- Emojis for visual appeal (but not excessive)
- Clear sections
- Bullet points for lists
- Bold for emphasis (use *text* for bold)

Keep it concise but informative.`
          }]
        }]
      });

      return response.response.text();
    } catch (error) {
      log.error('Chat recap error:', { error: error.message || error });
      throw new Error(`Chat recap formatting failed: ${error.message}`);
    }
  }
}

module.exports = new GeminiService();
