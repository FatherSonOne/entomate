/**
 * Agent Tasks Routes
 * Endpoints for AI-powered task intelligence: overdue detection, ETA prediction, auto-assignment
 */

const express = require('express');
const { supabase } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const log = require('../utils/log');

const router = express.Router();

router.use(authenticate);

// ========================================
// DEFAULT ETA DAYS BY PRIORITY
// ========================================
const DEFAULT_DAYS_BY_PRIORITY = { high: 3, medium: 7, low: 14 };

// ========================================
// GET /api/agent-tasks/overdue
// Find all overdue tasks
// ========================================
router.get('/overdue', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const minDays = parseInt(req.query.minDays) || 1;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - minDays);

    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, title, description, priority, status, due_date, assigned_to, project_id, created_at')
      .lt('due_date', cutoffDate.toISOString().split('T')[0])
      .neq('status', 'done')
      .order('due_date', { ascending: true })
      .limit(100);

    if (error) throw error;

    const overdueTasks = (tasks || []).map(task => {
      const daysOverdue = Math.floor(
        (Date.now() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      return { ...task, daysOverdue };
    });

    res.json({
      success: true,
      tasks: overdueTasks,
      count: overdueTasks.length
    });
  } catch (error) {
    log.error('Error fetching overdue tasks:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// GET /api/agent-tasks/:id/eta
// Get or compute ETA prediction for a task
// ========================================
router.get('/:id/eta', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const { id } = req.params;

    // Get the task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // If task is done, return actual completion
    if (task.status === 'done') {
      return res.json({
        success: true,
        prediction: {
          taskId: id,
          predictedCompletionDate: task.completed_at || task.updated_at,
          confidence: 'high',
          explanation: 'Task is already completed',
          isCompleted: true
        }
      });
    }

    // Get historical stats for similar tasks (same priority)
    const { data: completedTasks } = await supabase
      .from('tasks')
      .select('created_at, updated_at, completed_at')
      .eq('priority', task.priority)
      .eq('status', 'done')
      .limit(50);

    let typicalDays = null;
    if (completedTasks && completedTasks.length >= 5) {
      const durations = completedTasks
        .filter(t => (t.completed_at || t.updated_at) && t.created_at)
        .map(t => {
          const created = new Date(t.created_at);
          const completed = new Date(t.completed_at || t.updated_at);
          return Math.max(1, Math.floor((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
        });

      if (durations.length > 0) {
        typicalDays = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      }
    }

    // Fallback to defaults
    if (!typicalDays) {
      typicalDays = DEFAULT_DAYS_BY_PRIORITY[task.priority] || 7;
    }

    // Get assignee workload
    let assigneeOpenTasks = 0;
    if (task.assigned_to) {
      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', task.assigned_to)
        .in('status', ['open', 'in_progress']);

      assigneeOpenTasks = count || 0;
    }

    // Adjustments
    let extraDays = 0;
    const adjustments = [];

    if (assigneeOpenTasks > 10) {
      extraDays += 3;
      adjustments.push('+3 days (high assignee workload)');
    } else if (assigneeOpenTasks > 5) {
      extraDays += 1;
      adjustments.push('+1 day (moderate workload)');
    }

    if (task.status === 'open') {
      extraDays += 1;
      adjustments.push('+1 day (not started)');
    }

    // Predicted date
    const now = new Date();
    const predicted = new Date(now);
    predicted.setDate(predicted.getDate() + typicalDays + extraDays);
    const predictedCompletionDate = predicted.toISOString().slice(0, 10);

    // Confidence
    let confidence;
    if (completedTasks && completedTasks.length >= 5 && assigneeOpenTasks < 5) {
      confidence = 'high';
    } else if ((completedTasks && completedTasks.length >= 5) || assigneeOpenTasks < 10) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    // Explanation
    const baseExplanation = completedTasks && completedTasks.length >= 5
      ? `Based on ${completedTasks.length} historical ${task.priority} priority tasks (avg ${typicalDays} days)`
      : `Default estimate for ${task.priority} priority (${typicalDays} days)`;

    const explanation = adjustments.length > 0
      ? `${baseExplanation}. Adjustments: ${adjustments.join(', ')}`
      : baseExplanation;

    res.json({
      success: true,
      prediction: {
        taskId: id,
        predictedCompletionDate,
        confidence,
        explanation,
        typicalDays,
        extraDays,
        assigneeWorkload: assigneeOpenTasks,
        isCompleted: false
      }
    });
  } catch (error) {
    log.error('Error computing task ETA:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// POST /api/agent-tasks/:id/auto-assign
// Auto-assign a task based on workload
// ========================================
router.post('/:id/auto-assign', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const { id } = req.params;
    const { strategy = 'balanced_workload', excludeUsers = [] } = req.body;

    // Get the task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.assigned_to) {
      return res.json({
        success: false,
        reason: 'Task is already assigned',
        currentAssignee: task.assigned_to
      });
    }

    // Get active team members with their workload
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('active', true);

    if (usersError || !users || users.length === 0) {
      return res.json({ success: false, reason: 'No active team members found' });
    }

    const eligible = users.filter(u => !excludeUsers.includes(u.id));
    if (eligible.length === 0) {
      return res.json({ success: false, reason: 'All team members excluded' });
    }

    // Get workload for each member
    const membersWithWorkload = [];
    for (const user of eligible) {
      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', user.id)
        .in('status', ['open', 'in_progress']);

      membersWithWorkload.push({
        ...user,
        openTaskCount: count || 0
      });
    }

    // Sort by workload (lowest first)
    membersWithWorkload.sort((a, b) => a.openTaskCount - b.openTaskCount);
    const assignee = membersWithWorkload[0];

    // Assign the task
    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        assigned_to: assignee.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    log.info('Task auto-assigned', { taskId: id, assigneeId: assignee.id, strategy });

    res.json({
      success: true,
      taskId: id,
      assignee: {
        id: assignee.id,
        name: assignee.name,
        email: assignee.email
      },
      strategy,
      reason: `Assigned to ${assignee.name} (${assignee.openTaskCount} open tasks — lowest workload)`
    });
  } catch (error) {
    log.error('Error auto-assigning task:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
