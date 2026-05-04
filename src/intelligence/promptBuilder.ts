/**
 * Prompt Builder
 * Composes the final system prompt for Gemini by substituting template variables,
 * injecting assembled context, and respecting token budgets.
 */

import type {
  IntelligenceProfile,
  AssembledContext,
  FocusArea,
  OutputFormatConfig,
  ParticipantContext,
  PastMeetingContext,
  DecisionContext,
  TaskContext,
} from './types';

/** Max chars for the composed system prompt (~4000 tokens at ~4 chars/token) */
const MAX_PROMPT_CHARS = 16000;

// ==================== MAIN BUILDER ====================

/**
 * Build a meeting-specific system prompt from a profile, user values, and context.
 */
export function buildMeetingPrompt(
  profile: IntelligenceProfile,
  customFieldValues: Record<string, any>,
  assembledContext: AssembledContext | null,
  overrides?: {
    toneOverride?: string;
    focusOverride?: FocusArea[];
    additionalInstructions?: string;
  }
): string {
  let prompt = profile.systemPromptTemplate;

  // 1. Substitute custom field values
  for (const field of profile.customFields) {
    const value = customFieldValues[field.key] ?? '';
    const placeholder = `{{${field.key}}}`;
    prompt = replaceAll(prompt, placeholder, String(value));
  }

  // 2. Substitute participant context
  const participantText = assembledContext?.participants
    ? formatParticipants(assembledContext.participants)
    : '';
  prompt = replaceAll(prompt, '{{participant_context}}', participantText);

  // 3. Substitute past meeting context
  const pastMeetingText = assembledContext?.pastMeetings
    ? formatPastMeetings(assembledContext.pastMeetings)
    : '';
  prompt = replaceAll(prompt, '{{past_meeting_context}}', pastMeetingText);

  // 3b. Substitute Pulse signal (decisions + tasks from Pulse workspaces).
  // Templates that don't reference {{pulse_signal}} will fall through to the
  // auto-append at step 12, so existing profiles benefit without edits.
  const pulseSignalText = assembledContext
    ? formatPulseSignal(assembledContext.recentDecisions, assembledContext.openTasks)
    : '';
  prompt = replaceAll(prompt, '{{pulse_signal}}', pulseSignalText);

  // 4. Substitute focus areas
  const focusAreas = overrides?.focusOverride || profile.focusAreas;
  const focusText = focusAreas.map(f => f.label).join(', ');
  prompt = replaceAll(prompt, '{{focus_areas}}', focusText);

  // 5. Substitute tone
  const tone = overrides?.toneOverride || profile.tone;
  prompt = replaceAll(prompt, '{{tone}}', tone);

  // 6. Substitute output style
  const outputText = formatOutputStyle(profile.outputFormat);
  prompt = replaceAll(prompt, '{{output_style}}', outputText);

  // 7. Substitute additional instructions
  const instructions = overrides?.additionalInstructions || '';
  prompt = replaceAll(prompt, '{{additional_instructions}}', instructions);

  // 8. Process conditional blocks: {{#if variable}}...{{/if}}
  prompt = processConditionals(prompt);

  // 9. Clean up any remaining unresolved placeholders
  prompt = prompt.replace(/\{\{[a-z_]+\}\}/g, '');

  // 10. Append additional instructions if not already in template
  if (overrides?.additionalInstructions && !profile.systemPromptTemplate.includes('{{additional_instructions}}')) {
    prompt += `\n\nADDITIONAL INSTRUCTIONS: ${overrides.additionalInstructions}`;
  }

  // 11. Auto-append Pulse signal if the template doesn't reference {{pulse_signal}}
  // and the assembled context actually has Pulse signal to share. Existing
  // built-in profiles benefit without needing template edits.
  if (
    pulseSignalText &&
    !profile.systemPromptTemplate.includes('{{pulse_signal}}')
  ) {
    prompt += `\n\n${pulseSignalText}`;
  }

  // 12. Trim to token budget
  if (prompt.length > MAX_PROMPT_CHARS) {
    prompt = prompt.slice(0, MAX_PROMPT_CHARS - 50) + '\n\n[Context trimmed to fit token budget]';
  }

  return prompt.trim();
}

// ==================== PULSE SIGNAL FORMATTER ====================

