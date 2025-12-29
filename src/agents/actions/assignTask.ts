/**
 * Assign Task Action
 * Automatically assigns tasks based on workload and skills
 */

import { supabase } from '../../lib/supabase';
import type { Agent, ActionStep } from '../types';

export interface AssignTaskConfig {
  strategy: 'balanced_workload' | 'skills_match' | 'round_robin' | 'by_role';
  considerSkills?: boolean;
  considerWorkload?: boolean;
  maxTasksPerPerson?: number;
  excludeUsers?: string[];
  preferredUsers?: string[];
  roleAssignments?: Record<string, string>;
}

export interface AssignTaskResult {
  assigned: boolean;
  taskId?: string;
  assigneeId?: string;
  assigneeName?: string;
  strategy: string;
  reason?: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role?: string;
  skills?: string[];
  openTaskCount: number;
}

/**
 * Execute the assign task action
 */
export async function execute(params: {
  agent: Agent;
  step: ActionStep;
  triggerPayload: Record<string, any>;
  dryRun?: boolean;
}): Promise<{
  result: AssignTaskResult;
  countersDelta: { crmTasks: number };
}> {
  const { step, triggerPayload, dryRun } = params;
  const config = step.config as AssignTaskConfig;

  console.log('[Action:assign_task] Starting', { dryRun, strategy: config.strategy });

  const taskId = triggerPayload.taskId || triggerPayload.task_id;
  if (!taskId) {
    return {
      result: {
        assigned: false,
        strategy: config.strategy,
        reason: 'No taskId in payload'
      },
      countersDelta: { crmTasks: 0 }
    };
  }

  // Get task details
  const task = await getTaskDetails(taskId);
  if (!task) {
    return {
      result: {
        assigned: false,
        taskId,
        strategy: config.strategy,
        reason: 'Task not found'
      },
      countersDelta: { crmTasks: 0 }
    };
  }

  // Find best assignee based on strategy
  const assignee = await findBestAssignee(config, task, triggerPayload);

  if (!assignee) {
    return {
      result: {
        assigned: false,
        taskId,
        strategy: config.strategy,
        reason: 'No suitable assignee found'
      },
      countersDelta: { crmTasks: 0 }
    };
  }

  if (dryRun) {
    console.log('[Action:assign_task] DRY RUN - Would assign to:', assignee.name);
    return {
      result: {
        assigned: false,
        taskId,
        assigneeId: assignee.id,
        assigneeName: `[DRY RUN] ${assignee.name}`,
        strategy: config.strategy,
        reason: 'Dry run mode'
      },
      countersDelta: { crmTasks: 0 }
    };
  }

  // Assign the task
  const { error } = await supabase
    .from('tasks')
    .update({
      assignee_id: assignee.id,
      assigned_at: new Date().toISOString(),
      metadata: {
        ...task.metadata,
        auto_assigned: true,
        assignment_strategy: config.strategy,
        assignment_reason: `Assigned by agent using ${config.strategy} strategy`
      }
    })
    .eq('id', taskId);

  if (error) {
    throw new Error(`Failed to assign task: ${error.message}`);
  }

  console.log('[Action:assign_task] Task assigned:', { taskId, assigneeId: assignee.id });

  return {
    result: {
      assigned: true,
      taskId,
      assigneeId: assignee.id,
      assigneeName: assignee.name,
      strategy: config.strategy
    },
    countersDelta: { crmTasks: 0 } // Assignment doesn't create new tasks
  };
}

/**
 * Get task details
 */
async function getTaskDetails(taskId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error) return null;
  return data;
}

/**
 * Find the best assignee based on strategy
 */
async function findBestAssignee(
  config: AssignTaskConfig,
  task: any,
  payload: Record<string, any>
): Promise<TeamMember | null> {
  const { strategy, excludeUsers = [], preferredUsers = [], maxTasksPerPerson = 15 } = config;

  // Get team members with their workload
  const teamMembers = await getTeamMembersWithWorkload(excludeUsers, maxTasksPerPerson);

  if (teamMembers.length === 0) {
    console.log('[Action:assign_task] No eligible team members found');
    return null;
  }

  switch (strategy) {
    case 'balanced_workload':
      return findByBalancedWorkload(teamMembers, preferredUsers);

    case 'skills_match':
      return findBySkillsMatch(teamMembers, task, preferredUsers);

    case 'round_robin':
      return findByRoundRobin(teamMembers);

    case 'by_role':
      return findByRole(teamMembers, task, config.roleAssignments || {});

    default:
      return teamMembers[0] || null;
  }
}

