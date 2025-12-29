text
# Entomate: Quick Reference Guide

**One-Page Cheat Sheet for Everything Phase 1**

---

## 🎯 WHAT ARE WE BUILDING?

**Entomate** = Meeting intelligence + Project management + AI assistant

**Connects:** Your Logos Vision CRM + Your Pulse Chat + Your Team's Meetings

**Core Flow:**
Meeting Recorded
↓
Transcribed by Gemini AI
↓
Summarized + Action Items Extracted
↓
Action items auto-sync to Logos Vision CRM
↓
Team notified in Pulse Chat
↓
Can ask questions about meeting anytime

text

---

## 🛠️ TECH STACK (What We're Using)

**Backend:** Node.js / Python  
**Frontend:** React / Vue  
**Database:** PostgreSQL  
**AI Brain:** Gemini API (Google)  
**Hosting:** [TBD - AWS/Heroku/DigitalOcean]  
**External APIs:**
- Logos Vision CRM API
- Pulse Chat API

---

## 📅 TIMELINE AT A GLANCE

| Phase | Duration | What | Status |
|-------|----------|------|--------|
| **Phase 1** | 8 weeks | MVP: Recording → CRM Sync → Chat | Planning |
| **Phase 2** | 8 weeks | Custom AI Agents, Advanced Search | Roadmap |
| **Phase 3** | 8 weeks | Enterprise features, Analytics | Roadmap |

---

## 🎬 WEEK-BY-WEEK SPRINTS

**Week 1:** Get Gemini API working + set up backend ✓  
**Week 2:** Build recording UI + transcription working ✓  
**Week 3:** Sync action items to Logos Vision CRM ✓  
**Week 4:** Post summaries to Pulse Chat ✓  
**Week 5:** Project management CRUD ✓  
**Week 6:** Ask Assistant (Q&A about meetings) ✓  
**Week 7:** Automations (meetings → actions auto) ✓  
**Week 8:** Polish + deploy to production ✓  

---

## 🔑 KEY FILES TO REVIEW

| File | Purpose | For Whom |
|------|---------|----------|
| `entomate-clickup-research-analysis.md` | **Strategic overview** - What ClickUp Brain can do, how Entomate exceeds it | Everyone |
| `entomate-phase1-dev-guide.md` | **Implementation playbook** - Code examples, prompts, architecture | Developers |
| `entomate-phase1-timeline.md` | **Project schedule** - Day-by-day tasks, deadlines, sign-offs | PM + Team Leads |
| This file | **Quick reference** - Keep handy! | Everyone |

---

## 🚀 GEMINI AI SETUP (2 Minutes)

1. Go to https://aistudio.google.com
2. Create free account
3. Click "Create API Key"
4. Copy key, save in `.env` file as `GEMINI_API_KEY`
5. Test: "Summarize this: [paste meeting transcript]"

**Done!** Gemini is ready.

---

## 💻 BACKEND DEVELOPER QUICK START

Clone repo
git clone [repo-url]
cd entomate

Install dependencies
npm install

Setup env
cp .env.example .env

Fill in: GEMINI_API_KEY, DATABASE_URL, etc.
Start database
docker-compose up -d postgres

Run migrations
npm run migrate

Start server
npm start

Server running on http://localhost:3000
text

---

## 🎨 FRONTEND DEVELOPER QUICK START

In another terminal
cd entomate/frontend

Install dependencies
npm install

Start dev server
npm run dev

Open http://localhost:3000 in browser
text

---

## 📝 CORE GEMINI PROMPTS (Copy-Paste Ready)

### Prompt 1: Summarize Meeting
Summarize this meeting in JSON format with:
{
"summary": "3 sentence overview",
"key_points": ["point 1", "point 2"],
"decisions": ["decision 1", "decision 2"],
"sentiment": "Positive|Neutral|Negative"
}

MEETING TRANSCRIPT:
[PASTE HERE]

text

### Prompt 2: Extract Action Items
Extract action items from this transcript. Return JSON:
{
"action_items": [
{
"task": "What needs to be done",
"owner": "Person name",
"due_date": "YYYY-MM-DD",
"priority": "High|Medium|Low",
"description": "2-3 sentence detail"
}
]
}

RULES:

Only clear ownership

If no date, infer from context

High priority if deadline < 3 days

TRANSCRIPT:
[PASTE HERE]

text

### Prompt 3: Ask Question About Meeting
Answer this question using only information from the meeting:

QUESTION: "What did we decide about the budget?"

MEETING SUMMARY:
[PASTE SUMMARY]

MEETING TRANSCRIPT:
[PASTE TRANSCRIPT]

If answer not found, say "I couldn't find that information."

text

---

## 🔗 API INTEGRATIONS NEEDED

### Logos Vision CRM
**Get from:** Your CRM team  
**Need:** API base URL, API key, task creation endpoint format  
**Endpoint:** POST `/tasks` with `{title, description, assigned_to, due_date}`

### Pulse Chat
**Get from:** Your Pulse team  
**Need:** API base URL, API key, message posting format  
**Endpoint:** POST `/channels/{id}/messages` with message text

---

## 📊 DATABASE SCHEMA (Simple Version)

-- Meetings table
CREATE TABLE meetings (
id UUID PRIMARY KEY,
title VARCHAR(255),
transcript TEXT,
summary TEXT,
sentiment VARCHAR(20),
created_at TIMESTAMP
);

-- Action items table
CREATE TABLE action_items (
id UUID PRIMARY KEY,
meeting_id UUID REFERENCES meetings(id),
task_description TEXT,
assigned_to VARCHAR(255),
due_date DATE,
priority VARCHAR(20),
status VARCHAR(20),
crm_task_id VARCHAR(256) -- Link back to Logos Vision
);

