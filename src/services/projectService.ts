// Project Service - CRUD operations for Entomate projects and tasks
import { supabase, EntoamteProject, EntoamteProjectTask } from '../lib/supabase'
import {
  processProjectRelationships,
  processTaskRelationships,
  processTasksFromMeeting as graphProcessTasksFromMeeting
} from '../graph/relationshipHooks'
import { deleteRelationshipsForEntity } from '../graph/relationshipService'

// ==================== PROJECTS ====================

export async function createProject(project: Partial<EntoamteProject>): Promise<EntoamteProject | null> {
  const { data, error } = await supabase
    .from('entomate_projects')
    .insert([{
      ...project,
      status: project.status || 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating project:', error)
    return null
  }

  // Create Knowledge Graph relationships for the project
  if (data) {
    try {
      await processProjectRelationships(data)
    } catch (graphError) {
      console.error('Error creating project relationships:', graphError)
      // Don't fail the project creation if graph update fails
    }
  }

  return data
}

export async function getProjects(status?: 'active' | 'completed' | 'on_hold'): Promise<EntoamteProject[]> {
  let query = supabase
    .from('entomate_projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching projects:', error)
    return []
  }
  return data || []
}

export async function getProjectById(id: string): Promise<EntoamteProject | null> {
  const { data, error } = await supabase
    .from('entomate_projects')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching project:', error)
    return null
  }
  return data
}

export async function updateProject(id: string, updates: Partial<EntoamteProject>): Promise<EntoamteProject | null> {
  const { data, error } = await supabase
    .from('entomate_projects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating project:', error)
    return null
  }
  return data
}

export async function deleteProject(id: string): Promise<boolean> {
  // First delete all tasks for this project
  await supabase
    .from('entomate_project_tasks')
    .delete()
    .eq('project_id', id)

  const { error } = await supabase
    .from('entomate_projects')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting project:', error)
    return false
  }

  // Clean up Knowledge Graph relationships
  try {
    await deleteRelationshipsForEntity('project', id)
  } catch (graphError) {
    console.error('Error cleaning up project relationships:', graphError)
  }

  return true
}

// ==================== PROJECT TASKS ====================

export async function createProjectTask(task: Partial<EntoamteProjectTask>): Promise<EntoamteProjectTask | null> {
  const { data, error } = await supabase
    .from('entomate_project_tasks')
    .insert([{
      ...task,
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating task:', error)
    return null
  }

  // Create Knowledge Graph relationships for the task
  if (data) {
    try {
      await processTaskRelationships(data)
    } catch (graphError) {
      console.error('Error creating task relationships:', graphError)
      // Don't fail the task creation if graph update fails
    }
  }

  return data
}

export async function getTasksByProject(projectId: string): Promise<EntoamteProjectTask[]> {
  const { data, error } = await supabase
    .from('entomate_project_tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching tasks:', error)
    return []
  }
  return data || []
}

export async function getAllTasks(): Promise<EntoamteProjectTask[]> {
  const { data, error } = await supabase
    .from('entomate_project_tasks')
    .select('*')
    .order('due_date', { ascending: true })

  if (error) {
    console.error('Error fetching tasks:', error)
    return []
  }
  return data || []
}

export async function getTaskById(id: string): Promise<EntoamteProjectTask | null> {
  const { data, error } = await supabase
    .from('entomate_project_tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching task:', error)
    return null
  }
  return data
}

export async function updateProjectTask(id: string, updates: Partial<EntoamteProjectTask>): Promise<EntoamteProjectTask | null> {
  const { data, error } = await supabase
    .from('entomate_project_tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating task:', error)
    return null
  }
  return data
}

export async function deleteProjectTask(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('entomate_project_tasks')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting task:', error)
    return false
  }

  // Clean up Knowledge Graph relationships
  try {
    await deleteRelationshipsForEntity('task', id)
  } catch (graphError) {
    console.error('Error cleaning up task relationships:', graphError)
  }

  return true
}

// ==================== BULK OPERATIONS ====================

export async function updateTaskStatus(id: string, status: 'todo' | 'in_progress' | 'done'): Promise<boolean> {
  const { error } = await supabase
    .from('entomate_project_tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error updating task status:', error)
    return false
  }
  return true
}

export async function getProjectStats(projectId: string): Promise<{
  total: number
  todo: number
  inProgress: number
  done: number
  progress: number
}> {
  const tasks = await getTasksByProject(projectId)

  const todo = tasks.filter(t => t.status === 'todo').length
  const inProgress = tasks.filter(t => t.status === 'in_progress').length
  const done = tasks.filter(t => t.status === 'done').length
  const total = tasks.length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  return { total, todo, inProgress, done, progress }
}

// ==================== MEETING INTEGRATION ====================

/**
 * Create tasks from meeting action items
 */
export async function createTasksFromMeetingActionItems(
  projectId: string,
  meetingId: string,
  actionItems: Array<{
    task_description: string
    assigned_to_name?: string
    due_date?: string
    priority?: 'low' | 'medium' | 'high'
    action_item_id?: string  // Optional: link to original action item
  }>
): Promise<EntoamteProjectTask[]> {
  const tasksToCreate = actionItems.map(item => ({
    project_id: projectId,
    title: item.task_description,
    assigned_to: item.assigned_to_name,
    due_date: item.due_date,
    priority: item.priority || 'medium',
    status: 'todo' as const,
    meeting_id: meetingId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }))

  const { data, error } = await supabase
    .from('entomate_project_tasks')
    .insert(tasksToCreate)
    .select()

  if (error) {
    console.error('Error creating tasks from action items:', error)
    return []
  }

  // Create Knowledge Graph relationships for the tasks
  if (data && data.length > 0) {
    try {
      // Build action item mapping if available
      const actionItemMap = new Map<string, string>()
      actionItems.forEach((item, index) => {
        if (item.action_item_id && data[index]) {
          actionItemMap.set(data[index].id, item.action_item_id)
        }
      })

      await graphProcessTasksFromMeeting(meetingId, projectId, data, actionItemMap)
    } catch (graphError) {
      console.error('Error creating task relationships:', graphError)
      // Don't fail if graph update fails
    }
  }

  return data || []
}

// ==================== LOGOS VISION SYNC ====================

/**
 * Link project to Logos Vision project
 */
export async function linkToLogosProject(
  entomateProjectId: string,
  logosProjectId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('entomate_projects')
    .update({
      logos_project_id: logosProjectId,
      updated_at: new Date().toISOString()
    })
    .eq('id', entomateProjectId)

  if (error) {
    console.error('Error linking to Logos project:', error)
    return false
  }
  return true
}

/**
 * Get Logos Vision projects for linking
 */
export async function getLogosVisionProjects(): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .eq('status', 'active')
    .order('name')

  if (error) {
    console.error('Error fetching Logos projects:', error)
    return []
  }

  return data || []
}
