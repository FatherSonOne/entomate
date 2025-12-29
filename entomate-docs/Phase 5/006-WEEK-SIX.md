📄 WEEK 6: AI SEARCH & SEMANTIC ASSISTANT
Complete Implementation Guide
Version: 1.0
Timeline: 5 business days (Monday-Friday)
Status: Ready to Build
Total Tasks: 56 items
Prerequisite: Week 5 complete with dashboard working

🎯 WEEK 6 OVERVIEW
Goal: Add AI-powered search and "Ask" assistant so users can find meetings and get answers using natural language

By Friday EOD, you should have:

✅ Semantic search (find similar meetings by meaning, not just keywords)

✅ "Ask AI" chat interface for questions about meetings

✅ Answer generation from meeting content

✅ Citation of sources (which meeting/action item)

✅ Search history and saved searches

✅ Fast search (< 500ms for 1000 meetings)

✅ Accurate answers (90%+ relevance)

✅ Conversation memory (context from previous questions)

✅ Export search results

✅ Search analytics (what people search for)

Time Commitment: 40 hours total (2 backend + 2 frontend + 1 AI specialist)

Success Metric: Users can ask natural language questions and get accurate answers with sources

📋 TASK BREAKDOWN BY DAY
🔵 MONDAY: Semantic Search Planning & Architecture (8 hours)
Morning (9am-12pm): Embedding & Vector Search Strategy
AI Specialist / Backend Lead:

 Understand Vector Embeddings (20 mins)

What are embeddings? (convert text → vector)

Why semantic search? (find meaning, not keywords)

How does it work?

text
Query: "What did we discuss about budget?"

Traditional search:
- Looks for word "budget" in text
- Exact match only

Semantic search:
- Converts "budget discussion" to vector
- Finds similar vectors in database
- Returns meetings about finances, spending, costs
 Choose Embedding Model (15 mins)

Option 1: Gemini Embeddings (recommended)

Option 2: OpenAI Embeddings

Option 3: Open-source (all-MiniLM-L6-v2)

Recommendation: Use Gemini Embeddings (already integrated)

 Plan Vector Database (20 mins)

Option 1: Supabase pgvector (recommended, free)

Option 2: Pinecone (separate service)

Option 3: Weaviate (self-hosted)

Recommendation: Use Supabase pgvector extension

 Create Embedding Strategy (20 mins)

What to embed?

Meeting summaries (high level)

Action items (specific tasks)

Key points (important info)

Full transcripts (detailed)

When to embed?

On meeting completion (Week 2)

Store in database

Update if edited

 Plan Search Flow (15 mins)

text
User types: "Budget meetings"
↓
Convert query to embedding
↓
Find K nearest vectors (cosine similarity)
↓
Return top meetings
↓
Re-rank by recency
↓
Return to UI
 Plan "Ask AI" Flow (15 mins)

text
User asks: "Who owns the Q1 budget review?"
↓
Search for relevant meetings (semantic search)
↓
Pass top N meetings to Gemini
↓
Gemini generates answer with citations
↓
Return answer + sources
Afternoon (1pm-5pm): Database & Backend Setup
Backend Developer:

 Enable pgvector in Supabase (15 mins)

Go to Supabase Dashboard

Database → Extensions

Search: "vector"

Click: "Enable"

 Create Embeddings Table (20 mins)

sql
CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT, -- 'summary', 'action_item', 'key_point', 'transcript'
  source_id UUID, -- meeting_id or action_item_id
  source_type TEXT, -- 'meeting', 'action_item'
  text_content TEXT,
  embedding VECTOR(768), -- Gemini embeddings are 768-dim
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (source_id) REFERENCES meetings(id) ON DELETE CASCADE
);

-- Create index for faster search
CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops);
 Create Search History Table (15 mins)

sql
CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  query TEXT,
  search_type TEXT, -- 'semantic', 'keyword'
  results_count INT,
  execution_time INT, -- milliseconds
  created_at TIMESTAMP DEFAULT NOW()
);
 Create Saved Searches Table (10 mins)

sql
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT,
  query TEXT,
  search_type TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
 Plan Caching (15 mins)

Cache frequent searches (Redis)

Cache embeddings in memory

Cache search results (5 min TTL)

 Create API Endpoints Plan (15 mins)

POST /api/search/semantic (search meetings)

POST /api/search/ask (ask AI question)

GET /api/search/history

POST /api/search/save

GET /api/search/saved

POST /api/search/analytics

