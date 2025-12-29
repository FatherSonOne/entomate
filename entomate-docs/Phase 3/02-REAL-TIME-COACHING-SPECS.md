# Real-time Meeting Coaching Specification

**Phase 3 - Weeks 1-2**
**Priority:** High (unique competitive advantage)

---

## Overview

Real-time coaching provides live AI assistance during meetings. Unlike post-meeting analysis (Phase 1-2), this feature delivers actionable prompts **while the conversation is happening**.

### Key Differentiator
ClickUp Brain cannot do this. This is a unique opportunity for Entomate.

---

## Feature Requirements

### Core Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Deal Context Cards | Show relevant deal info during discussion | P0 |
| Objection Handling | Suggest responses to common objections | P0 |
| Competitor Alerts | Alert when competitor is mentioned | P0 |
| Talk-time Balance | Warn if user is dominating conversation | P1 |
| Key Point Reminders | Remind to cover important topics | P1 |
| Question Suggestions | Suggest discovery questions | P2 |
| Next Steps Prompt | Prompt to confirm next steps before ending | P2 |

### Non-Goals (Phase 3)
- Auto-response generation (too risky)
- Voice synthesis/speaking for user
- Real-time transcription (use existing system)

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Frontend                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Meeting UI  │  │ WebSocket   │  │ Coaching Overlay    │ │
│  │             │◄─┤ Client      │◄─┤ (prompts, alerts)   │ │
│  └─────────────┘  └──────┬──────┘  └─────────────────────┘ │
└──────────────────────────┼──────────────────────────────────┘
                           │ WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       Backend                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ WS Server   │──┤ Room Manager│──┤ Coaching Agent      │ │
│  │             │  │             │  │                     │ │
│  └─────────────┘  └─────────────┘  └──────────┬──────────┘ │
│                                               │             │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────▼──────────┐ │
│  │ Transcript  │──┤ Keyword     │──┤ Prompt Generator    │ │
│  │ Stream      │  │ Detector    │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### WebSocket Message Types

```typescript
// Client → Server
interface JoinMeetingMessage {
  type: 'join_meeting';
  meetingId: string;
  userId: string;
  token: string;
}

interface TranscriptChunkMessage {
  type: 'transcript_chunk';
  text: string;
  speaker: string;
  timestamp: number;
}

interface PromptActionMessage {
  type: 'prompt_action';
  promptId: string;
  action: 'used' | 'dismissed' | 'snoozed';
}

// Server → Client
interface CoachingPromptMessage {
  type: 'coaching_prompt';
  promptId: string;
  promptType: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  context?: Record<string, any>;
  expiresAt?: number;
}

interface TalkTimeUpdateMessage {
  type: 'talk_time_update';
  participants: Record<string, number>; // userId -> percentage
  warning?: string;
}

interface ContextUpdateMessage {
  type: 'context_update';
  dealInfo?: DealContext;
  customerHealth?: CustomerHealth;
}
```

---

## Data Models

### Database Schema

```sql
-- Coaching sessions (one per meeting per user)
CREATE TABLE coaching_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL,
  user_id UUID NOT NULL,
  deal_id UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  prompts_shown INT NOT NULL DEFAULT 0,
  prompts_used INT NOT NULL DEFAULT 0,
  prompts_dismissed INT NOT NULL DEFAULT 0,
  talk_time_percentage DOUBLE PRECISION,
  coaching_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(meeting_id, user_id)
);

-- Individual coaching prompts
CREATE TABLE coaching_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES coaching_sessions(id),
  prompt_type TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  trigger_reason TEXT,
  trigger_context JSONB NOT NULL DEFAULT '{}',
  shown_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keyword detection configuration
CREATE TABLE coaching_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,  -- objection, competitor, topic
  keyword TEXT NOT NULL,
  variations TEXT[] NOT NULL DEFAULT '{}',
  prompt_template TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_coaching_sessions_meeting ON coaching_sessions (meeting_id);
CREATE INDEX idx_coaching_sessions_user ON coaching_sessions (user_id);
CREATE INDEX idx_coaching_prompts_session ON coaching_prompts (session_id);
CREATE INDEX idx_coaching_keywords_category ON coaching_keywords (category);
```

