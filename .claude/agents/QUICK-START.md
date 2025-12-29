# Quick Orchestration Reference

## When to Use Which Agent:

Planning something new? → Architect
Building code? → Builder  
Code not working? → Quality Checker
Ready to deploy? → Deployment Specialist
Finished a task? → Learning Recorder

## Common Workflows:

1. New Feature: Architect → Builder → Quality → Deploy → Learning
2. Bug Fix: Quality → Builder → Quality → Deploy → Learning
3. Database Change: Architect → Builder → Quality → Builder → Deploy → Learning
```

---

## 🎯 Part 5: Real-World Examples for Your Projects

### Example 1: Adding AI Chat to PULSE

**Agent Orchestration Sequence:**

**SESSION START**
```
ARCHITECT:
"I need to add an AI-powered chat feature to PULSE app that:
- Uses Google Gemini API
- Stores messages in Supabase
- Shows real-time chat history
- Has a modern UI matching our gradient mesh design"
```

**↓ Get implementation plan ↓**
```
BUILDER (Step 1 - Database):
"Following the architect's plan step 1, create the Supabase table for chat messages"
```

**↓ Get SQL schema ↓**
```
QUALITY CHECKER:
"Review this chat messages schema: [paste schema]
Check for: proper indexing, RLS policies, timestamp handling"
```

**↓ Get validation ↓**
```
BUILDER (Step 2 - Service):
"Following the architect's plan step 2, create the chatService.ts file"
```

**↓ Get service code ↓**
```
QUALITY CHECKER:
"Review this chat service: [paste service code]
Check for: error handling, type safety, real-time subscription logic"
```

**↓ Get fixes if needed ↓**
```
BUILDER (Step 3 - Component):
"Following the architect's plan step 3, create AIChatPanel.tsx component"
```

**↓ Get React component ↓**
```
QUALITY CHECKER:
"Review this chat component: [paste component]
Check for: accessibility, responsive design, loading states"
```

**↓ Get improvements ↓**
```
DEPLOYMENT SPECIALIST:
"I've completed the AI chat feature. Ready to deploy."
```

**↓ Get deployment steps ↓**
```
LEARNING RECORDER:
"Document the AI chat implementation including:
- Gemini API integration pattern
- Real-time chat pattern with Supabase
- UI component structure"
```

**↓ Get documentation ↓**

**SESSION END**

---

### Example 2: Fixing a Bug in CRM

**Scenario:** Volunteer map not displaying locations
```
QUALITY CHECKER:
"The VolunteersMap component isn't showing markers. Console error:
'Cannot read property lat of undefined'

Code:
[paste VolunteersMap.tsx]"
```

**↓ Get diagnosis ↓**
```
BUILDER:
"Fix the VolunteersMap component to handle:
- Volunteers without location data
- Invalid coordinate formats
- Loading states while geocoding"
```

**↓ Get fixed code ↓**
```
QUALITY CHECKER:
"Verify this fix handles edge cases:
[paste fixed code]

Test scenarios:
- Volunteer with no address
- Volunteer with partial address
- Volunteer with complete address"
```

**↓ Get validation ↓**
```
DEPLOYMENT SPECIALIST:
"Deploy this bug fix to production"
```

**↓ Get commands ↓**
```
LEARNING RECORDER:
"Document this location data handling pattern for future map components"
```

---

## 🔧 Part 6: Advanced Orchestration Patterns

### Pattern 1: Continuous Improvement Loop

**Set up at end of each development session:**
```
LEARNING RECORDER:
"Review today's code session:

Built: [list features]
Solved: [list problems]
Patterns used: [list approaches]

Task: Extract reusable patterns and add to:
1. /docs/PATTERNS.md
2. /docs/COMMON-ISSUES.md
3. Update Tech Stack Reference if needed"
```

**This creates a knowledge base that grows smarter over time** ✨

### Pattern 2: Cross-Project Learning

**When working on both CRM and PULSE:**
```
ARCHITECT:
"I built [feature] in CRM. How can I apply this same pattern to PULSE?

CRM implementation:
[describe approach]

PULSE requirements:
[describe what PULSE needs]

Task: Create a reusable pattern that works for both projects"
```

### Pattern 3: Pre-Deployment Checklist

**Before any deployment, run this sequence:**
```
QUALITY CHECKER:
"Run pre-deployment checklist:

Changes:
[list modified files]

Verify:
✓ TypeScript builds without errors
✓ No console.errors in code
✓ Environment variables documented
✓ Database migrations tested
✓ RLS policies secure
✓ Mobile responsive
✓ Loading states present
✓ Error handling complete

Report any issues found."