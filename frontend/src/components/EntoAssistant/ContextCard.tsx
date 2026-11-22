/**
 * ContextCard — the panel's statement of what it is looking at, in two densities.
 *
 * U4's pre-flight found that the section context was never missing: `getSectionSummary()`
 * already computes live per-section facts across 26 sections, and the panel already rendered
 * them. It rendered them as a single ` · `-joined string inside a 36px strip with
 * `text-overflow: ellipsis` — so the moat was computed and then clipped at the last inch.
 * This component stops discarding it.
 *
 *   variant="bar"   a compact command strip that names the active workspace and its live
 *                   summary. Used once a conversation is running, where the answer deserves
 *                   the vertical space.
 *   variant="hero"  the empty state. The same facts, but as discrete units that cannot be
 *                   truncated, plus the line that only a context-aware assistant can honestly
 *                   print: which datasets it actually has loaded for this page.
 *
 * The scope line is derived from the LIVE context object rather than from a static per-page
 * map, so it describes exactly what was handed to the model. If a later sweep attaches a new
 * dataset, this says so with no edit here; if a fetch fails and a dataset arrives empty, this
 * stops claiming it. A hardcoded list would keep promising data the model never received.
 */
import React from 'react';
/** The `data` object a section loader returned; arrays are the datasets. */
type SectionData = Record<string, unknown>;

/** Human-readable names for the datasets Entomate's section loaders return (entoAssistantService DATA_LOADERS). */
const DATASET_LABELS: Record<string, string> = {
  overdue: 'overdue tasks',
  meetings: 'meetings',
  events: 'calendar',
  projects: 'projects',
  tasks: 'tasks',
  workflows: 'workflows',
  automations: 'automations',
  agents: 'agents',
};

/**
 * Which datasets are actually loaded, in the order DATASET_LABELS declares them.
 *
 * `orgEntitledPages` is an array on the context too, but it is an entitlement list, not a
 * dataset — including it would tell the user the AI "can see pages", which is meaningless.
 * Keying off DATASET_LABELS rather than off Object.keys is what excludes it, and it also
 * gives a stable order instead of whatever order the keys happen to be assigned in.
 */
export function getLoadedDatasets(context: SectionData): string[] {
  return Object.entries(DATASET_LABELS)
    .filter(([key]) => {
      const value = context[key];
      return Array.isArray(value) && value.length > 0;
    })
    .map(([, label]) => label);
}

/**
 * Split one fact into a leading figure and its label — "5 open" → 5 / open,
 * "$12,340 this month" → $12,340 / this month.
 *
 * Facts that do not start with a figure ("All clear today", "No open cases") are a real and
 * intended output of getSectionSummary, so they degrade to a label with no figure rather than
 * being forced into a shape they do not have.
 */
function splitFact(fact: string): { figure: string | null; label: string } {
  const match = /^(\$?[\d,]+(?:\.\d+)?\+?%?h?)\s+(.+)$/.exec(fact);
  return match ? { figure: match[1]!, label: match[2]! } : { figure: null, label: fact };
}

interface ContextCardProps {
  variant: 'bar' | 'hero';
  /** Display name for the current page, e.g. "Cases". */
  sectionLabel: string;
  /** The ` · `-joined summary from getSectionSummary(). May be empty. */
  sectionSummary: string;
  /** The section data the panel loaded — the source of the scope line. */
  context: SectionData;
}

const ContextCard: React.FC<ContextCardProps> = ({
  variant,
  sectionLabel,
  sectionSummary,
  context,
}) => {
  // The inverse of the join getSectionSummary performs. Not free-text parsing: one function
  // in this repo produces this string, with a delimiter none of its parts contain.
  const facts = sectionSummary ? sectionSummary.split(' · ') : [];

  if (variant === 'bar') {
    return (
      <div
        className="la-context-bar la-context-bar-command"
        role="region"
        aria-label="Current workspace context"
      >
        <div className="la-context-command-line">
          <span className="la-context-eyebrow">Working in</span>
          <span className="la-section-chip">{sectionLabel}</span>
        </div>
        {sectionSummary && (
          <div className="la-context-command-line la-context-command-summary">
            <span className="la-context-eyebrow">Live summary</span>
            <span className="la-section-summary">{sectionSummary}</span>
          </div>
        )}
      </div>
    );
  }

  const datasets = getLoadedDatasets(context);

  return (
    <div className="la-context-bar la-context-bar-hero">
      <div className="la-context-hero-head">
        <span className="la-section-chip">{sectionLabel}</span>
      </div>

      {facts.length > 0 && (
        <div className="la-context-facts">
          {facts.map((fact) => {
            const { figure, label } = splitFact(fact);
            return (
              <div className="la-context-fact" key={fact}>
                {figure && <span className="la-context-fact-figure">{figure}</span>}
                <span className="la-context-fact-label">{label}</span>
              </div>
            );
          })}
        </div>
      )}

      {datasets.length > 0 && (
        <p className="la-context-scope">
          <span className="la-context-scope-lead">Looking at</span>{' '}
          {formatList(datasets)}
        </p>
      )}
    </div>
  );
};

/** "a, b and c" — Intl.ListFormat is not safe to assume across this app's browser floor. */
function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export default ContextCard;