### TypeScript Interfaces

```typescript
// src/realtime/types.ts

export interface CoachingSession {
  id: string;
  meetingId: string;
  userId: string;
  dealId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  promptsShown: number;
  promptsUsed: number;
  promptsDismissed: number;
  talkTimePercentage: number | null;
  coachingEnabled: boolean;
}

export interface CoachingPrompt {
  id: string;
  sessionId: string;
  promptType: PromptType;
  promptText: string;
  priority: 'high' | 'medium' | 'low';
  triggerReason: string | null;
  triggerContext: Record<string, any>;
  shownAt: Date;
  usedAt: Date | null;
  dismissedAt: Date | null;
  snoozedUntil: Date | null;
}

export type PromptType =
  | 'deal_context'
  | 'objection_price'
  | 'objection_timeline'
  | 'objection_budget'
  | 'objection_authority'
  | 'competitor_mentioned'
  | 'talk_time_warning'
  | 'key_topic_reminder'
  | 'question_suggestion'
  | 'next_steps_reminder';

export interface CoachingContext {
  meetingId: string;
  userId: string;
  dealId: string | null;
  dealStage: string | null;
  dealValue: number | null;
  customerName: string | null;
  customerHealth: number | null;
  participants: string[];
  competitorNames: string[];
  keyTopics: string[];
  openObjections: string[];
  talkTimeByParticipant: Record<string, number>;
  lastPromptAt: Date | null;
}
```

---

## Coaching Logic

### Keyword Detection

```typescript
// src/realtime/keywordDetector.ts

const OBJECTION_KEYWORDS = {
  price: {
    keywords: ['expensive', 'cost', 'price', 'budget', 'afford', 'cheaper'],
    variations: ['too much', 'out of budget', 'price point', 'pricing'],
    promptTemplate: 'Price concern detected. Consider:\n• Value proposition\n• ROI calculation\n• Payment terms\n• Competitive comparison'
  },
  timeline: {
    keywords: ['timeline', 'deadline', 'urgent', 'rush', 'delay', 'wait'],
    variations: ['how long', 'time frame', 'when can', 'too slow'],
    promptTemplate: 'Timeline concern detected. Consider:\n• Implementation phases\n• Quick wins\n• Parallel workstreams\n• Dedicated resources'
  },
  authority: {
    keywords: ['approval', 'boss', 'manager', 'committee', 'stakeholder'],
    variations: ['need to check', 'run it by', 'decision maker', 'sign off'],
    promptTemplate: 'Authority/approval mentioned. Consider:\n• Identify decision makers\n• Offer executive summary\n• Schedule stakeholder call\n• Provide business case materials'
  },
  competitor: {
    keywords: [], // Loaded dynamically from deal record
    variations: [],
    promptTemplate: 'Competitor {{name}} mentioned.\n\nKey differentiators:\n{{differentiators}}'
  }
};

export function detectKeywords(
  text: string,
  context: CoachingContext
): DetectedKeyword[] {
  const detected: DetectedKeyword[] = [];

  for (const [category, config] of Object.entries(OBJECTION_KEYWORDS)) {
    const allKeywords = [...config.keywords, ...config.variations];

    for (const keyword of allKeywords) {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        detected.push({
          category,
          keyword,
          promptTemplate: config.promptTemplate,
          position: text.toLowerCase().indexOf(keyword.toLowerCase())
        });
      }
    }
  }

  // Check competitor names from context
  for (const competitor of context.competitorNames) {
    if (text.toLowerCase().includes(competitor.toLowerCase())) {
      detected.push({
        category: 'competitor',
        keyword: competitor,
        promptTemplate: OBJECTION_KEYWORDS.competitor.promptTemplate,
        position: text.toLowerCase().indexOf(competitor.toLowerCase())
      });
    }
  }

  return detected;
}
```

### Talk-time Tracking

