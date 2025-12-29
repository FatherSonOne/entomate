# Changelog

All notable changes to Entomate will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2025-02-10 (Planned)

### Phase 2 Release - Agents + Search/RAG + Knowledge Graph + Predictive Analytics

### Added

#### Agents Framework
- Agent runner with idempotency, retries, and guardrails
- 4 agent templates:
  - Deal Risk Monitor
  - Meeting Outcome Processor
  - Task Auto-Assigner
  - Customer Success Coordinator
- Agent builder UI for creating custom agents
- Audit logging with `agent_runs` and `agent_run_steps` tables
- Emergency kill switch (`emergencyDisableAllAgents`)
- Spam detection (`checkSpamThreshold`)

#### Search/RAG (Ask Assistant)
- Semantic search across meetings, tasks, and messages
- Citation-required answers (no hallucinations)
- "Not found" responses when no relevant data
- Retrieval latency target: <500ms

#### Knowledge Graph
- Entity relationships table with prefixed IDs
- Relationship types: meeting→deal, meeting→project, task→project, etc.
- `LinkedRecordsPanel` UI component
- Automatic relationship creation from meeting/task workflows

#### Predictive Analytics
- Deal close probability scoring (0-100%)
- Task ETA prediction with confidence levels
- `predictions` table for storing results
- `PredictionBadge` UI components (probability, ETA)
- `useDealProbability` and `useTaskEta` hooks

#### Testing & QA
- Vitest test framework setup
- 147 unit tests covering:
  - Deal probability scoring logic
  - Task ETA prediction logic
  - Agent guardrails
  - Entity ID formatting
  - Prediction UI helpers
  - Health check utilities
- Search test questions file (25 questions)

#### Documentation
- Support runbook (`docs/phase2/SUPPORT-RUNBOOK.md`)
- Known limitations (`docs/phase2/KNOWN-LIMITATIONS.md`)
- Search test questions (`docs/phase2/search-test-questions.md`)

#### Infrastructure
- Health check utilities (`src/utils/healthCheck.ts`)
- Database migrations for new tables:
  - `relationships`
  - `predictions`
  - `agents`
  - `agent_runs`
  - `agent_run_steps`

### Changed
- `ProjectsView` now displays Task ETA predictions on task rows
- `MeetingsView` now shows linked records panel
- Meeting and project services now create knowledge graph relationships

### Security
- Row Level Security (RLS) on all new tables
- Guardrails prevent agent spam (max actions per run)
- Agent dry-run mode by default

---

## [1.0.0] - 2024-XX-XX

### Phase 1 Release

#### Added
- Meeting management (create, edit, delete meetings)
- Meeting transcription and sentiment analysis
- Action item extraction from meetings
- Project management with tasks
- Task status tracking (todo, in_progress, done)
- Supabase integration for data persistence
- React frontend with Tailwind CSS

---

## Release Notes Format

### Version Numbering
- **Major (X.0.0)**: Breaking changes or major feature releases
- **Minor (0.X.0)**: New features, backward compatible
- **Patch (0.0.X)**: Bug fixes, backward compatible

### Pre-release Tags
- `-rc1`, `-rc2`: Release candidates
- `-beta1`: Beta releases
- `-alpha1`: Alpha releases

### Example
```
v2.0.0-rc1  → Release candidate 1
v2.0.0      → Production release
v2.0.1      → Patch release
v2.1.0      → Minor feature release
```