function formatPulseSignal(
  decisions?: DecisionContext[],
  tasks?: TaskContext[]
): string {
  const pulseDecisions = (decisions || []).filter(d => d.sourceApp === 'pulse');
  const pulseTasks = (tasks || []).filter(t => t.relatedTo === 'pulse');

  if (pulseDecisions.length === 0 && pulseTasks.length === 0) return '';

  const lines: string[] = ['RECENT PULSE WORKSPACE SIGNAL:'];

  if (pulseDecisions.length > 0) {
    lines.push('\nDecisions logged:');
    for (const d of pulseDecisions.slice(0, 5)) {
      const type = d.decisionType ? ` [${d.decisionType}]` : '';
      const desc = d.description ? ` — ${d.description.slice(0, 120)}` : '';
      lines.push(`  - ${d.title}${type}${desc}`);
    }
  }

  if (pulseTasks.length > 0) {
    lines.push('\nOpen tasks from Pulse:');
    for (const t of pulseTasks.slice(0, 5)) {
      const due = t.dueDate ? ` (due ${t.dueDate})` : '';
      const prio = t.priority && t.priority !== 'medium' ? ` [${t.priority}]` : '';
      lines.push(`  - ${t.title}${prio}${due}`);
    }
  }

  return lines.join('\n');
}

// ==================== DEFAULT PROMPT (BACKWARD COMPAT) ====================

/**
 * Returns the existing hardcoded prompts from geminiService.ts.
 * Used when no intelligence profile is assigned to a meeting.
 */
export function buildDefaultPrompt(type: 'summarize' | 'extract'): string {
  if (type === 'summarize') {
    return `Analyze this meeting transcript and provide a structured summary.

Respond in this exact JSON format:
{
  "summary": "A 2-3 sentence executive summary of the meeting",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "decisions": ["Decision 1", "Decision 2"],
  "sentiment_label": "positive" | "neutral" | "negative",
  "sentiment_score": 0.0 to 1.0 (0 = very negative, 1 = very positive)
}

Only respond with valid JSON, no markdown or extra text.`;
  }

  return `Analyze this meeting transcript and extract all action items, tasks, and follow-ups that were mentioned or assigned.

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

Only respond with valid JSON, no markdown or extra text.`;
}

// ==================== FORMATTING HELPERS ====================

function formatParticipants(participants: ParticipantContext[]): string {
  if (!participants.length) return 'No participant data available.';

  return participants.map(p => {
    const parts = [`- ${p.name}`];
    if (p.role) parts.push(`(${p.role})`);
    if (p.organization) parts.push(`at ${p.organization}`);
    if (p.relationship) parts.push(`[${p.relationship}]`);
    if (p.meetingCount) parts.push(`— ${p.meetingCount} previous meetings`);
    if (p.notes) parts.push(`\n  Notes: ${p.notes}`);
    return parts.join(' ');
  }).join('\n');
}

function formatPastMeetings(meetings: PastMeetingContext[]): string {
  if (!meetings.length) return 'No previous meeting data available.';

  return meetings.map(m => {
    const parts = [`- ${m.title} (${m.date})`];
    if (m.summary) parts.push(`\n  Summary: ${m.summary}`);
    if (m.keyDecisions?.length) parts.push(`\n  Decisions: ${m.keyDecisions.join('; ')}`);
    if (m.openActionItems?.length) parts.push(`\n  Open items: ${m.openActionItems.join('; ')}`);
    return parts.join('');
  }).join('\n');
}

function formatOutputStyle(format: OutputFormatConfig): string {
  const parts: string[] = [];

  switch (format.summaryStyle) {
    case 'executive': parts.push('Provide a concise executive summary'); break;
    case 'detailed': parts.push('Provide a detailed, comprehensive summary'); break;
    case 'bullet_points': parts.push('Use bullet points for a scannable summary'); break;
  }

  if (format.includeRecommendations) parts.push('include recommendations');
  if (format.includeRiskAssessment) parts.push('include risk assessment');
  if (format.includeSentimentBreakdown) parts.push('include sentiment breakdown');

  if (format.customSections?.length) {
    const sectionNames = format.customSections.map(s => s.title).join(', ');
    parts.push(`include these sections: ${sectionNames}`);
  }

  return parts.join('; ');
}

// ==================== TEMPLATE ENGINE HELPERS ====================

/**
 * Process simple conditional blocks: {{#if variable}}content{{/if}}
 * Removes the block if the variable is empty/falsy, keeps content if truthy.
 */
function processConditionals(template: string): string {
  const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

  return template.replace(conditionalRegex, (_match, variable, content) => {
    // Check if the content between the tags has any non-whitespace after
    // variable substitution (i.e., the variable was filled in)
    const trimmed = content.trim();

    // If the content still has unresolved {{variable}} placeholders or is empty,
    // the variable wasn't provided — remove the block
    if (!trimmed || trimmed === variable) {
      return '';
    }

    // Check if all the text (minus labels/headers) is empty
    // A block like "PARTICIPANTS:\n" with nothing after means the context was empty
    const lines = trimmed.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    const hasContent = lines.some((line: string) => {
      // Skip label-only lines (e.g., "PARTICIPANTS:", "PREVIOUS MEETING NOTES:")
      return !line.endsWith(':') && line.length > 0;
    });

    return hasContent ? content : '';
  });
}

/**
 * Replace all occurrences of a string (without regex special char issues)
 */
function replaceAll(str: string, search: string, replacement: string): string {
  return str.split(search).join(replacement);
}