```typescript
// src/realtime/talkTimeTracker.ts

export class TalkTimeTracker {
  private speakingTime: Map<string, number> = new Map();
  private lastUpdate: Date = new Date();

  updateSpeakingTime(speaker: string, durationMs: number): void {
    const current = this.speakingTime.get(speaker) || 0;
    this.speakingTime.set(speaker, current + durationMs);
  }

  getPercentages(): Record<string, number> {
    const total = Array.from(this.speakingTime.values())
      .reduce((sum, time) => sum + time, 0);

    if (total === 0) return {};

    const percentages: Record<string, number> = {};
    for (const [speaker, time] of this.speakingTime) {
      percentages[speaker] = Math.round((time / total) * 100);
    }
    return percentages;
  }

  shouldWarn(userId: string, threshold = 70): boolean {
    const percentages = this.getPercentages();
    return (percentages[userId] || 0) > threshold;
  }

  getWarningMessage(userId: string): string | null {
    const percentages = this.getPercentages();
    const userPct = percentages[userId] || 0;

    if (userPct > 80) {
      return `You've been speaking ${userPct}% of the time. Try pausing for questions.`;
    }
    if (userPct > 70) {
      return `Talk time at ${userPct}%. Consider asking an open-ended question.`;
    }
    return null;
  }
}
```

### Prompt Rate Limiting

```typescript
// src/realtime/promptRateLimiter.ts

export class PromptRateLimiter {
  private lastPromptTime: Map<string, Date> = new Map();
  private promptCounts: Map<string, number> = new Map();

  // Minimum seconds between prompts
  private minIntervalSeconds = 30;

  // Maximum prompts per session
  private maxPromptsPerSession = 20;

  canShowPrompt(sessionId: string, priority: string): boolean {
    const lastTime = this.lastPromptTime.get(sessionId);
    const count = this.promptCounts.get(sessionId) || 0;

    // Check max prompts
    if (count >= this.maxPromptsPerSession) {
      return false;
    }

    // Check interval (high priority can bypass)
    if (lastTime && priority !== 'high') {
      const elapsed = (Date.now() - lastTime.getTime()) / 1000;
      if (elapsed < this.minIntervalSeconds) {
        return false;
      }
    }

    return true;
  }

  recordPrompt(sessionId: string): void {
    this.lastPromptTime.set(sessionId, new Date());
    const count = this.promptCounts.get(sessionId) || 0;
    this.promptCounts.set(sessionId, count + 1);
  }
}
```

---

## Backend Implementation

### WebSocket Server

```typescript
// src/realtime/wsServer.ts

import { Server } from 'socket.io';
import { createServer } from 'http';
import { verifyToken } from '../auth/jwt';
import { RoomManager } from './roomManager';
import { CoachingAgent } from './coachingAgent';

export function createWebSocketServer(httpServer: ReturnType<typeof createServer>) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ['GET', 'POST']
    }
  });

  const roomManager = new RoomManager();
  const coachingAgent = new CoachingAgent();

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    try {
      const user = await verifyToken(token);
      socket.data.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.data.user.id}`);

    socket.on('join_meeting', async (data) => {
      const { meetingId } = data;
      const userId = socket.data.user.id;

      await roomManager.joinRoom(socket, meetingId, userId);

      // Load coaching context
      const context = await coachingAgent.initializeContext(meetingId, userId);

      // Send initial context
      socket.emit('context_update', {
        type: 'context_update',
        dealInfo: context.dealInfo,
        customerHealth: context.customerHealth
      });
    });

    socket.on('transcript_chunk', async (data) => {
      const { text, speaker, timestamp } = data;
      const meetingId = roomManager.getMeetingId(socket);

      if (meetingId) {
        const prompts = await coachingAgent.processTranscript(
          meetingId,
          socket.data.user.id,
          text,
          speaker
        );

        for (const prompt of prompts) {
          socket.emit('coaching_prompt', prompt);
        }
      }
    });

    socket.on('prompt_action', async (data) => {
      await coachingAgent.recordPromptAction(data.promptId, data.action);
    });

    socket.on('disconnect', async () => {
      await roomManager.leaveAllRooms(socket);
      console.log(`User disconnected: ${socket.data.user.id}`);
    });
  });

  return io;
}
```

### Coaching Agent

