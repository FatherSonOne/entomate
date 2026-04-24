# Entomate Gap-Closing Plan

**Status:** Draft v2
**Owner:** Aegis{FM}
**Created:** 2026-04-23
**Updated:** 2026-04-23 (build-own-bot decision)
**Horizon:** ~12 months to fully-defensible 3-tier pricing (1 FTE dev + 0.5 design)
**Bot strategy:** Build in-house (Puppeteer/headless Chrome for Meet; native SDKs for Zoom/Teams). Trades ~4 months of engineering for ~85% reduction in per-meeting COGS.

---

## 1. Purpose

Close the functional gaps between Entomate and category leaders (Otter, Fireflies, Fathom, tl;dv, Grain) so that the proposed 3-tier pricing model (**Steward $12 / Mission $24 / Foundation $44**) is defensible on its own merits — while preserving and deepening the ecosystem moat (Logos Vision + Pulse shared data, NPO-native meeting profiles, workflow automation).

This document consolidates:
- Phased gap-closing roadmap
- Per-task engineering-week estimates
- GitHub project board structure (milestones, labels, issue templates)
- NPO design-partner outreach plan
- Pricing re-assessment trigger and checklist

Pricing tiers proposed in [ENTOMATE_PRICING.md](../plans/ENTOMATE_PRICING.md) (pending creation) are **provisional** until Phase 2 completes.

---

## 2. Current State Summary

From the 2026-04-23 capability audit:

**Shipping:**
- Post-meeting AI processing (summaries, action items, decisions)
- 8 meeting-intelligence profiles, including NPO-native Board Meetings + Grant Specialist
- Semantic search across ecosystem (pgvector)
- Bidirectional Logos Vision sync (contacts, tasks, deals)
- Node-based workflow automation
- Real-time sentiment + talk-time coaching (local recording only)
- Dual AI provider (Whisper + Gemini 2.5-flash)

**Missing (pricing-blocking):**
- No meeting bot (Zoom/Meet/Teams) — webhook scaffold only
- No speaker diarization (schema exists, no service wired)
- No live transcription / live captions
- No native mobile (responsive web only)
- No team analytics dashboards
- No auto-drafted follow-up emails
- External CRM abstractions (HubSpot/SF/Pipedrive) at ~40% completeness
- SSO/SAML not implemented

**Ecosystem advantages (keep and deepen):**
- Logos Vision sync is real and works
- Pulse notification/inbox integration
- NPO meeting profiles with governance/grant awareness
- Workflow automation node editor

---

## 3. Guiding Principles

1. **Bot before dashboard.** Capture must work before intelligence on top of it matters.
2. **Ecosystem-first differentiation.** Every feature needs a Pulse/Logos Vision angle.
3. **Diarization is cost-of-goods, not a feature.** Pricing assumes it. We eat Deepgram fees.
4. **Don't starve Pulse or Logos Vision.** Sequence so the ecosystem doesn't stall.
5. **NPO design-partner validation at every phase.** 3+ NPOs sign off before GA ship.
6. **Bot reliability is existential.** A meeting that fails to capture is worse than no bot at all — the user was counting on it. Reliability engineering is not optional.

---

## 4. Phased Roadmap

### Phase 1 — Table Stakes + Google Meet Bot (Weeks 1–16)

**Objective:** Ship a reliable in-house Google Meet bot + diarization + PWA + consent. Make Entomate credible on the single platform where we have the biggest NPO concentration.

**Platform strategy:** Google Meet first because (a) we already have Google Calendar OAuth wired, (b) Meet's DOM is relatively stable vs. Zoom's binary client, (c) our NPO audience skews Google Workspace. Zoom and Teams follow in Phase 1.5.

