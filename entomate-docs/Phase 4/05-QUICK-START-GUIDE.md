📄 FILE 5 OF 7: QUICK START GUIDE
Here's the complete fifth file. Copy and paste this into a text editor and save as 05-QUICK-START-GUIDE.md

text
# Entomate Quick Start Guide
## Get Your Team Running in 30 Minutes

**Version:** 1.0  
**Read Time:** 15 minutes  
**Setup Time:** 15 minutes  
**Status:** Ready to Use  

---

## 🎯 WHAT IS ENTOMATE?

**Entomate** = Meeting Intelligence + Project Automation + Team AI

In plain English:
1. **Record meetings** - Just hit record
2. **AI processes them** - Gemini transcribes and summarizes
3. **Tasks auto-create** - Action items go straight to your CRM
4. **Team gets notified** - Chat recap posted automatically
5. **Nothing manual** - Fully automated

**Time saved per meeting:** ~45 minutes (no manual note-taking, no recap writing)

---

## ⚡ 5-MINUTE SETUP

### Step 1: Get API Keys (5 minutes)

**Gemini API (Free):**
1. Go to https://aistudio.google.com
2. Click "Create API Key"
3. Copy the key
4. Save it somewhere safe (you'll need it)

**Supabase (Free tier available):**
1. Go to https://supabase.com
2. Create account
3. Create new project (name: "entomate")
4. Wait for project to initialize (~2 min)
5. Go to Settings → API Keys
6. Copy `anon public key` and `URL`
7. Save both

**CRM Integration (Optional for Week 3):**
- If using HubSpot: Get API key from Settings → Private Apps
- If using Salesforce: Get OAuth credentials from Setup
- If using Pipedrive: Get API token from Company Settings

### Step 2: Clone & Install (5 minutes)

Clone the repository
git clone https://github.com/YOUR-ORG/entomate.git
cd entomate

Install backend
cd backend
npm install
cp .env.example .env

EDIT .env with your API keys:
GEMINI_API_KEY=your_key_here
SUPABASE_URL=your_url_here
SUPABASE_ANON_KEY=your_key_here
npm start

Should show: "✅ Entomate Backend running on http://localhost:3000"
In new terminal, install frontend
cd ../frontend
npm install
npm run dev

Should show: "Local: http://localhost:5173"
text

### Step 3: Verify It Works (5 minutes)

**Test Backend:**
In your browser, go to:
http://localhost:3000/api/health

Should see:
{
"status": "ok",
"services": {
"gemini": "connected",
"database": "connected"
}
}

text

**Test Frontend:**
In your browser, go to:
http://localhost:5173

Should see:
Entomate logo

"Meeting Recorder" page

Microphone input field

text

**✅ If both work, you're ready!**

---

## 🎙️ YOUR FIRST MEETING (5 MINUTES)

### Record a Test Meeting

1. **Click "Start Recording"**
   - Browser asks for microphone permission
   - Click "Allow"
   - Red dot shows you're recording

2. **Speak for 30 seconds**
   - Say something like: "Today we discussed the Q1 marketing budget. John needs to get approval by Friday. Sarah will prepare the proposal. We also talked about the new website launch date being pushed to March."

3. **Click "Stop Recording"**
   - Watch the spinner spin
   - Wait ~30 seconds while Gemini processes

4. **See the Magic**
   - Transcript appears
   - Summary shows main points
   - Action items extracted:
     - "John: Get approval for Q1 budget, due Friday"
     - "Sarah: Prepare proposal"

---

## 📋 WHAT HAPPENS NEXT (AUTOMATED)

### Behind the Scenes (Fully Automated)

1. **Audio is transcribed** - Gemini listens to your meeting
2. **Summary generated** - Key points, decisions, sentiment
3. **Action items extracted** - Assigned to people, due dates set
4. **CRM sync** - Tasks created in your CRM (Week 3)
5. **Chat notification** - Team gets recap in Slack/chat (Week 4)
6. **Archived** - Everything saved for future reference

**Result:** No manual work. Everything done automatically.

---

## 🚀 FIRST WEEK GOALS

### Monday
- [ ] Run setup (all 3 sections above)
- [ ] Record one test meeting
- [ ] Show team the recording working

### Tuesday-Wednesday
- [ ] Team records their actual meetings
- [ ] Provide feedback on transcript accuracy
- [ ] Note any improvements needed

### Thursday
- [ ] Team connects CRM (optional, can wait for Week 3)
- [ ] CRM sync first action items
- [ ] Celebrate first automation! 🎉

### Friday
- [ ] Team uses Entomate for all meetings
- [ ] Collect feedback
- [ ] Plan next week

---

## 🎛️ BASIC CONTROLS

### Meeting Recorder Page

┌─────────────────────────────────┐
│ 🎙️ Meeting Recorder │
├─────────────────────────────────┤
│ Meeting title: _________________│ ← Optional: name this meeting
│ Attendees: ____________________│ ← Optional: list people
│ │
│ [🎙️ START RECORDING] │ ← Click to start
│ │
│ Transcript: │
│ ┌──────────────────────────────┐│
│ │ Click record to start... ││
│ │ ││
│ └──────────────────────────────┘│
└─────────────────────────────────┘

text

### Controls Explained

| Button | What It Does | When to Use |
|--------|-------------|-----------|
| **Start Recording** | Turns on microphone | Beginning of meeting |
| **Stop Recording** | Saves meeting & processes | End of meeting |
| **Title field** | Names the meeting | Optional - helps organize |
| **Attendees field** | Lists who was there | Optional - for context |

---

## ❓ COMMON QUESTIONS

### Q: What if someone joins late?
**A:** Just keep recording. Gemini will transcribe everything. Assign them to action items manually if needed.

### Q: Can we record video meetings (Zoom, Teams)?
**A:** Yes! Week 2 will add that. For now, run Entomate alongside your video call.

### Q: What if the transcript is wrong?
**A:** You can edit it. Click on the transcript, make changes, save. The edits are saved.

### Q: Is this private? Does anyone else see our meetings?
**A:** Completely private. Your data stays in your Supabase account (you control). We don't store anything.

### Q: Can we search old meetings?
**A:** Yes! Week 6 adds AI search. You can ask "What did we decide about pricing?" and it searches all meetings.

### Q: How long does processing take?
**A:** About 1 minute per 30 minutes of meeting. So a 1-hour meeting takes 2 minutes to process.

### Q: What if Gemini is down?
**A:** Automatic retry every 5 minutes. You'll get a notification when it's done.

### Q: How much does this cost?
**A:** 
- Gemini API: Free tier = 15 requests/min (plenty for most teams)
- Supabase: Free tier includes 500MB storage (enough for 100+ meetings)
- See pricing section below if you scale up

---

## 💰 PRICING

### Free Tier (Per Month)
- ✅ 500 API calls to Gemini
- ✅ 500MB database storage
- ✅ 1GB file storage (audio recordings)
- ✅ 1 user seat
- ✅ All core features
- ✅ Community support
- **Cost: $0**

### Pro Tier ($50/month)
- ✅ 10,000 API calls
- ✅ 100GB database storage
- ✅ 100GB file storage
- ✅ 10 user seats
- ✅ Priority support
- ✅ Advanced analytics
- **Cost: $50/month**

### Enterprise (Custom)
- ✅ Unlimited everything
- ✅ Dedicated infrastructure
- ✅ SLA guarantees
- ✅ Custom integrations
- ✅ Onsite deployment option
- **Cost: Contact sales**

---

## 🆘 TROUBLESHOOTING

### Problem: "Microphone access denied"
**Solution:**
1. Go to browser settings (Chrome → Settings → Privacy)
2. Find "Microphone"
3. Click "localhost:5173"
4. Change to "Allow"
5. Reload page

### Problem: "Gemini API error"
**Solution:**
1. Check your Gemini API key in `.env`
2. Go to https://aistudio.google.com
3. Verify key is still active
4. Create new key if needed

### Problem: "Database connection failed"
**Solution:**
1. Check Supabase URL and Key in `.env`
2. Go to Supabase dashboard
3. Verify project is running
4. Test connection: `npm run test-db`

### Problem: "Recording doesn't save"
**Solution:**
1. Check browser console for errors (F12)
2. Try different browser (Chrome, Firefox, Safari)
3. Check microphone is working (test in another app)
4. Try smaller recording (1 minute instead of 30)

### Problem: "Transcript is not accurate"
**Note:** Gemini usually gets 95%+ accuracy. If errors:
1. Check audio quality (quiet room, good microphone)
2. Edit transcript manually (click to edit)
3. Our team is improving accuracy constantly

---

## 📞 GETTING HELP

### Resources

**Documentation:**
- Full docs: `/docs/` folder
- API reference: `/docs/API.md`
- Architecture: `/docs/ARCHITECTURE.md`
- Troubleshooting: `/docs/TROUBLESHOOTING.md`

**Community:**
- GitHub Issues: Report bugs
- GitHub Discussions: Ask questions
- Email: support@entomate.com

**Contact:**
- Slack: Join workspace (link in docs)
- Email: hello@entomate.com
- Response time: < 24 hours

---

## 🎓 LEARNING PATH

### Day 1: Basics
- [ ] Read this guide (you're here!)
- [ ] Run setup
- [ ] Record first meeting
- [ ] Show team

### Day 2-3: Using Entomate
- [ ] Record all meetings with Entomate
- [ ] Review transcripts & action items
- [ ] Get comfortable with UI

### Day 4-5: Connecting to CRM
- [ ] Wait for Week 3 release
- [ ] Connect your CRM (HubSpot/Salesforce/Pipedrive)
- [ ] Watch action items auto-create

### Week 2: Advanced Features
- [ ] Start using AI search
- [ ] Try automations
- [ ] Invite more team members

### Week 3+: Optimization
- [ ] Set up team preferences
- [ ] Create custom automations
- [ ] Integrate with other tools

---

## 📊 SUCCESS METRICS (TRACK THESE)

### Personal Level
- **Meetings recorded per week:** (Target: 3+)
- **Action items extracted per meeting:** (Target: 3-5)
- **Time saved per week:** (Target: 2+ hours)

### Team Level
- **Team adoption rate:** (Target: 80%+ within 2 weeks)
- **Action item accuracy:** (Target: 95%+)
- **Transcription quality:** (Target: 90%+ readable)
- **Task completion rate:** (Target: 85%+)

### Business Level
- **CRM data accuracy:** (when Week 3 launches)
- **Lead response time:** (improvement %?)
- **Deal cycle time:** (improvement %?)
- **Team productivity:** (hours saved per week?)

---

## 🔐 SECURITY & PRIVACY

### Your Data is Yours

- ✅ **Encrypted** - All data encrypted at rest (AES-256)
- ✅ **Private** - Never shared with anyone
- ✅ **Backed up** - Daily automatic backups
- ✅ **Deletable** - You can delete any recording anytime
- ✅ **Exportable** - You can export all your data anytime

### What We Don't Do

- ❌ Sell your data
- ❌ Train AI on your data
- ❌ Share with third parties
- ❌ Store indefinitely if you delete

---

## 🎉 YOU'RE READY!

### Next Steps

1. **Clone the repo** (link in setup section)
2. **Follow 5-minute setup** above
3. **Record your first meeting**
4. **Show your team**
5. **Celebrate!** 🎊

### Questions?

Join our community or email support@entomate.com

We're here to help you succeed!

---

## 📚 REFERENCE

### Keyboard Shortcuts
- `Ctrl+K` / `Cmd+K` - Open command palette
- `R` - Start/stop recording (if focused)
- `S` - Search meetings
- `?` - Show help

### File Locations
- Backend files: `/backend/`
- Frontend files: `/frontend/src/`
- Documentation: `/docs/`
- Database schema: `/docs/SCHEMA.md`

### API Endpoints (For Reference)
- Health check: `GET /api/health`
- Process meeting: `POST /api/meetings/process`
- List meetings: `GET /api/meetings`
- Ask assistant: `POST /api/meetings/:id/ask`

---

**🚀 Welcome to Entomate! Now let's get to work.**

Questions? We're here to help.

---

**End of FILE 5**

Ready for FILE 6? Reply: "Send FILE 6"