```typescript
// src/realtime/coachingAgent.ts

import { supabase } from '../lib/supabase';
import { detectKeywords } from './keywordDetector';
import { TalkTimeTracker } from './talkTimeTracker';
import { PromptRateLimiter } from './promptRateLimiter';

export class CoachingAgent {
  private talkTimeTrackers: Map<string, TalkTimeTracker> = new Map();
  private rateLimiter = new PromptRateLimiter();
  private contexts: Map<string, CoachingContext> = new Map();

  async initializeContext(
    meetingId: string,
    userId: string
  ): Promise<{ dealInfo: any; customerHealth: any }> {
    // Load deal info from meeting
    const { data: meeting } = await supabase
      .from('meetings')
      .select('*, deals(*)')
      .eq('id', meetingId)
      .single();

    const deal = meeting?.deals;

    // Build context
    const context: CoachingContext = {
      meetingId,
      userId,
      dealId: deal?.id || null,
      dealStage: deal?.stage || null,
      dealValue: deal?.value || null,
      customerName: deal?.customer_name || null,
      customerHealth: null,
      participants: [],
      competitorNames: await this.getCompetitorNames(deal?.id),
      keyTopics: await this.getKeyTopics(deal?.id),
      openObjections: [],
      talkTimeByParticipant: {},
      lastPromptAt: null
    };

    this.contexts.set(`${meetingId}:${userId}`, context);
    this.talkTimeTrackers.set(meetingId, new TalkTimeTracker());

    // Create coaching session
    await supabase.from('coaching_sessions').upsert({
      meeting_id: meetingId,
      user_id: userId,
      deal_id: deal?.id,
      started_at: new Date().toISOString()
    });

    return {
      dealInfo: deal ? {
        name: deal.name,
        stage: deal.stage,
        value: deal.value,
        customerName: deal.customer_name
      } : null,
      customerHealth: context.customerHealth
    };
  }

  async processTranscript(
    meetingId: string,
    userId: string,
    text: string,
    speaker: string
  ): Promise<CoachingPromptMessage[]> {
    const contextKey = `${meetingId}:${userId}`;
    const context = this.contexts.get(contextKey);
    if (!context) return [];

    const prompts: CoachingPromptMessage[] = [];

    // Update talk time
    const tracker = this.talkTimeTrackers.get(meetingId);
    if (tracker) {
      // Estimate speaking time from text length (rough)
      const estimatedMs = text.length * 50; // ~50ms per character
      tracker.updateSpeakingTime(speaker, estimatedMs);

      // Check for talk time warning
      const warning = tracker.getWarningMessage(userId);
      if (warning && this.rateLimiter.canShowPrompt(contextKey, 'low')) {
        prompts.push(await this.createPrompt(
          contextKey,
          'talk_time_warning',
          warning,
          'low',
          { percentages: tracker.getPercentages() }
        ));
      }
    }

    // Detect keywords
    const detected = detectKeywords(text, context);
    for (const detection of detected) {
      const priority = detection.category === 'competitor' ? 'high' : 'medium';

      if (this.rateLimiter.canShowPrompt(contextKey, priority)) {
        const promptText = this.formatPromptTemplate(
          detection.promptTemplate,
          context,
          detection
        );

        prompts.push(await this.createPrompt(
          contextKey,
          `objection_${detection.category}` as PromptType,
          promptText,
          priority,
          { keyword: detection.keyword, text: text.substring(0, 200) }
        ));
      }
    }

    return prompts;
  }

  private async createPrompt(
    contextKey: string,
    promptType: PromptType,
    text: string,
    priority: 'high' | 'medium' | 'low',
    triggerContext: Record<string, any>
  ): Promise<CoachingPromptMessage> {
    const [meetingId, userId] = contextKey.split(':');

    // Get session
    const { data: session } = await supabase
      .from('coaching_sessions')
      .select('id')
      .eq('meeting_id', meetingId)
      .eq('user_id', userId)
      .single();

    // Insert prompt record
    const { data: prompt } = await supabase
      .from('coaching_prompts')
      .insert({
        session_id: session?.id,
        prompt_type: promptType,
        prompt_text: text,
        priority,
        trigger_context: triggerContext
      })
      .select()
      .single();

    this.rateLimiter.recordPrompt(contextKey);

    return {
      type: 'coaching_prompt',
      promptId: prompt?.id || '',
      promptType,
      text,
      priority,
      context: triggerContext
    };
  }

  async recordPromptAction(
    promptId: string,
    action: 'used' | 'dismissed' | 'snoozed'
  ): Promise<void> {
    const updates: Record<string, any> = {};

    if (action === 'used') {
      updates.used_at = new Date().toISOString();
    } else if (action === 'dismissed') {
      updates.dismissed_at = new Date().toISOString();
    } else if (action === 'snoozed') {
      updates.snoozed_until = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    }

    await supabase
      .from('coaching_prompts')
      .update(updates)
      .eq('id', promptId);

    // Update session counters
    const { data: prompt } = await supabase
      .from('coaching_prompts')
      .select('session_id')
      .eq('id', promptId)
      .single();

    if (prompt?.session_id) {
      const column = action === 'used' ? 'prompts_used' : 'prompts_dismissed';
      await supabase.rpc('increment_session_counter', {
        session_id: prompt.session_id,
        column_name: column
      });
    }
  }

  private async getCompetitorNames(dealId: string | null): Promise<string[]> {
    if (!dealId) return [];

    const { data } = await supabase
      .from('deal_competitors')
      .select('competitor_name')
      .eq('deal_id', dealId);

    return data?.map(d => d.competitor_name) || [];
  }

  private async getKeyTopics(dealId: string | null): Promise<string[]> {
    if (!dealId) return [];

    const { data } = await supabase
      .from('deal_key_topics')
      .select('topic')
      .eq('deal_id', dealId);

    return data?.map(d => d.topic) || [];
  }

  private formatPromptTemplate(
    template: string,
    context: CoachingContext,
    detection: DetectedKeyword
  ): string {
    return template
      .replace('{{name}}', detection.keyword)
      .replace('{{customerName}}', context.customerName || 'Customer')
      .replace('{{dealStage}}', context.dealStage || 'Unknown')
      .replace('{{differentiators}}', 'See competitive intel in deal record');
  }
}
```

