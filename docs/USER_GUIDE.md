# Entomate User's Guide

**Version**: 1.0.0
**Last Updated**: 2026-03-27

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Dashboard](#3-dashboard)
4. [Meetings](#4-meetings)
5. [Meeting Details](#5-meeting-details)
6. [Tasks](#6-tasks)
7. [Projects](#7-projects)
8. [Calendar](#8-calendar)
9. [Goals & OKRs](#9-goals--okrs)
10. [Workflows](#10-workflows)
11. [Automations](#11-automations)
12. [AI Agents](#12-ai-agents)
13. [Search](#13-search)
14. [Analytics](#14-analytics)
15. [Reports & Exports](#15-reports--exports)
16. [Settings](#16-settings)
17. [Troubleshooting & FAQ](#17-troubleshooting--faq)

---

## 1. Introduction

### What is Entomate?

Entomate is an AI-powered meeting intelligence platform that transforms your meetings into actionable insights. It records and transcribes meetings, automatically extracts action items, detects priorities and deadlines, and helps your team stay on top of follow-ups — all with built-in AI that learns and improves over time.

Entomate is part of **The Trifecto** — a suite of three integrated products:

- **Logos Vision** (The Mind) — AI-powered CRM
- **Pulse** (The Voice) — Team communication hub
- **Entomate** (The Hands) — Meeting intelligence and workflow automation

### Who is it for?

Entomate is designed for teams and professionals who want to:

- Spend less time taking notes and more time engaging in meetings
- Never lose track of action items or follow-ups
- Get AI-powered recommendations for task assignments and priorities
- Automate repetitive workflows triggered by meeting outcomes
- Track goals and project progress with real-time intelligence

### Key Concepts

- **Meetings** — Recorded sessions with AI-generated transcripts, summaries, and sentiment analysis.
- **Action Items** — Tasks automatically extracted from meetings, with AI-suggested assignments and deadlines.
- **Workflows** — Visual, node-based automations that connect meeting events to actions across your tools.
- **Agents** — AI-powered bots that run continuously, handling tasks like assignment suggestions, priority detection, and follow-up reminders.
- **Goals** — OKR-style goal hierarchies (Company, Team, Individual) with key results and progress tracking.

---

## 2. Getting Started

### Creating Your Account

1. Visit the Entomate landing page.
2. Click **Get Started** or **Sign In**.
3. Sign in with your Google account through Supabase OAuth.
4. You will be redirected to your Dashboard automatically.

### Navigating the App

Once signed in, you will see a sidebar on the left with links to every section:

- **Dashboard** — Your home base with intelligence briefings and quick actions.
- **Meetings** — Record, browse, and review meetings.
- **Tasks** — Manage action items with AI recommendations.
- **Projects** — Organize work into project portfolios.
- **Calendar** — View events, tasks, and deadlines on a monthly calendar.
- **Goals** — Set and track OKRs at every level.
- **Workflows** — Build visual automations.
- **Automations** — Deploy and monitor automation rules.
- **Agents** — Manage your fleet of AI agents.
- **Analytics** — View performance metrics and trends.
- **Reports** — Generate and export PDF and CSV reports.
- **Search** — Find anything across your workspace with AI-powered search.
- **Settings** — Configure integrations, appearance, and connections.

Use the **Command Palette** (keyboard shortcut) for quick navigation to any page or action.

### Switching Themes

Entomate supports both **Dark mode** (Void × Crimson theme) and **Light mode** (warm rose-tinted neutrals). Toggle between them using the theme switch in the top navigation bar or in Settings.

---

## 3. Dashboard

The Dashboard is your home screen — a real-time snapshot of everything happening in your workspace.

### What You Will See

- **Greeting** — A personalized, time-based greeting with an animated typewriter effect.
- **Ring Gauges** — Four visual gauges showing counts for Meetings, Tasks, Projects, and Automations. Click any gauge to jump to that section.
- **Today's Intelligence** — A daily briefing panel showing:
  - Today's meetings with status indicators
  - Overdue tasks requiring attention
  - Active deals and contact activity
  - A **Start Day** button to begin your morning workflow
  - Collapsible sections you can expand or collapse
  - A **Refresh** button to update the briefing
- **Quick Actions Bar** — A docked toolbar at the bottom with shortcuts:
  - **Start Meeting** — Open the meeting recorder.
  - **New Task** — Create a task instantly via the Quick Task modal.
  - **New Project** — Start a new project.
  - **AI Insights** — Jump to the Intelligence Dashboard.
  - **Automations** — Go to the Automations page.
- **Intelligence Dashboard** — AI-generated insights, action item status cards, stakeholder cards, sentiment trends, and relationship insights. From here you can:
  - **Quick Schedule** — Click the schedule icon on any insight to create a calendar event instantly.
  - **Quick Task** — Create a task directly from an intelligence card.
  - **Reassign** — Reassign a task to a different team member with a searchable contact list.
- **AI Learning Insights** — A widget showing what the AI has learned from your patterns, including an **Effectiveness Report** with trending metrics over a configurable time period.
- **System Status** — Indicators for your AI provider and database connection.
- **Recent Meetings** — A list of your latest meetings with sentiment badges (Positive, Neutral, or Negative).
- **Open Tasks** — Your outstanding action items with priority and due date indicators.
- **Meeting Recorder** — Start recording a meeting right from the Dashboard.

**Tip:** The ring gauges are interactive — clicking one navigates you directly to that section for a deeper look.

---

## 4. Meetings

The Meetings page lets you browse, search, and manage all your recorded meetings.

### Browsing Meetings

1. Navigate to **Meetings** from the sidebar.
2. You will see a list of meeting cards, each showing:
   - Meeting title with a sentiment indicator (emoji)
   - A brief summary preview
   - Date, duration, attendee count, and key points count
3. Use the **search bar** at the top to filter meetings by title or summary content.

### Recording a New Meeting

1. Click the **New Meeting** button at the top of the page.
2. The Meeting Recorder will appear.
3. Follow the on-screen prompts to start recording.
4. When finished, the recording will be transcribed and analyzed automatically.

### Deleting a Meeting

1. Click the **delete button** on any meeting card.
2. Confirm the deletion in the dialog that appears.
3. This action is permanent and cannot be undone.

### Sentiment Indicators

Each meeting displays a sentiment badge based on AI analysis:

- **Positive** — Shown in mint/green
- **Neutral** — Shown in gray
- **Negative** — Shown in crimson/red

---

## 5. Meeting Details

Click any meeting from the Meetings list to open its detail view, where you can explore the full AI analysis.

### Sections

- **Header** — Meeting title, sentiment, date, duration, and attendee list.
- **Summary** — An AI-generated overview of the meeting.
- **Key Points** — Important moments displayed on a visual timeline.
- **Decisions** — Key decisions made during the meeting, shown on a colored timeline.
- **Transcript** — The full, scrollable meeting transcript.

### Action Items

On the right side, you will find the Action Items panel:

1. View all action items extracted from the meeting.
2. Mark items as complete or incomplete by clicking the checkbox.
3. Delete action items you no longer need.

### Ask AI

Use the **Ask AI** feature to ask questions about the meeting:

1. Type your question in the input field (e.g., "What did we decide about the timeline?").
2. Click **Send**.
3. The AI will respond with an answer and a confidence score.

### Sharing

- **Share to Chat** — Send a meeting recap to a connected chat channel (e.g., Slack).
- **Sync to CRM** — Push action items and meeting data to your connected CRM.

**Tip:** The Ask AI feature understands the full context of your meeting — try asking follow-up questions for deeper insights.

---

## 6. Tasks

The Tasks page is your central hub for managing action items, with AI-powered recommendations to help you prioritize and assign work.

### Creating a Task

1. Navigate to **Tasks** from the sidebar.
2. A guided 3-step wizard appears at the top: Create → Prioritize → Complete.
3. Fill in the task form:
   - **Title** (required)
   - **Priority** — Select High, Medium, or Low
   - **Due Date** — Pick a deadline
4. Review the **AI Recommendations** panel on the right:
   - **Assignment Suggestions** — Who should own this task
   - **Priority Predictions** — AI-recommended priority level
   - **Deadline Suggestions** — Recommended due dates
5. Accept or override any AI suggestion, then save.

### Managing Tasks

- **Filter tasks** by status: All, Open, In Progress, or Done.
- **Search tasks** by title using the search bar.
- **Complete a task** by clicking the checkbox — it will animate and mark as done.
- **Delete a task** by clicking the delete button on any task row.

### Understanding AI Recommendations

Each recommendation comes with an **Explainability Card** that shows why the AI made its suggestion. Click the card to see the factors that influenced the recommendation.

### Task Indicators

- **Priority badges** are color-coded: High (crimson), Medium (amber), Low (neutral).
- **Overdue tasks** are highlighted so you can spot them immediately.
- **Project links** show which project a task belongs to.

**Tip:** The AI learns from your decisions over time. The more you accept or override its suggestions, the better it gets at predicting your preferences.

---

## 7. Projects

Projects let you group related tasks, meetings, and goals into organized workspaces.

### Creating a Project

1. Navigate to **Projects** from the sidebar.
2. Follow the 3-step wizard: Create → Organize → Track.
3. Enter a **project name** and optional **description**.
4. Click **Create**.

### Browsing Projects

- Projects appear as cards in a grid layout.
- Each card shows the project name, description preview, status badge, deal value, and end date.
- Use the **search bar** to filter projects by name.
- Status indicators: **Active** (mint), **Planning** (amber), **Completed** (gray), **Archived** (gray).

### Project Details

Click a project card to open its detail view:

1. **Stats Cards** — Total Tasks, Completed, In Progress, and Open counts.
2. **Tasks Section** — Add tasks directly to this project with a title and priority. Manage tasks with checkboxes and delete buttons.
3. **Related Meetings** — Any meetings linked to this project, with clickable links to their detail pages.

---

## 8. Calendar

The Calendar page gives you a unified view of events, tasks, and goal deadlines in one place.

### Connecting Google Calendar

1. Navigate to **Calendar** from the sidebar.
2. If not connected, click **Connect Google Calendar**.
3. Complete the Google OAuth authorization flow.
4. Your calendar events will sync automatically.

### Using the Calendar

- **Navigate months** using the left/right arrow buttons.
- **Jump to today** by clicking the **Today** button.
- **Click any date** to see its details in the sidebar panel.

### Upcoming Items

Below the calendar grid, you will see a list of upcoming items for the next 14 days:

- **Action Items** — Tasks with due dates
- **Goal Deadlines** — Key result and goal deadlines
- **Calendar Events** — Synced events from Google Calendar

Each item shows a type icon, priority color, and a link to its source.

### Quick Stats

Four stat cards at the bottom show:

- Calendar Events count
- Due Tasks count
- Goal Deadlines count
- Overdue count

**Tip:** Click the **Sync Tasks** button to push your Entomate action items to your Google Calendar as events.

---

## 9. Goals & OKRs

The Goals page lets you create and track Objectives and Key Results (OKRs) at every level of your organization.

### Creating a Goal

1. Navigate to **Goals** from the sidebar.
2. Click **New Goal**.
3. Fill in the form:
   - **Title** — The objective name
   - **Description** — What this goal aims to achieve
   - **Goal Type** — Company, Team, or Individual
   - **Quarter** — Which quarter this goal targets
   - **Parent Goal** (optional) — Link this goal under a higher-level objective
4. Click **Create**.

### Viewing Goals

- **Hierarchy View** — Goals are organized under Company → Team → Individual levels. Expand any goal to see its children.
- **List View** — A flat list of all goals. Toggle between views using the view mode switch.

### Goal Cards

Each goal card displays:

- Goal type icon (company, team, or individual)
- Title and description
- Status badge
- Quarter and key results count
- Progress percentage with a visual progress bar
- A preview of the first three key results

### Managing Key Results

1. Click a goal to open the **Detail Panel** on the right.
2. View all key results with their current progress.
3. **Update progress** by entering new values for each key result.
4. **Add a new key result** using the form at the bottom of the panel.

### Stats Overview

At the top of the page, four cards summarize:

- Total Goals
- Average Progress (%)
- On Track count
- At Risk count

---

## 10. Workflows

Workflows are visual, node-based automations that let you connect triggers, conditions, and actions into powerful pipelines.

### Browsing Workflows

1. Navigate to **Workflows** from the sidebar.
2. Use the **search bar** and **status filter** (Active, Inactive, All) to find workflows.
3. Each workflow card shows:
   - Name and description
   - Node count, execution count, last run date, and version
   - Status indicator (active or paused)

### Creating a Workflow

1. Click **New Workflow**.
2. You can start from scratch or choose a **Quick Start Template**:
   - **Meeting Processing** — Automatically process new meeting recordings
   - **Webhook to Slack** — Route incoming webhooks to Slack channels
   - **Daily Digest** — Generate and send daily summary reports

### Managing Workflows

From the workflow list, you can:

- **Activate/Pause** — Toggle a workflow on or off.
- **Execute** — Run a workflow immediately.
- **Edit** — Open the visual Workflow Builder.
- **Duplicate** — Create a copy of a workflow.
- **View History** — See past execution logs.
- **Delete** — Remove a workflow permanently.

### The Workflow Builder

The Workflow Builder is a full-screen visual editor:

1. Add nodes from the **Node Palette** on the left.
2. Connect nodes by dragging from output to input ports.
3. Configure each node by clicking it to open its settings.
4. Use the **Toolbar** to:
   - **Save** your workflow
   - **Test** with a dry run (no side effects)
   - **Execute** the workflow live
   - **Toggle active state**
   - **Duplicate** or **Delete**

### Expression Editor

When configuring node settings, you can use dynamic expressions:

1. Type `{{` in any text field to open the expression autocomplete.
2. Choose from available data sources: upstream node outputs, secrets, environment variables, or built-in functions.
3. Expressions are validated in real-time — invalid references are underlined in red.
4. Hover over an expression to preview its resolved value.

### Debug Panel

The Workflow Builder includes a built-in Debug Panel with four tabs:

- **Execution** — Step-by-step trace of each node's execution, showing status (completed, failed, running, pending, skipped), timing, and input/output data.
- **Output** — The final workflow result displayed as formatted data.
- **Pinned Data** — Pin test data to specific nodes for repeatable testing. Upload or download pinned datasets for sharing with your team.
- **Versions** — View the full version history of your workflow. Compare changes between versions with a visual diff viewer, and restore any previous version if needed.

### Secrets Manager

Workflows that connect to external services often need API keys or credentials:

1. Open the **Secrets Manager** from the Workflow Builder toolbar.
2. Create secrets with a name and value — values are encrypted and hidden by default.
3. Use the eye icon to temporarily reveal a secret's value.
4. Reference secrets in node configurations using the expression editor.
5. Track expiration dates and access history for each secret.

**Tip:** Always use the **Test** (dry run) feature before activating a workflow to make sure it behaves as expected. The Debug Panel will show you exactly what each node did during the test.

---

## 11. Automations

Automations are pre-built or custom rules that run actions in response to triggers — similar to workflows but with a simpler template-based setup.

### Getting Started

1. Navigate to **Automations** from the sidebar.
2. Follow the 3-step wizard: Choose Template → Configure → Monitor.

### Choosing a Template

Templates are organized by category:

- **AI-Powered** — Automations that use AI agents (shown with an amber badge)
- **CRM** — Automations that sync with your CRM (shown in mint)
- **Integration** — Cross-platform automations (shown in crimson)

Click any template card to start configuring it, or click **Custom Build** to create your own from scratch.

### Managing Active Automations

Each automation card shows:

- Name and status badge (Active or Paused)
- AI badge (if it uses AI agents)
- Trigger type, action count, execution count, and last run time
- Controls: **Play/Pause**, **Test** (dry run), **Execute**, and **Delete**

### Testing Automations

1. Click **Test** on any automation to perform a dry run.
2. The test result panel will appear showing what the automation would do, without actually executing any actions.
3. Review the results before enabling the automation.

### Execution History

Expand the **Execution History** panel to see past runs with:

- Success or failure indicators
- Automation name and timestamp
- Duration and any error messages

---

## 12. AI Agents

AI Agents are intelligent bots that run continuously in the background, handling tasks like assignment suggestions, priority detection, deadline prediction, and follow-up reminders.

### Deploying an Agent

1. Navigate to **Agents** from the sidebar.
2. Follow the 3-step wizard: Select Template → Customize → Monitor.
3. Browse **Quick Start Templates** or filter by category (Sales, Meetings, Operations, etc.).
4. Click **Deploy** on a template to start customizing it.
5. In the customization modal:
   - Set a **name** and **description**
   - Configure the **trigger** (what starts the agent)
   - Configure the **actions** (what the agent does)
6. Click **Deploy** to activate the agent.

### Managing Your Agent Fleet

The **Active Fleet** section shows all deployed agents:

- Agent name with status badge (Running or Paused)
- Description and performance stats (execution count, success rate, last run)
- **Play/Pause** toggle to enable or disable the agent
- **Delete** button to remove the agent

### Viewing Agent Details

Click an agent to open its detail panel:

- **Execution Logs** — See what the agent has done recently
- **Explanations** — Understand why the agent made specific decisions
- **Performance Metrics** — Track success rates and execution counts

**Tip:** AI agents use the same explainability system as task recommendations. You can always see *why* an agent made a particular decision.

---

## 13. Search

The Search page provides a unified way to find anything across your entire workspace, with both traditional keyword search and AI-powered semantic search.

### Searching

1. Navigate to **Search** from the sidebar.
2. Type your query in the search bar.
3. Choose your search mode:
   - **Semantic** — AI understands the meaning of your query (e.g., "meetings about budget concerns")
   - **Keyword** — Traditional text matching

### Search Results

Results are grouped by type:

- Meetings
- Projects
- Tasks
- Action Items

Each result shows a title, preview snippet, and metadata.

### Ask AI

Below the search results, you can ask the AI a direct question:

1. Type a natural-language question (e.g., "What were the main decisions from last week's meetings?").
2. The AI will respond with an answer, citations, and follow-up suggestions.
3. Continue the conversation with follow-up questions.

### Additional Features

- **Search History** — View and re-run previous searches.
- **Saved Searches** — Save frequently used queries for quick access.
- **Export Results** — Download search results as CSV or JSON.
- **Search Analytics** — View trending topics and popular queries across your workspace.

---

## 14. Analytics

The Analytics page gives you a comprehensive view of performance metrics across your workspace.

### Time Period

Use the period selector at the top to choose your time range: **7 days**, **30 days**, **90 days**, or **1 year**. Click **Refresh** to update the data.

### Tabs

- **Overview** — Key metrics at a glance: meeting count, task count, time saved. Includes a breakdown of time saved by category (transcription, summarization, action items, automations).
- **Meetings** — Meeting frequency, average duration, and trends over time.
- **Tasks** — Task completion rates, priority distribution, and status breakdowns shown as visual bars.
- **AI** — AI performance metrics including transcription accuracy, action item extraction rates, and automation success rates.
- **Team** — A performance table showing each team member's stats:
  - Tasks created and completed
  - Completion rate (with badge)
  - High priority task count
  - Average days to complete

**Tip:** Check the **Time Saved** card on the Overview tab to see exactly how much time Entomate's AI is saving your team.

---

## 15. Reports & Exports

The Reports page lets you generate downloadable reports and export your data.

### PDF Reports

- **Meeting Recap** — Select a meeting from the dropdown and download a formatted PDF summary.
- **Goals & OKRs** — Select a quarter and download a PDF of your goals and progress.
- **Weekly Summary** — Download a 7-day overview as a PDF.

### CSV Exports

- **Meetings** — Export all meeting data as a CSV file.
- **Action Items** — Export all action items (all statuses) as CSV.
- **Goals** — Export all goals and key results as CSV.

### Quick Stats

Four cards show at-a-glance numbers:

- Total Meetings
- Total Goals
- Completed Goals
- Average Goal Progress

**Tip:** Use CSV exports to bring your Entomate data into spreadsheets or other tools for custom analysis.

---

## 16. Settings

The Settings page lets you configure your workspace, manage integrations, and customize your experience.

### Appearance

- **Theme Mode** — Toggle between Dark mode (Void × Crimson) and Light mode (warm rose-tinted neutrals). Dark mode uses a true black canvas with crimson accents. Light mode uses warm stone tones with the same crimson highlights.

### AI Learning

- Access the **Learning Dashboard** to view and manage AI patterns.
- Review what the AI has learned from your feedback.
- Approve or reject detected patterns.
- View the **Effectiveness Report** to see how AI recommendations are performing over time, with trending metrics and confidence levels.

### System Status

Click **Test Connections** to verify the health of:

- **AI Provider** — Whether your OpenAI or Gemini connection is working.
- **Database** — Whether your Supabase connection is active.
- **CRM Integration** — Test your CRM connection with a dedicated button.
- **Chat Integration** — Test your chat platform connection (e.g., Slack).

### Configuration Guide

The Settings page includes setup instructions for each integration:

- Required environment variables
- Links to provider documentation
- Step-by-step configuration steps

### About

View your current Entomate version and tech stack information.

---

## 17. Troubleshooting & FAQ

### Common Issues

**I can't sign in.**
- Entomate uses Google sign-in through Supabase. Make sure you are using a Google account and that pop-ups are not blocked in your browser.

**My meetings aren't being transcribed.**
- Check the AI Provider status on the Settings page. Make sure your AI provider (OpenAI or Gemini) is connected and working.
- Click **Test Connections** to verify.

**Action items aren't being detected.**
- The AI extracts action items from meeting transcripts automatically. If a meeting has no transcript, no action items will appear.
- Try asking the AI directly from the Meeting Detail page using the Ask AI feature.

**My calendar events aren't showing up.**
- Go to **Calendar** and verify that Google Calendar is connected.
- If connected, try disconnecting and reconnecting to refresh the authorization.

**A workflow isn't running.**
- Check that the workflow is set to **Active** (not Paused).
- Use the **Test** (dry run) feature to verify the workflow logic.
- Open the **Debug Panel** to inspect the execution trace for errors.
- Check the execution history for error messages.

**My workflow expressions aren't working.**
- Make sure you are using the `{{` syntax to reference node outputs.
- Check that the upstream node you are referencing has actually run successfully.
- Use the Expression Editor's autocomplete for valid references — invalid ones will be underlined in red.

**My AI recommendations seem off.**
- The AI learns over time. Accept or override its suggestions to help it improve.
- Check the Learning Dashboard in Settings to review and approve detected patterns.
- View the Effectiveness Report to see if recommendation accuracy is trending up or down.

**The page looks different or broken.**
- Try toggling between Dark and Light mode in Settings to refresh the theme.
- Clear your browser cache and reload the page.

### FAQ

**Q: Can I use Entomate without recording meetings?**
A: Yes. You can use Tasks, Projects, Goals, Workflows, Automations, and Agents independently of meeting recordings.

**Q: How does the AI learn from my feedback?**
A: When you accept, modify, or override AI recommendations, the system tracks these decisions. Over time, it detects patterns in your preferences and adjusts its suggestions accordingly. You can review and approve these patterns in the Learning Dashboard.

**Q: Can I export my data?**
A: Yes. Go to the Reports page to download PDF reports or CSV exports of your meetings, action items, and goals.

**Q: Is my data secure?**
A: Entomate uses Supabase with Row-Level Security (RLS) policies, ensuring that each user can only access their own data. All connections use encrypted protocols.

**Q: What AI providers does Entomate support?**
A: Entomate supports both OpenAI and Google Gemini as AI providers. You can configure your preferred provider through environment variables.

**Q: What is The Trifecto?**
A: The Trifecto is the suite of three integrated products — Logos Vision (CRM), Pulse (communication), and Entomate (meeting intelligence). They are designed to work together but can also be used independently.

**Q: Can I restore a previous version of a workflow?**
A: Yes. Open the workflow in the Builder, then go to the Debug Panel's Versions tab. You can view the change history and restore any previous version.

### Getting Help

If you encounter an issue not covered here, check the project documentation in the `docs/` folder or reach out to your team administrator.
