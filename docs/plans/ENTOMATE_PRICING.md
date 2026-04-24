# Entomate Pricing

**Status:** Provisional (ratifies at Pricing Re-Assessment Checkpoint, Week 35 of gap-closing plan)
**Owner:** Aegis{FM}
**Created:** 2026-04-23
**Supersedes:** All earlier informal pricing drafts
**See also:** [ENTOMATE_GAP_CLOSING_PLAN.md](./ENTOMATE_GAP_CLOSING_PLAN.md) — source of the engineering sequencing and COGS model this pricing depends on.

---

## 1. Pricing Philosophy

Entomate serves the nonprofit sector as part of the QntmEcos Ecosystem (Logos Vision + Pulse + Entomate). Pricing must:

- Be **accessible to small NPOs** without requiring a TechSoup gatekeeping flow (in-app 501(c)(3) verification instead)
- **Sustain ≥70% blended gross margin** at expected p50 usage, with bot infrastructure owned in-house
- **Push larger orgs up the tier stack** cleanly, so the unit economics work at every level
- **Reward ecosystem purchases** meaningfully — if an NPO commits to 2+ apps, they get a better deal than assembling equivalent functionality elsewhere
- **Be readable on a single page** — NPO decision-makers don't have time to decode seat/add-on mazes

### Alignment to sibling apps

| App | Tier model | Why |
|-----|-----------|-----|
| Logos Vision | 3-tier (Seedling / Growth / Legacy) | Natural CRM scale gradient |
| Pulse | 2-tier flat + overage (Team with hard cap / Scale with overage) | Messaging volume is the natural lever |
| **Entomate** | **3-tier with feature + capacity gradient** | Meeting intelligence has two metering axes (hours + features); 3 tiers fit the NPO scale distribution better |

---

## 2. Tier Structure (Public)

All prices are **per user, per month, billed annually**. Monthly billing available at a 25% premium.

| | **Steward** | **Mission** | **Foundation** |
|---|---|---|---|
| **Price (annual)** | **$15/user/mo** | **$29/user/mo** | **$49/user/mo** |
| **Price (monthly)** | $19/user/mo | $36/user/mo | $61/user/mo |
| **Target buyer** | Solo ED / small ministry / startup NPO | Mid-size NPO ops or grant team | Large NPO / foundation / multi-site ministry |
| **Meeting hours** | 20 hrs/user/mo | 40 hrs/user/mo | 120 hrs/user/mo (fair-use) |
| **Overage** | $0.95/hr | $0.75/hr | Conversation → custom plan |
| **AI summaries** | 30/user/mo | Unlimited | Unlimited |
| **Meeting profiles** | Standard 5 | All 8 (incl. Board, Grant, Donor, Volunteer) | All 8 + custom profile editor |
| **Logos Vision sync** | Read-only | Bidirectional | Bidirectional + real-time events |
| **Pulse notifications & inbox** | ✓ | ✓ | ✓ |
| **Cross-app ecosystem search** | Own data only | Full ecosystem | Full ecosystem + API |
| **Workflow automation** | 3 workflows | 25 workflows | Unlimited |
| **Real-time coaching** | — | ✓ | ✓ |
| **Team analytics dashboard** | — | Basic | Advanced (grant velocity, board throughput) |
| **Follow-up email drafts** | — | ✓ | ✓ |
| **SSO / SAML** | — | — | ✓ |
| **Public API + webhooks** | — | — | ✓ |
| **Audit log retention** | 30 days | 1 year | 7 years (grant-compliance ready) |
| **Support** | Community + docs | Email, 2-biz-day SLA | Dedicated CSM + priority response |
| **Data retention default** | 30 days | 1 year | 7 years |
| **Platforms (Phase 1.5+)** | Google Meet, Zoom, Teams | Google Meet, Zoom, Teams | Google Meet, Zoom, Teams |

### Tier gating rationale

- **Steward**: Deliberately undercuts Otter Pro ($10) only slightly (at $15) while adding NPO profiles and ecosystem sync (read-only). Keeps solo NPO staff in the door. Read-only sync means we aren't pushing workflow-automation compute costs onto the lowest-margin tier.
- **Mission**: The workhorse tier. Priced between Fireflies Business ($19) and Otter Business ($20) with meaningfully more: bidirectional Logos Vision sync, all 8 profiles, 25 workflows, coaching. This is where the ecosystem value proves itself.
- **Foundation**: Positioned at Fireflies Enterprise ($39) territory but under Grain Business ($48). SSO + 7-year audit log + API + custom profiles justify the step-up. Fair-use at 120 hrs prevents runaway COGS; power users with real volume convert to custom plans.

