# Entomate User Guide

**Version:** 1.0.0
**Date:** March 29, 2026

Welcome to the Entomate User Guide. This document covers every feature of the platform and walks you through how to use each one.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Dashboard](#3-dashboard)
4. [Meetings](#4-meetings)
5. [Meeting Details](#5-meeting-details)
6. [Calendar](#6-calendar)
7. [Search](#7-search)
8. [Tasks](#8-tasks)
9. [Projects & Project Board](#9-projects--project-board)
10. [Goals & OKRs](#10-goals--okrs)
11. [Workflows](#11-workflows)
12. [Automations](#12-automations)
13. [AI Agents](#13-ai-agents)
14. [Analytics](#14-analytics)
15. [Reports & Exports](#15-reports--exports)
16. [Ecosystem Integration](#16-ecosystem-integration)
17. [Meeting Intelligence Profiles](#17-meeting-intelligence-profiles)
18. [Settings](#18-settings)
19. [Keyboard Shortcuts](#19-keyboard-shortcuts)
20. [Troubleshooting & FAQ](#20-troubleshooting--faq)

---

## 1. Introduction

Entomate is an AI-powered meeting intelligence platform that turns your meetings into organized, actionable outcomes. Instead of relying on memory or scattered notes, Entomate records and transcribes your meetings, then uses AI to extract action items, priorities, decisions, and follow-ups automatically.

Over time, the AI agents built into Entomate learn from your feedback. When you accept, override, or adjust a suggestion, the system remembers and improves its future recommendations. Workflows and automations connect your meeting outcomes to the tools you already use, so nothing falls through the cracks.

**Key concepts you will encounter throughout this guide:**

- **Meetings** — Recorded sessions that Entomate transcribes and analyzes.
- **Action Items** — Tasks extracted from meetings or created manually, tracked to completion.
- **Workflows** — Visual, node-based pipelines that process data and trigger actions.
- **Agents** — Intelligent bots that handle repetitive work like summarization, assignment, and notification.
- **Goals** — OKR-style objectives with measurable key results that cascade across your organization.

---

## 2. Getting Started

Setting up Entomate takes just a minute. There is no complex configuration required to get going.

### Signing In

1. Visit the Entomate landing page.
2. Click **Get Started**.
3. Sign in with your Google account (authentication is handled securely through Supabase OAuth).
4. You will be redirected to your Dashboard automatically.

### Navigating the Sidebar

The sidebar is organized into four groups so you can find what you need quickly:

- **Intelligence** — Dashboard, Meetings, Calendar, Search
- **Work** — Projects, Board, Tasks, Goals
- **Automation** — Workflows, Automations, Agents
- **Output** — Analytics, Reports

At the bottom of the sidebar you will find **Settings** and your **User Profile**.

**Tip:** Press **Ctrl+K** to open the Command Palette. It lets you jump to any page, run actions, and search without touching the mouse.

**Tip:** Toggle between dark and light mode by clicking the sun/moon icon in the top bar.

---

## 3. Dashboard

The Dashboard is your home screen. It gives you an at-a-glance summary of everything happening across your workspace so you can decide where to focus.

### Ring Gauges

At the top of the Dashboard you will see four ring gauges showing progress for **Meetings**, **Tasks**, **Projects**, and **Automations**. Click any ring to jump directly to that section.

### Intelligence Briefing

Below the gauges, the Intelligence Briefing provides:

- **Action item status** — How many items are open, in progress, or completed.
- **Stakeholder cards** — Key people across your meetings and their involvement.
- **Sentiment trends** — How the tone of your meetings has shifted over time.
- **Relationship insights** — Patterns in how you interact with contacts and teams.

### Daily Briefing

The Daily Briefing highlights tasks that are overdue or due today, along with overall task statistics to help you prioritize your day.

### System Status

A compact panel shows the health of your connected services: AI provider status, database connectivity, the count of recent meetings, and open tasks.

### Quick Actions

A Quick Actions bar lets you immediately:

- **Start Meeting** — Begin recording a new meeting.
- **New Task** — Create a task manually.
- **New Project** — Set up a new project.
- **AI Insights** — Open the AI analysis view.
- **Automations** — Jump to your automation library.

**Tip:** The greeting at the top of the Dashboard changes based on the time of day — morning, afternoon, or evening.

**Tip:** Sentiment is displayed with emoji indicators: Positive, Neutral, and Negative, so you can read the mood at a glance.

---

## 4. Meetings

The Meetings page is where you browse, search, and record all of your meetings.

### Browsing Meetings

Meetings appear as cards showing the title, a sentiment badge, a short summary, the date, duration, and attendees. Scroll through or use the search bar to find a specific meeting by title or summary text.

### Recording a New Meeting

1. Click the **New Meeting** button at the top of the page.
2. The Meeting Recorder opens with an audio visualizer.
3. Click **Start** to begin recording. A timer tracks the duration.
4. Click **Stop** when the meeting is finished.
5. Entomate automatically transcribes the recording and runs AI analysis.

### Deleting a Meeting

1. Open the meeting you want to remove.
2. Click the delete button.
3. Confirm the deletion in the dialog that appears.

**Tip:** You can also start a meeting from the Dashboard Quick Actions bar without navigating to the Meetings page first.

---

## 5. Meeting Details

Click any meeting card to open the full detail view. This is where Entomate's intelligence really shines, giving you a complete breakdown of what happened and what needs to happen next.

### Summary and Timelines

- **AI-Generated Summary** — A concise overview of the meeting written by AI.
- **Key Points Timeline** — Important moments laid out in order.
- **Decisions Timeline** — Specific decisions that were made, in sequence.

### Transcript

The full transcript is available in a scrollable viewer. You can read through the entire conversation as it was spoken.

### Action Items Panel

On the right side, the Action Items panel lists every extracted task. From here you can:

1. Mark an item as complete by clicking its checkbox.
2. Delete an item you do not need.
3. Create a new action item manually.

### Ask AI

Type a question about the meeting into the Ask AI box and get an answer drawn from the full meeting context. Each answer includes a confidence score so you know how certain the AI is.

**Tip:** Ask AI understands the full meeting context. Try asking follow-up questions — it remembers what you asked before in the same session.

### Sharing and Syncing

- **Share to Chat** — Send a meeting recap to Slack. Choose the target channel from a selector.
- **Sync to CRM** — Push action items to your connected CRM system.
- **Ecosystem sync status** — An indicator shows whether the meeting has been synced to connected Pulse and Logos Vision apps.

### Meeting Intelligence Panel

The AI suggests intelligence profiles based on the meeting content. These profiles customize how the analysis is run. See [Meeting Intelligence Profiles](#17-meeting-intelligence-profiles) for details.

---

## 6. Calendar

The Calendar gives you a unified view of your schedule, tasks, and goals in one place.

### Month View

The calendar displays a full month view. Use the navigation arrows to move between months. Click any date to see everything scheduled for that day.

### Connecting Google Calendar

1. Open the Calendar page.
2. Click **Connect Google Calendar**.
3. Authorize access through the Google OAuth prompt.
4. Your events will appear on the calendar automatically.

### Upcoming Items

A 14-day look-ahead panel shows everything coming up soon:

- Action items with due dates
- Goal deadlines
- Google Calendar events

### Quick Stats

At the top of the page, quick stat cards show your event count, due tasks, goal deadlines, and overdue count.

### Syncing Tasks

Click the **Sync Tasks** button to push your Entomate action items to Google Calendar as events, so they appear alongside your other commitments.

**Tip:** Clicking on an external calendar event opens it directly in Google Calendar.

---

## 7. Search

Search lets you find anything across your workspace, whether you know the exact words or just the general idea.

### Search Modes

- **Semantic Search** — The AI understands meaning, not just keywords. Great for queries like "meetings about budget concerns" even if the word "budget" was never used explicitly.
- **Keyword Search** — Traditional exact-text matching for when you know the specific term.

### Ask AI

The Ask AI panel lets you type natural-language questions about your entire workspace. For example: "What did we decide about the Q3 roadmap?"

### Search History and Saved Searches

Your recent searches are saved automatically. You can also pin frequently used searches for quick access later. A trending topics section highlights popular terms across your workspace.

### Exporting Results

1. Run your search.
2. Click the export button.
3. Choose **CSV** or **JSON** format.
4. The file downloads to your computer.

### Cross-App Search

If you have Ecosystem Integration enabled, search extends across Pulse and Logos Vision. You can find contacts, meetings, and deals from all three apps in a single query.

**Tip:** Semantic search is especially powerful for finding meetings about a topic when you do not remember the exact words used.

---

## 8. Tasks

Tasks in Entomate are created from meetings or manually, and the AI helps you prioritize and assign them intelligently.

### Creating a Task

Entomate uses a 3-step wizard:

1. **Create** — Enter the task title, description, and any relevant details.
2. **Prioritize** — Set priority level and due date. The AI will suggest values.
3. **Complete** — Review and confirm. The task is now live.

### AI Recommendations

When you create or manage tasks, the AI provides:

- **Assignment suggestions** — Who should own this task, based on past patterns.
- **Priority predictions** — Whether the task is likely high, medium, or low priority.
- **Deadline suggestions** — When the task should be completed, based on similar past items.

Each recommendation comes with an **Explainability Card** that shows the reasoning behind the suggestion. When you accept or override a recommendation, the AI learns from your decision and adjusts future suggestions accordingly.

### Managing Tasks

- **Filter** by status: All, Open, In Progress, or Done.
- **Search** tasks by keyword.
- **Complete** a task by clicking its animated checkbox.
- **Delete** tasks you no longer need.

### Visual Indicators

- **Priority badges:** High (crimson), Medium (amber), Low (neutral).
- **Overdue highlighting** makes it clear when something is past due.
- **Project links** let you jump to the associated project.

**Tip:** Tasks created from meetings include a link back to the source meeting, so you always have the full context.

---

## 9. Projects & Project Board

Projects group related tasks, meetings, and goals together. The Project Board gives you a visual way to manage work across your team.

### Projects Page

#### Creating a Project

Use the 3-step wizard:

1. Enter the project name, description, and key details.
2. Set the status, deal value, and end date.
3. Review and confirm.

Projects appear as cards in a grid layout, showing their status, deal value, and end date.

#### Status Indicators

- **Active** (green) — Work is underway.
- **Planning** (amber) — Still being set up.
- **Completed** (gray) — Finished.
- **Archived** (dimmed) — No longer active but kept for reference.

### Project Detail

Click a project card to open its detail view, where you can see:

- Task statistics (open, in progress, done)
- Add new tasks directly to the project
- Related meetings linked to the project

### Project Board (Kanban)

The Board page presents your projects and tasks as a Kanban board:

- **Drag and drop** tasks between columns to update their status.
- **Team workload visualization** shows how work is distributed across team members.

---

## 10. Goals & OKRs

Goals in Entomate follow the OKR (Objectives and Key Results) framework, letting you set high-level objectives and track measurable outcomes.

### Creating a Goal

1. Click **New Goal**.
2. Enter the title and description.
3. Choose the type: **Company**, **Team**, or **Individual**.
4. Select the quarter this goal applies to.
5. Optionally, select a parent goal to create a hierarchy.
6. Save the goal.

### Views

- **Hierarchy View** — See goals cascading from Company down to Team and Individual levels.
- **List View** — A flat list of all goals for quick scanning.

### Key Results

Each goal can have multiple key results. For each key result:

1. Define what you are measuring.
2. Set the target value.
3. Update progress as you go.

The goal's overall percentage is calculated automatically from its key results.

### Goal Detail Panel

Click any goal to open the detail panel on the right side. From here you can edit the goal, manage key results, and track progress.

### Stats

At the top of the Goals page, summary cards show:

- Total goals
- Average progress
- Goals on track
- Goals at risk

**Tip:** Link goals to parent goals to build cascading OKR trees. When team goals roll up to company goals, you get a clear picture of alignment.

---

## 11. Workflows

Workflows let you build custom automation pipelines using a visual, node-based editor. This is the most powerful automation tool in Entomate.

### Workflow Builder

The Workflow Builder opens in full-screen mode, giving you plenty of room to design your pipeline.

1. Open the **Node Palette** on the left to browse available nodes.
2. Drag nodes onto the canvas. Nodes include triggers, conditions, and actions.
3. Connect nodes by dragging from one node's output to another's input.
4. Configure each node by clicking it and filling in its settings.

### Toolbar Actions

- **Save** — Save your workflow at any time.
- **Test** — Run a dry test to see what would happen without actually executing actions.
- **Execute** — Run the workflow for real.

### Quick Start Templates

If you do not want to start from scratch, choose from built-in templates:

- **Meeting Processing** — Automatically process new meeting recordings.
- **Webhook to Slack** — Forward incoming webhook data to a Slack channel.
- **Daily Digest** — Send a daily summary of activity to your team.

### Managing Workflows

From the Workflows list, you can:

- **Activate or pause** a workflow.
- **Execute** it manually.
- **Duplicate** it to create a variation.
- **View history** to see past runs.
- **Delete** workflows you no longer need.

### Advanced Features

- **Expression Editor** — Map dynamic data between nodes using expressions.
- **Debug Panel** — Inspect execution traces to understand exactly what happened at each step.

**Tip:** Always use the Test (dry run) feature before activating a workflow. This catches configuration issues before they affect real data.

---

## 12. Automations

Automations are simpler than workflows and are based on pre-built templates. They are ideal for common tasks that do not need a custom pipeline.

### Template Categories

- **AI-Powered** (amber) — Automations that use AI to process data, like summarizing meetings or categorizing tasks.
- **CRM** (mint) — Automations that sync data with your CRM system.
- **Integration** (crimson) — Automations that connect to external services.

You can also choose **Custom Build** to create an automation from scratch.

### Setting Up an Automation

1. Browse the template library or click Custom Build.
2. Configure the trigger (what starts the automation).
3. Configure the action (what the automation does).
4. Click **Test** to run a dry test.
5. Enable the automation with the Play/Pause toggle.

### Available Triggers

- Meeting Processed
- Action Item Created
- Task Completed
- Scheduled (time-based)
- And more

### Available Actions

- Run AI Agent
- Auto-Assign tasks
- Send Notification
- Sync to CRM
- And more

### Execution History

Every automation keeps a log of past runs showing success or failure status and duration. This makes it easy to troubleshoot if something goes wrong.

**Tip:** Always test an automation with a dry run before enabling it. This ensures everything is wired up correctly without affecting real data.

---

## 13. AI Agents

AI Agents are intelligent bots that handle specialized work automatically. Deploy them from templates or customize them for your needs.

### Agent Templates

Choose from pre-built agent types:

- **Sales** — Agents focused on deal tracking, follow-ups, and pipeline management.
- **Meetings** — Agents that process recordings, extract insights, and distribute recaps.
- **Operations** — Agents that handle task routing, status updates, and team coordination.

### Active Fleet

The Active Fleet view shows all your deployed agents as cards. Each card displays:

- Current status (active, paused, error)
- Total execution count
- Success rate percentage
- Last run timestamp

### Agent Detail

Click an agent card to see its full detail view:

- **Execution logs** — A history of every run with outcomes.
- **Explanations** — Why the agent made each decision.
- **Performance metrics** — Trends in accuracy and success over time.

### Explainability

Every agent decision comes with a transparency breakdown:

- **Factor breakdown** — What inputs influenced the decision.
- **Weight visualization** — How much each factor mattered.
- **Confidence scoring** — How certain the agent is about its output.

You can provide feedback on agent decisions, which helps the system improve over time.

**Tip:** Agents use the same explainability system as task recommendations. If you are comfortable reading explainability cards on tasks, you already know how to interpret agent decisions.

---

## 14. Analytics

Analytics gives you a data-driven view of how your team uses Entomate and the value it delivers.

### Time Period Selection

Choose from the following time ranges at the top of the page:

- **7 days**
- **30 days**
- **90 days**
- **1 year**

### Tabs

#### Overview

Key metrics across all areas, plus a **Time Saved** breakdown showing how much time AI has saved you through:

- Transcription
- Summarization
- Action item extraction
- Automations

#### Meetings

Statistics about meeting frequency, duration, and trends.

#### Tasks

Task creation, completion rates, and throughput over time.

#### AI

Performance metrics for AI features, including transcription accuracy and extraction rates.

#### Team

A per-member performance table showing:

- Tasks created
- Tasks completed
- Completion rate
- Average days to complete

**Tip:** Check the Time Saved card regularly to see the concrete impact AI is having on your team's productivity.

---

## 15. Reports & Exports

The Reports page lets you generate polished documents and data exports from your workspace.

### Quick Stats

At the top of the page, stat cards summarize your data at a glance before you generate anything.

### PDF Reports

Generate formatted PDF documents for:

- **Meeting Recap** — A professional summary of a specific meeting.
- **Goals & OKRs** — Current status of all goals and key results.
- **Weekly Summary** — A digest of the past week's activity.

### CSV Exports

Download raw data as CSV files for:

- **Meetings** — All meeting records.
- **Action Items** — Every action item with status and metadata.
- **Goals** — Goal and key result data.

---

## 16. Ecosystem Integration

Ecosystem Integration is a new feature that connects Entomate with two companion apps: **Pulse** (a communication platform) and **Logos Vision** (a CRM). Together, these three apps form a unified ecosystem where data flows automatically between them.

### Setting Up Connections

1. Go to **Settings** and open the **Ecosystem Settings** page.
2. For each app (Pulse, Logos Vision), enter the connection details and authentication token.
3. Click **Test** to verify the connection is healthy.
4. Save your settings.

### What Gets Synced

- **Meeting recaps to Pulse** — When a meeting is processed, the recap is automatically posted to Pulse bot channels (such as #entomate-meetings and #entomate-tasks).
- **Action items to Logos Vision** — Action items are synced to the CRM as tasks, keeping your sales and client teams in the loop.
- **Recordings from Pulse** — Pull audio recordings from Pulse into Entomate for AI processing.
- **Auto-export from Pulse** — When enabled, meetings recorded in Pulse are automatically exported to Entomate.

### Cross-App Entity Mapping

The ecosystem tracks relationships across apps. A contact in Logos Vision, a conversation in Pulse, and a meeting in Entomate can all be linked together, giving you a complete picture of every interaction.

### Event Log

The event log shows all inbound and outbound sync events. If a sync fails, you can retry it directly from the log.

**Tip:** Test your connections regularly in Ecosystem Settings. This catches expired tokens or configuration drift before they cause sync failures.

---

## 17. Meeting Intelligence Profiles

Meeting Intelligence Profiles are a new feature that lets AI customize its analysis based on the type of meeting you are in. Different meetings need different focus areas, and profiles make that automatic.

### Built-In Profiles

Entomate ships with several ready-to-use profiles:

- **Grant Specialist** — Focuses on funding requirements, compliance items, and deliverables.
- **Sales Discovery** — Emphasizes pain points, budget signals, decision makers, and next steps.
- **Client Check-In** — Tracks satisfaction, concerns, renewal signals, and relationship health.
- **Board Meeting** — Highlights strategic decisions, financial updates, and governance items.
- **Internal Standup** — Captures blockers, progress updates, and team commitments.
- **Strategic Planning** — Focuses on long-term objectives, resource allocation, and risk assessment.
- **Vendor Negotiation** — Tracks pricing, terms, concessions, and agreement points.

### How Profiles Work

Each profile defines:

- A **system prompt** that guides the AI's analysis.
- **Focus areas** that tell the AI what to prioritize.
- **Tone** settings for the output style.
- **Output format** preferences.

### AI Profile Suggestions

The AI suggests profiles based on your meeting content. It uses keyword matching and recurring patterns to recommend the best fit. Over time, it learns which profiles work best for your meetings.

### Custom Fields

Each profile can include custom fields for user input, letting you provide additional context that shapes the analysis (for example, the grant program name or the client account number).

### Context Sources

Profiles can pull in additional context from:

- Contacts
- CRM deals
- Past meetings

This extra context helps the AI produce more relevant and accurate analysis.

### Profile Analytics

Track how each profile performs:

- **Usage count** — How often each profile is applied.
- **Acceptance rate** — How often you keep the AI's profile suggestion.
- **Effectiveness** — Quality ratings based on your feedback.

A quality feedback rating system lets you rate the output of each profile, which helps the AI improve its suggestions.

**Tip:** The AI learns which profiles work best for your meetings over time. The more feedback you provide, the better the suggestions become.

---

## 18. Settings

The Settings page is where you configure Entomate to work the way you want.

### Appearance

Toggle between **Light** and **Dark** mode to suit your preference.

### AI Learning Dashboard

Review the patterns the AI has learned from your usage:

- View learned patterns and their confidence levels.
- Approve or reject specific patterns.
- Customize how the AI adapts to your preferences.

### System Status

Check the health of all connected services:

- AI provider status
- Database connectivity
- CRM integration
- Chat integration (Slack)

### Ecosystem Settings

Manage your Pulse and Logos Vision connections. See [Ecosystem Integration](#16-ecosystem-integration) for details.

### Configuration Guide

A built-in guide walks you through environment variable setup and links to provider documentation for each connected service.

### About

View the current version number and the technology stack powering Entomate.

**Tip:** Test your connections regularly from the System Status panel. Catching issues early prevents surprises during important meetings.

---

## 19. Keyboard Shortcuts

Entomate supports keyboard shortcuts to help you navigate and act quickly. Here are the available shortcuts:

| Shortcut | Action |
|---|---|
| **Ctrl+K** | Open Command Palette |
| **Ctrl+?** | Show keyboard shortcuts help |
| **Ctrl+/** | Go to Search |
| **Ctrl+M** | Start a New Meeting |
| **Arrow keys** | Navigate options in menus and lists |
| **Enter** | Execute or select the highlighted option |
| **Escape** | Close dialogs, modals, and panels |

---

## 20. Troubleshooting & FAQ

If something is not working as expected, check the common issues below before reaching out for support.

### Common Issues

#### Sign-in problems

- Make sure pop-up blockers are not preventing the Google OAuth window from appearing.
- Try clearing your browser cookies and signing in again.
- Ensure you are using a supported browser (Chrome, Firefox, Edge, or Safari).

#### Meetings not recording or transcribing

- Go to **Settings** and check the AI provider status under System Status.
- Click **Test Connections** to verify the AI service is reachable.
- Make sure your browser has microphone permissions enabled.

#### Calendar not showing events

- Disconnect and reconnect your Google Calendar from the Calendar page.
- Verify that you authorized the correct Google account.

#### Workflows not running

- Confirm the workflow is set to **Active** (not paused).
- Use the **Test** button to run a dry test and check for errors.
- Review the **Execution History** for error messages.

### Frequently Asked Questions

**Can I use Entomate without recording meetings?**
Yes. You can create tasks, projects, goals, and workflows manually without ever recording a meeting. The meeting intelligence features are optional.

**How does the AI learn from my feedback?**
Entomate tracks patterns in your decisions. When you accept, override, or adjust an AI recommendation, the system records that preference and factors it into future suggestions. Over time, recommendations become more aligned with how you work.

**Can I export my data?**
Yes. Go to the **Reports** page to generate PDF reports or download CSV exports of your meetings, action items, and goals.

**Is my data secure?**
Yes. Entomate uses Supabase with Row Level Security (RLS), which means your data is isolated to your account at the database level. No other user can access your information.

---

*This guide covers Entomate version 1.0.0. For questions or feedback, reach out through the app or your team's support channel.*