🟢 TUESDAY: Embedding Generation & Search Backend (8 hours)
Morning (9am-12pm): Embedding Generation
Backend Developer / AI Specialist:

 Create Embedding Service (30 mins)

Create: backend/services/embeddingService.js

Copy code from "SECTION: BACKEND CODE - embeddingService.js" below

Paste into file

 Generate Embeddings for Existing Meetings (20 mins)

bash
# Migration script
node scripts/generateEmbeddings.js
For each meeting:

Create embedding of summary

Create embedding of each action item

Store in database

Track progress

Handle errors (retry logic)

 Test Embedding Generation (15 mins)

Create test meeting

Generate embeddings

Verify stored in database

Check vector dimensions (should be 768)

 Test Similarity Search (15 mins)

bash
node -e "
const embeddings = require('./services/embeddingService');
embeddings.findSimilar('budget discussion', 5).then(console.log);
"
Afternoon (1pm-5pm): Search Endpoints
Backend Developer:

 Create Search Routes (30 mins)

Create: backend/routes/search.js

Copy code from "SECTION: BACKEND CODE - search.js" below

Paste into file

 Register Routes (10 mins)

Open: backend/server.js

Add:

javascript
app.use('/api/search', require('./routes/search'));
 Create Search Utility (25 mins)

Create: backend/utils/searchUtils.js

Function: performSemanticSearch(query, limit, filters)

Function: rankResults(results, query)

Function: formatSearchResults(results)

 Test Search Endpoint (15 mins)

bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "budget planning"}' \
  http://localhost:3000/api/search/semantic
Expected: Returns similar meetings

 Add Search History Logging (15 mins)

Log every search

Track query, results count, execution time

Store in database

Use for analytics

 Add Caching (15 mins)

Cache search results

Cache embedding lookups

Invalidate on new meetings

Monitor cache hit rate

🟡 WEDNESDAY: "Ask AI" Assistant (8 hours)
Morning (9am-12pm): AI Question Answering
Backend Developer / AI Specialist:

 Create Ask Service (25 mins)

Create: backend/services/askService.js

Copy code from "SECTION: BACKEND CODE - askService.js" below

Paste into file

 Create Answer Generation (20 mins)

Search for relevant meetings (semantic search)

Pass to Gemini with context

Generate answer with citations

Return with source references

 Test Question Answering (15 mins)

bash
node -e "
const ask = require('./services/askService');
ask.answerQuestion('Who owns the Q1 budget?').then(console.log);
"
 Add Conversation Memory (20 mins)

Create: backend/tables/conversations.sql

Track conversation history

Include previous questions/answers

Pass context to next question

Afternoon (1pm-5pm): Ask Endpoints & Integration
Backend Developer:

 Create Ask Routes (25 mins)

Add to: backend/routes/search.js

POST /api/search/ask (answer question)

POST /api/search/ask/follow-up (follow-up question)

GET /api/search/conversations (get chat history)

 Implement Conversation Threading (20 mins)

Store conversations in database

Track question → answer pairs

Include timestamps and metadata

Allow user to view past conversations

 Test Ask Endpoint (15 mins)

bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the Q1 priorities?",
    "conversationId": "optional-uuid"
  }' \
  http://localhost:3000/api/search/ask
 Add Citation Generation (20 mins)

Extract source references from answer

Link to meeting, action item, transcript

Format citations properly

Verify sources exist

 Add Response Streaming (15 mins)

Stream long answers to frontend

Use Server-Sent Events (SSE)

Show typing effect

Improve perceived performance

 Error Handling (15 mins)

Handle no relevant meetings found

Handle API errors gracefully

Return helpful fallback messages

Log errors for debugging

🔵 THURSDAY: Frontend Search UI (8 hours)
Morning (9am-12pm): Search Components
Frontend Developer:

 Create Search Component (25 mins)

Create: frontend/src/components/SearchPanel.jsx

Search input with autocomplete

Search type toggle (semantic/keyword)

Recent searches display

Copy code from "SECTION: FRONTEND CODE - SearchPanel.jsx" below

 Create Search Results (25 mins)

Create: frontend/src/components/SearchResults.jsx

Display search results

Show relevance score

Show snippet of content

Click to view full meeting

Filter/sort results

 Create Ask Component (20 mins)

Create: frontend/src/components/AskAssistant.jsx

Chat-like interface

Question input

Answer display with typing effect

Citations with links

Conversation history

 Test Components (10 mins)

Components render without errors

Can type in search

Can toggle search type

Afternoon (1pm-5pm): Integration & Styling
Frontend Developer:

 Create Search Service (20 mins)

Create: frontend/src/services/searchService.js