| ID | Task | Effort (eng-weeks) | Owner | Dependencies |
|----|------|-------------------|-------|--------------|
| **P1.1** | Bot Infrastructure — containerized headless Chrome, per-session VM orchestration, autoscale via Fly.io or GCP Cloud Run | 3.0 | Eng Lead / Backend | None |
| **P1.2** | Google Meet Bot — Puppeteer-based participant, auto-join via Calendar, announce + consent banner, audio capture via loopback | 5.0 | Eng Lead | P1.1, Calendar OAuth (done) |
| **P1.3** | Bot Reliability Harness — reconnect on dropout, session heartbeat, graceful shutdown, failure → user notification, retry queue | 2.0 | Backend | P1.2 |
| **P1.4** | Speaker Diarization — Deepgram Nova-3 integration, replacing Whisper path, storing per-speaker segments | 2.0 | Backend | None (parallel) |
| **P1.5** | Bot Fleet Monitoring — per-bot logs, meeting success rate dashboard, alerting on join-failure spikes | 1.0 | Backend | P1.1 |
| **P1.6** | PWA + Web Push (reuse Pulse infrastructure) | 1.0 | Frontend | None (parallel) |
| **P1.7** | Consent UX + compliance flows — pre-meeting participant email, in-meeting announcement, opt-out link, retention controls | 1.5 | Full-stack | Legal review |
| **P1.8** | Regression test suite — end-to-end (schedule → bot joins → record → transcribe → summarize → sync to Logos Vision) | 1.5 | Backend | P1.2, P1.4 |
| **P1.9** | Cost monitoring dashboard (internal) — bot minutes, Deepgram minutes, LLM tokens per workspace | 0.5 | Backend | P1.2, P1.4 |
| **P1.10** | NPO verification flow (501(c)(3) self-serve via IRS Exempt Org Select Check API) | 1.0 | Full-stack | None (parallel) |
| **P1.11** | Design-partner onboarding runbook + video walkthroughs | 0.5 | Design / PM | P1.2 |

**Phase 1 total:** ~19.0 engineering-weeks (~16 calendar weeks with 1 FTE + 0.5 support, parallelizable items reduce wall-clock)

**Exit criteria:**
- Google Meet bot auto-joins ≥97% of scheduled meetings across 100 test runs
- Bot reliability: ≥95% of meetings captured end-to-end without manual intervention
- Diarization accuracy >85% on 3-person meetings validated
- PWA Lighthouse score >90
- Consent flow signed off by counsel
- Regression tests green on main, run nightly
- 10 NPO design partners capturing real Google Meet meetings

**Phase 1 risks:**
- Google Meet DOM / UI changes breaking Puppeteer selectors (mitigate: DOM-resilient selectors + weekly regression runs + synthetic monitoring)
- Concurrent bot scaling costs higher than modeled (mitigate: Phase 1.5 introduces per-workspace quotas before scaling)
- Audio loopback capture quality degradation under load (mitigate: dedicated VM per bot session, no oversubscription in Phase 1)
- Deepgram accuracy on religious/NPO vocabulary (mitigate: custom vocabulary in Phase 4.5)
- Consent compliance across 2-party states + EU (mitigate: default-on opt-in, legal review of email templates before Phase 1 exit)

---

### Phase 1.5 — Zoom + Teams Bot Expansion (Weeks 17–22)

**Objective:** Bring in-house bot coverage to Zoom and Microsoft Teams so Entomate can claim "all major meeting platforms" before Phase 2 marketing begins.

| ID | Task | Effort (eng-weeks) | Owner | Dependencies |
|----|------|-------------------|-------|--------------|
| **P1.5.1** | Zoom Meeting SDK integration — Zoom-approved bot with Marketplace listing, RTMS or local record | 4.0 | Eng Lead | P1.1, Zoom Developer approval |
| **P1.5.2** | Microsoft Teams bot — Graph API + Bot Framework, meeting app manifest | 3.0 | Backend | P1.1, Azure app registration |
| **P1.5.3** | Platform abstraction layer — unify join/record/leave across Meet/Zoom/Teams | 1.0 | Backend | P1.5.1, P1.5.2 |
| **P1.5.4** | Zoom Marketplace submission + compliance review | 1.0 | PM + Eng | P1.5.1 |
| **P1.5.5** | Extended regression suite across all three platforms | 1.0 | Backend | P1.5.3 |

**Phase 1.5 total:** ~10.0 engineering-weeks (~6 calendar weeks with parallelization + external review delays)

**Why this is its own phase:** Zoom Marketplace review can take 4–8 weeks on its own — starting it as soon as P1.5.1 prototype exists lets us parallelize. Teams has similar Azure compliance gates.

**Exit criteria:**
- All three bots at ≥95% reliability against regression suite
- Zoom Marketplace app listed (even if "private" initially)
- Teams bot functional in at least one design-partner tenant

