/**
 * Create Onboarding Project Action
 * Creates a new project from a template for customer onboarding
 */

import { supabase } from '../../lib/supabase';
import { upsertRelationship } from '../../graph/relationshipService';
import type { Agent, ActionStep } from '../types';

export interface CreateOnboardingProjectConfig {
  templateId: string;
  nameTemplate: string;
  linkToDeal?: boolean;
  copyTasks?: boolean;
  adjustDueDates?: boolean;
  defaultDurationDays?: number;
}

export interface CreateOnboardingProjectResult {
  created: boolean;
  projectId?: string;
  projectName?: string;
  tasksCreated: number;
  linkedToDeal?: string;
}

/**
 * Execute the create onboarding project action
 */
export async function execute(params: {
  agent: Agent;
  step: ActionStep;
  triggerPayload: Record<string, any>;
  dryRun?: boolean;
}): Promise<{
  result: CreateOnboardingProjectResult;
  countersDelta: { crmTasks: number };
}> {
  const { step, triggerPayload, dryRun } = params;
  const config = step.config as CreateOnboardingProjectConfig;

  console.log('[Action:create_onboarding_project] Starting', { dryRun, templateId: config.templateId });

  // Build project name from template
  const projectName = buildProjectName(config.nameTemplate, triggerPayload);

  if (dryRun) {
    console.log('[Action:create_onboarding_project] DRY RUN - Would create:', { projectName, config });
    return {
      result: {
        created: false,
        projectName: `[DRY RUN] ${projectName}`,
        tasksCreated: 0
      },
      countersDelta: { crmTasks: 0 }
    };
  }

  try {
    // Load project template
    const template = await loadProjectTemplate(config.templateId);

    // Create the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: projectName,
        description: template?.description || `Onboarding project for ${triggerPayload.customerName || 'customer'}`,
        status: 'active',
        template_id: config.templateId,
        deal_id: triggerPayload.dealId,
        customer_id: triggerPayload.customerId,
        start_date: new Date().toISOString(),
        target_end_date: calculateTargetEndDate(config.defaultDurationDays || 30),
        metadata: {
          created_by_agent: true,
          source_deal_id: triggerPayload.dealId,
          template_id: config.templateId
        }
      })
      .select()
      .single();

    if (projectError || !project) {
      throw new Error(`Failed to create project: ${projectError?.message || 'Unknown error'}`);
    }

    console.log('[Action:create_onboarding_project] Project created:', project.id);

    let tasksCreated = 0;

    // Copy tasks from template if configured
    if (config.copyTasks && template?.tasks) {
      tasksCreated = await copyTemplateTasks(
        project.id,
        template.tasks,
        config.adjustDueDates,
        config.defaultDurationDays || 30
      );
    }

    // Link project to deal if configured
    if (config.linkToDeal && triggerPayload.dealId) {
      await upsertRelationship({
        sourceType: 'deal',
        sourceId: triggerPayload.dealId,
        targetType: 'project',
        targetId: project.id,
        relationshipType: 'deal_created_project',
        confidence: 1.0,
        evidence: { created_by: 'customer_success_coordinator_agent' }
      });
    }

    return {
      result: {
        created: true,
        projectId: project.id,
        projectName: project.name,
        tasksCreated,
        linkedToDeal: triggerPayload.dealId
      },
      countersDelta: { crmTasks: tasksCreated }
    };

  } catch (err) {
    console.error('[Action:create_onboarding_project] Failed:', err);
    throw err;
  }
}

/**
 * Load a project template by ID
 */
async function loadProjectTemplate(templateId: string): Promise<{
  description: string;
  tasks: TemplateTask[];
} | null> {
  // Try to load from database
  const { data, error } = await supabase
    .from('project_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error || !data) {
    // Return default onboarding template
    console.log('[Action:create_onboarding_project] Using default template');
    return getDefaultOnboardingTemplate();
  }

  return {
    description: data.description,
    tasks: data.tasks || []
  };
}

interface TemplateTask {
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  daysFromStart: number;
  assigneeRole?: string;
}

/**
 * Get default onboarding template
 */
function getDefaultOnboardingTemplate(): { description: string; tasks: TemplateTask[] } {
  return {
    description: 'Standard customer onboarding project',
    tasks: [
      { title: 'Schedule kickoff call', priority: 'high', daysFromStart: 1, assigneeRole: 'csm' },
      { title: 'Complete kickoff call', priority: 'high', daysFromStart: 3, assigneeRole: 'csm' },
      { title: 'Technical setup', priority: 'high', daysFromStart: 5, assigneeRole: 'engineer' },
      { title: 'Data migration', priority: 'medium', daysFromStart: 7, assigneeRole: 'engineer' },
      { title: 'User training session 1', priority: 'medium', daysFromStart: 10, assigneeRole: 'trainer' },
      { title: 'User training session 2', priority: 'medium', daysFromStart: 14, assigneeRole: 'trainer' },
      { title: 'Go-live checklist review', priority: 'high', daysFromStart: 21, assigneeRole: 'csm' },
      { title: 'Go-live', priority: 'high', daysFromStart: 28, assigneeRole: 'csm' },
      { title: 'Post go-live check-in', priority: 'medium', daysFromStart: 35, assigneeRole: 'csm' }
    ]
  };
}

/**
 * Copy tasks from template to new project
 */
async function copyTemplateTasks(
  projectId: string,
  templateTasks: TemplateTask[],
  adjustDueDates: boolean = true,
  durationDays: number = 30
): Promise<number> {
  const startDate = new Date();
  let created = 0;

  for (const task of templateTasks) {
    const dueDate = adjustDueDates
      ? addDays(startDate, task.daysFromStart)
      : null;

    const { error } = await supabase
      .from('tasks')
      .insert({
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: 'todo',
        project_id: projectId,
        due_date: dueDate,
        metadata: {
          from_template: true,
          assignee_role: task.assigneeRole
        }
      });

    if (!error) {
      created++;
    }
  }

  console.log(`[Action:create_onboarding_project] Created ${created} tasks`);
  return created;
}

/**
 * Build project name from template
 */
function buildProjectName(template: string, payload: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return String(payload[varName] || payload[camelToSnake(varName)] || match);
  });
}

/**
 * Calculate target end date
 */
function calculateTargetEndDate(durationDays: number): string {
  return addDays(new Date(), durationDays);
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Convert camelCase to snake_case
 */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}
