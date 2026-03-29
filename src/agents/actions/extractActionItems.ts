/**
 * Extract Action Items Action
 * Uses Gemini to extract action items, decisions, and insights from meeting transcripts
 */

import { GoogleGenAI } from '@google/genai';
import { getEnvVar } from '../../lib/env';
import type { Agent, ActionStep } from '../types';

let genAI: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genAI) {
    const apiKey = getEnvVar('GEMINI_API_KEY');
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export interface ExtractActionItemsConfig {
  model?: string;
  extractDecisions?: boolean;
  extractKeyPoints?: boolean;
  extractSentiment?: boolean;
  extractNextSteps?: boolean;
  analysisType?: 'meeting_summary' | 'risk_assessment';
  includeRecommendations?: boolean;
}

export interface ExtractedData {
  actionItems: ActionItem[];
  decisions: string[];
  keyPoints: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  nextSteps: string[];
  recommendations?: string[];
  riskFactors?: string[];
  summary?: string;
}

export interface ActionItem {
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Execute the extract action items action
 */
export async function execute(params: {
  agent: Agent;
  step: ActionStep;
  triggerPayload: Record<string, any>;
  dryRun?: boolean;
}): Promise<{
  result: ExtractedData;
  countersDelta?: { pulseMessages?: number; crmTasks?: number };
}> {
  const { step, triggerPayload, dryRun } = params;
  const config = step.config as ExtractActionItemsConfig;

  console.log('[Action:extract_action_items] Starting extraction', { dryRun, config });

  // Get the transcript from the trigger payload
  const transcript = triggerPayload.transcript || triggerPayload.content || '';
  const meetingTitle = triggerPayload.title || triggerPayload.meetingTitle || 'Meeting';

  if (!transcript && !dryRun) {
    console.warn('[Action:extract_action_items] No transcript provided');
    return {
      result: {
        actionItems: [],
        decisions: [],
        keyPoints: [],
        nextSteps: [],
        summary: 'No transcript available for analysis.'
      }
    };
  }

  // In dry run mode, return mock data
  if (dryRun) {
    return {
      result: getMockExtractionResult(config),
      countersDelta: {}
    };
  }

  // Check for intelligence config — use composed prompt if available
  const intelligenceConfig = triggerPayload.intelligenceConfig;
  const intelligencePrompt = intelligenceConfig?.composedPrompt;

  // Build the extraction prompt (intelligence prompt overrides the default)
  const prompt = intelligencePrompt
    ? `${intelligencePrompt}\n\nMeeting: ${meetingTitle}\n\nExtract the following in JSON format:\n1. actionItems: Array of {title, description, assignee, priority}\n2. decisions: Array of key decisions made\n3. keyPoints: Array of important discussion points\n4. nextSteps: Array of agreed next steps\n\nRespond with valid JSON only.\n\nTRANSCRIPT:\n${transcript.slice(0, 15000)}`
    : buildExtractionPrompt(transcript, meetingTitle, config);

  try {
    const ai = getGenAI();
    const model = ai.models.get('gemini-2.0-flash');

    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048
      }
    });

    const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const extracted = parseExtractionResponse(responseText, config);

    console.log('[Action:extract_action_items] Extraction complete', {
      actionItems: extracted.actionItems.length,
      decisions: extracted.decisions.length
    });

    return {
      result: extracted,
      countersDelta: {}
    };

  } catch (err) {
    console.error('[Action:extract_action_items] Extraction failed:', err);
    throw new Error(`Failed to extract action items: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Build the extraction prompt based on config
 */
function buildExtractionPrompt(
  transcript: string,
  meetingTitle: string,
  config: ExtractActionItemsConfig
): string {
  const sections: string[] = [];

  if (config.analysisType === 'risk_assessment') {
    sections.push(`Analyze this content for risk factors and issues.`);
    sections.push(`Identify: overdue items, blockers, concerns raised, negative sentiment.`);
  } else {
    sections.push(`Analyze this meeting transcript and extract key information.`);
  }

  sections.push(`Meeting: ${meetingTitle}`);
  sections.push('');
  sections.push('Extract the following in JSON format:');
  sections.push('1. actionItems: Array of {title, description, assignee (if mentioned), priority (high/medium/low)}');

  if (config.extractDecisions !== false) {
    sections.push('2. decisions: Array of key decisions made');
  }

  if (config.extractKeyPoints !== false) {
    sections.push('3. keyPoints: Array of important discussion points');
  }

  if (config.extractSentiment) {
    sections.push('4. sentiment: Overall meeting sentiment (positive/neutral/negative)');
  }

  if (config.extractNextSteps !== false) {
    sections.push('5. nextSteps: Array of agreed next steps');
  }

  if (config.includeRecommendations) {
    sections.push('6. recommendations: Array of suggested actions based on the discussion');
  }

  if (config.analysisType === 'risk_assessment') {
    sections.push('7. riskFactors: Array of identified risks or concerns');
  }

  sections.push('');
  sections.push('Respond with valid JSON only.');
  sections.push('');
  sections.push('TRANSCRIPT:');
  sections.push(transcript.slice(0, 15000)); // Limit transcript length

  return sections.join('\n');
}

/**
 * Parse the Gemini response into structured data
 */
function parseExtractionResponse(
  responseText: string,
  config: ExtractActionItemsConfig
): ExtractedData {
  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        actionItems: normalizeActionItems(parsed.actionItems || []),
        decisions: parsed.decisions || [],
        keyPoints: parsed.keyPoints || [],
        sentiment: parsed.sentiment,
        nextSteps: parsed.nextSteps || [],
        recommendations: parsed.recommendations,
        riskFactors: parsed.riskFactors,
        summary: parsed.summary
      };
    }
  } catch (err) {
    console.warn('[Action:extract_action_items] Failed to parse JSON response:', err);
  }

  // Fallback: return empty structure
  return {
    actionItems: [],
    decisions: [],
    keyPoints: [],
    nextSteps: [],
    summary: responseText.slice(0, 500)
  };
}

/**
 * Normalize action items to ensure consistent format
 */
function normalizeActionItems(items: any[]): ActionItem[] {
  return items.map(item => ({
    title: item.title || item.task || item.action || 'Untitled action item',
    description: item.description || item.details,
    assignee: item.assignee || item.owner || item.assigned_to,
    dueDate: item.dueDate || item.due_date || item.deadline,
    priority: normalizePriority(item.priority)
  }));
}

/**
 * Normalize priority value
 */
function normalizePriority(priority: any): 'high' | 'medium' | 'low' {
  const p = String(priority || '').toLowerCase();
  if (p.includes('high') || p.includes('urgent') || p === '1') return 'high';
  if (p.includes('low') || p === '3') return 'low';
  return 'medium';
}

/**
 * Get mock extraction result for dry run
 */
function getMockExtractionResult(config: ExtractActionItemsConfig): ExtractedData {
  return {
    actionItems: [
      {
        title: '[DRY RUN] Sample action item 1',
        description: 'This is a mock action item for testing',
        assignee: 'Team Member',
        priority: 'high'
      },
      {
        title: '[DRY RUN] Sample action item 2',
        description: 'Another mock action item',
        priority: 'medium'
      }
    ],
    decisions: ['[DRY RUN] Sample decision made during meeting'],
    keyPoints: ['[DRY RUN] Key discussion point'],
    sentiment: 'neutral',
    nextSteps: ['[DRY RUN] Follow up on action items'],
    recommendations: config.includeRecommendations
      ? ['[DRY RUN] Consider scheduling follow-up meeting']
      : undefined,
    riskFactors: config.analysisType === 'risk_assessment'
      ? ['[DRY RUN] Sample risk factor identified']
      : undefined,
    summary: '[DRY RUN] This is a mock extraction result for testing the agent.'
  };
}
