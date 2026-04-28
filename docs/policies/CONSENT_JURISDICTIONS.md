# Consent Jurisdictions — Engineering Reference

> ⚠️ **Engineering reference, not legal advice.** This document captures the
> product team's working understanding of meeting-recording consent rules
> across jurisdictions, for the purpose of building product features
> (`workspace_settings.data_controls_json.consent_jurisdiction`, launcher UI
> disclosure prompts, the opt-out email flow). It has **not** been reviewed
> by counsel. Counsel review is tracked in
> [COUNSEL_REVIEW_PACKET.md](./COUNSEL_REVIEW_PACKET.md).

**Last updated:** 2026-04-27 (P1.7 Slice 4)

---

## TL;DR

- Default product posture is **one-party consent assumed** (`permissive`):
  the meeting organizer's affirmation at launch is treated as sufficient.
- Workspaces can opt into a stricter posture (`two_party` or `gdpr`) which
  surfaces a more prominent consent prompt at bot launch. Slice 4 does not
  enforce these settings beyond UI.
- The legal obligation to obtain valid consent always rests with the
  organizer; this setting and our disclosures are product guidance, not a
  legal shield.

---

## United States

### Federal baseline

18 U.S.C. § 2511 — federal wiretap law is **one-party consent**: a
participant in a conversation may record it without notice to others.
Most US states follow this rule.

### Two-party / all-party consent states

The following states require **all** parties to consent to recording.
Where a meeting has any participant in one of these states, treat the
all-party-consent rule as controlling. (Whether the law of the recorder
or the law of the recorded controls is itself unsettled in some
multi-state cases — see *open questions* in the counsel review packet.)

| State | Statute | Notes |
|---|---|---|
| California | Cal. Penal Code § 632 | Strict — written or verbal all-party consent |
| Connecticut | Conn. Gen. Stat. § 52-570d | Civil all-party consent; criminal is one-party |
| Delaware | Del. Code Tit. 11 § 2402(c)(4) | Wiretap statute; in-person ambiguous |
| Florida | Fla. Stat. § 934.03 | All-party for "oral communications" with reasonable expectation of privacy |
| Illinois | 720 ILCS 5/14-2 | Strict; criminal exposure |
| Maryland | Md. Cts. & Jud. Proc. § 10-402 | All-party for private conversations |
| Massachusetts | M.G.L. c. 272 § 99 | "Wiretapping" defined to include any secret recording |
| Montana | Mont. Code Ann. § 45-8-213 | Exception: clearly identified recording with notice |
| Nevada | Nev. Rev. Stat. § 200.620 | All-party for in-person; one-party for telephone (NV Sup. Ct.) |
| New Hampshire | RSA 570-A:2 | Strict |
| Pennsylvania | 18 Pa. Cons. Stat. § 5703 | All-party for "oral communications" |
| Washington | RCW 9.73.030 | All-party with announcement exception |

### Practical implication for Meet Mate

A clearly-identified bot named "Meet Mate" that posts a chat message on
join announcing recording **arguably** satisfies the "announcement" /
"clearly identified recording" carve-outs in Montana and Washington, and
provides **notice** in all other two-party states. Whether announcement
+ continued participation constitutes **consent** under those statutes
is a question for counsel. Some interpretations: a participant who hears
the announcement and stays in the meeting has impliedly consented. Other
interpretations: implied consent is insufficient where the statute
requires affirmative all-party consent.

### Federal sectoral overlays

- **HIPAA (45 C.F.R. Parts 160, 164):** healthcare meetings discussing
  PHI may require BAAs with all subprocessors that touch the recording.
  Meet Mate is **not** currently HIPAA-suitable; we do not have BAAs
  with Recall.ai, Deepgram, or Supabase.
- **GLBA (15 U.S.C. § 6801 et seq.):** financial services may have
  additional notice obligations.
- **FERPA (20 U.S.C. § 1232g):** educational records.

---

## European Union and United Kingdom

### GDPR (Regulation 2016/679)

Meeting recording captures personal data (Art. 4(1)) and may capture
special categories (Art. 9 — biometric voice data is debated). Lawful
basis under Art. 6 is required:

| Basis | Article | Applicability to recording |
|---|---|---|
| Consent | 6(1)(a) | Specific, freely given, informed, unambiguous; revocable. Strongest basis. |
| Contract performance | 6(1)(b) | Where recording is necessary for a contracted service the data subject is party to |
| Legal obligation | 6(1)(c) | Rare for meeting recording |
| Vital interests | 6(1)(d) | Not applicable |
| Public task | 6(1)(e) | Public authorities only |
| Legitimate interests | 6(1)(f) | Requires balancing test; weak basis for recording without notice |

**Practical posture:** for meetings that may include EU/UK
participants, prefer explicit consent (Art. 6(1)(a)). The Meet Mate
organizer-affirmation gate + pre-meeting opt-out email + in-meeting
chat announcement together approximate notice + opt-out, but do **not**
constitute affirmative opt-in consent per Art. 6(1)(a)'s strict
reading.

### ePrivacy Directive (2002/58/EC)

Article 5(1) prohibits "interception" and "surveillance" of electronic
communications without consent. Whether an AI notetaker bot in a video
meeting is an "interceptor" is unsettled. National implementations vary
(e.g. Germany's TKG § 89 is stricter than France's CPCE).

