/**
 * Live agent pipeline shown in the loading bubble while Entomate AI works (EAI-04).
 * Ported from Logos AI's AgentPipeline.tsx; the tool names are Entomate's
 * (backend/services/entoAi/tools.js) and the thought list is left out until the
 * backend streams reasoning.
 *
 * Everything on it is real: the step list comes from the backend's tool_start /
 * tool_end events, so a quiet stretch reads as "Reviewing what it found", never
 * as invented activity.
 */
import { Fragment, useEffect, useState } from 'react';
import { Orb, type OrbLook } from '../ui/thinking-orbs';

export interface ToolStep {
  turn: number;
  name: string;
  status: 'running' | 'done' | 'failed';
}

export type AgentToolEvent =
  | { type: 'tool_start'; turn: number; tools: string[] }
  | { type: 'tool_end'; turn: number; tools: Array<{ name: string; ok: boolean; count?: number }> };

/** One finished tool call, as the backend's `complete` event lists it. */
export interface ToolCall {
  turn: number;
  name: string;
  ok: boolean;
  count: number;
}

/** Fold one live backend event into the step list. Pure, so it is unit-testable. */
export function applyToolEvent(steps: ToolStep[], event: { type: string; turn?: number; tools?: unknown }): ToolStep[] {
  if (event.type !== 'tool_start' && event.type !== 'tool_end') return steps;
  const e = event as AgentToolEvent;
  if (e.type === 'tool_start') {
    return [...steps, ...e.tools.map((name) => ({ turn: e.turn, name, status: 'running' as const }))];
  }
  const next = [...steps];
  for (const { name, ok } of e.tools) {
    const i = next.findIndex((s) => s.turn === e.turn && s.name === name && s.status === 'running');
    if (i >= 0) next[i] = { ...next[i]!, status: ok ? 'done' : 'failed' };
  }
  // The turn is over: a step it returned no result for must not spin forever.
  return next.map((s) => (s.turn === e.turn && s.status === 'running' ? { ...s, status: 'done' } : s));
}

const TOOL_LABELS: Record<string, string> = {
  search_meetings: 'Searching meetings',
  get_meeting: 'Reading the meeting',
  list_action_items: 'Checking action items',
  list_tasks: 'Checking tasks',
  get_task: 'Reading the task',
  list_projects: 'Checking projects',
  get_project: 'Reading the project',
  get_calendar: 'Checking the calendar',
  search_everything: 'Searching everything',
};

/** Short names for the chips under a finished answer. */
const TOOL_NOUNS: Record<string, string> = {
  search_meetings: 'Meetings',
  get_meeting: 'Meeting',
  list_action_items: 'Action items',
  list_tasks: 'Tasks',
  get_task: 'Task',
  list_projects: 'Projects',
  get_project: 'Project',
  get_calendar: 'Calendar',
  search_everything: 'Search',
};

/** Every read tool has a label (a test pins this). */
export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? `Looking up: ${name.replace(/_/g, ' ')}`;
}

export function pipelineOrb(running: string[]): OrbLook {
  return running.length > 0 ? { state: 'searching' } : { state: 'reasoning' };
}

type NodeState = 'done' | 'active' | 'pending';

interface AgentPipelineProps {
  steps: ToolStep[];
  /** The backend says the model has started writing the final answer. */
  answering?: boolean;
}

export function AgentPipeline({ steps, answering = false }: AgentPipelineProps) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // One row per tool per turn: three identical "Checking tasks" lines read like a glitch.
  const rows: Array<{ turn: number; name: string; count: number; failed: number; status: ToolStep['status'] }> = [];
  for (const s of steps) {
    let row = rows.find((r) => r.turn === s.turn && r.name === s.name);
    if (!row) rows.push((row = { turn: s.turn, name: s.name, count: 0, failed: 0, status: 'done' }));
    row.count += 1;
    if (s.status === 'failed') row.failed += 1;
    row.status = s.status === 'running' || row.status === 'running' ? 'running' : row.failed > 0 ? 'failed' : 'done';
  }

  const running = rows.filter((r) => r.status === 'running');
  // The track moves forward only, until the `answering` event says the reply is being written.
  const rounds = new Set(steps.map((s) => s.turn)).size;
  const nodes: Array<{ key: string; label: string; state: NodeState }> = [
    { key: 'question', label: 'Question', state: 'done' },
    { key: 'model', label: 'Ask Entomate', state: answering || steps.length > 0 ? 'done' : 'active' },
    { key: 'data', label: rounds > 1 ? `Your data · ${rounds} rounds` : 'Your data', state: steps.length === 0 ? 'pending' : answering ? 'done' : 'active' },
    { key: 'answer', label: 'Answer', state: answering ? 'active' : 'pending' },
  ];

  const status = running.length > 0
    ? `${toolLabel(running[0]!.name)}${running.length > 1 ? ` +${running.length - 1} more` : ''}…`
    : answering
      ? 'Writing the answer…'
      : steps.length > 0
        ? 'Reviewing what it found…'
        : 'Deciding what to look up…';

  return (
    <div className="la-pipeline" aria-label={status}>
      <div className="la-pipeline-track" aria-hidden="true">
        {nodes.map((n, i) => (
          <Fragment key={n.key}>
            {i > 0 && <span className={`la-pipeline-edge${n.state === 'active' ? ' is-flowing' : ''}`} />}
            <span className={`la-pipeline-node is-${n.state}`}>{n.label}</span>
          </Fragment>
        ))}
      </div>
      <div className="la-pipeline-status">
        <Orb {...pipelineOrb(running.map((r) => r.name))} size={20} className="la-pipeline-orb" />
        <span className="la-pipeline-text">{status}</span>
        <span className="la-pipeline-time" aria-hidden="true">{seconds}s</span>
      </div>
      {steps.length > 0 && (
        <ul className="la-pipeline-steps">
          {rows.map((r) => (
            <li key={`${r.turn}-${r.name}`} className={`la-pipeline-step is-${r.status}`}>
              <span className="la-pipeline-step-dot" aria-hidden="true" />
              <span>{toolLabel(r.name)}{r.count > 1 ? ` ×${r.count}` : ''}</span>
              {r.status !== 'running' && (
                <span className="la-pipeline-step-state">
                  {r.status === 'failed' && r.count > 1 ? `${r.failed} failed` : r.status}
                </span>
              )}
            </li>
          )).slice(-4)}
        </ul>
      )}
    </div>
  );
}

/** Chips under a finished answer: what Entomate AI looked at, and how many records came back. */
export function ToolsUsed({ calls }: { calls: ToolCall[] }) {
  const chips: Array<{ name: string; count: number; failed: boolean }> = [];
  for (const c of calls) {
    const chip = chips.find((x) => x.name === c.name);
    if (chip) {
      chip.count += c.count;
      chip.failed = chip.failed && !c.ok;
    } else {
      chips.push({ name: c.name, count: c.count, failed: !c.ok });
    }
  }
  if (!chips.length) return null;
  return (
    <ul className="la-tools-used" aria-label="Looked up">
      {chips.map((c) => (
        <li key={c.name} className={`la-tool-chip${c.failed ? ' is-failed' : ''}`} title={toolLabel(c.name)}>
          <span>{TOOL_NOUNS[c.name] ?? c.name.replace(/_/g, ' ')}</span>
          <span className="la-tool-chip-count">{c.failed ? 'failed' : c.count}</span>
        </li>
      ))}
    </ul>
  );
}