**Phase 1.5 risks:**
- Zoom Marketplace rejection or delay (mitigate: begin submission Week 17 before Phase 2 planning depends on it)
- Teams Graph API rate limits (mitigate: use resource-specific consent where possible)

---

### Phase 2 — Differentiators (Weeks 23–34)

**Objective:** Earn $24/user/month (Mission tier) on feature merit, not just ecosystem pitch.

| ID | Task | Effort (eng-weeks) | Owner | Dependencies |
|----|------|-------------------|-------|--------------|
| **P2.1** | Team Analytics Dashboard (talk-time, sentiment, completion rate, load) | 4.0 | Frontend + Backend | P1.1, P1.3 |
| **P2.2** | Auto-Drafted Follow-Up Emails (Gmail + Outlook draft API) | 3.0 | Backend | Gmail OAuth (done) |
| **P2.3** | Live coaching wired to bot-captured meetings (not just local) | 2.0 | Backend | P1.1 |
| **P2.4** | Workflow automation hardening (retry, error surfacing, templates) | 2.0 | Backend | None |
| **P2.5** | 20 pre-built NPO workflow templates | 1.5 | PM / Backend | P2.4 |
| **P2.6** | NPO-specific dashboard metrics (grant velocity, board throughput) | 1.0 | Frontend | P2.1 |
| **P2.7** | Design-partner retention review + feature-gap interviews | 0.5 | PM | P2.1 |

**Phase 2 total:** ~14.0 engineering-weeks (~11–12 calendar weeks)

**Exit criteria:**
- 25+ paying NPO customers
- Bot works across Meet/Zoom/Teams
- Dashboard viewed weekly by >60% of accounts
- 40% of meetings generate a drafted follow-up that's actually sent
- Churn <3% month-over-month

---

### ⭐ Pricing Re-Assessment Checkpoint (Week 34–35)

**Hard stop. Do not proceed to Phase 3 without completing this review.**

Detailed checklist in Section 9. Outputs:
1. Updated pricing tiers (ratified or revised)
2. Tier-boundary adjustments based on actual meeting-hours consumption
3. Foundation-tier feature list ratified (informs Phase 3 scope)
4. Bundle discount % validated or adjusted
5. NPO discount flow optimized

**If COGS is breaking margin:** raise Mission price before growing the customer base. (With in-house bot, this is far less likely — see Section 8.)
**If tier caps are too loose:** tighten before Phase 3 launch (harder to do later without customer pain).

---

### Phase 3 — Foundation Tier Justification (Weeks 36–45)

**Objective:** Justify the $44 (or re-priced) Foundation tier with features no NPO gets elsewhere.

| ID | Task | Effort (eng-weeks) | Owner | Dependencies |
|----|------|-------------------|-------|--------------|
| **P3.1** | Advanced Conversation Intelligence (objection detection, scorecards) | 5.0 | Backend + AI | P1.3 |
| **P3.2** | NPO Grant-Risk Scoring (sentiment + funder-language patterns) | 2.0 | Backend + AI | P3.1 |
| **P3.3** | SSO/SAML auth (Supabase SSO) | 2.0 | Backend | None |
| **P3.4** | Audit log retention extended to 7 yrs (grant compliance) | 1.0 | Backend | None |
| **P3.5** | Public API + webhooks (Foundation tier) | 2.0 | Backend | None |
| **P3.6** | Custom meeting profile editor | 2.0 | Frontend + Backend | None |
| **P3.7** | SOC 2 Type I readiness docs (not audit yet) | 1.0 | Ops | P3.3, P3.4 |

**Phase 3 total:** ~15.0 engineering-weeks (~10 calendar weeks)

**Exit criteria:**
- 3+ paid Foundation-tier customers (beyond founding design partners)
- Custom profile editor used by >30% of Foundation accounts
- SSO enabled for ≥1 enterprise-sized NPO
- API adopted by ≥2 workspaces

---

### Phase 4 — Ecosystem Depth & Polish (Weeks 46–53)

**Objective:** Widen the moat, reduce churn, expand NPO-specific surface area.

