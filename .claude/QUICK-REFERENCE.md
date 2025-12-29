# Claude Code Quick Reference - Entomate Project

## Agent Selection (Instant Decision)

```
Planning?          → ARCHITECT
Coding?            → BUILDER
Broken/reviewing?  → QUALITY CHECKER
Deploying?         → DEPLOYMENT SPECIALIST
Done/documenting?  → LEARNING RECORDER
```

## Workflow Shortcuts

```
New Feature:       A → B → Q → D → L
Bug Fix:           Q → B → Q → D → L
Database Change:   A → B → [PAUSE] → Q → B → D → L
Refactor:          A → B → Q → B → Q → D → L

A = Architect    B = Builder    Q = Quality Checker
D = Deployment   L = Learning Recorder
```

## Trigger Words

| Agent | Keywords |
|-------|----------|
| ARCHITECT | plan, design, new feature, refactor, schema |
| BUILDER | build, create, implement, code, write |
| QUALITY | error, bug, broken, fix, review, check |
| DEPLOY | deploy, push, commit, git, production |
| LEARNING | document, record, pattern, learned |

## SQL Protocol

**ALWAYS PAUSE** for database changes:
```
1. Write SQL script
2. Say: "Please run this SQL in Supabase"
3. Wait for confirmation
4. Continue with type updates
```

## File Locations

```
CLAUDE.md                    # Project memory (main)
.claude/agents/              # Agent prompts
.claude/workflows/           # Workflow definitions
.claude/agent-switching-rules.md  # Switching logic
.claude/memory-entities.json # MCP memory data
.mcp.json                    # MCP server config
```

## Key Commands

```bash
# Development
npm run dev              # Start backend
cd frontend && npm run dev  # Start frontend

# Testing
artillery run tests/smoke-test.yml
artillery run tests/load-test.yml

# Docker
docker-compose up -d
docker-compose logs -f
```

## Tech Stack Reminder

- **Backend:** Node.js, Express, Supabase
- **Frontend:** React, Vite
- **Database:** PostgreSQL (Supabase)
- **AI:** OpenAI/Gemini for agents
- **Deploy:** Docker, AWS ECS/Fargate

## Context Loading

Start each session by checking:
1. `CLAUDE.md` - Project context and patterns
2. Recent git commits
3. Current week's docs in `entomate-docs/Phase 5/`