### UK GDPR + Data Protection Act 2018

Substantively similar to EU GDPR. The ICO has published guidance
treating workplace recording as requiring a clear lawful basis and
notice; consent is preferred where the relationship is non-coercive.

### Practical implication for Meet Mate

Workspaces with `consent_jurisdiction = 'gdpr'` should:
1. Provide attendees a meaningful opt-out before the meeting (the
   pre-meeting email satisfies the *notice* component, not the
   *opt-in* component).
2. Document the lawful basis in their own records — typically Art. 6(1)(a)
   consent or 6(1)(f) legitimate interest with a balancing test.
3. Honor right-to-delete requests (the Privacy Policy commits to a 72h
   target via `/data-deletion`).

---

## Canada

### PIPEDA (federal)

Personal Information Protection and Electronic Documents Act requires
**meaningful consent**. Knowledge-and-consent-when-collecting principle
(Schedule 1, Principle 3). Opt-out generally **insufficient** for
sensitive personal information; voice recording is typically treated as
sensitive.

### Quebec (Law 25 / Bill 64)

Effective 2023–2024 in stages. Stricter than PIPEDA: explicit consent
required for biometric data (likely includes voice in some contexts).

### Practical implication

Treat Canadian participants similarly to GDPR — prefer explicit consent
or a strong legitimate-interest justification with notice.

---

## Australia

### Privacy Act 1988 (Cth) — Australian Privacy Principles

APP 3 (Collection of solicited personal information) requires that
collection be necessary and that the entity collect by lawful and fair
means. APP 5 (Notification) requires notice at or before the time of
collection.

### State surveillance device laws

Variable by state. NSW, VIC, WA, NT, and QLD have private-conversation
prohibitions analogous to US two-party consent.

| Jurisdiction | Statute |
|---|---|
| New South Wales | Surveillance Devices Act 2007 (NSW) |
| Victoria | Surveillance Devices Act 1999 (Vic) |
| Western Australia | Surveillance Devices Act 1998 (WA) |
| Queensland | Invasion of Privacy Act 1971 (Qld) |

### Practical implication

For Australian participants, default to all-party-consent treatment.
Notice via the Meet Mate announcement + opt-out email is necessary but
likely not sufficient on its own.

---

## Singapore

### PDPA (Personal Data Protection Act 2012)

Notification + consent obligations. Recording captures personal data;
the organization is responsible for obtaining consent before
collection. Deemed consent (by conduct after notice) is recognized in
some contexts but is being narrowed.

### Practical implication

Notice via the Meet Mate announcement is consistent with PDPA but
explicit opt-in is the safer posture for non-employee participants.

---

## Open questions tracked for counsel review

1. **Multi-jurisdiction meetings.** If a CA participant + a NY
   participant are in the same call, which jurisdiction's consent rules
   apply? (The recorder's location? The recorded's location? The most
   restrictive jurisdiction in the meeting?)
2. **Bot identity in two-party states.** Does a clearly-identified
   recording bot ("Meet Mate") posting a chat announcement satisfy the
   "all parties consent" threshold? Or does it only satisfy notice,
   leaving an open consent question?
3. **GDPR Art. 9 special-category data.** Does diarized voice data
   constitute biometric data under Art. 9? If so, is Art. 9(2)(a)
   explicit consent required (vs. Art. 6 lawful basis alone)?
4. **ePrivacy Directive treatment of an AI bot.** Is the bot an
   "interceptor" under Art. 5(1) ePrivacy?
5. **Children/minors in meetings.** What happens if a minor is
   unwittingly in a Meet Mate meeting? COPPA + Art. 8 GDPR + state
   parallels. Currently no detection mechanism.
6. **Cross-border transfers.** US-West-2 hosting + EU/UK users requires
   a transfer mechanism (SCCs / IDTA). Privacy §9 mentions this but
   we have no specific contractual mechanism with customers.
7. **Sectoral overlays.** HIPAA / GLBA / FERPA / FCA-regulated
   meetings — should we proactively block bot launches, or rely on
   workspace admins to know?
8. **Retention floor conflicts.** Some jurisdictions / sectors have
   minimum retention requirements (e.g. financial services records,
   healthcare under state law). Could our 30-day setting put a
   customer in violation?

---

## Sources

- [Reporters Committee for Freedom of the Press — Reporter's Recording Guide](https://www.rcfp.org/reporters-recording-guide/) — state-by-state US summary
- [Justia](https://law.justia.com/) and [Cornell LII](https://www.law.cornell.edu/) for primary US statutes
- [EDPB Guidelines 05/2020 on consent under GDPR](https://edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en)
- [ICO guidance on workplace monitoring](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/employment/monitoring-of-workers/)
- [OPC Canada — PIPEDA fair information principles](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/)
- [OAIC — Australian Privacy Principles](https://www.oaic.gov.au/privacy/australian-privacy-principles)
- [PDPC Singapore guidance](https://www.pdpc.gov.sg/Overview-of-PDPA/The-Legislation/Personal-Data-Protection-Act)

---

## Maintenance

This doc is updated when:
1. Counsel returns review feedback (next: pending Slice 4 packet).
2. A statute is amended that materially changes our posture.
3. Product adds a jurisdiction-aware enforcement layer beyond the
   current UI prompt.

Issues / corrections: file in the project tracker or email
`fm1@qntmecos.com`.