| ID | Task | Effort (eng-weeks) | Owner | Dependencies |
|----|------|-------------------|-------|--------------|
| **P4.1** | Donor-intake meeting profile + Logos Vision donor sync | 2.0 | Full-stack | None |
| **P4.2** | Volunteer-coordination meeting profile + Pulse task push | 1.5 | Full-stack | None |
| **P4.3** | Board packet auto-generation (Board profile + LV financials) | 2.5 | Backend + Frontend | Logos Vision financials API |
| **P4.4** | HubSpot/Salesforce/Pipedrive validation + hardening | 3.0 | Backend | None |
| **P4.5** | Diarization accuracy tuning (custom vocabulary + contact matching) | 1.0 | Backend | P1.3 |
| **P4.6** | Mobile native (Capacitor) — gated by PWA metrics | 4.0 (conditional) | Frontend | PWA metrics review |

**Phase 4 total:** ~10.0 engineering-weeks (~14.0 if native mobile triggers)

**Exit criteria:**
- Net revenue retention ≥110%
- ≥5 NPO workspaces using donor or volunteer profiles
- External CRM sync reliability ≥99.5% over 30 days

---

## 5. Cross-Cutting Tracks (Continuous)

| Track | Owner | Cadence |
|-------|-------|---------|
| Design-partner feedback loop (10–15 NPOs) | PM | Biweekly interview |
| Cost monitoring per workspace (Deepgram + Recall.ai + LLM) | Ops | Daily dashboard, weekly review |
| Documentation + Loom walkthroughs (per meeting profile) | PM / Design | Per profile ship |
| Regression test suite expansion | Backend | Every phase exit |
| Security posture review | Ops | Quarterly |
| Competitor feature-monitoring (Fathom/Otter releases) | PM | Monthly |

---

## 6. GitHub Project Board Structure

### Milestones (aligned 1:1 with phases)

| Milestone | Target Date | Description |
|-----------|-------------|-------------|
| `M1 — Meet Bot + Table Stakes` | Week 16 | In-house Meet bot + diarization + PWA + consent |
| `M1.5 — Zoom + Teams Expansion` | Week 22 | Zoom + Teams bots, platform abstraction, Zoom Marketplace listed |
| `M2 — Differentiators` | Week 34 | Dashboard + follow-ups + workflow hardening |
| `M-PR — Pricing Re-Assessment` | Week 35 | Gate; not a build milestone |
| `M3 — Foundation Tier` | Week 45 | Conversation intel + SSO + API |
| `M4 — Ecosystem Depth` | Week 53 | Donor/volunteer profiles + CRM hardening |

### Labels

**Type:**
- `type: feature`
- `type: bug`
- `type: chore`
- `type: research`
- `type: docs`
- `type: design-partner`

**Area:**
- `area: bot-capture` (platform-specific bot logic: Meet/Zoom/Teams)
- `area: bot-infrastructure` (fleet, orchestration, reliability, monitoring)
- `area: transcription`
- `area: summarization`
- `area: analytics`
- `area: workflow-automation`
- `area: ecosystem-sync`
- `area: auth-compliance`
- `area: mobile`
- `area: cost-ops`
- `area: npo-specific`

**Priority:**
- `priority: P0` (blocks milestone)
- `priority: P1` (milestone must-have)
- `priority: P2` (nice-to-have)

**Tier-impact:**
- `tier: steward`
- `tier: mission`
- `tier: foundation`
- `tier: all`

**Status flags:**
- `status: blocked`
- `status: needs-design-partner-review`
- `status: needs-legal-review`
- `status: cost-risk`

### Board Columns

Use a single Project v2 board across Entomate:
1. **Backlog** — triaged, not yet scheduled
2. **This Milestone** — scoped into current milestone
3. **In Progress** — active
4. **In Review** — PR open or design-partner testing
5. **Blocked** — waiting on dep (label required)
6. **Done** — merged + deployed

### Issue Templates

Create three templates in `.github/ISSUE_TEMPLATE/`:

