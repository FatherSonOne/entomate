# AI Explainability Layer - Quick Start Guide

**Status:** ✅ Fully Implemented & Integrated
**Last Updated:** 2026-01-24

---

## 🎉 What's Been Completed

### ✅ Backend (100%)
1. **ExplainabilityService.js** - Core AI explanation engine
2. **Database Migration** - `agent_explanations` table created with RLS
3. **API Integration** - Automatic explanation generation on agent execution
4. **API Endpoint** - `GET /api/agents/executions/:id/explanation`

### ✅ Frontend (100%)
1. **6 React Components** - Complete UI component library
2. **CSS Styling** - Responsive, accessible, dark mode support
3. **API Client** - `api.agents.getExplanation(executionId)`
4. **UI Integration** - Agents page now shows explanations automatically

---

## 🚀 How to Test

### Step 1: Verify Backend is Running

```bash
# Make sure your backend is running
cd backend
npm start
```

### Step 2: Verify Database Migration

The migration should already be complete (you ran it). Verify with:

```sql
-- In Supabase SQL Editor
SELECT * FROM agent_explanations LIMIT 1;
```

### Step 3: Navigate to Agents Page

1. Open your Entomate app
2. Go to the **Agents** page
3. You should see your existing agents

### Step 4: Trigger an AI Agent

#### Option A: Use Existing Agent
1. Select an agent from the list
2. Look at the "Recent Executions" section
3. If explanations exist, they'll load automatically

#### Option B: Create New Agent & Execute
1. Click "Create from Template"
2. Select any template (e.g., "Assignment Agent")
3. Deploy the agent
4. Manually trigger it or wait for automatic trigger
5. View the execution with explanation in "Recent Executions"

---

## 📸 What You'll See

### Before Explanation Loads:
```
✓ SUCCESS    2:30 PM
Trigger: deal_created
Decisions: 2 actions taken

[Loading explanation... ⟳]
```

### After Explanation Loads:
```
✓ SUCCESS    2:30 PM
Trigger: deal_created
Decisions: 2 actions taken

┌─────────────────────────────────────────┐
│ ✅ Recommended: John Doe    87% 🟢     │
│                                         │
│ Top Factors:                            │
│  • Skill Match: 90%    ✓ Has API...   │
│  • Workload: 85%       ✓ 3 tasks...   │
│  • Availability: 85%   ✓ Available    │
│                                         │
│ [✓ Accept] [↻ Change] [▼ Show More]   │
└─────────────────────────────────────────┘
```

### When Expanded:
```
All Decision Factors (Weighted):

1. Skill Match (40% weight)        90/100 ✓
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   • Matched 4/5 required skills
   • API integration: 5 years experience

2. Current Workload (30% weight)   85/100 ✓
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   • Active tasks: 3 vs team avg: 5
   • Estimated capacity: 15 hours

[... and more]

Alternatives Considered:
2. Jane Smith                      72/100
   Why lower: Higher workload (7 tasks)
   [Select Jane Instead]
```

---

## 🎯 How It Works

### Automatic Flow

```mermaid
User → Triggers Agent → Agent Executes → Decision Made
                                              ↓
                                    ExplainabilityService
                                              ↓
                                    Analyzes Factors:
                                    • Skill Match (90%)
                                    • Workload (85%)
                                    • Availability (85%)
                                    • Performance (92%)
                                              ↓
                                    Calculates Confidence: 87%
                                              ↓
                                    Finds Alternatives
                                              ↓
                                    Stores in Database
                                              ↓
                                    Returns to Frontend
                                              ↓
                                    ExplanationCard Displays
```

### What Gets Explained

The system currently supports **4 agent types**:

1. **Assignment Agent**
   - Skill Match
   - Current Workload
   - Availability
   - Past Performance

2. **Priority Agent**
   - Business Impact
   - Urgency
   - Effort Estimation
   - Risk Level

3. **Deadline Agent**
   - Task Complexity
   - Team Velocity
   - Buffer Calculation
   - Business Constraints

4. **Follow-up Agent**
   - Follow-up Likelihood
   - Context Importance
   - Time Sensitivity
   - Relationship Health

---

## 🔧 Integration Points

### Where Explanations Appear

**Current:**
- ✅ Agents Page → Recent Executions section

**Potential Future Locations:**
- Tasks Page (when AI assigns tasks)
- Meetings Page (when AI detects follow-ups)
- Projects Page (when AI sets priorities/deadlines)
- Dashboard (when AI makes recommendations)

### How to Add to Other Pages

```jsx
import ExplanationCard from '../components/explainability/ExplanationCard';

// In your component:
const [explanation, setExplanation] = useState(null);

// Fetch explanation
useEffect(() => {
  if (executionId) {
    api.agents.getExplanation(executionId)
      .then(response => setExplanation(response.data))
      .catch(err => console.log('No explanation available'));
  }
}, [executionId]);

// Display
{explanation && (
  <ExplanationCard
    recommendation={agentResult.recommendation}
    explanation={explanation}
    onAccept={handleAccept}
    onChangeRecommendation={handleChange}
  />
)}
```

---

## 🧪 Testing Checklist

