# Entomate Phase 2 - Known Limitations

## Overview
This document lists known limitations and constraints in Phase 2 features. These are not bugs but intentional scope boundaries or technical constraints to be aware of.

---

## Agents Framework

### General
- **Maximum 25 actions per run**: Guardrails limit total actions to prevent runaway automation
- **Dry-run default**: New agents start in dry-run mode and must be explicitly enabled for live actions
- **Sequential execution**: Agent steps execute sequentially, not in parallel

### Idempotency
- **Requires sourceId**: Every trigger event must have a unique `sourceId` for idempotency to work
- **Success-based dedup**: Only `status='success'` runs are considered for deduplication
- **No time window**: If an old successful run exists, it will be skipped forever (no TTL)

### Trigger Limitations
| Trigger | Limitation |
|---------|------------|
| `meeting.completed` | Only fires after explicit completion, not on duration timeout |
| `task.overdue` | Checks once when triggered, not continuously |
| `deal.stage_changed` | Requires CRM webhook integration to detect changes |

### Action Limitations
| Action | Limitation |
|--------|------------|
| `post_to_pulse` | Max 3 messages per run (configurable) |
| `sync_to_crm` | Max 10 tasks per run (configurable) |
| `extract_action_items` | Requires meeting transcript to exist |

---

## Search/RAG (Ask Assistant)

### Data Coverage
- **Meeting transcripts only**: Does not search attachments, images, or non-text content
- **Recent data only**: Embedding pipeline may have lag of up to 1 hour for new content
- **No real-time Pulse**: Pulse messages are indexed periodically, not in real-time

### Citation Requirements
- **Must have citations**: Answers without citations are rejected and return "Not found"
- **Citation verification**: System trusts that cited IDs exist; invalid IDs may slip through
- **No cross-workspace search**: Data is scoped to current user's accessible records

### Performance
- **500ms target for retrieval**: Excludes LLM generation time
- **Concurrent query limit**: May queue requests during high load
- **Large result sets**: Retrieval returns top-K chunks, may miss relevant distant matches

### Quality
- **Baseline chunking**: Fixed-size chunks may split semantic units awkwardly
- **No query expansion**: Exact keyword matching; synonyms may be missed
- **English-optimized**: Non-English content may have lower retrieval quality

---

## Knowledge Graph

### Relationship Types
Limited to predefined types:
- `meeting_about_deal`
- `meeting_about_project`
- `meeting_produced_action_item`
- `action_item_became_task`
- `task_belongs_to_project`
- `project_linked_to_deal`

Custom relationship types are not supported in Phase 2.

### Entity Scope
Supported entities:
- meeting
- task
- project
- deal
- contact
- pulse_message

Not supported:
- Documents/attachments
- Calendar events
- External contacts (not in CRM)

### Constraints
- **No cycles allowed**: Relationships are directional; circular references prevented
- **Single relationship per pair**: Only one relationship of each type between two entities
- **Soft delete**: Deleting an entity does not cascade-delete relationships (manual cleanup required)

---

## Predictive Analytics

### Deal Close Probability

**Limitations:**
- **Rule-based only**: No ML model; uses fixed scoring rules
- **CRM integration required**: Deal data must come from Logos Vision CRM
- **Limited factors**: Scores based on:
  - Deal stage
  - Recent meeting activity
  - Overdue tasks
  - Meeting sentiment
- **No historical training**: Does not learn from won/lost deal patterns

**Score interpretation:**
| Range | Meaning |
|-------|---------|
| 70-100 | High probability |
| 40-69 | Medium probability |
| 0-39 | At-risk |

### Task ETA Prediction

**Limitations:**
- **Minimum 5 completed tasks**: Historical averaging requires sample size
- **Priority-based defaults**: Falls back to fixed estimates without history
- **Single assignee workload**: Only considers open task count, not complexity
- **No external dependencies**: Does not account for blocked tasks or dependencies

**Default estimates (no history):**
| Priority | Default Days |
|----------|-------------|
| High | 3 days |
| Medium | 7 days |
| Low | 14 days |

**Confidence levels:**
| Level | Meaning |
|-------|---------|
| High | Historical data + low workload |
| Medium | Historical OR low workload |
| Low | No historical data + high workload |

---

## Database/Infrastructure

### Supabase Constraints
- **Row Level Security**: All queries filtered by authenticated user
- **Connection limits**: Shared tier has connection pooling limits
- **Storage limits**: Blob storage for transcripts has size limits

### Performance Boundaries
- **Relationship queries**: Paginated to 100 records per request
- **Prediction caching**: No automatic cache invalidation; relies on staleness checks
- **Concurrent writes**: Optimistic locking; may fail on conflicts

---

## UI/UX Limitations

### ProjectsView
- **Task ETA visible only for incomplete tasks**: Done tasks don't show predictions
- **Tooltip positioning**: Fixed position; may clip near screen edges
- **Loading states**: Individual task ETAs load independently (may flash)

### Linked Records Panel
- **Compact view only in detail pages**: List views don't show linked records
- **Click navigation**: Opening linked records navigates away from current view

### Prediction Badges
- **No real-time updates**: Refresh required to see new predictions
- **Static colors**: Thresholds (40/70) are hardcoded

---

## Integration Limitations

### Logos Vision CRM
- **Read-heavy**: Limited write capabilities in Phase 2
- **Deal sync**: One-way sync from CRM to Entomate
- **Contact matching**: Requires exact email match

### Pulse
- **Post-only**: Cannot edit or delete messages
- **Channel targeting**: Must specify channel; no smart channel selection
- **Rate limits**: Subject to Pulse API rate limits

---

## Future Improvements (Not in Phase 2)

These features are planned for future releases:

1. **ML-based predictions**: Train models on historical outcomes
2. **Custom relationship types**: User-defined relationship categories
3. **Real-time indexing**: Immediate search availability for new content
4. **Bulk agent operations**: Batch processing for efficiency
5. **Cross-workspace search**: Federated search across workspaces
6. **Dependency tracking**: Task blocking/dependency relationships
7. **Advanced chunking**: Semantic chunking for better retrieval
8. **Multi-language support**: Improved non-English handling

---

## Reporting Issues

If you encounter behavior outside these documented limitations, please report:

1. Steps to reproduce
2. Expected vs. actual behavior
3. Relevant IDs (agent_run_id, prediction_id, etc.)
4. Timestamp of occurrence

Contact: [Support channel TBD]