Copy code from "SECTION: FRONTEND CODE - searchService.js" below

 Integrate Search & Ask (20 mins)

Add to main navigation

Show in sidebar or modal

Keyboard shortcut (Cmd+K for search)

Keyboard shortcut (Cmd+? for ask)

 Add Autocomplete (20 mins)

Suggest recent searches

Suggest popular searches

Show trending topics

Show as you type

 Create Styles (25 mins)

Create: frontend/src/styles/Search.css

Style search panel

Style results list

Style ask assistant chat

Dark/light mode support

Mobile responsive

 Add Conversation UI (15 mins)

Show chat bubbles

Show citations as links

Show loading states

Show error messages

 Test UI (15 mins)

Search functionality works

Ask functionality works

Results display correctly

Mobile responsive

🟢 FRIDAY: Testing, Optimization & Deployment (8 hours)
Morning (9am-12pm): Testing & Performance
QA & Backend Developer:

 End-to-End Test #1: Semantic Search (25 mins)

Search: "budget"

Verify returns budget-related meetings

Verify ranked by relevance

Verify < 500ms response

Verify shown in order of relevance

 End-to-End Test #2: Ask AI Question (20 mins)

Ask: "Who is responsible for the website redesign?"

Verify answer is accurate

Verify citations link correctly

Verify can ask follow-up question

Check conversation memory works

 End-to-End Test #3: Search History (15 mins)

Perform 5 searches

Check recent searches displayed

Can view search history

Can save searches

Can re-run saved searches

 Accuracy Test (20 mins)

Test 10 different questions

Verify accuracy > 85%

Verify citations are correct

Check answer relevance

 Performance Test (20 mins)

Search with 1000+ meetings

Measure response time (target: < 500ms)

Measure memory usage

Test concurrent searches

Afternoon (1pm-5pm): Code Review & Documentation
Tech Lead & Developers:

 Code Review: Backend (25 mins)

Review: backend/services/embeddingService.js

Review: backend/services/askService.js

Review: backend/routes/search.js

Checklist:

 Error handling comprehensive

 Performance optimized

 Caching effective

 Comments clear

 Security checked

 Code Review: Frontend (20 mins)

Review: frontend/src/components/SearchPanel.jsx

Review: frontend/src/components/AskAssistant.jsx

Review: frontend/src/services/searchService.js

Checklist:

 Responsive design

 Accessible

 Error handling

 Loading states

 Mobile friendly

 Performance Optimization (20 mins)

Optimize embedding search queries

Add database indexes

Implement caching

Lazy load components

Measure improvements

 Run Linter & Formatter (10 mins)

bash
npx eslint backend/services/embeddingService.js
npx prettier --write backend/services/embeddingService.js
npx eslint frontend/src/components/SearchPanel.jsx
npx prettier --write frontend/src/components/SearchPanel.jsx
 Update API Documentation (15 mins)

text
## POST /api/search/semantic

Search for meetings using semantic similarity

Request:
{
"query": "budget planning",
"limit": 10,
"filters": { "sentiment": "positive" }
}

text

Response:
{
"results": [
{
"id": "uuid",
"title": "Q1 Budget Planning",
"relevance_score": 0.92,
"snippet": "We discussed...",
"source": "meeting"
}
],
"execution_time_ms": 245
}

text

## POST /api/search/ask

Ask AI a question about your meetings

Request:
{
"question": "Who owns the website project?",
"conversationId": "optional-uuid"
}

text

Response:
{
"answer": "Sarah owns the website project...",
"citations": [
{
"type": "meeting",
"id": "uuid",
"title": "Project Planning",
"relevance": 0.95
}
],
"followUpSuggestions": [...]
}

text
undefined
 Create User Guide (15 mins)

Create: docs/USER_GUIDE_WEEK6.md

Include:

How to search meetings

How to ask questions

Understanding search results

Citation meaning

Tips for better results

 Commit & Push (10 mins)

bash
git add backend/services/embeddingService.js
git add backend/services/askService.js
git add backend/routes/search.js
git add frontend/src/components/SearchPanel.jsx
git add frontend/src/components/AskAssistant.jsx
git add frontend/src/services/searchService.js
git add docs/
git commit -m "Week 6: AI search and semantic assistant complete"
git push origin develop
 Weekly Demo (45 mins)

Demo 1: Type in search box

Demo 2: Show semantic search results

Demo 3: Ask question about meetings

Demo 4: Show AI answer with citations

Demo 5: Ask follow-up question (conversation memory)

Demo 6: Show search history and saved searches