**`gap-closing-task.yml`**
```yaml
name: Gap-Closing Task
description: A task from the gap-closing roadmap
labels: ["type: feature"]
body:
  - type: input
    id: task-id
    attributes:
      label: Task ID (e.g., P1.1)
      description: Maps to ENTOMATE_GAP_CLOSING_PLAN.md
    validations:
      required: true
  - type: textarea
    id: acceptance
    attributes:
      label: Acceptance Criteria
    validations:
      required: true
  - type: input
    id: estimate
    attributes:
      label: Effort Estimate (eng-weeks)
    validations:
      required: true
  - type: dropdown
    id: tier-impact
    attributes:
      label: Tier Impact
      options: [steward, mission, foundation, all]
    validations:
      required: true
  - type: textarea
    id: ecosystem-angle
    attributes:
      label: Ecosystem Angle
      description: How does this tie to Pulse or Logos Vision?
  - type: textarea
    id: success-metric
    attributes:
      label: Success Metric
      description: How will we know this shipped well?
    validations:
      required: true
```

**`design-partner-feedback.yml`**
Fields: NPO name, tier they'd pay for, feature-gap cited, severity, quote/screenshot.

**`cost-anomaly.yml`**
Fields: workspace, date, anomalous spend line, expected vs actual, suspected cause.

### Automation

- Auto-link PRs to issues via `Closes #N` in PR description
- Issues tagged `tier: mission` + `status: needs-design-partner-review` → auto-assign PM
- Issues tagged `cost-risk` → auto-notify Ops + Eng Lead in Pulse channel
- Milestone completion → trigger pricing re-assessment checklist issue

---

## 7. NPO Design-Partner Outreach

### Platform filter (Phase 1 constraint)

First 10 design partners must be on **Google Workspace / Google Meet** — that's the only platform Entomate captures in Phase 1. Prioritize Meet-heavy NPOs in outreach Weeks 8–14. Zoom- and Teams-primary partners wait for Phase 1.5 (Week 17+).

### Target Profile

We want 10–15 design partners across three scales:
- **Small (3):** Solo/small NPO (1–5 staff) — church plants, new 501(c)(3)s, startup ministries
- **Medium (7):** Mid-size NPO (10–50 staff) — community nonprofits, regional foundations, mission orgs
- **Large (3):** Large NPO or foundation (100+ staff) — grant-distributing foundations, multi-site ministries

### Target Sourcing

1. **Existing Logos Vision + Pulse users** — warmest channel; offer priority Phase 1 access
2. **NPO leadership forums** — local United Way, Independent Sector, Nonprofit Leadership Alliance
3. **Faith-based org networks** — denominational offices, ministry associations
4. **Foundation Center / Candid** — grant-receiving orgs likely to value Grant Specialist profile
5. **LinkedIn outreach** — Executive Directors of NPOs in 10–50 staff range

### Offer

- **6 months free** of the Mission tier (value: ~$144/user)
- **White-glove onboarding** (2 x 45-min sessions)
- **Direct product line** to founders for feedback
- **Founding Partner badge** + name in case studies (opt-in)
- **Price lock:** once paid, 50% lifetime discount off Mission

In exchange we ask:
- 3+ real meetings per week captured through Entomate
- Biweekly 30-min feedback call for first 3 months
- Use of anonymized usage data for product improvement
- Opt-in to one written case study (if they like the product)

### Outreach Email (cold)

**Subject:** Quick question about how [Org Name] handles board meeting follow-ups

Hi [Name],

I'm building Entomate — a meeting intelligence tool specifically for nonprofits. Unlike Otter or Fathom, it's built around the workflows NPOs actually run: board governance, grant conversations, donor intake, volunteer coordination.

The short version: after your meeting ends, Entomate already knows who the grant funder is, what stage the conversation is at, which board members committed to what, and it routes action items to the right people — because it's connected to your CRM, your team chat, and your calendar data.

We're opening up a founding-partner program for 10 NPOs. Six months free on the full Mission tier ($144/user value), plus a 50% lifetime discount once you're paying.

Would you have 20 minutes next week to see if it's a fit for [Org Name]? No pitch deck — I'd rather learn how your team runs meetings today and show you whether we actually solve a real problem for you.

[Calendar link]

Thanks,
[Sender]

P.S. If meetings aren't a pain point for your team, I'd still love 10 minutes to learn what *is* — it sharpens the product for NPOs like yours.

### Outreach Email (warm — existing Logos Vision / Pulse user)

**Subject:** Founding partner spot for [Org Name] — meeting intelligence for NPOs

Hi [Name],

