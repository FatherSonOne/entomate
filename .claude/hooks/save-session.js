#!/usr/bin/env node
/**
 * Stop hook — summarizes the session and writes it to the Obsidian vault.
 *
 * Reads hook input JSON from stdin (session_id, transcript_path, cwd,
 * stop_hook_active). Pulls the JSONL transcript, asks Claude Haiku to
 * produce a structured session note, writes it to:
 *   F:/Obsidian/Entomate/Sessions/YYYY-MM-DD <slug>.md
 *
 * Skips trivial sessions, never blocks Stop, never throws.
 *
 * Env vars:
 *   ANTHROPIC_API_KEY     — required to call Haiku for the summary.
 *   DISABLE_SESSION_SAVE  — set to "1" to disable the hook entirely.
 */

const fs = require('fs');
const path = require('path');

const VAULT_SESSIONS = 'F:/Obsidian/Entomate/Sessions';
const MODEL = 'claude-haiku-4-5-20251001';
const MIN_TRANSCRIPT_BYTES = 2000;
const MIN_EXCHANGES = 2;
const MAX_CONVERSATION_CHARS = 60000;

async function main() {
  if (process.env.DISABLE_SESSION_SAVE === '1') return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    log('ANTHROPIC_API_KEY not set; skipping');
    return;
  }

  const input = readStdinJson();
  if (!input) return;
  if (input.stop_hook_active) return;

  const transcriptPath = input.transcript_path;
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return;
  if (fs.statSync(transcriptPath).size < MIN_TRANSCRIPT_BYTES) return;

  const conversation = extractConversation(transcriptPath);
  if (conversation.exchanges < MIN_EXCHANGES) return;

  const summary = await summarize(conversation.text, apiKey);
  if (!summary) return;

  const parsed = parseSummary(summary);
  if (!parsed) return;

  writeNote(parsed, input.session_id);
}

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    log(`stdin parse failed: ${err.message}`);
    return null;
  }
}

function extractConversation(transcriptPath) {
  const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  const out = [];
  let exchanges = 0;

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }

    if (entry.type === 'user' && entry.message?.content) {
      const text = stringifyContent(entry.message.content);
      if (text && !text.startsWith('<system-reminder>') && !text.startsWith('<command-')) {
        out.push(`USER: ${text.slice(0, 2000)}`);
        exchanges++;
      }
    } else if (entry.type === 'assistant' && entry.message?.content) {
      const text = (entry.message.content || [])
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');
      if (text) out.push(`ASSISTANT: ${text.slice(0, 2000)}`);
    }
  }

  return { text: out.join('\n\n').slice(0, MAX_CONVERSATION_CHARS), exchanges };
}

function stringifyContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map(c => (typeof c === 'string' ? c : c.type === 'text' ? c.text : ''))
    .filter(Boolean)
    .join('\n');
}

async function summarize(conversation, apiKey) {
  const prompt = `Below is a Claude Code session transcript from work on the Entomate project. Produce a session note for the project's Obsidian vault.

If the session was trivial (a quick question with no real work, no decisions, no code changes), output exactly:
SKIP

Otherwise output EXACTLY this format and nothing else:

SLUG: <3-6 word title in Title Case, e.g. "Recall Webhook Signature Bug" or "Hero Image Redesign Plan">

# <Topic title — same as the slug or close>

## Goal
<one or two sentences describing what the user wanted>

## What Happened
<concise bullets covering: key actions taken, files modified (use [path](path) markdown links), commands run, decisions made>

## Key Decisions / Learnings
<bullets — only meaningful ones worth a future session knowing about. If none, write a single line: \`—\`>

## What's Next
<bullets for follow-up work. If none, write a single line: \`—\`>

Be concrete. Reference specific files, services, or decisions. Skip pleasantries and meta-commentary about the conversation itself.

Transcript:

${conversation}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      log(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch (err) {
    log(`summarize failed: ${err.message}`);
    return null;
  }
}

function parseSummary(text) {
  const trimmed = text.trim();
  if (trimmed === 'SKIP' || /^SKIP\b/.test(trimmed)) return null;

  const slugMatch = trimmed.match(/^SLUG:\s*(.+)$/m);
  if (!slugMatch) return null;

  const slug = slugMatch[1]
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 60);

  if (!slug) return null;

  const body = trimmed.replace(/^SLUG:.*\n+/m, '').trim();
  if (!body) return null;

  return { slug, body };
}

function writeNote({ slug, body }, sessionId) {
  if (!fs.existsSync(VAULT_SESSIONS)) {
    fs.mkdirSync(VAULT_SESSIONS, { recursive: true });
  }

  const date = new Date().toISOString().slice(0, 10);
  let filename = `${date} ${slug}.md`;
  let filepath = path.join(VAULT_SESSIONS, filename);

  if (fs.existsSync(filepath)) {
    const time = new Date().toISOString().slice(11, 16).replace(':', '');
    filename = `${date} ${slug} (${time}).md`;
    filepath = path.join(VAULT_SESSIONS, filename);
  }

  const frontmatter = `---
tags:
  - session
  - auto-saved
created: '${date}'
type: session
session_id: ${sessionId || 'unknown'}
---

`;

  fs.writeFileSync(filepath, frontmatter + body + '\n');
  log(`wrote ${filename}`);
}

function log(msg) {
  process.stderr.write(`[save-session] ${msg}\n`);
}

main().catch(err => {
  log(`fatal: ${err.message}`);
  process.exit(0);
});