---

## Frontend Implementation

### Coaching Overlay Component

```tsx
// src/components/coaching/CoachingOverlay.tsx

import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { CoachingPrompt } from './CoachingPrompt';
import { TalkTimeIndicator } from './TalkTimeIndicator';

interface Props {
  meetingId: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function CoachingOverlay({ meetingId, enabled, onToggle }: Props) {
  const [prompts, setPrompts] = useState<CoachingPromptMessage[]>([]);
  const [talkTime, setTalkTime] = useState<Record<string, number>>({});
  const [talkTimeWarning, setTalkTimeWarning] = useState<string | null>(null);

  const { socket, connected } = useWebSocket();

  useEffect(() => {
    if (!socket || !connected) return;

    socket.on('coaching_prompt', (message: CoachingPromptMessage) => {
      if (!enabled) return;

      setPrompts(prev => [...prev, message]);

      // Auto-expire after 30 seconds
      setTimeout(() => {
        setPrompts(prev => prev.filter(p => p.promptId !== message.promptId));
      }, 30000);
    });

    socket.on('talk_time_update', (message: TalkTimeUpdateMessage) => {
      setTalkTime(message.participants);
      setTalkTimeWarning(message.warning || null);
    });

    return () => {
      socket.off('coaching_prompt');
      socket.off('talk_time_update');
    };
  }, [socket, connected, enabled]);

  const handlePromptAction = (promptId: string, action: 'used' | 'dismissed') => {
    socket?.emit('prompt_action', { promptId, action });
    setPrompts(prev => prev.filter(p => p.promptId !== promptId));
  };

  if (!enabled) {
    return (
      <button
        onClick={() => onToggle(true)}
        className="fixed bottom-4 right-4 bg-gray-200 px-3 py-1 rounded text-sm"
      >
        Enable Coaching
      </button>
    );
  }

  return (
    <div className="fixed right-4 top-20 w-80 space-y-3 z-50">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow px-3 py-2">
        <span className="text-sm font-medium text-gray-700">AI Coaching</span>
        <button
          onClick={() => onToggle(false)}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Turn off
        </button>
      </div>

      {/* Talk time indicator */}
      <TalkTimeIndicator
        percentages={talkTime}
        warning={talkTimeWarning}
      />

      {/* Active prompts */}
      {prompts.map(prompt => (
        <CoachingPrompt
          key={prompt.promptId}
          prompt={prompt}
          onUse={() => handlePromptAction(prompt.promptId, 'used')}
          onDismiss={() => handlePromptAction(prompt.promptId, 'dismissed')}
        />
      ))}
    </div>
  );
}
```