### Basic Functionality
- [ ] Agents page loads without errors
- [ ] Can select an agent
- [ ] Recent executions are displayed
- [ ] Explanations load automatically (if available)
- [ ] "Show More Details" expands the explanation
- [ ] Progress bars display correctly
- [ ] Confidence badge shows correct color (🟢🟡🔴)

### Explanation Quality
- [ ] Top 3 factors are relevant
- [ ] Natural language makes sense
- [ ] Scores seem reasonable (0-100)
- [ ] Alternatives are ranked correctly
- [ ] "Why lower" explanations are clear

### UI/UX
- [ ] Card is readable and well-styled
- [ ] Expand/collapse animation is smooth
- [ ] Mobile responsive (test on small screen)
- [ ] Colors match Entomate design system
- [ ] Loading states show while fetching

### Edge Cases
- [ ] Works when no explanation available (degrades gracefully)
- [ ] Works when only 1 factor available
- [ ] Works when no alternatives available
- [ ] Handles API errors gracefully

---

## 🐛 Troubleshooting

### "No explanation available"

**Cause:** The execution doesn't have a stored explanation yet.

**Solutions:**
1. Trigger a new agent execution (old ones won't have explanations)
2. Check if ExplainabilityService is generating explanations (backend logs)
3. Verify database migration was successful

### Explanation not loading

**Check:**
```bash
# Backend logs
# Should see: "[Explainability] Generating explanation for: assignment"
```

**Verify API:**
```bash
curl http://localhost:3000/api/agents/executions/{execution-id}/explanation
```

### Factors showing low scores

**This is normal!** Low scores mean:
- Skill match is weak
- Workload is high
- Availability is limited

The AI is being transparent about limitations.

### No alternatives showing

**Possible reasons:**
1. Only 1 option available (no team members to choose from)
2. Agent type doesn't support alternatives yet
3. Alternative calculation failed (check backend logs)

---

## 📊 Success Metrics to Track

After 1 week of use, check:

### User Engagement
- **Explanation View Rate:** What % of executions have explanations viewed?
- **Expansion Rate:** What % of users click "Show More Details"?
- **Alternative Selection:** Do users ever choose alternatives?

### Trust & Quality
- **Override Rate:** Did it decrease from baseline?
- **User Feedback:** Do explanations make sense?
- **Confidence Accuracy:** Do high-confidence recommendations succeed more?

### Technical Performance
- **Generation Time:** How long to create explanations? (Target: <200ms)
- **API Success Rate:** % of successful explanation retrievals
- **Error Rate:** Any errors in production?

---

## 🎨 Customization Options

### Adjust Factor Weights

Edit [backend/services/explainability/ExplainabilityService.js](backend/services/explainability/ExplainabilityService.js:86-95):

```javascript
assignment: [
  { name: 'Skill Match', weight: 0.40 },      // Currently 40%
  { name: 'Current Workload', weight: 0.30 }, // Currently 30%
  { name: 'Availability', weight: 0.20 },     // Currently 20%
  { name: 'Past Performance', weight: 0.10 }  // Currently 10%
]
```

### Adjust Confidence Calculation

Edit [backend/services/explainability/ExplainabilityService.js](backend/services/explainability/ExplainabilityService.js:924):

```javascript
// Penalty if top alternative is close
const separationPenalty = Math.max(0, (15 - separation) * 2);
//                                   ↑ Increase this to be more cautious
```

### Change UI Colors

Edit [frontend/src/styles/explainability.css](frontend/src/styles/explainability.css:80):

```css
.confidence-badge.high {
  background: #D1FAE5;  /* Light green */
  color: #065F46;       /* Dark green */
}
```

---

## 🚀 Next Steps

### Immediate (This Week)
1. ✅ Database migration - DONE
2. ✅ UI integration - DONE
3. 🔲 Test with real agent executions
4. 🔲 Gather initial user feedback

### Short Term (Next 2 Weeks)
1. Enhance factor calculations with real data
2. Improve natural language generation
3. Add more alternative recommendation logic
4. Integrate into other pages (Tasks, Projects)

### Long Term (Next Month)
1. Machine learning for factor weight optimization
2. User feedback loop to improve recommendations
3. Explanation history and analytics
4. Custom factor definitions per team

---

## 📚 Additional Resources

- **Design Document:** [docs/AI-EXPLAINABILITY-LAYER-DESIGN.md](AI-EXPLAINABILITY-LAYER-DESIGN.md)
- **Implementation Summary:** [docs/AI-EXPLAINABILITY-IMPLEMENTATION-SUMMARY.md](AI-EXPLAINABILITY-IMPLEMENTATION-SUMMARY.md)
- **Database Migration:** [docs/migrations/001_agent_explanations.sql](migrations/001_agent_explanations.sql)
- **Backend Service:** [backend/services/explainability/ExplainabilityService.js](../backend/services/explainability/ExplainabilityService.js)
- **Frontend Components:** [frontend/src/components/explainability/](../frontend/src/components/explainability/)

---

## ✨ You're All Set!

The AI Explainability Layer is **fully implemented and integrated**.

Just trigger an agent execution and watch the explanations appear automatically in the "Recent Executions" section of the Agents page!

**Happy explaining! 🎉**