---

## 3. Discounts

### 3.1 NPO Verification Discount — 30% off all tiers

Applied automatically to any workspace where the primary admin verifies 501(c)(3) status (US) or recognized charity status (international). Verification flow:
- In-app upload of determination letter OR automated IRS Exempt Organization Select Check lookup by EIN
- Approved within 24 hours (automated) or 3 business days (manual review)
- Renewed annually

**Effective NPO prices:**

| Tier | Public | NPO-verified |
|------|--------|--------------|
| Steward | $15 | **$10.50** |
| Mission | $29 | **$20.30** |
| Foundation | $49 | **$34.30** |

### 3.2 Ecosystem Bundle Discount — 25% off Entomate

Applied when the same workspace has **active paid subscriptions to at least one other ecosystem app** (Logos Vision or Pulse) in the same billing cycle.

### 3.3 Discount Stacking

NPO + Ecosystem discounts **stack multiplicatively**:

| Tier | Public | NPO only | Ecosystem only | NPO + Ecosystem (stacked) |
|------|--------|----------|----------------|---------------------------|
| Steward | $15 | $10.50 | $11.25 | **$7.88** |
| Mission | $29 | $20.30 | $21.75 | **$15.23** |
| Foundation | $49 | $34.30 | $36.75 | **$25.73** |

**This is the headline number for NPO marketing:** a verified NPO using the full Ecosystem gets Entomate Mission at ~$15/user/mo — below every meaningful competitor's standard price, with deep ecosystem integration nobody else can offer.

### 3.4 Annual Billing Discount

All prices above are the annual rate. Monthly billing adds 25% (not 33%, not 40%). Annual is still strongly incentivized but we don't want to gate NPOs with tight cash flow out of the product.

### 3.5 Founding Partner Program (limited, time-boxed)

First 10 design partners who sign letters of intent during Phase 1:
- 6 months free on Mission tier (value: $174 at NPO rate)
- 50% lifetime discount on whichever tier they settle on after trial
- Name in case studies (opt-in)
- Direct founder access for feedback

Caps at 10 partners and closes Week 20. Not renewed.

---

## 4. Overage Behavior

### 4.1 Steward (20 hrs/user/mo)

- Overage warning surfaces at 80% of cap
- Overage auto-billed at $0.95/hr up to 2x cap (40 hrs total)
- At 2x cap, **bot stops capturing new meetings** and admin is prompted to upgrade to Mission (or add a one-time hour pack)
- Hour packs available: +10 hrs for $8, +25 hrs for $18

### 4.2 Mission (40 hrs/user/mo)

- Overage warning at 80%
- Overage auto-billed at $0.75/hr with no hard cap, but:
- At 2x cap, workspace is flagged for a check-in call to assess whether Foundation is a better fit
- Hour packs available: +20 hrs for $13, +50 hrs for $30

### 4.3 Foundation (120 hrs/user/mo fair-use)

- No auto-billing overage; "fair use" is a soft limit
- At 150% of fair use for 2 consecutive months, account manager initiates custom-plan conversation
- No per-hour overage rate published — Foundation users who regularly exceed fair use are either enterprise candidates or the metric is telling us Foundation's scope is wrong, which informs a re-assessment

### 4.4 Anti-Abuse