### Prompt Card Component

```tsx
// src/components/coaching/CoachingPrompt.tsx

import React from 'react';

interface Props {
  prompt: CoachingPromptMessage;
  onUse: () => void;
  onDismiss: () => void;
}

export function CoachingPrompt({ prompt, onUse, onDismiss }: Props) {
  const priorityColors = {
    high: 'border-l-red-500 bg-red-50',
    medium: 'border-l-yellow-500 bg-yellow-50',
    low: 'border-l-blue-500 bg-blue-50'
  };

  return (
    <div
      className={`
        rounded-lg shadow-lg border-l-4 p-4
        ${priorityColors[prompt.priority]}
        animate-slide-in
      `}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase">
          {prompt.promptType.replace(/_/g, ' ')}
        </span>
        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>

      <p className="text-sm text-gray-800 whitespace-pre-line">
        {prompt.text}
      </p>

      <div className="flex justify-end mt-3 space-x-2">
        <button
          onClick={onDismiss}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Dismiss
        </button>
        <button
          onClick={onUse}
          className="text-xs bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700"
        >
          Helpful
        </button>
      </div>
    </div>
  );
}
```

---

## API Endpoints

### REST Endpoints (for configuration)

```typescript
// GET /api/coaching/keywords
// List all coaching keywords

// POST /api/coaching/keywords
// Add new keyword
// Body: { category, keyword, variations, promptTemplate, priority }

// PUT /api/coaching/keywords/:id
// Update keyword

// DELETE /api/coaching/keywords/:id
// Deactivate keyword

// GET /api/coaching/sessions/:meetingId
// Get coaching session summary

// GET /api/coaching/analytics
// Query params: userId, startDate, endDate
// Returns: promptsShown, promptsUsed, usageRate, topCategories
```

---

## Testing Plan

### Unit Tests
- Keyword detection with various inputs
- Talk-time calculation accuracy
- Rate limiter behavior
- Prompt template formatting

### Integration Tests
- WebSocket connection/authentication
- Full coaching flow (join → prompts → actions)
- Session persistence
- Multi-user in same meeting

### Performance Tests
- Prompt delivery latency (<500ms target)
- 50 concurrent sessions
- Memory usage under load

### User Acceptance Tests
- Real meeting simulation with scripted objections
- Verify prompts are helpful (not annoying)
- Test coaching on/off toggle
- Verify talk-time accuracy with real speech

---

## Gemini Studio Mockup Prompts

### Prompt 1: Coaching Overlay
```
Design a "Real-time Coaching" overlay for a meeting recording application.

Requirements:
- Fixed position on right side of screen
- Non-intrusive but visible
- Shows coaching prompts as cards
- Cards have priority indicators (color-coded)
- Each card has "Helpful" and "Dismiss" buttons
- Talk-time indicator at top (pie chart or bar)
- Toggle to turn coaching on/off

Style: Clean, minimal, professional. Should not distract from the meeting.
```

### Prompt 2: Coaching Settings
```
Design a "Coaching Settings" page for an enterprise meeting tool.

Sections:
1. Enable/disable coaching globally
2. Keyword configuration (table with add/edit/delete)
3. Talk-time threshold slider (50-90%)
4. Prompt frequency settings
5. Categories to enable/disable

Style: Enterprise admin panel, clean forms.
```

---

## Next Steps After MVP

1. **Gemini-powered suggestions** - Use Gemini to generate contextual responses
2. **Learning from feedback** - Improve prompts based on "Helpful" clicks
3. **Custom keyword sets** - Per-user or per-deal keyword configurations
4. **Coaching insights dashboard** - Show coaching effectiveness over time
5. **Voice tone analysis** - Detect frustration or excitement in speech

---

## Next File

Reply: **"Show file 03"** for Customer Sentiment Tracking specification.