/**
 * Get team members with their current workload
 */
async function getTeamMembersWithWorkload(
  excludeUsers: string[],
  maxTasksPerPerson: number
): Promise<TeamMember[]> {
  // Get all team members
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, email, role, skills')
    .eq('active', true);

  if (error || !users) return [];

  // Filter out excluded users
  const eligibleUsers = users.filter(u => !excludeUsers.includes(u.id));

  // Get task counts for each user
  const membersWithWorkload: TeamMember[] = [];

  for (const user of eligibleUsers) {
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assignee_id', user.id)
      .in('status', ['todo', 'in_progress']);

    const openTaskCount = count || 0;

    // Only include if under max tasks
    if (openTaskCount < maxTasksPerPerson) {
      membersWithWorkload.push({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        skills: user.skills || [],
        openTaskCount
      });
    }
  }

  return membersWithWorkload;
}

/**
 * Find assignee with lowest workload
 */
function findByBalancedWorkload(
  members: TeamMember[],
  preferredUsers: string[]
): TeamMember | null {
  // Prioritize preferred users if they have capacity
  const preferred = members
    .filter(m => preferredUsers.includes(m.id))
    .sort((a, b) => a.openTaskCount - b.openTaskCount);

  if (preferred.length > 0) {
    return preferred[0];
  }

  // Otherwise, find person with lowest workload
  const sorted = [...members].sort((a, b) => a.openTaskCount - b.openTaskCount);
  return sorted[0] || null;
}

/**
 * Find assignee with matching skills
 */
function findBySkillsMatch(
  members: TeamMember[],
  task: any,
  preferredUsers: string[]
): TeamMember | null {
  const taskSkills = task.required_skills || task.tags || [];

  if (taskSkills.length === 0) {
    // No skills to match, fall back to balanced workload
    return findByBalancedWorkload(members, preferredUsers);
  }

  // Score members by skill match
  const scored = members.map(member => {
    const memberSkills = member.skills || [];
    const matchCount = taskSkills.filter((s: string) =>
      memberSkills.some(ms => ms.toLowerCase().includes(s.toLowerCase()))
    ).length;

    return {
      member,
      score: matchCount / taskSkills.length,
      isPreferred: preferredUsers.includes(member.id)
    };
  });

  // Sort by score (descending), then by preference, then by workload
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
    return a.member.openTaskCount - b.member.openTaskCount;
  });

  return scored[0]?.member || null;
}

/**
 * Find assignee using round robin
 */
function findByRoundRobin(members: TeamMember[]): TeamMember | null {
  // Simple round robin - just pick the one with fewest recent assignments
  // Could be enhanced with a proper rotation tracking
  const sorted = [...members].sort((a, b) => a.openTaskCount - b.openTaskCount);
  return sorted[0] || null;
}

/**
 * Find assignee by role mapping
 */
function findByRole(
  members: TeamMember[],
  task: any,
  roleAssignments: Record<string, string>
): TeamMember | null {
  // Get the task type or role requirement
  const taskType = task.type || task.metadata?.assignee_role || 'default';
  const targetRole = roleAssignments[taskType] || roleAssignments['default'];

  if (!targetRole) {
    // No role mapping, fall back to balanced workload
    return findByBalancedWorkload(members, []);
  }

  // Find members with matching role
  const roleMembers = members.filter(m =>
    m.role?.toLowerCase() === targetRole.toLowerCase()
  );

  if (roleMembers.length === 0) {
    console.log(`[Action:assign_task] No members with role: ${targetRole}`);
    return null;
  }

  // Pick the one with lowest workload
  const sorted = [...roleMembers].sort((a, b) => a.openTaskCount - b.openTaskCount);
  return sorted[0] || null;
}
