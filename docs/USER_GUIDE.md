# Entomate User Guide

**Version:** 1.5.0
**Last Updated:** April 12, 2026

Welcome to the Entomate User Guide. This document covers every feature of the platform and walks you through how to use each one.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Organizations & Teams](#3-organizations--teams)
4. [Billing & Plans](#4-billing--plans)
5. [Dashboard](#5-dashboard)
6. [Meetings](#6-meetings)
7. [Meeting Details](#7-meeting-details)
8. [Calendar](#8-calendar)
9. [Search](#9-search)
10. [Tasks](#10-tasks)
11. [Projects & Project Board](#11-projects--project-board)
12. [Goals & OKRs](#12-goals--okrs)
13. [Workflows](#13-workflows)
14. [Automations](#14-automations)
15. [AI Agents](#15-ai-agents)
16. [Ento AI Assistant](#16-ento-ai-assistant)
17. [Analytics](#17-analytics)
18. [Reports & Exports](#18-reports--exports)
19. [Ecosystem Integration](#19-ecosystem-integration)
20. [Meeting Intelligence Profiles](#20-meeting-intelligence-profiles)
21. [Settings](#21-settings)
22. [Keyboard Shortcuts](#22-keyboard-shortcuts)
23. [Troubleshooting & FAQ](#23-troubleshooting--faq)

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
4. A branded loading screen with an animated neural catalyst logo tracks your session setup progress.
5. If this is your first time, you will be guided through organization setup (see [Organizations & Teams](#3-organizations--teams)).
6. Once your organization is ready, you will be redirected to your Dashboard automatically.

### Accepting a Team Invitation

If someone has invited you to their organization, you will see an invitation banner after signing in.

1. Review the banner showing your invited role and the invitation expiration date.
2. Click **Accept Invitation** to join the organization immediately.
3. You will be taken to the Dashboard with full access to the team workspace.

### Navigating the Sidebar

The sidebar is organized into four groups so you can find what you need quickly:

- **Intelligence** — Dashboard, Meetings, Calendar, Search
- **Work** — Projects, Board, Tasks, Goals
- **Automation** — Workflows, Automations, Agents
- **Output** — Analytics, Reports

At the bottom of the sidebar you will find **Settings** and your **User Profile**.

**Tip:** Press **Ctrl+K** to open the Command Palette. It lets you jump to any page, run actions, and search without touching the mouse.

**Tip:** Toggle between dark and light mode by clicking the sun/moon icon in the top bar. You can also choose "System" to match your operating system preference.

---

## 3. Organizations & Teams

Entomate is built around organizations. Every workspace belongs to an organization, and team members collaborate within that shared context.

### Creating an Organization

When you sign in for the first time, a two-step wizard guides you through setup:

1. **Name your organization** — Enter a name (2 to 100 characters). A URL-safe slug is generated automatically below the input field.
2. **Choose a plan** — Select from Free, Starter, Pro, Business, or Ecosystem. Each plan card shows monthly pricing, team member limits, workflow run limits, and the number of included features. Plans marked "Popular" or "Full Suite" are highlighted.

After completing the wizard, your organization is created and you land on the Dashboard.

### Team Members and Roles

Organization members have roles that determine their access level:

- **Owner** — Full control over the organization, billing, and member management.
- **Admin** — Can manage members and most settings.
- **Member** — Standard access to all workspace features.

### Managing Your Organization

You can manage your organization from **Settings**:

- View and invite team members.
- Change member roles.
- Transfer ownership to another member.

### Archiving and Deleting an Organization

If you need to close an organization:

1. Go to **Settings** and find the danger zone section.
2. Click **Archive Organization** to soft-delete it.
3. Members lose access immediately, and pending invitations stop working.
4. You have **30 days** to restore the organization before it is permanently deleted.

If you change your mind during the 30-day window, an interstitial screen appears when you sign in showing the archived organization with a countdown of days remaining. From here you can:

- **Restore** — Undo the archive and bring the organization back.
- **Permanently Delete** — Remove it immediately (requires typing the organization name to confirm).
- **Start Fresh** — Create a new organization and clean up the old one.

**Tip:** Your personal data (account, profile) is never affected when an organization is archived or deleted.

**Tip:** Permanent deletion requires you to type the organization name as confirmation, preventing accidental data loss.

---

## 4. Billing & Plans

Entomate offers five plan tiers to match your team's needs. You can manage your subscription from **Settings > Billing**.

### Plan Tiers

| Plan | Price | Team Members | Workflow Runs/Month | Highlights |
|------|-------|--------------|---------------------|------------|
| **Free** | $0 | 3 | 100 | Basic features |
| **Starter** | Monthly/Yearly | 5 | 500 | Basic integrations |
| **Pro** | Monthly/Yearly | 15 | 5,000 | Webhooks, scheduling (Popular) |
| **Business** | Monthly/Yearly | Unlimited | 50,000 | API access, custom functions |
| **Ecosystem** | Monthly/Yearly | Unlimited | 50,000 | Unlocks Pulse + Logos Vision (Full Suite) |

### Billing Dashboard

The Billing page in Settings shows:

- **Current Plan Card** — Your active plan name, status badge (Active, Trial, Past Due, or Free), and renewal date. Click **Manage** to open the Stripe billing portal.
- **Usage Meters** — Three progress bars tracking your Workflows, Runs per month, and Integrations against your plan limits. Bars change color from green to yellow to red as you approach limits.
- **Billing Cycle Toggle** — Switch between Monthly and Yearly pricing. Yearly billing saves you two months.
- **Plan Comparison Cards** — Browse all plans side by side with feature lists and upgrade buttons.
- **Invoice History** — A table of past invoices with date, amount, status, and download links.

### Upgrading or Changing Plans

1. Go to **Settings > Billing**.
2. Toggle Monthly or Yearly billing.
3. Click **Upgrade** on the plan you want.
4. Complete payment through the secure Stripe checkout.
5. Your new plan takes effect immediately.

### Feature Gating

Some features are only available on higher-tier plans. When you reach a plan limit or try to access a feature above your tier, Entomate shows an upgrade prompt explaining what plan you need.

**Tip:** Watch the usage meters to avoid hitting limits unexpectedly. If a bar turns yellow, it is time to consider upgrading.

**Tip:** Yearly billing saves you two months compared to paying monthly.

---

## 5. Dashboard

The Dashboard is your home screen. It gives you an at-a-glance summary of everything happening across your workspace so you can decide where to focus.

### Ring Gauges

At the top of the Dashboard you will see four ring gauges showing progress for **Meetings**, **Tasks**, **Projects**, and **Automations**. Click any ring to jump directly to that section.

### Intelligence Briefing

Below the gauges, the Intelligence Briefing provides a live system snapshot:

- **Action item status** — How many items are open, in progress, or completed, with AI priority ranking active.
- **Stakeholder cards** — Key people across your meetings and their involvement.
- **Sentiment trends** — How the tone of your meetings has shifted over time.
- **Relationship insights** — Patterns in how you interact with contacts and teams.

### Overdue Alert Banner

When you have overdue items, an expandable alert banner appears at the top of the Dashboard. Click it to see a list of overdue tasks with the assignee name and how many days late each item is.

### Team Workload Widget

A stacked bar chart shows how work is distributed across team members. Each bar breaks down tasks into Done, In Progress, and Pending segments so you can spot who is overloaded.

### Insights and Trends Panel

A three-column layout presents:

- **Sentiment Donut** — A donut chart breaking down Positive, Neutral, and Negative sentiment across recent meetings.
- **Priority Bars** — A horizontal bar chart showing the distribution of High, Medium, and Low priority items.
- **Completion Ring** — A ring gauge showing your overall task completion rate.

### Automation Activity Feed

A live feed lists your running automations with status badges (Active or Paused). This lets you monitor automation health without leaving the Dashboard.

### Daily Briefing

The Daily Briefing highlights tasks that are overdue or due today, along with overall task statistics to help you prioritize your day.

### System Status

A compact panel shows the health of your connected services: AI provider status, database connectivity, CRM connection via Ecosystem Bridge, and Pulse notification status via Ecosystem Bridge. Each service has a color-coded dot — green for connected, orange for not configured, and red for disconnected.

### Quick Actions

A Quick Actions bar lets you immediately:

- **Start Meeting** — Begin recording a new meeting.
- **New Task** — Create a task manually.
- **New Project** — Set up a new project.
- **AI Insights** — Open the Intelligence Dashboard.
- **Automations** — Jump to your automation library.

**Tip:** The greeting at the top of the Dashboard uses a typewriter animation and changes based on the time of day — morning, afternoon, or evening.

**Tip:** Sentiment is displayed with emoji indicators: Positive, Neutral, and Negative, so you can read the mood at a glance.

---

## 6. Meetings

The Meetings page is where you browse, search, and record all of your meetings.

### Browsing Meetings

Meetings appear as cards showing the title, a sentiment badge, a short summary, the date, duration, and attendees. Use the search bar to filter meetings by title or summary text. Search uses server-side filtering with a short delay so results appear as you type.

### Selection Mode and Bulk Operations

1. Click the selection toggle to enter selection mode.
2. Use the checkboxes to select individual meetings, or click **Select All**.
3. Click **Bulk Delete** to remove selected meetings (with a confirmation prompt).
4. Click **Bulk Export** to export selected meetings as a Markdown file.

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

**Tip:** Your preferred microphone is remembered between sessions. Set it in Settings under Audio and Recording.

---

## 7. Meeting Details

Click any meeting card to open the full detail view. This is where Entomate's intelligence really shines, giving you a complete breakdown of what happened and what needs to happen next.

### Summary and Timelines

- **AI-Generated Summary** — A concise overview of the meeting written by AI. Click to edit inline.
- **Key Points Timeline** — Important moments laid out in order. Click to edit.
- **Decisions Timeline** — Specific decisions that were made, in sequence.

### Inline Editing

You can edit the meeting title, summary, and key points directly on the detail page. Click the text to enter edit mode, make your changes, and click the checkmark to save.

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
- **Sync to CRM** — Push action items to your connected CRM system (Logos Vision).
- **Sync to Calendar** — Add the meeting to your Google Calendar.
- **Ecosystem sync status** — An indicator shows whether the meeting has been synced to connected Pulse and Logos Vision apps.

### Meeting Intelligence Panel

The AI suggests intelligence profiles based on the meeting content. These profiles customize how the analysis is run. The panel shows a confidence score for each suggestion. You can accept the suggestion, choose a different profile, or dismiss it entirely. See [Meeting Intelligence Profiles](#20-meeting-intelligence-profiles) for details.

---

## 8. Calendar

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

### Quick Scheduling

Use the Quick Schedule modal to create calendar events on the fly. Set a title, date, time, duration (15, 30, 45, or 60 minutes), and optional notes. This modal is also available from the Intelligence Dashboard.

### Syncing Tasks

Click the **Sync Tasks** button to push your Entomate action items to Google Calendar as events, so they appear alongside your other commitments.

**Tip:** Clicking on an external calendar event opens it directly in Google Calendar.

---

## 9. Search

Search lets you find anything across your workspace, whether you know the exact words or just the general idea.

### Search Modes

- **Semantic Search** — The AI understands meaning, not just keywords. Great for queries like "meetings about budget concerns" even if the word "budget" was never used explicitly.
- **Keyword Search** — Traditional exact-text matching for when you know the specific term.

Press **Tab** on the Search page to switch between search modes.

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

**Tip:** Use **Ctrl+/** to jump to the Search page from anywhere. Use **Ctrl+Enter** to submit a search, and **Ctrl+S** to save the current search.

---

## 10. Tasks

Tasks in Entomate are created from meetings or manually, and the AI helps you prioritize and assign them intelligently.

### View Modes

The Tasks page offers two ways to view your work:

- **List View** — A paginated table with sorting and search. Click the list icon in the top-right toggle to switch to this view.
- **Board View (Kanban)** — Visual columns (To Do, In Progress, Review, Done, Blocked) with drag-and-drop. Click the board icon to switch.

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
- **Filter by tag** — Click a tag chip to see only tasks with that tag.
- **Search** tasks by keyword (with auto-filtering as you type).
- **Sort** by created date, due date, priority, status, or title. Toggle ascending or descending.
- **Complete** a task by clicking its animated checkbox.
- **Delete** tasks you no longer need.

### Editing a Task

Click a task to open the Task Edit Modal. From here you can:

1. Update the title, description, status, and priority.
2. Set or change the due date.
3. Add or remove tags.
4. Create and manage **subtasks** — smaller items that break down the main task.
5. View the **AI ETA prediction** — an estimated completion date based on task complexity and your team's historical pace.

### Bulk Operations

1. Enable bulk selection mode.
2. Select individual tasks or use Select All.
3. Apply a status change to all selected tasks at once (for example, mark multiple tasks as Done).

### Visual Indicators

- **Priority badges:** High (crimson), Medium (amber), Low (neutral).
- **Overdue highlighting** makes it clear when something is past due.
- **Project links** let you jump to the associated project.

**Tip:** Tasks created from meetings include a link back to the source meeting, so you always have the full context.

**Tip:** Use the Board View for a quick visual overview and drag tasks between columns to update their status instantly.

---

## 11. Projects & Project Board

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

## 12. Goals & OKRs

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

## 13. Workflows

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
- **Duplicate** — Create a copy of the workflow for modification.
- **Delete** — Remove a workflow permanently (with confirmation).

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
- **Version History** — Review previous versions of a workflow and roll back if needed.
- **Execution Trace Viewer** — Step through a workflow run node by node to see inputs, outputs, and timing.

**Tip:** Always use the Test (dry run) feature before activating a workflow. This catches configuration issues before they affect real data.

---

## 14. Automations

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

## 15. AI Agents

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

## 16. Ento AI Assistant

The Ento AI Assistant is a context-aware chat panel built into every page of Entomate. It understands what you are currently working on and can answer questions, offer suggestions, and help you get things done faster.

### Opening the Assistant

Press **Ctrl+/** (or **Cmd+/** on Mac) to toggle the assistant panel on the right side of the screen. You can also click the AI Assistant button at the bottom of the sidebar.

### Chatting with Ento

Type a question or request into the input field and press Enter. Ento responds in real time with streaming text, so you can see the answer as it is being generated.

Examples of things you can ask:

- "Summarize my last meeting"
- "What action items are overdue?"
- "Help me draft a follow-up email for the Q3 review"
- "What did we decide about the budget?"

### Context Awareness

Ento automatically knows which page and section you are viewing. If you are on a Meeting Detail page, it has access to that meeting's transcript, summary, and action items. If you are on the Tasks page, it knows about your current tasks and priorities.

### Conversation History

Your conversation with Ento is preserved during your browser session (up to 50 messages). If you close the panel and reopen it, your previous messages are still there. Starting a new browser session clears the history.

### Proactive Suggestions

Ento monitors your workspace in the background and will show a notification badge on its button when something needs your attention:

- **Overdue tasks** that have passed their due date
- **Upcoming meetings** scheduled within the next hour

You do not need to ask for these alerts — they appear automatically.

### Aborting a Response

If Ento is generating a long response and you want to stop it, click the stop button that appears while the response is streaming.

**Tip:** Ento remembers what you asked earlier in the same session, so you can ask follow-up questions naturally — "Tell me more about that" or "What about the other project?"

**Tip:** The assistant is available from every page. You never need to navigate away from what you are doing to ask a question.

---

## 17. Analytics

Analytics gives you a data-driven view of how your team uses Entomate and the value it delivers.

### Time Period Selection

Choose from the following time ranges at the top of the page:

- **7 days**
- **30 days**
- **90 days**
- **1 year**

Click **Refresh** to update data for the selected period. Click **Export** to download the analytics as a CSV file.

### Tabs

#### Overview

Key metrics across all areas, including:

- **Meetings Processed** — Total meetings analyzed.
- **Tasks Completed** — Tasks finished in the period.
- **Action Items** — Total action items extracted.
- **Automations Run** — Automation executions in the period.
- **Time Saved** breakdown showing how much time AI has saved you through transcription, summarization, action item extraction, and automations.
- **Task Status** breakdown — Completed, In Progress, Open, and Blocked counts.
- **Meeting Sentiment** — Distribution of Positive, Neutral, and Negative meetings.
- **Projects Overview** — Total, Active, Completed, Planning counts and total deal value.

#### Meetings

- Total meetings count.
- Total and average duration.
- Average action items per meeting.
- **Sentiment Over Time** — An area chart showing positive, neutral, and negative trends.
- **Meetings Over Time** — A bar chart showing daily meeting counts.

#### Tasks

Task creation, completion rates, and throughput over time.

#### AI

Performance metrics for AI features, including transcription accuracy, action item extraction rates, and automation success rates.

#### Team

A per-member performance table showing:

- Tasks created
- Tasks completed
- Completion rate (with color-coded badge)
- High priority task count
- Average days to complete

**Tip:** Check the Time Saved card regularly to see the concrete impact AI is having on your team's productivity.

---

## 18. Reports & Exports

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
- **Action Items** — Every action item with status and metadata. Filter by status (All, Open, Completed, or Missed) before exporting.
- **Goals** — Goal and key result data. Select a quarter to scope the export.
- **Tasks** — All tasks with status, priority, tags, and assignee information.
- **Automations** — Automation execution logs showing run history, status, and timing.

---

## 19. Ecosystem Integration

Ecosystem Integration connects Entomate with two companion apps: **Pulse** (a communication platform) and **Logos Vision** (a CRM). Together, these three apps form a unified ecosystem where data flows automatically between them.

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

The event log shows all inbound and outbound sync events. Each event displays direction, status, timestamp, and processing time. If a sync fails, you can retry it directly from the log.

**Tip:** Test your connections regularly in Ecosystem Settings. This catches expired tokens or configuration drift before they cause sync failures.

---

## 20. Meeting Intelligence Profiles

Meeting Intelligence Profiles let AI customize its analysis based on the type of meeting you are in. Different meetings need different focus areas, and profiles make that automatic.

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

The AI suggests profiles based on your meeting content. It analyzes the meeting title, attendees, and content keywords, then matches against profile suggestion rules. A confidence score indicates how well the profile fits. You can always override or dismiss a suggestion.

### Custom Fields

Each profile can include custom fields for user input, letting you provide additional context that shapes the analysis (for example, the grant program name or the client account number). Field types include text, dropdown, and date pickers.

### Context Sources

Profiles can pull in additional context from:

- Contacts
- CRM deals
- Past meetings
- Pulse threads

This extra context helps the AI produce more relevant and accurate analysis.

### Profile Analytics

Track how each profile performs:

- **Usage count** — How often each profile is applied.
- **Acceptance rate** — How often you keep the AI's profile suggestion.
- **Effectiveness** — Quality ratings based on your feedback.

A quality feedback rating system lets you rate the output of each profile, which helps the AI improve its suggestions.

**Tip:** The AI learns which profiles work best for your meetings over time. The more feedback you provide, the better the suggestions become.

---

## 21. Settings

The Settings page is where you configure Entomate to work the way you want.

### Appearance

- Toggle between **Light**, **Dark**, and **System** mode. Each option shows a visual preview.
- Enable **Reduce Motion** for accessibility. This disables animations throughout the app.

### Audio and Recording

Configure your audio devices and recording preferences:

1. **Microphone** — Select your preferred audio input device from the dropdown. Click the refresh button to re-scan devices.
2. **Speakers/Headphones** — Select your audio output device.
3. **Recording Quality** — Choose between Standard (64 kbps), High (128 kbps), or Maximum (256 kbps).
4. **Transcription Language** — Select from 14 languages (English, Spanish, French, German, Portuguese, Italian, Dutch, Japanese, Korean, Chinese, Arabic, Hindi, Russian) or choose Auto-Detect.
5. **Auto-Sync to Calendar** — Toggle this on to automatically add meetings to your Google Calendar.

### Permissions

View and manage browser permissions required by Entomate:

- **Microphone** (required) — Needed for recording meetings.
- **Camera** — For video features.
- **Notifications** — For push notification alerts.
- **Clipboard** — For copy/paste functionality.

Each permission shows its current state: Granted (green), Denied (red), Not Yet Granted (amber), or Unavailable (gray). Click **Grant Access** to request a permission, or **Retry** if one was denied. If a permission was denied, follow the instructions to re-enable it through your browser's address bar.

### Notifications

Control how and when Entomate notifies you:

- **Email Notifications** — Toggle Meeting Summaries, Overdue Reminders, and Weekly Digest on or off.
- **In-App Notifications** — Toggle Task Assignments, Meeting Ready, and Agent Suggestions.
- **Browser Push Notifications** — Enable or disable push notifications (requires Notifications permission).
- **Quiet Hours** — Set a time window during which notifications are silenced. Choose the start and end time.

### Integrations

#### Slack Integration

1. View your Slack connection status and workspace name.
2. Click **Test Connection** to verify.
3. Select a **Default Channel** for Entomate messages.
4. Toggle notification events: Meeting Completed, Deal Won, Overdue Reminders, New Action Items.
5. Click **Save Slack Settings** to apply.
6. Use **Send Test Message** to verify the integration works.

#### Ecosystem Settings

Manage your Pulse and Logos Vision connections. See [Ecosystem Integration](#19-ecosystem-integration) for details.

### AI and Learning

Fine-tune how the AI behaves:

- **Summary Detail Level** — Choose Brief, Standard, or Detailed for AI-generated meeting summaries.
- **Auto-Assign Confidence Threshold** — Adjust the slider (0.3 to 1.0) to control how confident the AI must be before automatically assigning tasks. Default is 0.75.
- **Sentiment Analysis** — Toggle sentiment detection on or off.
- **Learning Patterns** — Click **Manage Learning Patterns** to open the full Learning Dashboard where you can review, approve, or reject AI-learned patterns.

### System Status

Check the health of all connected services by clicking **Test All**:

- **AI Provider** — Whether OpenAI or Gemini is connected and working.
- **Database** — Whether Supabase connection is active with live query verification.
- **CRM Integration** — Logos Vision task synchronization status via Ecosystem Bridge.
- **Chat Integration** — Pulse team notifications and meeting recaps via Ecosystem Bridge.

### About

View the current version number, design system (Void Crimson), and the technology stack powering Entomate.

**Tip:** Test your connections regularly from the System Status panel. Catching issues early prevents surprises during important meetings.

---

## 22. Keyboard Shortcuts

Entomate supports keyboard shortcuts to help you navigate and act quickly. Press **Ctrl+?** to see these shortcuts at any time.

### General

| Shortcut | Action |
|---|---|
| **Ctrl+K** | Open Command Palette |
| **Ctrl+/** | Toggle Ento AI Assistant |
| **Ctrl+?** | Show keyboard shortcuts help |
| **Escape** | Close dialogs, modals, and panels |

### Navigation

| Shortcut | Action |
|---|---|
| **G then D** | Go to Dashboard |
| **G then M** | Go to Meetings |
| **G then P** | Go to Projects |
| **G then T** | Go to Tasks |
| **G then S** | Go to Search |

### Actions

| Shortcut | Action |
|---|---|
| **Ctrl+M** | Start a New Meeting |
| **Ctrl+P** | Create a New Project |
| **Ctrl+T** | Create a New Task |

### Search Page

| Shortcut | Action |
|---|---|
| **Ctrl+Enter** | Submit search |
| **Tab** | Switch search type (Semantic / Keyword) |
| **Ctrl+S** | Save current search |

**Tip:** Navigation shortcuts use a two-key sequence: press **G** first, then the letter for the destination. You do not need to hold G down.

---

## 23. Troubleshooting & FAQ

If something is not working as expected, check the common issues below before reaching out for support.

### Common Issues

#### Sign-in problems

- Make sure pop-up blockers are not preventing the Google OAuth window from appearing.
- Try clearing your browser cookies and signing in again.
- Ensure you are using a supported browser (Chrome, Firefox, Edge, or Safari).

#### Meetings not recording or transcribing

- Go to **Settings** and check the AI provider status under System Status.
- Click **Test All** to verify the AI service is reachable.
- Check **Settings > Permissions** to make sure microphone access is granted.
- Make sure your browser has microphone permissions enabled.

#### No audio input detected

- Go to **Settings > Audio and Recording** and check that the correct microphone is selected.
- Click the refresh button to re-scan for audio devices.
- Check that your microphone is not muted at the operating system level.

#### Calendar not showing events

- Disconnect and reconnect your Google Calendar from the Calendar page.
- Verify that you authorized the correct Google account.

#### Workflows not running

- Confirm the workflow is set to **Active** (not paused).
- Use the **Test** button to run a dry test and check for errors.
- Review the **Execution History** for error messages.

#### Slack messages not sending

- Go to **Settings > Integrations > Slack** and click **Test Connection**.
- Verify that a default channel is selected.
- Use **Send Test Message** to verify the integration.

#### Notifications not appearing

- Go to **Settings > Permissions** and check that Notifications permission is Granted.
- Go to **Settings > Notifications** and make sure your desired notification types are enabled.
- Check that Quiet Hours is not currently active.

### Frequently Asked Questions

**Can I use Entomate without recording meetings?**
Yes. You can create tasks, projects, goals, and workflows manually without ever recording a meeting. The meeting intelligence features are optional.

**How does the AI learn from my feedback?**
Entomate tracks patterns in your decisions. When you accept, override, or adjust an AI recommendation, the system records that preference and factors it into future suggestions. Over time, recommendations become more aligned with how you work. You can review learned patterns in Settings under AI and Learning.

**Can I export my data?**
Yes. Go to the **Reports** page to generate PDF reports or download CSV exports of your meetings, action items, and goals. You can also export analytics data as CSV from the Analytics page.

**Is my data secure?**
Yes. Entomate uses Supabase with Row Level Security (RLS), which means your data is isolated to your account at the database level. No other user can access your information.

**What languages does transcription support?**
Entomate supports 14 transcription languages including English, Spanish, French, German, Portuguese, Italian, Dutch, Japanese, Korean, Chinese, Arabic, Hindi, and Russian. You can also choose Auto-Detect to let the AI determine the language.

**Can I choose my recording quality?**
Yes. Go to Settings > Audio and Recording to choose between Standard (64 kbps), High (128 kbps), or Maximum (256 kbps) recording quality.

**How do I invite team members to my organization?**
Go to Settings and use the team management section to send invitations. Invitees receive a banner when they sign in, showing their invited role and expiration date. They can accept with one click.

**What happens if I archive my organization?**
Archiving soft-deletes the organization. Members lose access immediately, but you have 30 days to restore it. After 30 days, the organization and its data are permanently deleted. Your personal account is not affected.

**Can I change my plan later?**
Yes. Go to Settings > Billing at any time to upgrade, downgrade, or switch between monthly and yearly billing. Changes take effect immediately.

---

*This guide covers Entomate version 1.5.0. For questions or feedback, reach out through the app or your team's support channel.*