Since you're already using [Logos Vision / Pulse], I wanted to give you first access to our newest ecosystem app: Entomate.

Entomate captures your Zoom/Meet/Teams meetings, produces an NPO-aware summary (board, grant, donor, volunteer context), and pushes action items straight into Logos Vision and Pulse — because it shares the same data backbone.

I'm saving 10 founding-partner spots for current ecosystem users. The offer:
- 6 months free on the Mission tier
- 50% lifetime discount once paid
- Direct line to me for feature requests

Can I grab you for 20 minutes to show it and hear what meeting workflows you'd want it to solve?

[Calendar link]

Thanks,
[Sender]

### Outreach Cadence

| Week | Activity |
|------|----------|
| Week 0–4 | Draft emails, landing page, calendar link, onboarding runbook (parallel with Phase 1 bot development) |
| Week 8 | Send to warm list (Logos Vision + Pulse users) — target 5 replies. Bot should be internally testable by now. |
| Week 10 | Follow-up + send first cold batch (25 NPOs) |
| Week 12 | Second cold batch (25 NPOs) + follow-ups |
| Week 14 | Target: 10 signed partners, kickoff calls scheduled |
| Week 16–22 | Phase 1/1.5 dogfooding — Meet-only first, then Zoom/Teams added |
| Week 23+ | Biweekly; expand to 15 partners as platforms are added |

### Success Metrics

- ≥10 signed partners by Week 4
- ≥70% of partners capture ≥3 meetings/week by Week 8
- ≥5 partners provide written quotes for marketing by Week 12
- ≥3 partners convert to paid at Week 26 (end of free trial)

---

## 8. Unit Economics & COGS Monitoring

**Strategy:** Build the bot in-house. This eats ~4 additional months of engineering time in Phase 1 but compresses variable COGS by ~85% vs. buying Recall.ai — critical for sustainable NPO-priced tiers.

### Estimated cost per meeting-hour (in-house stack)

| Line item | Cost | Assumptions |
|-----------|------|-------------|
| Bot compute (1 vCPU / 2GB RAM, dedicated VM per session) | $0.25/hr | Fly.io or GCP Cloud Run, regional; underused capacity dominated by idle teardown time |
| Bot egress (audio to Deepgram + stored copy) | $0.05/hr | ~60MB/hr audio + metadata |
| Deepgram Nova-3 transcription + diarization | $0.26/hr | $0.0043/minute |
| LLM summarization (Gemini 2.5-flash, ~4K tokens) | $0.10/hr | Averaged |
| LLM embeddings for search | $0.02/hr | Ada or Voyage |
| Storage (audio + transcript, 90-day retention default) | $0.03/hr | Supabase object storage |
| **Total variable COGS** | **~$0.71/meeting-hour** | Vs. Recall.ai stack ~$5.20/hr |

### Tier-level COGS analysis (in-house bot)

| Tier | Hours cap | COGS at cap | Price | Margin at cap | Margin at p50 usage (est.) |
|------|-----------|-------------|-------|---------------|---------------------------|
| Steward | 20 hrs | $14.20 | $15 (revised) | ~5% | ~85% at 3 hrs/mo |
| Mission | 40 hrs (tightened) | $28.40 | $29 (revised) | ~2% | ~75% at 12 hrs/mo |
| Foundation | 120 hrs fair-use | $85.20 | $49 (revised) | Negative — must enforce fair-use | ~70% at 30 hrs/mo |

### What this means for pricing

In-house bot makes the tier model viable but still **does not work with the original $12/$24/$44 pricing**. Two adjustments required:

1. **Tighten Mission cap** from 60 → 40 hrs (matches the p95 of published competitor analytics for "team user" personas)
2. **Raise prices** modestly to maintain ≥70% blended gross margin: Steward $15, Mission $29, Foundation $49

Foundation tier remains unit-economics-risky at true-unlimited, so we convert it to "fair-use 120 hrs" with a soft-overage conversation — NPOs hitting that are already power users and will upgrade to custom contracts.

### Assumptions to validate during Phase 1

- Bot VM utilization rate (if bots average 40% idle time, real cost/hr jumps to ~$0.40 → recalculate)
- Concurrent capacity needs (meeting hours cluster at 10am/2pm — peak overprovisioning)
- Audio-egress pricing under real traffic (may be higher than modeled)
- Per-workspace bot sessions per hour (to detect runaway bot loops before billing impact)

