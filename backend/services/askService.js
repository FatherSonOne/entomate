/**
 * Ask Service
 * AI-powered question answering about meetings
 * Week 6: AI Search & Semantic Assistant
 */

const ai = require('../config/ai');
const { supabase } = require('../config/supabase');
const embeddingService = require('./embeddingService');
const log = require('../utils/log');

class AskService {
  constructor() {
    this.maxContextMeetings = 5;
    this.maxTranscriptLength = 3000;
  }

  /**
   * Check if service is ready
   */
  isReady() {
    return ai.isConfigured();
  }

  /**
   * Answer a question based on meetings
   */
  async answerQuestion(question, options = {}) {
    try {
      log.info(`Answering: "${question}"`);
      const { conversationId, meetingIds } = options;

      if (!ai.isConfigured()) {
        throw new Error('AI service not configured');
      }

      // 1. Find relevant meetings using semantic search
      let relevantMeetings = [];

      if (meetingIds && meetingIds.length > 0) {
        // Use specified meetings
        const { data } = await supabase
          .from('meetings')
          .select('id, title, summary, transcript, key_points, decisions, created_at, sentiment_label')
          .in('id', meetingIds);
        relevantMeetings = data || [];
      } else {
        // Use semantic search to find relevant meetings
        const searchResult = await embeddingService.semanticSearch(question, this.maxContextMeetings);

        if (searchResult.results && searchResult.results.length > 0) {
          // Get full meeting data for the results
          const meetingIdList = searchResult.results
            .filter(r => r.source_type === 'meeting')
            .map(r => r.source_id);

          if (meetingIdList.length > 0) {
            const { data } = await supabase
              .from('meetings')
              .select('id, title, summary, transcript, key_points, decisions, created_at, sentiment_label')
              .in('id', meetingIdList);

            relevantMeetings = data || [];
          }
        }

        // If semantic search didn't find enough, use recent meetings
        if (relevantMeetings.length < 3) {
          const { data: recentMeetings } = await supabase
            .from('meetings')
            .select('id, title, summary, transcript, key_points, decisions, created_at, sentiment_label')
            .order('created_at', { ascending: false })
            .limit(this.maxContextMeetings);

          // Merge without duplicates
          const existingIds = new Set(relevantMeetings.map(m => m.id));
          for (const meeting of (recentMeetings || [])) {
            if (!existingIds.has(meeting.id)) {
              relevantMeetings.push(meeting);
            }
          }
        }
      }

      if (relevantMeetings.length === 0) {
        return {
          answer: "I couldn't find any meetings to answer your question. Try recording some meetings first, or rephrase your question.",
          citations: [],
          followUpSuggestions: [
            "What meetings have been recorded?",
            "Show me recent activity"
          ],
          confidence: 0,
          conversationId
        };
      }

      // 2. Get conversation context (if available)
      let conversationContext = '';
      if (conversationId && supabase) {
        try {
          const { data: history } = await supabase
            .from('conversation_messages')
            .select('role, content')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(5);

          if (history && history.length > 0) {
            conversationContext = history
              .reverse()
              .map(m => `${m.role}: ${m.content}`)
              .join('\n');
          }
        } catch (error) {
          // Conversation table might not exist
          log.warn('Could not load conversation history');
        }
      }

      // 3. Build context from meetings
      const meetingContext = relevantMeetings.map(m => {
        const keyPoints = Array.isArray(m.key_points)
          ? m.key_points.join(', ')
          : (m.key_points || '');
        const decisions = Array.isArray(m.decisions)
          ? m.decisions.join(', ')
          : (m.decisions || '');
        const transcript = m.transcript
          ? m.transcript.substring(0, this.maxTranscriptLength)
          : '';

        return `
Meeting: ${m.title}
Date: ${new Date(m.created_at).toLocaleDateString()}
Summary: ${m.summary || 'No summary'}
Key Points: ${keyPoints || 'None'}
Decisions: ${decisions || 'None'}
${transcript ? `Transcript excerpt: ${transcript}...` : ''}
---`;
      }).join('\n');

      // 4. Generate answer using AI
      const fullContext = conversationContext
        ? `Previous conversation:\n${conversationContext}\n\n${meetingContext}`
        : meetingContext;

      const response = await ai.answerQuestion(question, fullContext);

      // 5. Build citations
      const citations = relevantMeetings.map(m => ({
        type: 'meeting',
        id: m.id,
        title: m.title,
        date: m.created_at,
        sentiment: m.sentiment_label
      }));

      // 6. Generate follow-up suggestions
      const followUpSuggestions = this.generateFollowUpSuggestions(question, relevantMeetings);

      // 7. Calculate confidence
      const confidence = this.calculateConfidence(response, relevantMeetings);

      // 8. Save to conversation history
      let newConversationId = conversationId;
      if (supabase) {
        try {
          if (!conversationId) {
            // Create new conversation
            const { data: newConv } = await supabase
              .from('conversations')
              .insert({
                started_at: new Date(),
                title: question.substring(0, 100)
              })
              .select()
              .single();

            if (newConv) {
              newConversationId = newConv.id;
            }
          }

          if (newConversationId) {
            // Save messages
            await supabase.from('conversation_messages').insert([
              {
                conversation_id: newConversationId,
                role: 'user',
                content: question
              },
              {
                conversation_id: newConversationId,
                role: 'assistant',
                content: response.answer
              }
            ]);
          }
        } catch (error) {
          // Conversation tables might not exist
          log.warn('Could not save conversation:', error.message);
        }
      }

      log.info(`Generated answer with ${citations.length} citations`);

      return {
        answer: response.answer,
        citations,
        followUpSuggestions,
        confidence,
        conversationId: newConversationId,
        relevantExcerpts: response.relevantExcerpts || []
      };

    } catch (error) {
      log.error('Error answering question:', { error: error.message || error });
      throw error;
    }
  }