Demo 7: Show performance metrics

Q&A

 Retrospective (15 mins)

What went well?

Challenges faced?

Improvements needed?

Team feedback?

🔧 BACKEND CODE - embeddingService.js
javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');
const supabase = require('../config/supabase');

class EmbeddingService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY not set');
    }
    
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'embedding-001'
    });
    
    console.log('✅ Embedding service initialized');
  }
  
  /**
   * Generate embedding for text
   */
  async generateEmbedding(text) {
    try {
      if (!text || text.length === 0) {
        throw new Error('Text is required');
      }
      
      // Limit text to 20k characters
      const truncatedText = text.substring(0, 20000);
      
      const result = await this.model.embedContent(truncatedText);
      return result.embedding.values;
    } catch (error) {
      console.error('Embedding error:', error);
      throw error;
    }
  }
  
  /**
   * Store embedding in database
   */
  async storeEmbedding(contentType, sourceId, sourceType, text) {
    try {
      // Generate embedding
      const embedding = await this.generateEmbedding(text);
      
      // Store in database
      const { data, error } = await supabase
        .from('embeddings')
        .insert({
          content_type: contentType,
          source_id: sourceId,
          source_type: sourceType,
          text_content: text,
          embedding: embedding
        });
      
      if (error) throw error;
      
      console.log(`✅ Stored embedding for ${sourceType}:${sourceId}`);
      return data;
    } catch (error) {
      console.error('Error storing embedding:', error);
      throw error;
    }
  }
  
  /**
   * Search for similar content using semantic search
   */
  async semanticSearch(query, limit = 10, filters = {}) {
    try {
      console.log(`🔍 Semantic search: "${query}"`);
      
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Search for similar embeddings using cosine similarity
      let searchQuery = supabase.rpc('search_embeddings', {
        query_embedding: queryEmbedding,
        match_count: limit,
        similarity_threshold: 0.5
      });
      
      const { data, error } = await searchQuery;
      
      if (error) throw error;
      
      // Enrich results with source data
      const enrichedResults = await Promise.all(
        (data || []).map(async (result) => {
          if (result.source_type === 'meeting') {
            const { data: meeting } = await supabase
              .from('meetings')
              .select('id, title, created_at, sentiment_label')
              .eq('id', result.source_id)
              .single();
            
            return {
              ...result,
              meeting: meeting
            };
          }
          return result;
        })
      );
      
      console.log(`✅ Found ${enrichedResults.length} similar items`);
      return enrichedResults;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }
  
  /**
   * Generate embeddings for new meeting
   */
  async generateEmbeddingsForMeeting(meetingId, meeting, actionItems) {
    try {
      console.log(`📝 Generating embeddings for meeting: ${meetingId}`);
      
      // 1. Embed summary
      if (meeting.summary) {
        await this.storeEmbedding(
          'summary',
          meetingId,
          'meeting',
          meeting.summary
        );
      }
      
      // 2. Embed key points
      if (meeting.key_points && meeting.key_points.length > 0) {
        await this.storeEmbedding(
          'key_points',
          meetingId,
          'meeting',
          meeting.key_points.join(' ')
        );
      }
      
      // 3. Embed decisions
      if (meeting.decisions && meeting.decisions.length > 0) {
        await this.storeEmbedding(
          'decisions',
          meetingId,
          'meeting',
          meeting.decisions.join(' ')
        );
      }
      
      // 4. Embed each action item
      if (actionItems && actionItems.length > 0) {
        for (const item of actionItems) {
          await this.storeEmbedding(
            'action_item',
            item.id,
            'action_item',
            `${item.task_description} assigned to ${item.assigned_to_name}`
          );
        }
      }
      
      // 5. Embed full transcript (if available)
      if (meeting.transcript) {
        // Split into chunks (max 5000 chars per chunk)
        const chunks = this.chunkText(meeting.transcript, 5000);
        for (let i = 0; i < chunks.length; i++) {
          await this.storeEmbedding(
            `transcript_chunk_${i}`,
            meetingId,
            'meeting',
            chunks[i]
          );
        }
      }
      
      console.log(`✅ Generated embeddings for meeting`);
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }
  }
  
  /**
   * Split text into chunks
   */
  chunkText(text, chunkSize) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
  }
  
  /**
   * Re-rank results by recency and relevance
   */
  reRankResults(results, weights = { similarity: 0.7, recency: 0.3 }) {
    const now = new Date();
    
    return results.sort((a, b) => {
      // Normalize similarity (0-1)
      const similarityA = a.similarity || 0.5;
      const similarityB = b.similarity || 0.5;
      
      // Normalize recency (newer = higher score)
      const ageA = (now - new Date(a.meeting?.created_at || now)) / (1000 * 60 * 60 * 24);
      const ageB = (now - new Date(b.meeting?.created_at || now)) / (1000 * 60 * 60 * 24);
      
      const recencyScoreA = Math.exp(-ageA / 30); // Decay over 30 days
      const recencyScoreB = Math.exp(-ageB / 30);
      
      // Combined score
      const scoreA = (similarityA * weights.similarity) + (recencyScoreA * weights.recency);
      const scoreB = (similarityB * weights.similarity) + (recencyScoreB * weights.recency);
      
      return scoreB - scoreA;
    });
  }
}

