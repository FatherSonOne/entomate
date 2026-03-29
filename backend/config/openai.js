const OpenAI = require('openai');
const log = require('../utils/log');

class OpenAIService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.client = null;

    if (this.apiKey) {
      this.client = new OpenAI({ apiKey: this.apiKey });
      log.info('OpenAI initialized');
    } else {
      log.warn('OPENAI_API_KEY not set in environment');
    }
  }

  /**
   * Check if OpenAI is configured
   */
  isConfigured() {
    return !!this.apiKey && !!this.client;
  }

  /**
   * Transcribe audio to text using Whisper
   * @param {Buffer} audioBuffer - Audio file buffer
   * @param {string} mimeType - Audio MIME type
   * @returns {Promise<string>} Transcript text
   */
  async transcribeAudio(audioBuffer, mimeType = 'audio/wav') {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API not configured');
    }

    try {
      log.info('Starting transcription with Whisper...');

      // Determine file extension from mime type
      const extMap = {
        'audio/wav': 'wav',
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/webm': 'webm',
        'audio/ogg': 'ogg',
        'audio/m4a': 'm4a',
        'audio/mp4': 'mp4'
      };
      const ext = extMap[mimeType] || 'wav';

      // Create a File-like object from buffer
      const file = new File([audioBuffer], `audio.${ext}`, { type: mimeType });

      const response = await this.client.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment']
      });

      // Format transcript with timestamps
      let transcript = '';
      if (response.segments) {
        for (const segment of response.segments) {
          const mins = Math.floor(segment.start / 60);
          const secs = Math.floor(segment.start % 60);
          const timestamp = `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`;
          transcript += `${timestamp} ${segment.text.trim()}\n`;
        }
      } else {
        transcript = response.text;
      }

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
      throw new Error('OpenAI API not configured');
    }

    try {
      log.info('Generating summary with GPT...');

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert meeting analyst. Always respond with valid JSON only, no markdown code blocks.'
          },
          {
            role: 'user',
            content: `Analyze this meeting transcript and return ONLY valid JSON:

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
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const text = response.choices[0].message.content;
      const summary = JSON.parse(text);
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
      throw new Error('OpenAI API not configured');
    }

    try {
      log.info('Extracting action items with GPT...');
      const today = new Date().toISOString().split('T')[0];

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at extracting action items from meeting transcripts. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: `Extract action items from this meeting transcript. Return ONLY valid JSON:

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
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const text = response.choices[0].message.content;
      const result = JSON.parse(text);
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
      throw new Error('OpenAI API not configured');
    }

    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text
      });
      return response.data[0].embedding;
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
      throw new Error('OpenAI API not configured');
    }

    try {
      log.info('Processing question with GPT...');

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that answers questions based on meeting transcripts. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: `Answer this question based on the context provided.

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
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const text = response.choices[0].message.content;
      const result = JSON.parse(text);
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
      throw new Error('OpenAI API not configured');
    }

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a professional meeting summarizer. Create clean, well-formatted chat messages.'
          },
          {
            role: 'user',
            content: `Format this meeting information into a clean, professional chat message recap.

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
          }
        ],
        temperature: 0.5
      });

      return response.choices[0].message.content;
    } catch (error) {
      log.error('Chat recap error:', { error: error.message || error });
      throw new Error(`Chat recap formatting failed: ${error.message}`);
    }
  }
}

module.exports = new OpenAIService();