  /**
   * Generate follow-up question suggestions
   */
  generateFollowUpSuggestions(question, meetings) {
    const suggestions = [];

    // Based on meeting content
    if (meetings.length > 0) {
      const latestMeeting = meetings[0];

      if (latestMeeting.key_points && latestMeeting.key_points.length > 0) {
        suggestions.push(`Tell me more about the key points from "${latestMeeting.title}"`);
      }

      // Check for action items
      suggestions.push("What action items are pending?");

      // Check for decisions
      if (meetings.some(m => m.decisions && m.decisions.length > 0)) {
        suggestions.push("What decisions were made recently?");
      }
    }

    // Generic follow-ups
    if (question.toLowerCase().includes('project')) {
      suggestions.push("What's the status of all active projects?");
    }

    if (question.toLowerCase().includes('meeting')) {
      suggestions.push("Show me the most recent meetings");
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(response, meetings) {
    let confidence = response.confidence || 0.5;

    // Boost confidence based on number of relevant meetings
    if (meetings.length >= 3) {
      confidence = Math.min(confidence + 0.1, 1.0);
    }

    // Boost if meetings have good content
    const hasGoodContent = meetings.some(m =>
      m.summary && m.summary.length > 100
    );
    if (hasGoodContent) {
      confidence = Math.min(confidence + 0.1, 1.0);
    }

    return confidence;
  }

  /**
   * Get conversation history
   */
  async getConversation(conversationId) {
    try {
      if (!supabase) return [];

      const { data: messages } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      return messages || [];
    } catch (error) {
      log.error('Error fetching conversation:', { error: error.message || error });
      return [];
    }
  }

  /**
   * List recent conversations
   */
  async listConversations(limit = 20) {
    try {
      if (!supabase) return [];

      const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

      return conversations || [];
    } catch (error) {
      log.error('Error listing conversations:', { error: error.message || error });
      return [];
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId) {
    try {
      if (!supabase) return;

      // Delete messages first
      await supabase
        .from('conversation_messages')
        .delete()
        .eq('conversation_id', conversationId);

      // Delete conversation
      await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      log.info(`Deleted conversation: ${conversationId}`);
    } catch (error) {
      log.error('Error deleting conversation:', { error: error.message || error });
    }
  }

  /**
   * Answer a question with streaming response
   */
  async answerQuestionStreaming(question, options = {}) {
    const { conversationId, meetingIds, onChunk, onCitations, onFollowUp, onComplete, onError } = options;

    try {
      log.info(`Streaming answer for: "${question}"`);

      if (!ai.isConfigured()) {
        throw new Error('AI service not configured');
      }

      // 1. Find relevant meetings (same logic as non-streaming)
      let relevantMeetings = [];

      if (meetingIds && meetingIds.length > 0) {
        const { data } = await supabase
          .from('meetings')
          .select('id, title, summary, transcript, key_points, decisions, created_at, sentiment_label')
          .in('id', meetingIds);
        relevantMeetings = data || [];
      } else {
        const searchResult = await embeddingService.semanticSearch(question, this.maxContextMeetings);

        if (searchResult.results && searchResult.results.length > 0) {
          const meetingIdList = searchResult.results
            .filter(r => r.source_type === 'meeting')
            .map(r => r.source_id);

          if (meetingIdList.length > 0) {
            const { data } = await supabase
              .from('meetings')
              .select('id, title, summary, transcript, key_points, decisions, created_at, sentiment_label')
              .in('id', meetingIdList);
            relevantMeetings = data || [];
          }
        }

        if (relevantMeetings.length < 3) {
          const { data: recentMeetings } = await supabase
            .from('meetings')
            .select('id, title, summary, transcript, key_points, decisions, created_at, sentiment_label')
            .order('created_at', { ascending: false })
            .limit(this.maxContextMeetings);

          const existingIds = new Set(relevantMeetings.map(m => m.id));
          for (const meeting of (recentMeetings || [])) {
            if (!existingIds.has(meeting.id)) {
              relevantMeetings.push(meeting);
            }
          }
        }
      }

      // Send citations early
      const citations = relevantMeetings.map(m => ({
        type: 'meeting',
        id: m.id,
        title: m.title,
        date: m.created_at,
        sentiment: m.sentiment_label
      }));

      if (onCitations) {
        onCitations(citations);
      }

      if (relevantMeetings.length === 0) {
        const noResultAnswer = "I couldn't find any meetings to answer your question. Try recording some meetings first, or rephrase your question.";

        // Simulate streaming for consistency
        const words = noResultAnswer.split(' ');
        for (const word of words) {
          if (onChunk) onChunk(word + ' ');
          await new Promise(resolve => setTimeout(resolve, 30));
        }

        if (onFollowUp) {
          onFollowUp(["What meetings have been recorded?", "Show me recent activity"]);
        }

        if (onComplete) {
          onComplete({
            answer: noResultAnswer,
            citations: [],
            confidence: 0,
            conversationId
          });
        }
        return;
      }

      // 2. Get conversation context
      let conversationContext = '';
      if (conversationId && supabase) {
        try {
          const { data: history } = await supabase
            .from('conversation_messages')
            .select('role, content')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(5);

          if (history && history.length > 0) {
            conversationContext = history
              .reverse()
              .map(m => `${m.role}: ${m.content}`)
              .join('\n');
          }
        } catch (error) {
          log.warn('Could not load conversation history');
        }
      }

      // 3. Build context from meetings
      const meetingContext = relevantMeetings.map(m => {
        const keyPoints = Array.isArray(m.key_points) ? m.key_points.join(', ') : (m.key_points || '');
        const decisions = Array.isArray(m.decisions) ? m.decisions.join(', ') : (m.decisions || '');
        const transcript = m.transcript ? m.transcript.substring(0, this.maxTranscriptLength) : '';

        return `
Meeting: ${m.title}
Date: ${new Date(m.created_at).toLocaleDateString()}
Summary: ${m.summary || 'No summary'}
Key Points: ${keyPoints || 'None'}
Decisions: ${decisions || 'None'}
${transcript ? `Transcript excerpt: ${transcript}...` : ''}
---`;
      }).join('\n');

      const fullContext = conversationContext
        ? `Previous conversation:\n${conversationContext}\n\n${meetingContext}`
        : meetingContext;

      // 4. Stream the AI response
      let fullAnswer = '';

      await ai.answerQuestionStreaming(question, fullContext, {
        onChunk: (chunk) => {
          fullAnswer += chunk;
          if (onChunk) onChunk(chunk);
        }
      });

      // 5. Generate follow-up suggestions after answer is complete
      const followUpSuggestions = this.generateFollowUpSuggestions(question, relevantMeetings);
      if (onFollowUp) {
        onFollowUp(followUpSuggestions);
      }

      // 6. Calculate confidence
      const confidence = this.calculateConfidence({ answer: fullAnswer, confidence: 0.7 }, relevantMeetings);

      // 7. Save to conversation history
      let newConversationId = conversationId;
      if (supabase) {
        try {
          if (!conversationId) {
            const { data: newConv } = await supabase
              .from('conversations')
              .insert({
                started_at: new Date(),
                title: question.substring(0, 100)
              })
              .select()
              .single();

            if (newConv) {
              newConversationId = newConv.id;
            }
          }

          if (newConversationId) {
            await supabase.from('conversation_messages').insert([
              { conversation_id: newConversationId, role: 'user', content: question },
              { conversation_id: newConversationId, role: 'assistant', content: fullAnswer }
            ]);
          }
        } catch (error) {
          log.warn('Could not save conversation:', error.message);
        }
      }

      // 8. Send completion
      if (onComplete) {
        onComplete({
          answer: fullAnswer,
          citations,
          followUpSuggestions,
          confidence,
          conversationId: newConversationId
        });
      }

      log.info(`Streamed answer with ${citations.length} citations`);

    } catch (error) {
      log.error('Error in streaming answer:', { error: error.message || error });
      if (onError) {
        onError(error);
      }
    }
  }
}

module.exports = new AskService();