module.exports = new EmbeddingService();
🔧 BACKEND CODE - askService.js
javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');
const embeddingService = require('./embeddingService');
const supabase = require('../config/supabase');

class AskService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY not set');
    }
    
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash'
    });
    
    console.log('✅ Ask service initialized');
  }
  
  /**
   * Answer a question based on meetings
   */
  async answerQuestion(question, conversationId = null) {
    try {
      console.log(`🤔 Answering: "${question}"`);
      
      // 1. Find relevant meetings
      const relevantMeetings = await embeddingService.semanticSearch(
        question,
        5 // Get top 5 most relevant meetings
      );
      
      if (!relevantMeetings || relevantMeetings.length === 0) {
        return {
          answer: "I couldn't find any relevant meetings to answer your question. Try searching for specific topics or meetings first.",
          citations: [],
          followUpSuggestions: [],
          confidence: 0
        };
      }
      
      // 2. Get conversation context (if available)
      let conversationContext = '';
      if (conversationId) {
        const { data: history } = await supabase
          .from('conversation_messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (history && history.length > 0) {
          conversationContext = history
            .reverse()
            .map(m => `${m.role}: ${m.content}`)
            .join('\n');
        }
      }
      
      // 3. Prepare context for Gemini
      const meetingContext = relevantMeetings
        .map(m => {
          const meeting = m.meeting || {};
          return `
Meeting: ${meeting.title}
Date: ${meeting.created_at}
Content: ${m.text_content}
---`;
        })
        .join('\n');
      
      // 4. Generate answer using Gemini
      const systemPrompt = `You are a helpful assistant that answers questions about meetings.
      
Use the provided meeting context to answer questions accurately.
Always cite your sources (the specific meeting title and date).
Be concise but thorough.
If you're not sure, say so.

Format your answer in these sections:
ANSWER: [Your answer]
SOURCES: [List of meetings cited]
FOLLOWUP: [Suggest 2-3 follow-up questions]`;
      
      const userPrompt = `${conversationContext ? 'Previous conversation:\n' + conversationContext + '\n\n' : ''}
Question: ${question}

Meeting context:
${meetingContext}`;
      
      const response = await this.model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: systemPrompt + '\n\n' + userPrompt
              }
            ]
          }
        ]
      });
      
      const fullAnswer = response.response.text();
      
      // 5. Parse response
      const parsed = this.parseAnswer(fullAnswer);
      
      // 6. Store in conversation history
      if (conversationId) {
        await this.saveConversationMessage(
          conversationId,
          'user',
          question
        );
        
        await this.saveConversationMessage(
          conversationId,
          'assistant',
          parsed.answer
        );
      } else {
        // Create new conversation
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({ started_at: new Date() })
          .select()
          .single();
        
        if (newConv) {
          await this.saveConversationMessage(newConv.id, 'user', question);
          await this.saveConversationMessage(newConv.id, 'assistant', parsed.answer);
        }
      }
      
      // 7. Extract citations and add links
      const citations = relevantMeetings.map(m => ({
        type: m.source_type,
        id: m.source_id,
        title: m.meeting?.title || 'Unknown',
        date: m.meeting?.created_at,
        relevance: m.similarity || 0.8
      }));
      
      console.log(`✅ Generated answer with ${citations.length} citations`);
      
      return {
        answer: parsed.answer,
        citations,
        followUpSuggestions: parsed.followUp,
        confidence: this.calculateConfidence(relevantMeetings)
      };
      
    } catch (error) {
      console.error('Error answering question:', error);
      throw error;
    }
  }
  
  /**
   * Parse Gemini response
   */
  parseAnswer(response) {
    const answerMatch = response.match(/ANSWER:\s*([\s\S]*?)(?=SOURCES:|$)/);
    const sourcesMatch = response.match(/SOURCES:\s*([\s\S]*?)(?=FOLLOWUP:|$)/);
    const followUpMatch = response.match(/FOLLOWUP:\s*([\s\S]*?)$/);
    
    const answer = answerMatch ? answerMatch[1].trim() : response;
    const followUp = followUpMatch
      ? followUpMatch[1]
          .split('\n')
          .filter(line => line.trim().length > 0)
          .map(line => line.replace(/^[-•]\s*/, '').trim())
      : [];
    
    return {
      answer,
      followUp: followUp.slice(0, 3)
    };
  }
  
  /**
   * Calculate confidence score
   */
  calculateConfidence(relevantMeetings) {
    if (!relevantMeetings || relevantMeetings.length === 0) return 0;
    
    // Average similarity score of top 3 results
    const topScores = relevantMeetings.slice(0, 3).map(m => m.similarity || 0.5);
    const avgScore = topScores.reduce((a, b) => a + b, 0) / topScores.length;
    
    // Boost confidence if multiple meetings match
    const boost = Math.min(relevantMeetings.length / 5, 0.2);
    
    return Math.min(avgScore + boost, 1.0);
  }
  
  /**
   * Save conversation message
   */
  async saveConversationMessage(conversationId, role, content) {
    try {
      await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: conversationId,
          role,
          content,
          created_at: new Date()
        });
    } catch (error) {
      console.error('Error saving message:', error);
      // Don't throw - logging is non-critical
    }
  }
  
  /**
   * Get conversation history
   */
  async getConversation(conversationId) {
    try {
      const { data: messages } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      return messages || [];
    } catch (error) {
      console.error('Error fetching conversation:', error);
      return [];
    }
  }
  
  /**
   * Generate follow-up suggestions
   */
  async generateFollowUpSuggestions(question, answer) {
    try {
      const response = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{
            text: `Given this Q&A, suggest 2-3 natural follow-up questions:
            
Q: ${question}
A: ${answer}

Format as numbered list.`
          }]
        }]
      });
      
      return response.response.text()
        .split('\n')
        .filter(line => line.trim().length > 0)
        .slice(0, 3);
    } catch (error) {
      console.error('Error generating follow-up:', error);
      return [];
    }
  }
}

