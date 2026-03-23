/**
 * AI Service Abstraction Layer
 * Supports switching between Gemini and OpenAI providers
 *
 * Configure via AI_PROVIDER env variable: 'gemini' or 'openai'
 * Defaults to OpenAI if OPENAI_API_KEY is set, otherwise Gemini
 */

const gemini = require('./gemini');
const openai = require('./openai');
const log = require('../utils/log');

class AIService {
  constructor() {
    // Determine provider based on configuration and availability
    this.providerName = this._determineProvider();
    this.provider = this._getProvider();

    log.info(`AI Provider: ${this.providerName} (${this.isConfigured() ? 'configured' : 'not configured'})`);
  }

  _determineProvider() {
    // Explicit configuration takes priority
    const configuredProvider = process.env.AI_PROVIDER?.toLowerCase();

    if (configuredProvider === 'openai' && openai.isConfigured()) {
      return 'openai';
    }

    if (configuredProvider === 'gemini' && gemini.isConfigured()) {
      return 'gemini';
    }

    // Auto-detect based on available keys
    // Prefer OpenAI if both are configured (more reliable rate limits)
    if (openai.isConfigured()) {
      return 'openai';
    }

    if (gemini.isConfigured()) {
      return 'gemini';
    }

    // Default to gemini for backwards compatibility
    return 'gemini';
  }

  _getProvider() {
    return this.providerName === 'openai' ? openai : gemini;
  }

  /**
   * Check if AI is configured
   */
  isConfigured() {
    return this.provider.isConfigured();
  }

  /**
   * Get the current provider name
   */
  getProviderName() {
    return this.providerName;
  }

  /**
   * Transcribe audio to text
   * @param {Buffer} audioBuffer - Audio file buffer
   * @param {string} mimeType - Audio MIME type
   * @returns {Promise<string>} Transcript text
   */
  async transcribeAudio(audioBuffer, mimeType = 'audio/wav') {
    return this.provider.transcribeAudio(audioBuffer, mimeType);
  }

  /**
   * Generate meeting summary
   * @param {string} transcript - Meeting transcript
   * @returns {Promise<Object>} Summary with keyPoints, decisions, sentiment
   */
  async generateSummary(transcript) {
    return this.provider.generateSummary(transcript);
  }

  /**
   * Extract action items from transcript
   * @param {string} transcript - Meeting transcript
   * @returns {Promise<Array>} Action items with owner, due date, priority
   */
  async extractActionItems(transcript) {
    return this.provider.extractActionItems(transcript);
  }

  /**
   * Generate embeddings for semantic search
   * @param {string} text - Text to embed
   * @returns {Promise<Array<number>>} Embedding vector
   */
  async generateEmbedding(text) {
    return this.provider.generateEmbedding(text);
  }

  /**
   * Answer questions about meeting context
   * @param {string} question - User question
   * @param {string} context - Meeting transcript or combined context
   * @returns {Promise<Object>} Answer with confidence and sources
   */
  async answerQuestion(question, context) {
    return this.provider.answerQuestion(question, context);
  }

  /**
   * Answer questions with streaming response
   * @param {string} question - User question
   * @param {string} context - Meeting transcript or combined context
   * @param {Object} options - Streaming options with onChunk callback
   * @returns {Promise<void>}
   */
  async answerQuestionStreaming(question, context, options = {}) {
    // If provider supports streaming, use it
    if (this.provider.answerQuestionStreaming) {
      return this.provider.answerQuestionStreaming(question, context, options);
    }

    // Fallback: Get full answer and simulate streaming
    const result = await this.provider.answerQuestion(question, context);
    const answer = result.answer || '';

    // Simulate streaming by sending chunks
    const words = answer.split(' ');
    for (let i = 0; i < words.length; i++) {
      const chunk = words[i] + (i < words.length - 1 ? ' ' : '');
      if (options.onChunk) {
        options.onChunk(chunk);
      }
      // Small delay for typing effect
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }

  /**
   * Format meeting recap for chat posting
   * @param {Object} meeting - Meeting object
   * @returns {Promise<string>} Formatted message for chat
   */
  async formatChatRecap(meeting) {
    return this.provider.formatChatRecap(meeting);
  }
}

module.exports = new AIService();