- Hard cap: no single workspace exceeds 500 bot hours/day without manual approval
- Per-user-day cap: 12 hours (humans don't meet more than that honestly)
- Runaway-session kill: bot VM sessions >4 hours auto-terminate with user notification

---

## 5. Billing & Operations

### 5.1 Payment Provider

Stripe (same account/setup as Pulse — reuse price IDs pattern documented in [project_stripe_config.md](C:\Users\Aegis{FM}\.claude\projects\f--pulse1\memory\reference_stripe_config.md)).

### 5.2 Proration

- Upgrades: prorated mid-cycle, credit applied
- Downgrades: take effect at next cycle
- Seat adds: prorated
- Seat removes: credit at next cycle

### 5.3 Payment Failures

- 3 grace days with email + in-app warnings
- At day 4: read-only mode (meetings stop being captured, existing data viewable)
- At day 14: workspace paused (data retained per tier retention setting)
- At day 90: data deletion per retention policy unless admin restores

### 5.4 Refunds

- Annual billing: prorated refund within 30 days of purchase
- Monthly: no refunds, cancellation takes effect end of cycle
- NPO partners in good standing: case-by-case, flexible

---

## 6. COGS & Margin Model

Summarized from [gap-closing plan §8](./ENTOMATE_GAP_CLOSING_PLAN.md). In-house bot stack.

### Variable COGS: ~$0.71/meeting-hour

| Component | Cost |
|-----------|------|
| Bot compute (dedicated VM) | $0.25/hr |
| Bot egress | $0.05/hr |
| Deepgram Nova-3 | $0.26/hr |
| LLM summarization | $0.10/hr |
| LLM embeddings | $0.02/hr |
| Storage | $0.03/hr |

### Margin scenarios (Mission tier, $29 public / $20.30 NPO / $15.23 NPO+bundle)

| Usage scenario | COGS | Margin @ $29 | Margin @ $20.30 | Margin @ $15.23 |
|----------------|------|--------------|-----------------|-----------------|
| Light (5 hrs/mo) | $3.55 | 88% | 83% | 77% |
| Typical p50 (12 hrs/mo) | $8.52 | 71% | 58% | 44% |
| Heavy p75 (25 hrs/mo) | $17.75 | 39% | 13% | **Loss** |
| At cap (40 hrs/mo) | $28.40 | 2% | **Loss** | **Loss** |

### What this margin table tells us

- **Mission at $29 public has healthy margin through p75 usage.** Good.
- **Mission at NPO rate ($20.30) breaks down above p75 usage.** The $0.75/hr overage rate recoups this (overage contribution margin = ~$0.04/hr — effectively zero but not negative).
- **Mission at NPO+bundle rate ($15.23) only works at p50 or below.** This is the most discounted customer and we need to monitor their usage distribution carefully. If >30% of NPO+bundle customers go above p50 usage, we're losing money on that segment and must either:
  - Cap the bundle discount to Steward + Foundation (not Mission)
  - Tighten Mission cap to 25 hrs
  - Or raise NPO+bundle floor price

### Phase 2 cost-reduction levers (not priced-in yet)

These can widen margin by ~30–50 percentage points once proven:
- Self-hosted Whisper on idle bot VMs (saves $0.26/hr Deepgram)
- Opus audio compression (halves egress)
- Regional bot placement (further egress cut)

**Do not price against these savings until they ship in production.**

---

## 7. Upgrade & Downgrade Triggers

Used for in-product prompts, email flows, and CS outreach.

### Steward → Mission prompts when:
- Hitting 80% of hour cap consistently (3 months running)
- Attempting to use a profile not in Standard 5 (Board/Grant/Donor/Volunteer)
- Attempting to create workflow #4
- Viewing team analytics placeholder
- Requesting bidirectional Logos Vision sync

### Mission → Foundation prompts when:
- Hitting 80% of 40-hr cap consistently
- Admin asks about SSO
- Workspace size crosses 25 paid seats
- API usage requested
- Compliance/audit-log extension requested (e.g., grant reporting)

### Any tier → custom/enterprise when:
- Foundation fair-use exceeded 150% for 2 months
- >100 paid seats
- Request for dedicated infrastructure or non-standard DPA

---

## 8. Re-Assessment Schedule

Pricing is **not fixed**. Review triggers:

| Trigger | Review |
|---------|--------|
| End of Phase 2 (Week 35) | Full re-assessment per plan §9 |
| Any cost-anomaly issue tagged `cost-risk` + `pricing doc needs revisit` | Targeted review of affected tier |
| Quarterly (every 13 weeks post-launch) | Light review of usage distributions and margin |
| Competitor price move >15% | Monitor; re-assess only if we're at risk of misaligned positioning |
| Major new feature launch (Phase 3/4) | Consider whether it justifies tier re-gating |

### Commitments to existing customers at re-assessment

- Published prices may rise for new customers
- Existing paid customers get a **12-month price lock** from their signup date
- NPO discount rate is guaranteed so long as 501(c)(3) status is maintained
- Founding partner 50% lifetime discount is **permanent** for as long as they remain paying

---

## 9. Open Questions

- [ ] Do we offer a free tier? (Current answer: no — competitor free tiers create expectation we can't support on NPO margins. Revisit if customer acquisition is too hard.)
- [ ] Add a per-seat minimum for Foundation (e.g., 5 seats)? (Probably yes — otherwise single-seat Foundation customers disproportionately consume CSM time.)
- [ ] Annual-only for Foundation tier? (Lean yes — matches expectations at that price point, reduces billing churn admin cost.)
- [ ] Currency & international pricing — USD only at launch, or EUR/GBP equivalent? (USD only at launch; revisit at ~20 non-US customers.)
- [ ] Non-profit verification outside the US: what's the equivalent lookup? (Phase 1 deliverable: document accepted equivalents — UK charity number, Canadian CRA, etc.)

---

## 10. Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-23 | Initial draft with build-own-bot COGS model and 3-tier structure | Claude + Aegis{FM} |
