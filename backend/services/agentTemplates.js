/**
 * Agent Templates Service
 * Provides agent templates for the AI Agent section
 * These templates leverage the cross-app ecosystem (Entomate, Pulse, Logos CRM, Shared Hub)
 */

/**
 * Get all agent templates with metadata
 */
function getAllTemplates() {
  return [
    // Original templates
    {
      id: 'deal-risk-monitor',
      name: 'Deal Risk Monitor',
      description: 'Automatically monitors deals for risk signals like overdue tasks and missed deadlines',
      category: 'Sales',
      icon: '⚠️',
      recommendedFor: ['Sales teams', 'Account managers'],
      triggers: [
        { type: 'task.overdue' },
        { type: 'action_item.missed_deadline' }
      ],
      actions: [
        { type: 'extract_action_items', description: 'Analyze risk factors' },
        { type: 'post_to_pulse', description: 'Post alert to Pulse' },
        { type: 'sync_to_crm', description: 'Update CRM deal notes' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'task.overdue',
      trigger_config: {
        overdueByDays: 1,
        priorityFilter: 'high'
      }
    },
    {
      id: 'meeting-outcome-processor',
      name: 'Meeting Outcome Processor',
      description: 'Automatically processes meeting transcripts to extract action items, decisions, and summaries',
      category: 'Meetings',
      icon: '📋',
      recommendedFor: ['All teams', 'Project managers', 'Sales teams'],
      triggers: [
        { type: 'meeting.completed' }
      ],
      actions: [
        { type: 'extract_action_items', description: 'Extract action items and decisions' },
        { type: 'sync_to_crm', description: 'Sync to CRM' },
        { type: 'post_to_pulse', description: 'Post summary to Pulse' }
      ],
      setupTime: '3 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        minDurationSec: 300,
        mustHaveTranscript: true
      }
    },
    {
      id: 'task-auto-assigner',
      name: 'Task Auto Assigner',
      description: 'Automatically assigns tasks based on workload and skills',
      category: 'Operations',
      icon: '🤖',
      recommendedFor: ['All teams', 'Project managers'],
      triggers: [
        { type: 'task.created' }
      ],
      actions: [
        { type: 'assign_task', description: 'Auto-assign task' }
      ],
      setupTime: '4 minutes',
      agent_type: 'predefined',
      trigger_type: 'task.overdue',
      trigger_config: {}
    },
    {
      id: 'customer-success-coordinator',
      name: 'Customer Success Coordinator',
      description: 'Automates customer onboarding by creating projects and tasks when deals close',
      category: 'Customer Success',
      icon: '🎉',
      recommendedFor: ['Customer success teams', 'Implementation teams'],
      triggers: [
        { type: 'deal.stage_changed' }
      ],
      actions: [
        { type: 'create_onboarding_project', description: 'Create onboarding project' },
        { type: 'assign_task', description: 'Assign initial tasks' },
        { type: 'post_to_pulse', description: 'Post kickoff message' }
      ],
      setupTime: '10 minutes',
      agent_type: 'predefined',
      trigger_type: 'deal.stage_changed',
      trigger_config: {
        toStage: 'implementation'
      }
    },
    
    // Cross-App Sync Templates
    {
      id: 'contact-sync-agent',
      name: 'Contact Sync Agent',
      description: 'Automatically syncs contacts from meetings across Entomate, Pulse, and Logos CRM',
      category: 'Cross-App Sync',
      icon: '👤',
      recommendedFor: ['Sales teams', 'All teams', 'CRM administrators'],
      triggers: [
        { type: 'meeting.completed' }
      ],
      actions: [
        { type: 'extract_action_items', description: 'Extract contacts from meeting' },
        { type: 'sync_to_crm', description: 'Sync to CRM and Shared Hub' },
        { type: 'post_to_pulse', description: 'Notify team of new contacts' }
      ],
      setupTime: '2 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        minDurationSec: 60,
        mustHaveTranscript: false
      }
    },
    {
      id: 'deal-sync-agent',
      name: 'Deal Sync Agent',
      description: 'Keeps deals synchronized across Entomate, Logos CRM, and Pulse with automatic updates',
      category: 'Cross-App Sync',
      icon: '💰',
      recommendedFor: ['Sales teams', 'Sales managers', 'Revenue operations'],
      triggers: [
        { type: 'deal.stage_changed' }
      ],
      actions: [
        { type: 'sync_to_crm', description: 'Sync deal updates' },
        { type: 'post_to_pulse', description: 'Post deal updates to Pulse' }
      ],
      setupTime: '3 minutes',
      agent_type: 'predefined',
      trigger_type: 'deal.stage_changed',
      trigger_config: {}
    },
    {
      id: 'event-sync-agent',
      name: 'Event Sync Agent',
      description: 'Syncs important events across all apps for unified calendar and timeline visibility',
      category: 'Cross-App Sync',
      icon: '📅',
      recommendedFor: ['All teams', 'Operations', 'Project managers'],
      triggers: [
        { type: 'meeting.completed' },
        { type: 'task.overdue' }
      ],
      actions: [
        { type: 'extract_action_items', description: 'Extract events' },
        { type: 'sync_to_crm', description: 'Sync to Shared Hub and CRM' },
        { type: 'post_to_pulse', description: 'Post event updates' }
      ],
      setupTime: '3 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        minDurationSec: 300,
        syncImportantOnly: true
      }
    },
    
    // Sales Automation Templates
    {
      id: 'lead-enrichment-agent',
      name: 'Lead Enrichment Agent',
      description: 'Automatically enriches leads with data from across the ecosystem and updates CRM',
      category: 'Sales Automation',
      icon: '🎯',
      recommendedFor: ['Sales teams', 'Business development', 'SDR teams'],
      triggers: [
        { type: 'meeting.completed' }
      ],
      actions: [
        { type: 'extract_action_items', description: 'Extract and enrich leads' },
        { type: 'sync_to_crm', description: 'Update CRM with enriched data' },
        { type: 'post_to_pulse', description: 'Notify of high-value leads' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        minDurationSec: 180,
        mustHaveTranscript: true
      }
    },
    {
      id: 'follow-up-automation-agent',
      name: 'Follow-Up Automation Agent',
      description: 'Automatically creates and schedules follow-up tasks and meetings after meetings',
      category: 'Sales Automation',
      icon: '✅',
      recommendedFor: ['Sales teams', 'Account managers', 'All teams'],
      triggers: [
        { type: 'meeting.completed' }
      ],
      actions: [
        { type: 'extract_action_items', description: 'Extract follow-up needs' },
        { type: 'assign_task', description: 'Create follow-up tasks' },
        { type: 'sync_to_crm', description: 'Sync tasks to CRM' },
        { type: 'post_to_pulse', description: 'Notify team' }
      ],
      setupTime: '4 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        minDurationSec: 300,
        mustHaveTranscript: true
      }
    },
    {
      id: 'deal-progression-agent',
      name: 'Deal Progression Agent',
      description: 'Monitors deal progression and creates tasks to move deals forward through the pipeline',
      category: 'Sales Automation',
      icon: '📈',
      recommendedFor: ['Sales teams', 'Sales managers', 'Revenue operations'],
      triggers: [
        { type: 'deal.stage_changed' },
        { type: 'task.overdue' }
      ],
      actions: [
        { type: 'extract_action_items', description: 'Analyze deal health' },
        { type: 'assign_task', description: 'Create progression tasks' },
        { type: 'sync_to_crm', description: 'Update deal notes' },
        { type: 'post_to_pulse', description: 'Alert on stalled deals' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'deal.stage_changed',
      trigger_config: {}
    },
    
    // Customer Success Templates
    {
      id: 'customer-health-monitor',
      name: 'Customer Health Monitor',
      description: 'Monitors customer health signals from meetings and engagement across the ecosystem',
      category: 'Customer Success',
      icon: '💚',
      recommendedFor: ['Customer success teams', 'Account managers', 'CS managers'],
      triggers: [
        { type: 'meeting.completed' },
        { type: 'task.overdue' }
      ],
      actions: [
        { type: 'extract_action_items', description: 'Analyze customer health' },
        { type: 'sync_to_crm', description: 'Update health score' },
        { type: 'post_to_pulse', description: 'Alert on at-risk customers' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        minDurationSec: 300,
        mustHaveTranscript: true
      }
    },
    {
      id: 'renewal-alert-agent',
      name: 'Renewal Alert Agent',
      description: 'Monitors renewal dates and creates proactive renewal preparation tasks',
      category: 'Customer Success',
      icon: '🔄',
      recommendedFor: ['Customer success teams', 'CS managers', 'Account managers'],
      triggers: [
        { type: 'task.overdue' }
      ],
      actions: [
        { type: 'extract_action_items', description: 'Check renewal dates' },
        { type: 'assign_task', description: 'Create renewal tasks' },
        { type: 'sync_to_crm', description: 'Update renewal records' },
        { type: 'post_to_pulse', description: 'Alert CSM team' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'task.overdue',
      trigger_config: {
        overdueByDays: 0,
        filterRenewalTasks: true
      }
    },
    {
      id: 'expansion-opportunity-agent',
      name: 'Expansion Opportunity Agent',
      description: 'Identifies expansion opportunities from customer meetings and engagement signals',
      category: 'Customer Success',
      icon: '🚀',
      recommendedFor: ['Customer success teams', 'Sales teams', 'Account managers'],
      triggers: [
        { type: 'meeting.completed' }
      ],
      actions: [
        { type: 'extract_action_items', description: 'Detect expansion signals' },
        { type: 'sync_to_crm', description: 'Create expansion deal' },
        { type: 'post_to_pulse', description: 'Notify sales team' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        minDurationSec: 300,
        mustHaveTranscript: true
      }
    },
    
    // Communication Templates
    {
      id: 'team-coordination-agent',
      name: 'Team Coordination Agent',
      description: 'Coordinates team activities across Entomate, Pulse, and CRM to keep everyone aligned',
      category: 'Communication',
      icon: '👥',
      recommendedFor: ['All teams', 'Project managers', 'Team leads'],
      triggers: [
        { type: 'meeting.completed' },
        { type: 'task.overdue' }
      ],
      actions: [
        { type: 'extract_action_items', description: 'Extract team assignments' },
        { type: 'assign_task', description: 'Sync task assignments' },
        { type: 'post_to_pulse', description: 'Coordinate team updates' },
        { type: 'sync_to_crm', description: 'Sync to CRM' }
      ],
      setupTime: '4 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        minDurationSec: 300,
        mustHaveTranscript: true
      }
    },
    {
      id: 'cross-app-notification-agent',
      name: 'Cross-App Notification Agent',
      description: 'Sends notifications across Entomate, Pulse, and CRM for important events',
      category: 'Communication',
      icon: '🔔',
      recommendedFor: ['All teams', 'Operations', 'Administrators'],
      triggers: [
        { type: 'meeting.completed' },
        { type: 'deal.stage_changed' },
        { type: 'task.overdue' }
      ],
      actions: [
        { type: 'extract_action_items', description: 'Determine notification needs' },
        { type: 'post_to_pulse', description: 'Post notifications' },
        { type: 'sync_to_crm', description: 'Create CRM notifications' }
      ],
      setupTime: '3 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        minDurationSec: 300,
        notifyOnImportantOnly: true
      }
    },
    
    // Operations Templates
    {
      id: 'data-quality-agent',
      name: 'Data Quality Agent',
      description: 'Monitors and improves data quality across all connected apps',
      category: 'Operations',
      icon: '🔍',
      recommendedFor: ['Operations', 'Data administrators', 'CRM administrators'],
      triggers: [
        { type: 'meeting.completed' },
        { type: 'deal.stage_changed' }
      ],
      actions: [
        { type: 'extract_action_items', description: 'Check data quality' },
        { type: 'assign_task', description: 'Create cleanup tasks' },
        { type: 'sync_to_crm', description: 'Flag data issues' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        minDurationSec: 60,
        checkDataQuality: true
      }
    },
    {
      id: 'reporting-agent',
      name: 'Reporting Agent',
      description: 'Generates and distributes reports by aggregating data from across the ecosystem',
      category: 'Operations',
      icon: '📊',
      recommendedFor: ['Operations', 'Managers', 'Analytics teams'],
      triggers: [
        { type: 'meeting.completed' }
      ],
      actions: [
        { type: 'extract_action_items', description: 'Gather metrics' },
        { type: 'post_to_pulse', description: 'Post report summary' },
        { type: 'sync_to_crm', description: 'Store report' }
      ],
      setupTime: '10 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        triggerOnSchedule: true
      }
    },
    {
      id: 'project-kickoff-agent',
      name: 'Project Kickoff Agent',
      description: 'Automates project kickoff when deals close or new projects are created',
      category: 'Operations',
      icon: '🚀',
      recommendedFor: ['Project managers', 'Operations', 'Implementation teams'],
      triggers: [
        { type: 'deal.stage_changed' }
      ],
      actions: [
        { type: 'create_onboarding_project', description: 'Create project from template' },
        { type: 'assign_task', description: 'Assign initial tasks' },
        { type: 'post_to_pulse', description: 'Post kickoff message' },
        { type: 'sync_to_crm', description: 'Sync project to CRM' }
      ],
      setupTime: '8 minutes',
      agent_type: 'predefined',
      trigger_type: 'deal.stage_changed',
      trigger_config: {
        toStage: 'closed-won'
      }
    },
    
    // Meeting Templates
    {
      id: 'meeting-insights-agent',
      name: 'Meeting Insights Agent',
      description: 'Extracts and shares key insights from meetings across the ecosystem',
      category: 'Meetings',
      icon: '💡',
      recommendedFor: ['All teams', 'Sales teams', 'Customer success'],
      triggers: [
        { type: 'meeting.completed' }
      ],
      actions: [
        { type: 'extract_action_items', description: 'Extract insights and takeaways' },
        { type: 'post_to_pulse', description: 'Share insights' },
        { type: 'sync_to_crm', description: 'Store insights in CRM' }
      ],
      setupTime: '3 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        minDurationSec: 300,
        mustHaveTranscript: true
      }
    },

    // ========================================
    // PRODUCTIVITY & TIME MANAGEMENT
    // ========================================
    {
      id: 'daily-standup-summarizer',
      name: 'Daily Standup Summarizer',
      description: 'Automatically captures and summarizes daily standup meetings, tracking blockers and commitments',
      category: 'Productivity',
      icon: '☀️',
      recommendedFor: ['Development teams', 'Agile teams', 'Remote teams'],
      triggers: [
        { type: 'meeting.completed' }
      ],
      actions: [
        { type: 'extract_action_items', description: 'Extract yesterday/today/blockers' },
        { type: 'assign_task', description: 'Create blocker resolution tasks' },
        { type: 'post_to_pulse', description: 'Post standup summary to team channel' }
      ],
      setupTime: '3 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        meetingType: 'standup',
        maxDurationSec: 900
      }
    },
    {
      id: 'weekly-review-compiler',
      name: 'Weekly Review Compiler',
      description: 'Compiles weekly accomplishments, metrics, and next week priorities from all team activities',
      category: 'Productivity',
      icon: '📅',
      recommendedFor: ['All teams', 'Managers', 'Team leads'],
      triggers: [
        { type: 'scheduled.weekly' }
      ],
      actions: [
        { type: 'extract_action_items', description: 'Compile weekly achievements' },
        { type: 'generate_report', description: 'Generate weekly summary report' },
        { type: 'post_to_pulse', description: 'Share weekly review with team' },
        { type: 'sync_to_crm', description: 'Store metrics in CRM' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'scheduled.weekly',
      trigger_config: {
        dayOfWeek: 'friday',
        time: '16:00'
      }
    },
    {
      id: 'focus-time-protector',
      name: 'Focus Time Protector',
      description: 'Monitors calendar and protects deep work blocks by auto-declining or rescheduling conflicts',
      category: 'Productivity',
      icon: '🎯',
      recommendedFor: ['Developers', 'Designers', 'Knowledge workers'],
      triggers: [
        { type: 'calendar.conflict_detected' },
        { type: 'meeting.scheduled' }
      ],
      actions: [
        { type: 'analyze_calendar', description: 'Check for focus time conflicts' },
        { type: 'suggest_reschedule', description: 'Suggest alternative meeting times' },
        { type: 'post_to_pulse', description: 'Notify of protected time blocks' }
      ],
      setupTime: '4 minutes',
      agent_type: 'predefined',
      trigger_type: 'calendar.conflict_detected',
      trigger_config: {
        protectedBlockLabel: 'Focus Time',
        autoDecline: false
      }
    },
    {
      id: 'task-deadline-reminder',
      name: 'Smart Deadline Reminder',
      description: 'Sends intelligent reminders based on task complexity and team member workload',
      category: 'Productivity',
      icon: '⏰',
      recommendedFor: ['All teams', 'Project managers', 'Team leads'],
      triggers: [
        { type: 'task.deadline_approaching' }
      ],
      actions: [
        { type: 'analyze_workload', description: 'Check assignee workload' },
        { type: 'send_reminder', description: 'Send personalized reminder' },
        { type: 'post_to_pulse', description: 'Alert team of at-risk deadlines' }
      ],
      setupTime: '3 minutes',
      agent_type: 'predefined',
      trigger_type: 'task.deadline_approaching',
      trigger_config: {
        daysBeforeDeadline: [7, 3, 1],
        adjustForComplexity: true
      }
    },
    {
      id: 'workload-balancer',
      name: 'Workload Balancer',
      description: 'Monitors team workload distribution and suggests task reassignments to prevent burnout',
      category: 'Productivity',
      icon: '⚖️',
      recommendedFor: ['Managers', 'Team leads', 'Project managers'],
      triggers: [
        { type: 'task.created' },
        { type: 'task.overdue' }
      ],
      actions: [
        { type: 'analyze_workload', description: 'Calculate team workload distribution' },
        { type: 'suggest_reassignment', description: 'Suggest task redistribution' },
        { type: 'post_to_pulse', description: 'Alert on workload imbalance' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'task.created',
      trigger_config: {
        balanceThreshold: 0.3,
        alertOnOverload: true
      }
    },
    {
      id: 'meeting-free-day-enforcer',
      name: 'Meeting-Free Day Enforcer',
      description: 'Protects designated meeting-free days and auto-suggests rescheduling',
      category: 'Productivity',
      icon: '🚫',
      recommendedFor: ['All teams', 'Remote teams', 'Engineering teams'],
      triggers: [
        { type: 'meeting.scheduled' }
      ],
      actions: [
        { type: 'check_meeting_free_day', description: 'Verify meeting-free day policy' },
        { type: 'suggest_reschedule', description: 'Suggest alternative days' },
        { type: 'post_to_pulse', description: 'Remind team of meeting-free policy' }
      ],
      setupTime: '2 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.scheduled',
      trigger_config: {
        meetingFreeDays: ['wednesday'],
        exceptionsAllowed: ['urgent', 'client']
      }
    },

    // ========================================
    // HR & PEOPLE OPERATIONS
    // ========================================
    {
      id: 'new-hire-onboarding-agent',
      name: 'New Hire Onboarding Agent',
      description: 'Automates new employee onboarding with task creation, introductions, and training schedules',
      category: 'HR & People',
      icon: '👋',
      recommendedFor: ['HR teams', 'People ops', 'Managers'],
      triggers: [
        { type: 'employee.joined' }
      ],
      actions: [
        { type: 'create_onboarding_project', description: 'Create 30-60-90 day plan' },
        { type: 'assign_task', description: 'Assign onboarding tasks to team' },
        { type: 'schedule_meetings', description: 'Schedule intro meetings' },
        { type: 'post_to_pulse', description: 'Announce new team member' }
      ],
      setupTime: '10 minutes',
      agent_type: 'predefined',
      trigger_type: 'employee.joined',
      trigger_config: {
        onboardingTemplateDays: 90,
        assignBuddy: true
      }
    },
    {
      id: 'one-on-one-prep-agent',
      name: '1:1 Meeting Prep Agent',
      description: 'Prepares managers for 1:1s by gathering recent work, blockers, and talking points',
      category: 'HR & People',
      icon: '🤝',
      recommendedFor: ['Managers', 'Team leads', 'HR teams'],
      triggers: [
        { type: 'meeting.scheduled' }
      ],
      actions: [
        { type: 'gather_context', description: 'Collect recent activities and blockers' },
        { type: 'generate_agenda', description: 'Create suggested agenda' },
        { type: 'extract_action_items', description: 'Review previous 1:1 action items' }
      ],
      setupTime: '4 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.scheduled',
      trigger_config: {
        meetingType: '1:1',
        prepTimeMinutes: 60
      }
    },
    {
      id: 'employee-milestone-celebrator',
      name: 'Employee Milestone Celebrator',
      description: 'Tracks and celebrates work anniversaries, promotions, and achievements',
      category: 'HR & People',
      icon: '🎉',
      recommendedFor: ['HR teams', 'People ops', 'Culture teams'],
      triggers: [
        { type: 'employee.anniversary' },
        { type: 'employee.promotion' }
      ],
      actions: [
        { type: 'create_celebration', description: 'Prepare celebration message' },
        { type: 'post_to_pulse', description: 'Announce milestone to team' },
        { type: 'assign_task', description: 'Trigger recognition workflow' }
      ],
      setupTime: '3 minutes',
      agent_type: 'predefined',
      trigger_type: 'employee.anniversary',
      trigger_config: {
        milestones: [1, 2, 3, 5, 10],
        includePromotions: true
      }
    },
    {
      id: 'team-sentiment-monitor',
      name: 'Team Sentiment Monitor',
      description: 'Analyzes meeting tone and communication patterns to identify team morale trends',
      category: 'HR & People',
      icon: '😊',
      recommendedFor: ['Managers', 'HR teams', 'Team leads'],
      triggers: [
        { type: 'meeting.completed' }
      ],
      actions: [
        { type: 'analyze_sentiment', description: 'Analyze meeting sentiment' },
        { type: 'track_trends', description: 'Track sentiment over time' },
        { type: 'alert_manager', description: 'Alert on negative trends' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        sentimentThreshold: -0.3,
        alertOnDecline: true
      }
    },
    {
      id: 'pto-coverage-coordinator',
      name: 'PTO Coverage Coordinator',
      description: 'Automatically arranges coverage and handoffs when team members take time off',
      category: 'HR & People',
      icon: '🏖️',
      recommendedFor: ['All teams', 'Managers', 'HR teams'],
      triggers: [
        { type: 'pto.requested' },
        { type: 'pto.approved' }
      ],
      actions: [
        { type: 'identify_coverage', description: 'Identify tasks needing coverage' },
        { type: 'assign_task', description: 'Assign coverage to teammates' },
        { type: 'create_handoff', description: 'Generate handoff document' },
        { type: 'post_to_pulse', description: 'Announce coverage plan' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'pto.approved',
      trigger_config: {
        minPtoDays: 2,
        handoffLeadDays: 3
      }
    },
    {
      id: 'skill-gap-identifier',
      name: 'Skill Gap Identifier',
      description: 'Analyzes team capabilities and identifies training needs based on project requirements',
      category: 'HR & People',
      icon: '📚',
      recommendedFor: ['Managers', 'HR teams', 'L&D teams'],
      triggers: [
        { type: 'project.created' },
        { type: 'task.blocked' }
      ],
      actions: [
        { type: 'analyze_skills', description: 'Map required vs available skills' },
        { type: 'suggest_training', description: 'Recommend training resources' },
        { type: 'assign_task', description: 'Create learning tasks' }
      ],
      setupTime: '8 minutes',
      agent_type: 'predefined',
      trigger_type: 'project.created',
      trigger_config: {
        trackSkillsMatrix: true,
        suggestMentors: true
      }
    },

    // ========================================
    // MARKETING & CONTENT
    // ========================================
    {
      id: 'content-calendar-manager',
      name: 'Content Calendar Manager',
      description: 'Manages content calendar, sends reminders for deadlines, and tracks content pipeline',
      category: 'Marketing',
      icon: '📝',
      recommendedFor: ['Marketing teams', 'Content teams', 'Social media managers'],
      triggers: [
        { type: 'task.deadline_approaching' },
        { type: 'content.status_changed' }
      ],
      actions: [
        { type: 'send_reminder', description: 'Send content deadline reminders' },
        { type: 'update_calendar', description: 'Update content calendar status' },
        { type: 'post_to_pulse', description: 'Alert team of upcoming content' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'task.deadline_approaching',
      trigger_config: {
        contentTypes: ['blog', 'social', 'email', 'video'],
        reminderDays: [7, 3, 1]
      }
    },
    {
      id: 'campaign-performance-tracker',
      name: 'Campaign Performance Tracker',
      description: 'Monitors marketing campaign performance and alerts on significant changes',
      category: 'Marketing',
      icon: '📊',
      recommendedFor: ['Marketing teams', 'Growth teams', 'Digital marketers'],
      triggers: [
        { type: 'campaign.metrics_updated' },
        { type: 'scheduled.daily' }
      ],
      actions: [
        { type: 'analyze_metrics', description: 'Analyze campaign performance' },
        { type: 'generate_report', description: 'Generate performance summary' },
        { type: 'post_to_pulse', description: 'Share wins and alerts' },
        { type: 'sync_to_crm', description: 'Update campaign records' }
      ],
      setupTime: '6 minutes',
      agent_type: 'predefined',
      trigger_type: 'scheduled.daily',
      trigger_config: {
        alertOnThreshold: 0.2,
        trackMetrics: ['impressions', 'clicks', 'conversions']
      }
    },
    {
      id: 'social-mention-responder',
      name: 'Social Mention Responder',
      description: 'Monitors social mentions and creates response tasks for the team',
      category: 'Marketing',
      icon: '💬',
      recommendedFor: ['Social media teams', 'Community managers', 'PR teams'],
      triggers: [
        { type: 'social.mention_detected' }
      ],
      actions: [
        { type: 'classify_mention', description: 'Classify mention sentiment and urgency' },
        { type: 'assign_task', description: 'Create response task' },
        { type: 'post_to_pulse', description: 'Alert team of important mentions' }
      ],
      setupTime: '4 minutes',
      agent_type: 'predefined',
      trigger_type: 'social.mention_detected',
      trigger_config: {
        platforms: ['twitter', 'linkedin', 'facebook'],
        prioritizeNegative: true
      }
    },
    {
      id: 'competitor-update-monitor',
      name: 'Competitor Update Monitor',
      description: 'Tracks competitor activities and shares relevant updates with the team',
      category: 'Marketing',
      icon: '🔭',
      recommendedFor: ['Marketing teams', 'Product teams', 'Sales teams'],
      triggers: [
        { type: 'competitor.update_detected' },
        { type: 'scheduled.weekly' }
      ],
      actions: [
        { type: 'gather_intel', description: 'Collect competitor updates' },
        { type: 'generate_report', description: 'Summarize competitive landscape' },
        { type: 'post_to_pulse', description: 'Share intel with team' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'scheduled.weekly',
      trigger_config: {
        competitors: [],
        trackSources: ['news', 'social', 'product_updates']
      }
    },
    {
      id: 'event-promotion-coordinator',
      name: 'Event Promotion Coordinator',
      description: 'Manages event promotion timelines and ensures all marketing tasks are completed',
      category: 'Marketing',
      icon: '🎪',
      recommendedFor: ['Marketing teams', 'Event coordinators', 'Sales teams'],
      triggers: [
        { type: 'event.created' },
        { type: 'task.deadline_approaching' }
      ],
      actions: [
        { type: 'create_promotion_plan', description: 'Generate promotion timeline' },
        { type: 'assign_task', description: 'Assign promotional tasks' },
        { type: 'send_reminder', description: 'Send promotion reminders' },
        { type: 'post_to_pulse', description: 'Coordinate team efforts' }
      ],
      setupTime: '8 minutes',
      agent_type: 'predefined',
      trigger_type: 'event.created',
      trigger_config: {
        promotionLeadWeeks: 4,
        channels: ['email', 'social', 'partners']
      }
    },

    // ========================================
    // FINANCE & ADMIN
    // ========================================
    {
      id: 'invoice-followup-agent',
      name: 'Invoice Follow-Up Agent',
      description: 'Tracks outstanding invoices and automates follow-up reminders',
      category: 'Finance',
      icon: '💵',
      recommendedFor: ['Finance teams', 'Account managers', 'Small business owners'],
      triggers: [
        { type: 'invoice.overdue' },
        { type: 'invoice.due_soon' }
      ],
      actions: [
        { type: 'send_reminder', description: 'Send payment reminder' },
        { type: 'assign_task', description: 'Create follow-up task' },
        { type: 'sync_to_crm', description: 'Update account notes' },
        { type: 'post_to_pulse', description: 'Alert on large overdue amounts' }
      ],
      setupTime: '4 minutes',
      agent_type: 'predefined',
      trigger_type: 'invoice.overdue',
      trigger_config: {
        reminderDays: [7, 14, 30],
        escalateAfterDays: 60
      }
    },
    {
      id: 'expense-approval-router',
      name: 'Expense Approval Router',
      description: 'Routes expense requests to appropriate approvers based on amount and category',
      category: 'Finance',
      icon: '🧾',
      recommendedFor: ['Finance teams', 'Managers', 'Admin teams'],
      triggers: [
        { type: 'expense.submitted' }
      ],
      actions: [
        { type: 'route_approval', description: 'Route to appropriate approver' },
        { type: 'assign_task', description: 'Create approval task' },
        { type: 'send_notification', description: 'Notify approver' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'expense.submitted',
      trigger_config: {
        thresholds: { manager: 500, director: 2000, executive: 10000 },
        categoryRules: true
      }
    },
    {
      id: 'budget-alert-agent',
      name: 'Budget Alert Agent',
      description: 'Monitors budget utilization and alerts when spending approaches or exceeds limits',
      category: 'Finance',
      icon: '📉',
      recommendedFor: ['Finance teams', 'Managers', 'Project managers'],
      triggers: [
        { type: 'budget.threshold_reached' },
        { type: 'scheduled.weekly' }
      ],
      actions: [
        { type: 'check_budget', description: 'Analyze budget utilization' },
        { type: 'generate_report', description: 'Generate spending report' },
        { type: 'post_to_pulse', description: 'Alert on budget concerns' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'budget.threshold_reached',
      trigger_config: {
        alertThresholds: [0.75, 0.9, 1.0],
        includeForecasting: true
      }
    },
    {
      id: 'contract-renewal-tracker',
      name: 'Contract Renewal Tracker',
      description: 'Tracks contract expiration dates and initiates renewal processes automatically',
      category: 'Finance',
      icon: '📜',
      recommendedFor: ['Legal teams', 'Procurement', 'Account managers'],
      triggers: [
        { type: 'contract.expiring_soon' }
      ],
      actions: [
        { type: 'create_renewal_task', description: 'Initiate renewal process' },
        { type: 'assign_task', description: 'Assign to contract owner' },
        { type: 'send_reminder', description: 'Send expiration reminders' },
        { type: 'sync_to_crm', description: 'Update contract status' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'contract.expiring_soon',
      trigger_config: {
        reminderDays: [90, 60, 30, 14],
        autoRenewalCheck: true
      }
    },
    {
      id: 'vendor-payment-scheduler',
      name: 'Vendor Payment Scheduler',
      description: 'Manages vendor payment schedules and ensures timely payments',
      category: 'Finance',
      icon: '💳',
      recommendedFor: ['Finance teams', 'AP teams', 'Small business owners'],
      triggers: [
        { type: 'payment.due_soon' },
        { type: 'scheduled.daily' }
      ],
      actions: [
        { type: 'check_payments', description: 'Review upcoming payments' },
        { type: 'prepare_batch', description: 'Prepare payment batch' },
        { type: 'assign_task', description: 'Create approval task' },
        { type: 'post_to_pulse', description: 'Notify of payment schedule' }
      ],
      setupTime: '6 minutes',
      agent_type: 'predefined',
      trigger_type: 'scheduled.daily',
      trigger_config: {
        lookAheadDays: 7,
        earlyPaymentDiscount: true
      }
    },

    // ========================================
    // KNOWLEDGE MANAGEMENT
    // ========================================
    {
      id: 'meeting-notes-organizer',
      name: 'Meeting Notes Organizer',
      description: 'Automatically organizes meeting notes into searchable knowledge base entries',
      category: 'Knowledge',
      icon: '🗂️',
      recommendedFor: ['All teams', 'Documentation teams', 'Knowledge managers'],
      triggers: [
        { type: 'meeting.completed' }
      ],
      actions: [
        { type: 'extract_action_items', description: 'Extract key information' },
        { type: 'categorize_content', description: 'Categorize and tag notes' },
        { type: 'store_knowledge', description: 'Save to knowledge base' },
        { type: 'link_related', description: 'Link to related documents' }
      ],
      setupTime: '4 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        autoTag: true,
        extractDecisions: true
      }
    },
    {
      id: 'documentation-updater',
      name: 'Documentation Updater',
      description: 'Identifies outdated documentation based on product changes and creates update tasks',
      category: 'Knowledge',
      icon: '📖',
      recommendedFor: ['Documentation teams', 'Product teams', 'Technical writers'],
      triggers: [
        { type: 'product.feature_released' },
        { type: 'task.completed' }
      ],
      actions: [
        { type: 'identify_affected_docs', description: 'Find affected documentation' },
        { type: 'assign_task', description: 'Create documentation update tasks' },
        { type: 'post_to_pulse', description: 'Notify documentation team' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'product.feature_released',
      trigger_config: {
        trackDocTypes: ['user_guides', 'api_docs', 'faqs'],
        staleDays: 90
      }
    },
    {
      id: 'faq-generator',
      name: 'FAQ Generator',
      description: 'Analyzes support tickets and meetings to identify common questions for FAQ updates',
      category: 'Knowledge',
      icon: '❓',
      recommendedFor: ['Support teams', 'Documentation teams', 'Customer success'],
      triggers: [
        { type: 'support.ticket_resolved' },
        { type: 'meeting.completed' }
      ],
      actions: [
        { type: 'analyze_questions', description: 'Identify common questions' },
        { type: 'generate_faq', description: 'Draft FAQ entries' },
        { type: 'assign_task', description: 'Create review task' },
        { type: 'post_to_pulse', description: 'Share new FAQ suggestions' }
      ],
      setupTime: '6 minutes',
      agent_type: 'predefined',
      trigger_type: 'support.ticket_resolved',
      trigger_config: {
        frequencyThreshold: 3,
        includeMeetingQuestions: true
      }
    },
    {
      id: 'tribal-knowledge-capturer',
      name: 'Tribal Knowledge Capturer',
      description: 'Captures institutional knowledge from conversations before it gets lost',
      category: 'Knowledge',
      icon: '🧠',
      recommendedFor: ['All teams', 'Managers', 'Knowledge managers'],
      triggers: [
        { type: 'meeting.completed' },
        { type: 'employee.departing' }
      ],
      actions: [
        { type: 'extract_knowledge', description: 'Identify undocumented processes' },
        { type: 'create_documentation', description: 'Generate process documentation' },
        { type: 'assign_task', description: 'Create review/validation task' },
        { type: 'store_knowledge', description: 'Save to knowledge base' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        lookForProcesses: true,
        prioritizeExpertise: true
      }
    },
    {
      id: 'decision-log-keeper',
      name: 'Decision Log Keeper',
      description: 'Automatically captures and logs important decisions made in meetings',
      category: 'Knowledge',
      icon: '⚖️',
      recommendedFor: ['All teams', 'Project managers', 'Leadership'],
      triggers: [
        { type: 'meeting.completed' }
      ],
      actions: [
        { type: 'extract_decisions', description: 'Extract decisions from meeting' },
        { type: 'log_decision', description: 'Add to decision log with context' },
        { type: 'post_to_pulse', description: 'Announce key decisions' },
        { type: 'assign_task', description: 'Create implementation tasks' }
      ],
      setupTime: '3 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        requireRationale: true,
        linkToTickets: true
      }
    },

    // ========================================
    // QUALITY ASSURANCE & DEVELOPMENT
    // ========================================
    {
      id: 'bug-triage-agent',
      name: 'Bug Triage Agent',
      description: 'Automatically triages new bugs based on severity, component, and historical patterns',
      category: 'Development',
      icon: '🐛',
      recommendedFor: ['Development teams', 'QA teams', 'Support teams'],
      triggers: [
        { type: 'bug.reported' }
      ],
      actions: [
        { type: 'analyze_bug', description: 'Analyze bug severity and impact' },
        { type: 'assign_task', description: 'Route to appropriate team' },
        { type: 'post_to_pulse', description: 'Alert on critical bugs' },
        { type: 'link_related', description: 'Find related bugs' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'bug.reported',
      trigger_config: {
        severityLevels: ['critical', 'high', 'medium', 'low'],
        autoAssign: true
      }
    },
    {
      id: 'release-notes-generator',
      name: 'Release Notes Generator',
      description: 'Compiles release notes from completed tickets and generates formatted changelogs',
      category: 'Development',
      icon: '📋',
      recommendedFor: ['Development teams', 'Product teams', 'Technical writers'],
      triggers: [
        { type: 'release.created' },
        { type: 'sprint.completed' }
      ],
      actions: [
        { type: 'gather_changes', description: 'Collect completed tickets' },
        { type: 'generate_notes', description: 'Generate formatted release notes' },
        { type: 'post_to_pulse', description: 'Share release notes' },
        { type: 'sync_to_crm', description: 'Update customer-facing docs' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'release.created',
      trigger_config: {
        format: 'keep-a-changelog',
        includeContributors: true
      }
    },
    {
      id: 'code-review-reminder',
      name: 'Code Review Reminder',
      description: 'Reminds developers about pending code reviews and tracks review turnaround time',
      category: 'Development',
      icon: '👀',
      recommendedFor: ['Development teams', 'Engineering managers', 'Tech leads'],
      triggers: [
        { type: 'pr.review_requested' },
        { type: 'pr.stale' }
      ],
      actions: [
        { type: 'send_reminder', description: 'Send review reminder' },
        { type: 'track_metrics', description: 'Track review turnaround time' },
        { type: 'post_to_pulse', description: 'Alert on stale PRs' }
      ],
      setupTime: '3 minutes',
      agent_type: 'predefined',
      trigger_type: 'pr.review_requested',
      trigger_config: {
        reminderAfterHours: 24,
        escalateAfterHours: 48
      }
    },
    {
      id: 'tech-debt-tracker',
      name: 'Tech Debt Tracker',
      description: 'Identifies and tracks technical debt from code comments, meetings, and retrospectives',
      category: 'Development',
      icon: '💸',
      recommendedFor: ['Development teams', 'Engineering managers', 'Architects'],
      triggers: [
        { type: 'meeting.completed' },
        { type: 'code.todo_added' }
      ],
      actions: [
        { type: 'extract_tech_debt', description: 'Identify tech debt items' },
        { type: 'create_ticket', description: 'Create tech debt ticket' },
        { type: 'categorize_debt', description: 'Categorize by impact/effort' },
        { type: 'post_to_pulse', description: 'Report tech debt status' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        trackTodoComments: true,
        retrospectiveTag: 'tech-debt'
      }
    },
    {
      id: 'deployment-coordinator',
      name: 'Deployment Coordinator',
      description: 'Coordinates deployments by checking readiness and notifying stakeholders',
      category: 'Development',
      icon: '🚀',
      recommendedFor: ['DevOps teams', 'Development teams', 'Release managers'],
      triggers: [
        { type: 'deployment.scheduled' },
        { type: 'deployment.started' }
      ],
      actions: [
        { type: 'check_readiness', description: 'Verify deployment checklist' },
        { type: 'notify_stakeholders', description: 'Send deployment notifications' },
        { type: 'post_to_pulse', description: 'Announce deployment status' },
        { type: 'assign_task', description: 'Create post-deployment tasks' }
      ],
      setupTime: '6 minutes',
      agent_type: 'predefined',
      trigger_type: 'deployment.scheduled',
      trigger_config: {
        checklistRequired: true,
        notifyChannels: ['team', 'stakeholders']
      }
    },
    {
      id: 'sprint-retrospective-analyzer',
      name: 'Sprint Retrospective Analyzer',
      description: 'Analyzes retrospective feedback and tracks improvement action items over time',
      category: 'Development',
      icon: '🔄',
      recommendedFor: ['Agile teams', 'Scrum masters', 'Engineering managers'],
      triggers: [
        { type: 'meeting.completed' }
      ],
      actions: [
        { type: 'analyze_feedback', description: 'Categorize retro feedback' },
        { type: 'assign_task', description: 'Create improvement action items' },
        { type: 'track_progress', description: 'Track improvement over sprints' },
        { type: 'generate_report', description: 'Generate trend report' }
      ],
      setupTime: '4 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        meetingType: 'retrospective',
        categorize: ['keep', 'stop', 'start']
      }
    },

    // ========================================
    // CLIENT & SUPPORT
    // ========================================
    {
      id: 'client-meeting-prep',
      name: 'Client Meeting Prep Agent',
      description: 'Prepares comprehensive briefings before client meetings with recent history and context',
      category: 'Client Success',
      icon: '📁',
      recommendedFor: ['Sales teams', 'Account managers', 'Customer success'],
      triggers: [
        { type: 'meeting.scheduled' }
      ],
      actions: [
        { type: 'gather_context', description: 'Compile client history' },
        { type: 'generate_briefing', description: 'Create meeting briefing' },
        { type: 'extract_action_items', description: 'Review pending items' },
        { type: 'sync_to_crm', description: 'Update with latest info' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.scheduled',
      trigger_config: {
        meetingType: 'client',
        prepTimeMinutes: 120,
        includeHistory: true
      }
    },
    {
      id: 'support-ticket-escalator',
      name: 'Support Ticket Escalator',
      description: 'Monitors support tickets and escalates based on SLA, sentiment, or customer tier',
      category: 'Client Success',
      icon: '🚨',
      recommendedFor: ['Support teams', 'Customer success', 'Account managers'],
      triggers: [
        { type: 'support.ticket_sla_warning' },
        { type: 'support.negative_sentiment' }
      ],
      actions: [
        { type: 'escalate_ticket', description: 'Escalate to appropriate level' },
        { type: 'assign_task', description: 'Create urgent response task' },
        { type: 'post_to_pulse', description: 'Alert team of escalation' },
        { type: 'sync_to_crm', description: 'Update account health' }
      ],
      setupTime: '4 minutes',
      agent_type: 'predefined',
      trigger_type: 'support.ticket_sla_warning',
      trigger_config: {
        slaThresholds: { enterprise: 2, business: 4, standard: 8 },
        escalateNegativeSentiment: true
      }
    },
    {
      id: 'nps-response-handler',
      name: 'NPS Response Handler',
      description: 'Routes NPS responses for appropriate follow-up based on score and feedback',
      category: 'Client Success',
      icon: '📈',
      recommendedFor: ['Customer success', 'Product teams', 'Support teams'],
      triggers: [
        { type: 'nps.response_received' }
      ],
      actions: [
        { type: 'categorize_response', description: 'Categorize by score and feedback' },
        { type: 'assign_task', description: 'Create follow-up task' },
        { type: 'post_to_pulse', description: 'Share promoter testimonials' },
        { type: 'sync_to_crm', description: 'Update customer record' }
      ],
      setupTime: '4 minutes',
      agent_type: 'predefined',
      trigger_type: 'nps.response_received',
      trigger_config: {
        detractorThreshold: 6,
        promoterThreshold: 9,
        followUpDetractors: true
      }
    },
    {
      id: 'customer-communication-logger',
      name: 'Customer Communication Logger',
      description: 'Logs all customer communications across channels to maintain complete history',
      category: 'Client Success',
      icon: '📞',
      recommendedFor: ['Sales teams', 'Customer success', 'Support teams'],
      triggers: [
        { type: 'meeting.completed' },
        { type: 'email.sent' },
        { type: 'call.completed' }
      ],
      actions: [
        { type: 'log_communication', description: 'Log to customer timeline' },
        { type: 'extract_action_items', description: 'Extract commitments made' },
        { type: 'sync_to_crm', description: 'Update CRM records' }
      ],
      setupTime: '3 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        logAllChannels: true,
        extractSentiment: true
      }
    },

    // ========================================
    // PROJECT MANAGEMENT
    // ========================================
    {
      id: 'project-status-reporter',
      name: 'Project Status Reporter',
      description: 'Generates automated project status reports based on task completion and milestones',
      category: 'Project Management',
      icon: '📊',
      recommendedFor: ['Project managers', 'Team leads', 'Stakeholders'],
      triggers: [
        { type: 'scheduled.weekly' },
        { type: 'milestone.completed' }
      ],
      actions: [
        { type: 'gather_metrics', description: 'Collect project metrics' },
        { type: 'generate_report', description: 'Generate status report' },
        { type: 'post_to_pulse', description: 'Share with stakeholders' },
        { type: 'sync_to_crm', description: 'Update project records' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'scheduled.weekly',
      trigger_config: {
        includeMetrics: ['completion', 'velocity', 'blockers', 'risks'],
        format: 'executive_summary'
      }
    },
    {
      id: 'dependency-tracker',
      name: 'Dependency Tracker',
      description: 'Tracks task dependencies and alerts when blocking issues threaten timelines',
      category: 'Project Management',
      icon: '🔗',
      recommendedFor: ['Project managers', 'Development teams', 'Team leads'],
      triggers: [
        { type: 'task.blocked' },
        { type: 'task.updated' }
      ],
      actions: [
        { type: 'analyze_dependencies', description: 'Map dependency chain' },
        { type: 'identify_impact', description: 'Calculate timeline impact' },
        { type: 'assign_task', description: 'Create unblock tasks' },
        { type: 'post_to_pulse', description: 'Alert on critical path issues' }
      ],
      setupTime: '5 minutes',
      agent_type: 'predefined',
      trigger_type: 'task.blocked',
      trigger_config: {
        trackCriticalPath: true,
        alertOnDelay: true
      }
    },
    {
      id: 'milestone-celebration-agent',
      name: 'Milestone Celebration Agent',
      description: 'Celebrates project milestones and team achievements to boost morale',
      category: 'Project Management',
      icon: '🏆',
      recommendedFor: ['All teams', 'Project managers', 'Team leads'],
      triggers: [
        { type: 'milestone.completed' },
        { type: 'project.completed' }
      ],
      actions: [
        { type: 'create_celebration', description: 'Prepare celebration message' },
        { type: 'post_to_pulse', description: 'Announce achievement' },
        { type: 'gather_metrics', description: 'Compile achievement stats' }
      ],
      setupTime: '2 minutes',
      agent_type: 'predefined',
      trigger_type: 'milestone.completed',
      trigger_config: {
        includeContributors: true,
        shareMetrics: true
      }
    },
    {
      id: 'risk-register-updater',
      name: 'Risk Register Updater',
      description: 'Monitors project risks mentioned in meetings and updates the risk register',
      category: 'Project Management',
      icon: '⚠️',
      recommendedFor: ['Project managers', 'Risk managers', 'Team leads'],
      triggers: [
        { type: 'meeting.completed' },
        { type: 'task.blocked' }
      ],
      actions: [
        { type: 'extract_risks', description: 'Identify mentioned risks' },
        { type: 'update_register', description: 'Update risk register' },
        { type: 'assign_task', description: 'Create mitigation tasks' },
        { type: 'post_to_pulse', description: 'Alert on high-severity risks' }
      ],
      setupTime: '4 minutes',
      agent_type: 'predefined',
      trigger_type: 'meeting.completed',
      trigger_config: {
        severityLevels: ['low', 'medium', 'high', 'critical'],
        requireMitigation: true
      }
    },
    {
      id: 'resource-allocation-optimizer',
      name: 'Resource Allocation Optimizer',
      description: 'Analyzes resource utilization and suggests optimal allocation across projects',
      category: 'Project Management',
      icon: '📐',
      recommendedFor: ['Project managers', 'Resource managers', 'Team leads'],
      triggers: [
        { type: 'project.created' },
        { type: 'scheduled.weekly' }
      ],
      actions: [
        { type: 'analyze_utilization', description: 'Calculate resource utilization' },
        { type: 'suggest_allocation', description: 'Recommend optimal allocation' },
        { type: 'generate_report', description: 'Generate utilization report' },
        { type: 'post_to_pulse', description: 'Share allocation insights' }
      ],
      setupTime: '6 minutes',
      agent_type: 'predefined',
      trigger_type: 'scheduled.weekly',
      trigger_config: {
        utilizationTarget: 0.8,
        alertOnOverallocation: true
      }
    }
  ];
}

/**
 * Get template by ID
 */
function getTemplateById(templateId) {
  const templates = getAllTemplates();
  return templates.find(t => t.id === templateId) || null;
}

/**
 * Get templates by category
 */
function getTemplatesByCategory(category) {
  const templates = getAllTemplates();
  return templates.filter(t => t.category === category);
}

/**
 * Get all categories
 */
function getCategories() {
  const templates = getAllTemplates();
  const categories = [...new Set(templates.map(t => t.category))];
  return categories;
}

module.exports = {
  getAllTemplates,
  getTemplateById,
  getTemplatesByCategory,
  getCategories
};