-- Projects table
CREATE TABLE projects (
id UUID PRIMARY KEY,
name VARCHAR(255),
crm_deal_id VARCHAR(256), -- Link to deal
status VARCHAR(20),
created_at TIMESTAMP
);

-- Tasks table
CREATE TABLE tasks (
id UUID PRIMARY KEY,
project_id UUID REFERENCES projects(id),
title VARCHAR(255),
assigned_to UUID,
status VARCHAR(20),
due_date DATE
);

text

---

## 🧪 TESTING CHECKLIST

**Daily before standup:**
- [ ] Record test meeting (60 seconds)
- [ ] Verify transcription works
- [ ] Verify action items extracted
- [ ] Verify CRM sync happened
- [ ] Verify Pulse notification sent
- [ ] Ask assistant a question about it
- [ ] Verify answer is correct

---

## 🚨 COMMON ERRORS & FIXES

| Error | Cause | Fix |
|-------|-------|-----|
| "API key invalid" | GEMINI_API_KEY not set | Check `.env` file, test key in AI Studio |
| "Database connection failed" | PostgreSQL not running | `docker-compose up -d postgres` |
| "CRM sync failed" | Wrong endpoint or API key | Verify with CRM team |
| "No audio input" | Browser permissions | Check microphone permissions |
| "Empty action items" | Gemini didn't extract | Improve extraction prompt |

---

## 📞 WHO TO ASK FOR WHAT

| Question | Ask |
|----------|-----|
| How does Gemini work? | Backend Lead or Google docs |
| How do I record audio in browser? | Frontend Lead |
| What's the Logos Vision API? | CRM team |
| What's the Pulse API? | Pulse team |
| When is deadline for X? | PM |
| How do I deploy? | DevOps person |

---

## 💡 PRO TIPS

1. **Test Gemini prompts first** in AI Studio before coding
2. **Use real meeting audio** early - synthetic audio misses edge cases
3. **Log everything** - you'll need logs to debug integration issues
4. **Test integrations early** - don't wait until week 7 to test CRM sync
5. **Version your prompts** - Gemini behavior changes, track what works
6. **Monitor API costs** - Gemini pricing can add up fast with lots of processing
7. **Back up frequently** - Don't lose work to computer crashes
8. **Communicate blockers early** - Don't wait, tell PM immediately

---

## 🎓 LEARNING RESOURCES

**Gemini API:**
- [Google AI Studio](https://aistudio.google.com) - playground
- [Gemini API Docs](https://ai.google.dev) - full documentation
- [Prompt Engineering Guide](https://ai.google.dev/docs/prompt_guide) - how to write good prompts

**Technologies:**
- [Node.js Guide](https://nodejs.org/en/docs/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [React Docs](https://react.dev) or [Vue Docs](https://vuejs.org)

**Project Management:**
- Check ClickUp docs for UI inspiration
- Check Fellow, Otter, Fireflies for feature ideas

---

## 📈 SUCCESS METRICS (What "Done" Looks Like)

**By End of Week 1:** Gemini API working ✓  
**By End of Week 2:** Can record and transcribe meetings ✓  
**By End of Week 3:** Action items in CRM ✓  
**By End of Week 4:** Team notified in Pulse ✓  
**By End of Week 5:** Projects manageable ✓  
**By End of Week 6:** Ask Assistant working ✓  
**By End of Week 7:** Automations running ✓  
**By End of Week 8:** Live in production ✓  

---

## 🎯 PHASE 1 DEFINITION OF DONE

- [ ] Meeting recording working
- [ ] Transcription accurate
- [ ] Action items extracted correctly
- [ ] Logos Vision CRM sync working
- [ ] Pulse notifications working
- [ ] Ask Assistant answering questions
- [ ] Basic automations working
- [ ] No critical bugs
- [ ] Production deployed
- [ ] Team trained
- [ ] Documentation complete

---

## 🗺️ WHAT'S NEXT (Phase 2)

After Phase 1 ships, Phase 2 includes:

- Custom AI agents (deal risk monitor, task assigner, etc.)
- Advanced search across all data
- Predictive analytics (deal close probability, etc.)
- Team health dashboard
- Integration with more CRMs
- Real-time coaching during meetings
- Customer sentiment tracking

---

## 📌 REMEMBER

**Your competitive advantage:** This isn't ClickUp trying to bolt on CRM. This is CRM-native meeting intelligence. Leverage that!

**Unique features ClickUp doesn't have:**
- Deep Logos Vision CRM context
- Meeting insights tied to deal health
- Pulse chat as communication hub
- Deal-aware task assignment

**Focus on:** Make the integration seamless. Make it so good that users can't imagine working without it.

---

## 🤝 CONTACTS

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Backend Lead | [Name] | [Phone] | [Email] |
| Frontend Lead | [Name] | [Phone] | [Email] |
| PM | [Name] | [Phone] | [Email] |
| CRM Team | [Name] | [Phone] | [Email] |
| Pulse Team | [Name] | [Phone] | [Email] |
| DevOps | [Name] | [Phone] | [Email] |

---

## 📋 NEXT ACTIONS (This Week)

- [ ] Share this guide with team
- [ ] Review ClickUp research document
- [ ] Assign developers to tasks
- [ ] Schedule Week 1 kickoff meeting
- [ ] Get Logos Vision API docs
- [ ] Get Pulse API docs
- [ ] Create `.env` template
- [ ] Set up GitHub repo

---

**Questions? Check the full documentation in the other files or ask your team lead!**

**Start date:** December 16, 2025  
**Good luck! 🚀**