### Cost-reduction opportunities (Phase 2+)

- Whisper.cpp or faster-whisper self-hosted on idle bot VMs → replaces Deepgram entirely: ~$0.26 → ~$0.03/hr. Defer until reliability is proven.
- Lossy audio compression pre-transcription (Opus @ 24kbps) → egress cut in half
- Batching summarization across short meetings → LLM cost reduction
- Regional bot placement based on meeting participant geography → egress cost optimization

---

## 9. Pricing Re-Assessment Checklist (Week 22–23)

Run this as a formal gate before Phase 3 kickoff. Block calendar 2 days.

### Data to pull

- [ ] Median, p75, p95 meeting-hours consumption per user per month
- [ ] Distribution of meeting-profile usage (retire the bottom 2 if usage <5%)
- [ ] Recall.ai + Deepgram + LLM spend per workspace per month
- [ ] Tier mix of new signups (% Steward / Mission / Foundation)
- [ ] Upgrade rate from Steward → Mission at month 3
- [ ] Churn rate by tier
- [ ] Bundle adoption rate (% of accounts that have Pulse or Logos Vision too)
- [ ] NPO-verified percentage of signups
- [ ] Top 3 cited purchase reasons from sales calls

### Questions to answer

- [ ] Is Mission tier gross margin ≥70% at actual (not cap) usage?
- [ ] Is anyone hitting hour caps? If >30% hit monthly, caps too tight. If <5% hit in 6 months, caps too loose.
- [ ] Is "cross-app semantic search" driving purchases? (If yes, gate harder to ecosystem bundles)
- [ ] Which tier boundary gets debated most in sales conversations? That's the wrong line.
- [ ] At current prices, is CAC payback <12 months?

### Decisions to make (document rationale)

- [ ] Ratify or adjust Steward price
- [ ] Ratify or adjust Mission price
- [ ] Ratify or adjust Foundation price
- [ ] Ratify or adjust hour caps
- [ ] Ratify or adjust overage rate
- [ ] Ratify or adjust NPO discount %
- [ ] Ratify or adjust bundle discount %
- [ ] Go / no-go on Phase 3 as scoped (vs. trimming or re-ordering)
- [ ] Build-vs-buy bot decision revisited

### Outputs

- Updated `ENTOMATE_PRICING.md` doc
- Pricing-change comms plan (for any customers already signed)
- Phase 3 milestone re-scoped in GitHub project board

---

## 10. Definition of Done — Gap Closing

We're done closing gaps when a blind feature comparison against **Fathom Business ($22/user/mo)** lands as follows:

**Entomate wins on:**
- Ecosystem data sync (no competitor has Pulse + Logos Vision + meetings in one data plane)
- NPO meeting profiles (Board, Grant, Donor, Volunteer)
- Workflow automation (node editor vs their zapier-only)
- Team analytics at NPO scale (not Gong-heavy, but relevant)
- Grant-compliance audit log retention

**Entomate ties on:**
- Bot capture quality (Meet/Zoom/Teams)
- Speaker diarization
- Auto follow-up drafts
- Real-time coaching
- SSO/SAML (Foundation tier)

**Entomate acceptably loses on:**
- Deep Salesforce/HubSpot feature parity (we push toward Logos Vision)
- Native mobile parity (PWA is our answer until usage forces otherwise)
- Enterprise-sales deal scoring (not our target market)

---

## 11. Open Questions

- [ ] Do we offer a free tier? (None in current model; Otter, Fireflies, Fathom, tl;dv all do)
- [ ] Does the NPO discount apply on top of the ecosystem bundle discount? (Default: yes, stack)
- [ ] Zoom Marketplace listing timing — Phase 2 or Phase 3?
- [ ] Do we need a SOC 2 Type II audit for Foundation tier, or is Type I readiness enough?
- [ ] What's the data retention default? (GDPR right-to-delete by workspace owner)
- [ ] Multi-language support roadmap (Spanish/French/Portuguese for global NPO work)?
- [ ] Does Pulse's billing system support metered overage, or do we need custom billing?

---

## 12. Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-23 | Initial draft | Claude + Aegis{FM} |
