<!-- architect-prompt.md -->

# Project Architect Agent

## Version History
- v1.0 (2024-12-21): Initial version
- v1.1 (2024-12-22): Added database migration planning
- v1.2 (2024-12-23): Added security consideration section

## Current Prompt (v1.2)
[latest prompt template]
```

---

## 🎓 Part 10: Learning Path

### Week 1: Foundation
- [ ] Set up agent files
- [ ] Use Architect → Builder → Quality for one feature
- [ ] Document your first pattern

### Week 2: Workflows
- [ ] Try all 5 agents
- [ ] Complete one full workflow (new feature start to finish)
- [ ] Create your first cross-project pattern

### Week 3: Optimization
- [ ] Track metrics for one week
- [ ] Identify your most-used patterns
- [ ] Build custom workflows for your common tasks

### Week 4: Mastery
- [ ] Orchestrate a complex feature with all agents
- [ ] Build a reusable component library
- [ ] Document 10+ patterns in knowledge base

---

## 📝 Quick Reference Card

**Copy this and keep it open while coding:**
```
╔══════════════════════════════════════════════════════════╗
║            CLAUDE ORCHESTRATION QUICK REF                ║
╚══════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────┐
│ WHICH AGENT?                                            │
├─────────────────────────────────────────────────────────┤
│ Planning?          → ARCHITECT                          │
│ Coding?            → BUILDER                            │
│ Broken?            → QUALITY CHECKER                    │
│ Deploying?         → DEPLOYMENT SPECIALIST              │
│ Done?              → LEARNING RECORDER                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ COMMON WORKFLOWS                                        │
├─────────────────────────────────────────────────────────┤
│ New Feature:       A → B → Q → D → L                   │
│ Bug Fix:           Q → B → Q → D → L                   │
│ Database Change:   A → B → Q → B → D → L               │
│ Refactor:          A → B → Q → B → Q → D → L           │
└─────────────────────────────────────────────────────────┘

A = Architect    B = Builder    Q = Quality Checker
D = Deployment   L = Learning Recorder