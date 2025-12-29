# Development Metrics

## Week of [date]

### Speed
- Features completed: X
- Bugs fixed: X
- Average feature time: X hours

### Quality
- Bugs introduced: X
- Deployment failures: X
- Rollbacks needed: X

### Learning
- New patterns documented: X
- Reused patterns: X
- Team knowledge entries: X
```

**Use LEARNING RECORDER agent weekly to update this**

---

## 🚀 Part 8: Getting Started TODAY

### Your First Orchestrated Session (Step-by-Step)

**Right now, follow these exact steps:**

**Step 1: Set Up Your Agent System** (5 minutes)
1. Open your project folder
2. Create `.claude/agents/` folder
3. Create these 5 files:
   - `architect-prompt.md`
   - `builder-prompt.md`
   - `quality-prompt.md`
   - `deploy-prompt.md`
   - `learning-prompt.md`
4. Copy the prompt templates from Part 2 into each file

**Step 2: Choose Your First Task** (2 minutes)
Pick ONE thing you want to build today:
- [ ] New feature in CRM
- [ ] New feature in PULSE
- [ ] Fix existing bug
- [ ] Refactor old code

**Step 3: Start with ARCHITECT** (10 minutes)
1. Open new Claude chat
2. Use the Architect prompt template
3. Fill in your specific task
4. Get the complete plan
5. Save plan to a file: `/docs/plans/[feature-name]-plan.md`

**Step 4: Execute with BUILDER** (varies)
1. For each step in the plan:
   - New Claude message
   - Use Builder prompt template
   - Reference the plan step number
   - Get code for ONE file
   - Save to project

**Step 5: Validate with QUALITY CHECKER** (5 min per file)
1. After each file from Builder:
   - Same or new Claude chat
   - Use Quality Checker prompt
   - Paste the code you just built
   - Fix any issues found

**Step 6: Deploy with DEPLOYMENT SPECIALIST** (5 minutes)
1. When feature is complete:
   - Use Deploy prompt template
   - Get exact Git commands
   - Execute commands in terminal
   - Verify deployment

**Step 7: Learn with LEARNING RECORDER** (5 minutes)
1. After deployment:
   - Use Learning prompt template
   - Document what you built
   - Add to knowledge base

---

## 💡 Part 9: Pro Tips for Orchestration

### Tip 1: Context Preservation
**Problem:** Claude forgets earlier decisions
**Solution:** Always reference previous agent outputs
```
BUILDER:
"According to the Architect's plan (Step 3), build the TaskCard component.

Architect said:
- Use glassmorphism styling
- Include task status indicator  
- Make it draggable for Kanban view

[continue with builder prompt]"
```

### Tip 2: Batch Similar Tasks
**Problem:** Too many back-and-forth messages
**Solution:** Group similar work together
```
BUILDER:
"Build these 3 related service functions in one file:

1. createDonation()
2. updateDonation()
3. deleteDonation()

All should follow the same error handling pattern from clientService.ts"
```

### Tip 3: Maintain State Between Sessions
**Problem:** Can't remember what you were working on
**Solution:** Use Learning Recorder to create session notes
```
LEARNING RECORDER (end of session):
"Create end-of-day summary:

Completed today:
- [list finished items]

In progress (pick up next time):
- [current work state]
- [what to do next]

Blockers:
- [anything preventing progress]

Save to: /docs/sessions/2024-12-21.md"