# Counsel Review Packet — Entomate / Meet Mate

> Single-document brief for legal review. Written so a lawyer can review
> in one sitting and provide structured feedback. Hand this to counsel
> with read access to the live `/privacy`, `/terms`, and
> `/data-deletion` pages, and to this repository's
> [`docs/policies/CONSENT_JURISDICTIONS.md`](./CONSENT_JURISDICTIONS.md).

**Status:** awaiting first review.
**Last updated:** 2026-04-27.
**Document owner:** Frank Messana (`fm1@qntmecos.com`).
**P1.7 issue:** [#7 — Consent UX + Compliance Flows](https://github.com/FatherSonOne/entomate/issues/7).

---

## 1. What we built

**Entomate** is an AI-powered meeting intelligence platform. Pre-launch
(early 2026), with internal use plus a small design-partner cohort. The
operator is QntmEcos / Frank Messana, sole employee. Hosted at
[entomate.onrender.com](https://entomate.onrender.com).

The headline feature is **Meet Mate**, an AI notetaker that:

- Joins Google Meet / Zoom / Microsoft Teams meetings as a visible
  participant with the display name "Meet Mate."
- Posts a chat message on join announcing recording (where the
  conferencing platform supports it via the bot infrastructure).
- Captures audio (and video where available).
- Produces a diarized transcript (speaker labels A/B/C, not named).
- Generates notes, summaries, and action items for the meeting host.

**No real-time recording features ship outside the bot path.** There is
also a separate browser-based local recorder used for self-recording
(the existing `frontend/src/components/MeetingRecorder` flow); that path
predates this packet and is out of scope here.

## 2. Data flows

```
[Meeting participants]
         │
         ▼
[Conferencing platform: Meet / Zoom / Teams]
         │  audio/video streams
         ▼
[Recall.ai bot infrastructure]            ─── DPA in place
         │
         ├── audio stream ──► [Deepgram]   ─── BYO API key, DPA in place
         │                       │
         │                    transcript
         │                       │
         ▼                       ▼
[Recall-hosted recording]   [Recall-hosted transcript]
         │                       │
         └─────────┬─────────────┘
                   │ URLs
                   ▼
        [Entomate backend on Render]
                   │
                   ▼
             [Supabase database — US-West-2]
                   │
                   ▼
        [Workspace members (organizer + admins)]
```

**Hosting regions:** all subprocessors are configured for US-West-2
(Oregon). Recall.ai's region pin was selected at workspace setup; we
have no current EU-hosted variant.

**Subprocessors** (full list on `/privacy` §3):
- **Recall.ai** — bot infrastructure, recording host, transcript host
- **Deepgram** — speech-to-text + diarization
- **Supabase** — database + authenticated file storage
- **Render** — application hosting
- **Resend** — transactional email (consent + deletion-request emails)
- **OpenAI / Google Gemini** — summarization and AI agent reasoning
- **Sentry** — error tracking (request bodies scrubbed)

## 3. Current consent posture

Implemented across P1.7 Slices 1–4:

| Layer | What it does | Where in code |
|---|---|---|
| **Bot self-identification** | Joins as "Meet Mate"; posts chat announcement on join (Recall config). | `backend/services/botOrchestrator.js` |
| **Organizer-side gate** | `/api/admin/bots/launch` requires strict `consentAcknowledged: true`. user_id + timestamp recorded on `bot_sessions`. | `backend/routes/bots.js` |
| **Pre-meeting opt-out email** | External attendees (organizer-provided list) receive an email with a per-recipient signed opt-out link. | `backend/services/consentEmailService.js` |
| **Opt-out flow** | Public `/opt-out/:token` page records the opt-out, notifies the organizer (notify-only — bot is **not** auto-stopped). | `backend/routes/consent.js`, `frontend/src/pages/OptOut.jsx` |
| **Per-workspace retention** | 30 / 90 / 365 days. Daily 03:00 UTC sweep deletes Recall-hosted media past the threshold. | `backend/services/retentionService.js` |
| **GDPR Art. 17 deletion** | Public `/data-deletion` form. Notify-only fulfillment by platform admin within 72h target. | `backend/routes/dataDeletion.js`, `frontend/src/pages/DataDeletion.jsx` |
| **Per-workspace jurisdiction posture** | `permissive` / `two_party` / `gdpr` setting; surfaces a stronger UI prompt at launch. Not currently enforced beyond UI. | `backend/routes/settings.js`, `frontend/src/components/settings/DataRetentionSettings.jsx` |

The Privacy Policy and Terms of Service are currently marked
"Effective 2026-04-27 — pending counsel review" in the §4 banner.

## 4. What we want counsel to review

1. **[Privacy Policy](https://entomate.onrender.com/privacy)** — full
   document. Particular attention to:
   - **§4** (Meeting Recording, Consent, and the Meet Mate Bot)
   - **§6** (Data Retention) — per-workspace 30/90/365 with daily sweep
   - **§8** (Your Rights) — pointer to `/data-deletion`
   - **§9** (International Transfers) — currently a placeholder

2. **[Terms of Service](https://entomate.onrender.com/terms)** — full
   document. Particular attention to:
   - **§3** (Customer Content license + AI training carve-out)
   - **§4** (Recording Consent — assignment of obligation to organizer)
   - **§13–14** (Limitation of Liability + Indemnification)
   - **§16** (Governing Law — currently a placeholder; see §6 below)

3. **Pre-meeting opt-out email copy.** The exact subject line, HTML
   body, and plain-text body live in
   [`backend/services/consentEmailService.js`](../../backend/services/consentEmailService.js).
   Is the disclosure and CTA legally sufficient as participant notice?

4. **Meet Mate in-meeting chat announcement.** Default template:
   *"Hey all — Meet Mate (an AI notetaker) is recording this meeting for
   {organizer}. Notes + transcript shared with the meeting host."* Is
   this language sufficient for recording disclosure in (a) federal
   one-party-consent jurisdictions, (b) US two-party-consent states,
   (c) GDPR jurisdictions?

5. **GDPR Article 17 fulfillment workflow.** 72-hour target,
   notify-only manual fulfillment by platform admin. The submission
   page is [/data-deletion](https://entomate.onrender.com/data-deletion).
   The fulfillment endpoint is `POST /api/consent/data-deletion/admin/:id/fulfill`.
   Is the SLA defensible? Is the email-match-only identity verification
   sufficient, or do we need a second-factor (e.g. email-confirmation
   click before fulfillment fires)?

6. **Jurisdiction breakdown.** The internal engineering reference at
   [`docs/policies/CONSENT_JURISDICTIONS.md`](./CONSENT_JURISDICTIONS.md)
   summarizes our current understanding of two-party-consent states,
   GDPR lawful basis, and other jurisdictions. Is it accurate? Are we
   missing material jurisdictions for design-partner outreach?

7. **Customer DPA template.** We do not currently have one. Do we
   need one for design partners, and what should it cover?

## 5. Common asks for legal review

These are areas the product team flagged proactively for review even
without a specific question:

1. **Data residency commitments.** All subprocessors are US-West-2.
   Can we make customer-facing commitments at the DPA level? What's
   the scope (storage only? processing only? backups too?)?
2. **Subprocessor list certification.** Privacy §3 lists subprocessors.
   Do we need a public, certified subprocessor list with change-notice
   provisions?
3. **Breach notification SLA.** GDPR is 72h to authority. What's the
   right customer-facing SLA?
4. **Employee NDA / confidentiality.** Currently Frank is the only
   person with direct access to customer recordings. Do we need formal
   NDAs in place before hiring (e.g. with a contractor or a first
   employee)? What scope (perpetual? duration-limited? carve-outs)?
5. **Cyber insurance / E&O coverage.** Given the sensitivity of meeting
   audio + transcript data, what's the right level of coverage to
   carry pre-launch and at first paying customer?
6. **Records of Processing (Art. 30 GDPR).** Required even for small
   controllers in some interpretations. Do we need to produce one?

## 6. Open questions where the product team is uncertain

1. **Multi-jurisdiction meetings.** If a CA participant + a NY
   participant are in the same call, which jurisdiction's consent
   rules apply? See `CONSENT_JURISDICTIONS.md` open question #1.
2. **Bot identity in two-party states.** Does the Meet Mate
   self-identification + chat announcement satisfy the all-party
   consent threshold, or only the notice threshold?
3. **GDPR Art. 9 special-category data.** Is diarized voice data
   biometric data under Art. 9? If so, do we need explicit consent
   per Art. 9(2)(a) (vs. Art. 6 alone)?
4. **ePrivacy Directive.** Is an AI bot in a meeting an "interceptor"
   under Art. 5(1) ePrivacy?
5. **Children/minors in meetings.** No detection. COPPA + Art. 8
   GDPR + state parallels — do we need to require organizer-side
   age affirmation?
6. **Special categories of data.** Health, financial, legal-privilege
   meetings — should we proactively block bot launches in
   regulated-industry workspaces, or rely on the customer to know?
7. **Cross-border transfers.** US-West-2 + EU/UK users requires
   SCCs / IDTA. Currently mentioned in Privacy §9 but no specific
   contractual mechanism. What's the minimum we need?
8. **Governing law / forum** in the Terms — currently a placeholder
   pending finalization. Where should QntmEcos / Entomate be
   established for this purpose?
9. **Required retention floor.** Could our 30-day setting put
   regulated-industry customers in violation of their own minimum
   retention obligations (financial services, healthcare)?
10. **Agent / agency relationships.** When the bot acts on the
    organizer's behalf, is Entomate the controller, the processor,
    or a joint controller under GDPR? Same question under PIPEDA
    and APP.

## 7. Pointers (live URLs + in-tree files)

| Resource | Where |
|---|---|
| Privacy Policy | [entomate.onrender.com/privacy](https://entomate.onrender.com/privacy) |
| Terms of Service | [entomate.onrender.com/terms](https://entomate.onrender.com/terms) |
| Data deletion form | [entomate.onrender.com/data-deletion](https://entomate.onrender.com/data-deletion) |
| Bot ops runbook | [`docs/runbooks/BOT_OPS.md`](../runbooks/BOT_OPS.md) |
| Jurisdiction breakdown | [`docs/policies/CONSENT_JURISDICTIONS.md`](./CONSENT_JURISDICTIONS.md) |
| Email template source | [`backend/services/consentEmailService.js`](../../backend/services/consentEmailService.js) |
| Bot announcement source | [`backend/services/botOrchestrator.js`](../../backend/services/botOrchestrator.js) (search for `DEFAULT_ANNOUNCEMENT_TEMPLATE`) |
| GitHub issue tracker | [issue #7](https://github.com/FatherSonOne/entomate/issues/7) |

## 8. How to provide feedback

Choose whichever fits the workflow best:

- **Annotated PDF of this packet** — email annotations to
  `fm1@qntmecos.com`.
- **GitHub issue comments** on
  [issue #7](https://github.com/FatherSonOne/entomate/issues/7).
- **Markdown PR** against this repo if the firm is comfortable with
  Git — branch naming `legal/<initials>-review`.
- **Direct email** to `fm1@qntmecos.com` — preferred for time-sensitive
  flags.

For each item flagged, please indicate severity:
- **Block** — must be resolved before any external use.
- **Address before launch** — must be resolved before public launch /
  paid customers.
- **Eventually** — quality improvement, not blocking.
