const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/supabase');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/tasks');
const log = require('../utils/log');

const router = express.Router();

/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/', validate(schemas.create), async (req, res) => {
  try {
    const {
      projectId,
      title,
      description,
      assignedTo,
      priority = 'medium',
      dueDate,
      startDate,
      tags,
      parentTaskId
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const taskData = {
      id: uuidv4(),
      project_id: projectId || null,
      title,
      description: description || null,
      assigned_to: assignedTo || null,
      status: 'open',
      priority,
      due_date: dueDate || null,
      start_date: startDate || null,
      parent_task_id: parentTaskId || null,
      tags: tags || [],
      custom_fields: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!supabase) {
      return res.json({ success: true, task: taskData });
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .insert(taskData)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      task
    });

  } catch (error) {
    log.error('Error creating task:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tasks
 * List tasks with filters
 */
router.get('/', validate(schemas.list), async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      projectId,
      status,
      priority,
      assignedTo,
      search,
      overdue
    } = req.query;

    if (!supabase) {
      return res.json({ tasks: [], count: 0, hasMore: false });
    }

    let query = supabase
      .from('tasks')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (overdue === 'true') {
      query = query.lt('due_date', new Date().toISOString().split('T')[0])
                   .neq('status', 'done');
    }

    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: tasks, error, count } = await query;

    if (error) throw error;

    res.json({
      tasks: tasks || [],
      count: count || 0,
      hasMore: (tasks?.length || 0) === parseInt(limit)
    });

  } catch (error) {
    log.error('Error listing tasks:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tasks/:id
 * Get task details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(404).json({ error: 'Database not configured' });
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get subtasks if any
    const { data: subtasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('parent_task_id', id);

    res.json({
      ...task,
      subtasks: subtasks || []
    });

  } catch (error) {
    log.error('Error getting task:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/tasks/:id
 * Update task
 */
router.put('/:id', validate(schemas.update), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const allowedFields = ['title', 'description', 'assigned_to', 'status', 'priority',
                          'due_date', 'start_date', 'project_id', 'tags', 'custom_fields'];
    const filteredUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }
    filteredUpdates.updated_at = new Date().toISOString();

    // If status changed to done, set completed_at
    if (updates.status === 'done') {
      filteredUpdates.completed_at = new Date().toISOString();
    } else if (updates.status && updates.status !== 'done') {
      filteredUpdates.completed_at = null;
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .update(filteredUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);

  } catch (error) {
    log.error('Error updating task:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete task
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Delete subtasks first
    await supabase
      .from('tasks')
      .delete()
      .eq('parent_task_id', id);

    // Delete task
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ success: true, message: 'Task deleted' });

  } catch (error) {
    log.error('Error deleting task:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tasks/:id/complete
 * Mark task as complete
 */
router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .update({
        status: 'done',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);

  } catch (error) {
    log.error('Error completing task:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tasks/:id/reopen
 * Reopen a completed task
 */
router.post('/:id/reopen', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .update({
        status: 'open',
        completed_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);

  } catch (error) {
    log.error('Error reopening task:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/tasks/:id/assign
 * Assign task to user
 */
router.put('/:id/assign', validate(schemas.assign), async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .update({
        assigned_to: assignedTo,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);

  } catch (error) {
    log.error('Error assigning task:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tasks/bulk
 * Create multiple tasks at once
 */
router.post('/bulk', validate(schemas.bulkCreate), async (req, res) => {
  try {
    const { tasks, projectId } = req.body;

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: 'Tasks array is required' });
    }

    const tasksToInsert = tasks.map(task => ({
      id: uuidv4(),
      project_id: projectId || task.projectId || null,
      title: task.title,
      description: task.description || null,
      assigned_to: task.assignedTo || null,
      status: 'open',
      priority: task.priority || 'medium',
      due_date: task.dueDate || null,
      tags: task.tags || [],
      custom_fields: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    if (!supabase) {
      return res.json({ success: true, tasks: tasksToInsert, count: tasksToInsert.length });
    }

    const { data: createdTasks, error } = await supabase
      .from('tasks')
      .insert(tasksToInsert)
      .select();

    if (error) throw error;

    res.status(201).json({
      success: true,
      tasks: createdTasks,
      count: createdTasks.length
    });

  } catch (error) {
    log.error('Error creating bulk tasks:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/tasks/bulk/status
 * Update status of multiple tasks
 */
router.put('/bulk/status', validate(schemas.bulkStatus), async (req, res) => {
  try {
    const { taskIds, status } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: 'Task IDs array is required' });
    }

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const updates = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'done') {
      updates.completed_at = new Date().toISOString();
    }

    const { data: tasks, error } = await supabase
      .from('tasks')
      .update(updates)
      .in('id', taskIds)
      .select();

    if (error) throw error;

    res.json({
      success: true,
      tasks,
      count: tasks.length
    });

  } catch (error) {
    log.error('Error bulk updating tasks:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
