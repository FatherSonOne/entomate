# Search/RAG Test Questions
Phase 2 QA - Search Retrieval Accuracy Tests

## Purpose
These 25 questions test the RAG system's ability to:
1. Find relevant context from meetings + CRM data
2. Find relevant context from meetings + Pulse data
3. Correctly return "Not found" when no relevant data exists

## Test Format
Each question includes:
- **Question**: The user query
- **Expected Result**: found | not_found
- **Expected Source**: meeting | task | deal | message | none
- **Notes**: Additional context for evaluation

---

## Questions Requiring Meeting + CRM Context (10)

### Q1
- **Question**: "What was discussed about the Johnson deal in last week's meetings?"
- **Expected Result**: found
- **Expected Source**: meeting
- **Notes**: Should cite meeting transcript with deal context

### Q2
- **Question**: "Which tasks were assigned during the quarterly planning meeting?"
- **Expected Result**: found
- **Expected Source**: meeting, task
- **Notes**: Should cite action items from meeting

### Q3
- **Question**: "What's the current status of the Acme Corp proposal?"
- **Expected Result**: found
- **Expected Source**: deal
- **Notes**: Should cite CRM deal stage + meeting mentions

### Q4
- **Question**: "Who is responsible for the client onboarding tasks?"
- **Expected Result**: found
- **Expected Source**: task
- **Notes**: Should cite task assignees

### Q5
- **Question**: "What concerns were raised about the budget in the finance review?"
- **Expected Result**: found
- **Expected Source**: meeting
- **Notes**: Should cite meeting sentiment/transcript

### Q6
- **Question**: "When is the deadline for the marketing campaign deliverables?"
- **Expected Result**: found
- **Expected Source**: task
- **Notes**: Should cite task due dates

### Q7
- **Question**: "What follow-ups were agreed upon with Sarah from TechStart?"
- **Expected Result**: found
- **Expected Source**: meeting
- **Notes**: Should cite action items linked to contact

### Q8
- **Question**: "How much is the potential value of deals in the proposal stage?"
- **Expected Result**: found
- **Expected Source**: deal
- **Notes**: Should cite deal values and stages

### Q9
- **Question**: "What blockers were identified for the product launch?"
- **Expected Result**: found
- **Expected Source**: meeting, task
- **Notes**: Should cite meeting discussion + blocked tasks

### Q10
- **Question**: "Which high-priority tasks are overdue this week?"
- **Expected Result**: found
- **Expected Source**: task
- **Notes**: Should cite tasks with priority + due date

---

## Questions Requiring Meeting + Pulse Context (10)

### Q11
- **Question**: "What updates were shared in the team channel about the release?"
- **Expected Result**: found
- **Expected Source**: message
- **Notes**: Should cite Pulse messages about releases

### Q12
- **Question**: "Did anyone mention the server outage in team discussions?"
- **Expected Result**: found
- **Expected Source**: message
- **Notes**: Should cite relevant Pulse threads

### Q13
- **Question**: "What was the team's reaction to the new feature announcement?"
- **Expected Result**: found
- **Expected Source**: message
- **Notes**: Should cite team reactions/sentiment

### Q14
- **Question**: "Who posted about the customer feedback in Pulse?"
- **Expected Result**: found
- **Expected Source**: message
- **Notes**: Should cite author + message content

### Q15
- **Question**: "What decisions were made in the #engineering channel?"
- **Expected Result**: found
- **Expected Source**: message
- **Notes**: Should cite decision-related messages

### Q16
- **Question**: "Were there any meeting notes shared in Pulse this month?"
- **Expected Result**: found
- **Expected Source**: message, meeting
- **Notes**: Should cite shared meeting summaries

### Q17
- **Question**: "What questions were raised about the API integration?"
- **Expected Result**: found
- **Expected Source**: message
- **Notes**: Should cite Q&A threads

### Q18
- **Question**: "Who mentioned needing help with the data migration?"
- **Expected Result**: found
- **Expected Source**: message
- **Notes**: Should cite help requests

### Q19
- **Question**: "What announcements were made about the company retreat?"
- **Expected Result**: found
- **Expected Source**: message
- **Notes**: Should cite announcement messages

### Q20
- **Question**: "Were there any urgent messages about the deadline change?"
- **Expected Result**: found
- **Expected Source**: message
- **Notes**: Should cite urgent/deadline messages

---

## Questions That Should Return "Not Found" (5)

### Q21
- **Question**: "What is the capital of France?"
- **Expected Result**: not_found
- **Expected Source**: none
- **Notes**: General knowledge question - no relevant business context

### Q22
- **Question**: "What did we discuss with XYZ Corp in 2019?"
- **Expected Result**: not_found
- **Expected Source**: none
- **Notes**: Data outside retention window

### Q23
- **Question**: "What's the weather forecast for next week?"
- **Expected Result**: not_found
- **Expected Source**: none
- **Notes**: Non-business query

### Q24
- **Question**: "Show me the deleted draft proposal for Project Alpha"
- **Expected Result**: not_found
- **Expected Source**: none
- **Notes**: Deleted/non-existent data

### Q25
- **Question**: "What were the meeting notes from the fictional company TestCo?"
- **Expected Result**: not_found
- **Expected Source**: none
- **Notes**: Non-existent entity

---

## Scoring Criteria

### Pass Criteria
- **Found questions (Q1-Q20)**: Answer must include at least one valid citation
- **Not found questions (Q21-Q25)**: Must return explicit "Not found" or equivalent

### Anti-Hallucination Check
- All cited sources must exist in the database
- Cited text must support the claim
- No fabricated entity names or dates

### Latency Target
- Retrieval time < 500ms (excluding LLM generation)

---

## Test Results Template

| Question | Expected | Actual | Citation Valid | Latency (ms) | Pass |
|----------|----------|--------|----------------|--------------|------|
| Q1       | found    |        |                |              |      |
| Q2       | found    |        |                |              |      |
| ...      |          |        |                |              |      |
| Q25      | not_found|        |                |              |      |

**Total Pass Rate**: ___ / 25
**Anti-Hallucination Pass**: Yes / No
**Latency Target Met**: Yes / No
