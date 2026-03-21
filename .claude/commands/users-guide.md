# Entomate User's Guide — Writer & Updater

You are the Entomate User's Guide agent. Your role is to **write, maintain, and update** the Entomate User's Manual and its interactive dashboard every time this command is run.

---

## Step 1 — Find Existing Guide Files

Look for these files in the project:

1. **Markdown User Guide**: `docs/USER_GUIDE.md`
2. **Interactive Dashboard Component**: `frontend/src/components/UsersGuide/UsersGuide.jsx`
3. **Dashboard Data File**: `frontend/src/components/UsersGuide/guideData.js`

Use the Read tool to load any that exist. If none exist, you will create them from scratch.

---

## Step 2 — Check Recent Git Commits for Changes

Run:
```
git log --oneline -20
```

Then run:
```
git diff HEAD~5 --name-only
```

Look at the changed files. For each changed file:
- If it's in `frontend/src/components/` — read it to understand a new or updated UI feature
- If it's in `backend/routes/` or `backend/services/` — read it to understand new API functionality
- If it's in `frontend/src/pages/` — read it to understand page-level changes

Use this information to identify which sections of the User Guide need updating or adding.

---

## Step 3 — Assess What Needs to Change

Compare what you found in Step 2 against the current contents of `docs/USER_GUIDE.md`. Identify:
- New features to add
- Changed behavior to update
- New sections needed
- Outdated content to remove

---

## Step 4 — Update or Write the User's Guide

Write or update `docs/USER_GUIDE.md` following this exact structure:

```
# Entomate User's Guide

**Version**: [match package.json version]
**Last Updated**: [today's date]

---

## Table of Contents

[numbered list of all sections with anchor links]

---

## 1. Introduction
- What is Entomate?
- Who is it for?
- How to get started
- Key concepts (Meetings, Action Items, Workflows, Teams)

## 2. Getting Started
- Creating your account
- Signing in
- Setting up your profile
- Navigating the dashboard

## 3. Dashboard
- Overview of the main dashboard
- Meeting intelligence summary
- Recent activity feed
- Quick actions

## 4. Meetings
- Connecting your calendar
- Recording and transcribing meetings
- Viewing meeting summaries
- Meeting insights and highlights

## 5. Action Items
- How action items are detected
- Reviewing and editing action items
- Assigning action items to team members
- Tracking completion
- Bulk actions

## 6. Workflows
- What are Workflows?
- Creating a workflow
- Workflow triggers and conditions
- Workflow actions and automations
- Testing workflows with dry-run
- Managing active workflows

## 7. AI Intelligence
- AI-powered meeting summaries
- Action item extraction
- Priority and deadline detection
- Follow-up detection
- Assignment suggestions

## 8. Team Management
- Inviting team members
- Managing roles and permissions
- Team activity overview

## 9. Integrations
- Connecting your calendar (Google, Microsoft)
- Slack integration
- CRM integrations
- Webhook configuration

## 10. Analytics & Reporting
- Meeting frequency reports
- Action item completion rates
- Team engagement metrics
- Exporting reports

## 11. Settings & Customization
- Profile and account settings
- Notification preferences
- Connected accounts
- API key management
- Privacy settings

## 12. Troubleshooting & FAQ
- Common issues and fixes
- How to get help
- Reporting a bug
```

**Writing Rules for the Guide:**
- Use plain, friendly language — no jargon
- Each section uses numbered steps for procedures
- Each section has a brief intro paragraph
- Include tips labeled **Tip:** for useful shortcuts or tricks
- Do NOT include code, SQL, or implementation details
- Keep each section self-contained so users can jump to any section

---

## Step 5 — Confirm and Report

When finished, output a summary:

```
## User's Guide Update Complete

**Files Updated:**
- docs/USER_GUIDE.md — [X sections, ~Y words]

**Changes Based on Recent Commits:**
- [List each commit and what it caused you to add/update in the guide]

**New Sections Added:** [list]
**Sections Updated:** [list]
```

---

## Important Notes

- This is a **user-facing document** — write for non-technical users
- Never paste code samples or database details in the User Guide
- Always check git history first before writing — do not invent features that don't exist
- If a section already exists and hasn't changed, leave it as-is
- When in doubt, read the actual component or route file to understand what a feature does before documenting it

Target argument: $ARGUMENTS