module.exports = new AskService();
🔧 BACKEND CODE - search.js
javascript
const express = require('express');
const embeddingService = require('../services/embeddingService');
const askService = require('../services/askService');
const supabase = require('../config/supabase');
const router = express.Router();

/**
 * POST /api/search/semantic
 * Semantic search for meetings
 */
router.post('/semantic', async (req, res) => {
  try {
    const { query, limit = 10, filters = {} } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    console.log(`🔍 Semantic search: "${query}"`);
    const startTime = Date.now();
    
    // Search
    let results = await embeddingService.semanticSearch(query, limit, filters);
    
    // Re-rank
    results = embeddingService.reRankResults(results);
    
    // Log search
    await supabase
      .from('search_history')
      .insert({
        query,
        search_type: 'semantic',
        results_count: results.length,
        execution_time: Date.now() - startTime
      })
      .catch(err => console.error('Error logging search:', err));
    
    res.json({
      query,
      results,
      count: results.length,
      executionTime: Date.now() - startTime
    });
    
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      details: error.message
    });
  }
});

/**
 * POST /api/search/ask
 * Ask AI a question
 */
router.post('/ask', async (req, res) => {
  try {
    const { question, conversationId } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    // Stream response (for long answers)
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    try {
      const answer = await askService.answerQuestion(question, conversationId);
      res.json(answer);
    } catch (error) {
      console.error('Ask error:', error);
      res.status(500).json({
        error: 'Failed to answer question',
        details: error.message
      });
    }
    
  } catch (error) {
    console.error('Error in ask endpoint:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/search/ask/follow-up
 * Ask follow-up question
 */
router.post('/ask/follow-up', async (req, res) => {
  try {
    const { question, conversationId } = req.body;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID required' });
    }
    
    const answer = await askService.answerQuestion(question, conversationId);
    res.json(answer);
    
  } catch (error) {
    console.error('Follow-up error:', error);
    res.status(500).json({
      error: 'Failed to process follow-up',
      details: error.message
    });
  }
});

/**
 * GET /api/search/history
 * Get search history
 */
router.get('/history', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const { data: history, error } = await supabase
      .from('search_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    res.json({ history: history || [] });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch history',
      details: error.message
    });
  }
});

/**
 * GET /api/search/conversations/:id
 * Get conversation
 */
router.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const messages = await askService.getConversation(id);
    res.json({ messages });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch conversation',
      details: error.message
    });
  }
});

/**
 * POST /api/search/save
 * Save search
 */
router.post('/save', async (req, res) => {
  try {
    const { name, query, searchType = 'semantic' } = req.body;
    
    if (!name || !query) {
      return res.status(400).json({ error: 'Name and query required' });
    }
    
    const { data, error } = await supabase
      .from('saved_searches')
      .insert({
        name,
        query,
        search_type: searchType
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ saved: data });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to save search',
      details: error.message
    });
  }
});

/**
 * GET /api/search/saved
 * Get saved searches
 */
router.get('/saved', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('saved_searches')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({ saved: data || [] });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch saved searches',
      details: error.message
    });
  }
});

module.exports = router;
🔧 FRONTEND CODE - SearchPanel.jsx
jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../styles/Search.css';

export default function SearchPanel({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('semantic');
  const [results, setResults] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef(null);
  
  useEffect(() => {
    loadRecentSearches();
    
    // Focus input when opened
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);
  
  // Keyboard shortcut: Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Open search
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  const loadRecentSearches = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/search/history?limit=5`
      );
      setRecentSearches(response.data.history || []);
    } catch (err) {
      console.error('Error loading recent searches:', err);
    }
  };
  
  const handleSearch = async (searchQuery = query) => {
    if (!searchQuery.trim()) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/search/${searchType}`,
        { query: searchQuery }
      );
      
      setResults(response.data.results || []);
      setShowResults(true);
      loadRecentSearches();
      
    } catch (err) {
      setError(`Search failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };
  
  return (
    <div className={`search-panel ${isOpen ? 'open' : ''}`}>
      <div className="search-container">
        <div className="search-input-group">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search meetings or ask a question..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="search-input"
            autoFocus
          />
          
          <div className="search-controls">
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              className="search-type-select"
            >
              <option value="semantic">🔍 Semantic Search</option>
              <option value="keyword">🏷️ Keyword Search</option>
            </select>
            
            <button
              onClick={() => handleSearch()}
              disabled={loading || !query.trim()}
              className="btn-search"
            >
              {loading ? '⏳' : '→'}
            </button>
          </div>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        {!showResults && recentSearches.length > 0 && (
          <div className="recent-searches">
            <h4>Recent Searches</h4>
            {recentSearches.map((search, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(search.query);
                  handleSearch(search.query);
                }}
                className="recent-search-item"
              >
                🕐 {search.query}
              </button>
            ))}
          </div>
        )}
        
        {showResults && (
          <div className="search-results">
            <h4>Results ({results.length})</h4>
            {results.length === 0 ? (
              <div className="no-results">No results found</div>
            ) : (
              results.map((result, idx) => (
                <div key={idx} className="search-result-item">
                  <div className="result-title">{result.meeting?.title}</div>
                  <div className="result-snippet">{result.text_content?.substring(0, 100)}...</div>
                  <div className="result-meta">
                    <span className="relevance">
                      {Math.round((result.similarity || 0.8) * 100)}% match
                    </span>
                    <span className="date">
                      {new Date(result.meeting?.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
🔧 FRONTEND CODE - AskAssistant.jsx
jsx
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import '../styles/Search.css';

export default function AskAssistant({ isOpen, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);
  
  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    try {
      setLoading(true);
      
      // Add user message to chat
      setMessages(prev => [...prev, {
        role: 'user',
        content: input,
        timestamp: new Date()
      }]);
      
      setInput('');
      
      // Send to backend
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/search/ask`,
        {
          question: input,
          conversationId
        }
      );
      
      // Set conversation ID on first message
      if (!conversationId && response.data.conversationId) {
        setConversationId(response.data.conversationId);
      }
      
      // Add assistant response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.data.answer,
        citations: response.data.citations,
        followUp: response.data.followUpSuggestions,
        confidence: response.data.confidence,
        timestamp: new Date()
      }]);
      
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  return (
    <div className={`ask-assistant ${isOpen ? 'open' : ''}`}>
      <div className="assistant-header">
        <h3>💬 Ask Assistant</h3>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>
      
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <p>👋 Hi! Ask me about your meetings</p>
            <p className="hint">Try: "What projects are due this week?" or "Who owns the website redesign?"</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`message message-${msg.role}`}>
              <div className="message-content">
                {msg.content}
              </div>
              
              {msg.citations && msg.citations.length > 0 && (
                <div className="citations">
                  <strong>📚 Sources:</strong>
                  {msg.citations.map((cite, cidx) => (
                    <a key={cidx} href={`/meetings/${cite.id}`} className="citation">
                      {cite.title}
                    </a>
                  ))}
                </div>
              )}
              
              {msg.followUp && msg.followUp.length > 0 && (
                <div className="follow-up">
                  <strong>💭 Follow-up:</strong>
                  {msg.followUp.map((q, qidx) => (
                    <button
                      key={qidx}
                      onClick={() => {
                        setInput(q);
                        inputRef.current?.focus();
                      }}
                      className="follow-up-btn"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="input-area">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          className="message-input"
          rows="3"
          disabled={loading}
        />
        
        <button
          onClick={handleSendMessage}
          disabled={loading || !input.trim()}
          className="btn-send"
        >
          {loading ? '⏳' : '→'} Send
        </button>
      </div>
    </div>
  );
}
🔧 FRONTEND CODE - searchService.js
javascript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class SearchService {
  /**
   * Semantic search
   */
  static async semanticSearch(query, limit = 10) {
    try {
      const response = await axios.post(
        `${API_URL}/api/search/semantic`,
        { query, limit }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Keyword search
   */
  static async keywordSearch(query, limit = 10) {
    try {
      const response = await axios.post(
        `${API_URL}/api/search/keyword`,
        { query, limit }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Ask AI question
   */
  static async askQuestion(question, conversationId = null) {
    try {
      const response = await axios.post(
        `${API_URL}/api/search/ask`,
        { question, conversationId }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get search history
   */
  static async getHistory(limit = 50) {
    try {
      const response = await axios.get(
        `${API_URL}/api/search/history?limit=${limit}`
      );
      return response.data.history;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Save search
   */
  static async saveSearch(name, query, searchType = 'semantic') {
    try {
      const response = await axios.post(
        `${API_URL}/api/search/save`,
        { name, query, searchType }
      );
      return response.data.saved;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get saved searches
   */
  static async getSavedSearches() {
    try {
      const response = await axios.get(`${API_URL}/api/search/saved`);
      return response.data.saved;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get conversation
   */
  static async getConversation(conversationId) {
    try {
      const response = await axios.get(
        `${API_URL}/api/search/conversations/${conversationId}`
      );
      return response.data.messages;
    } catch (error) {
      throw error;
    }
  }
}

export default SearchService;
📋 WEEK 6 TASKS SUMMARY
Total Tasks: 56

Monday: 12 tasks (Planning & architecture)

Tuesday: 10 tasks (Embedding generation)

Wednesday: 10 tasks (Ask AI backend)

Thursday: 8 tasks (Frontend UI)

Friday: 16 tasks (Testing & deployment)

✅ WEEK 6 SIGN-OFF CHECKLIST
Complete ALL before Week 7:

Semantic Search
 Embeddings generated for all meetings

 Semantic search returns relevant results

 Results ranked by relevance

 Search < 500ms

 Handles edge cases (no results, empty query)

Ask AI
 Can ask questions

 Answers are accurate

 Citations link correctly

 Conversation memory works

 Follow-up suggestions appear

Frontend
 Search panel works

 Ask assistant appears and functions

 Results display correctly

 Mobile responsive

 No console errors

Quality
 Code reviewed (2+ reviewers)

 Performance optimized

 Error handling comprehensive

 Security checked

 Accessible

Testing
 Semantic search test: PASS

 Ask question test: PASS

 Conversation memory test: PASS

 Performance test: PASS

 Accuracy test: > 85%

Database
 pgvector extension enabled

 Embeddings table created

 Search history table created

 Indexes created

 Queries optimized

Documentation
 API.md updated

 USER_GUIDE_WEEK6.md created

 Troubleshooting guide

 Code commented

📊 WEEK 6 SUCCESS METRICS
Metric	Target	Actual
Search speed	< 500ms	___
Answer accuracy	> 85%	___
Search relevance	> 90%	___
Conversation memory	100%	___
🚀 READY FOR WEEK 7?
When all checkboxes complete:

✅ Commit all Week 6 code

✅ Create branch: feature/week-7-automations

✅ Review Week 7 plan

✅ Assign tasks

End of WEEK 6 Guide

You now have:

✅ Week 1: Foundation & Setup

✅ Week 2: Meeting Recording

✅ Week 3: CRM Sync

✅ Week 4: Chat Integration

✅ Week 5: Dashboard

✅ Week 6: AI Search & Assistant

Ready for WEEK 7: AUTOMATIONS & BASIC AGENTS?

Reply: "Send WEEK 7" (Last week before production!)