const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { isValidUUID } = require('../utils/validators');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/goals');

// Helper to check if error is missing table
function isTableMissing(error) {
  return error && error.message && error.message.includes('schema cache');
}

// Empty response for missing table
const EMPTY_GOALS_RESPONSE = {
  success: true,
  data: [],
  count: 0,
  notice: 'Goals table not yet created. Run goals-schema.sql in Supabase SQL Editor.'
};

/**
 * GET /api/goals
 * List all goals with filters
 */
router.get('/', validate(schemas.list), asyncHandler(async (req, res) => {
  const { type, status, quarter, owner_id, team_id } = req.query;

  let query = supabase.from('goals').select('*');

  if (type) query = query.eq('goal_type', type);
  if (status) query = query.eq('status', status);
  if (quarter) query = query.eq('quarter', quarter);
  if (owner_id) query = query.eq('owner_id', owner_id);
  if (team_id) query = query.eq('team_id', team_id);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (isTableMissing(error)) {
    return res.json(EMPTY_GOALS_RESPONSE);
  }

  if (error) throw error;

  res.json({
    success: true,
    data,
    count: data.length
  });
}));

/**
 * GET /api/goals/hierarchy
 * Get goals in hierarchical structure
 */
router.get('/hierarchy', asyncHandler(async (req, res) => {
  const { quarter } = req.query;

  let query = supabase.from('goals').select('*');
  if (quarter) query = query.eq('quarter', quarter);

  const { data: goals, error } = await query.order('goal_type');

  if (isTableMissing(error)) {
    return res.json({
      success: true,
      data: { company: [], teams: [], individuals: [] },
      notice: 'Goals table not yet created.'
    });
  }

  if (error) throw error;

  // Build hierarchy
  const hierarchy = {
    company: goals.filter(g => g.goal_type === 'company' && !g.parent_goal_id),
    teams: [],
    individuals: []
  };

  // Attach team goals under company goals
  const teamGoals = goals.filter(g => g.goal_type === 'team');
  const individualGoals = goals.filter(g => g.goal_type === 'individual');

  hierarchy.company = hierarchy.company.map(companyGoal => ({
    ...companyGoal,
    children: teamGoals.filter(t => t.parent_goal_id === companyGoal.id).map(teamGoal => ({
      ...teamGoal,
      children: individualGoals.filter(i => i.parent_goal_id === teamGoal.id)
    }))
  }));

  // Orphan team/individual goals
  hierarchy.teams = teamGoals.filter(t => !t.parent_goal_id);
  hierarchy.individuals = individualGoals.filter(i => !i.parent_goal_id);

  res.json({
    success: true,
    data: hierarchy
  });
}));

/**
 * POST /api/goals
 * Create a new goal
 */
router.post('/', validate(schemas.create), asyncHandler(async (req, res) => {
  const {
    title,
    description,
    goal_type,
    parent_goal_id,
    quarter,
    start_date,
    target_date,
    key_results
  } = req.body;

  if (!title || !goal_type) {
    return res.status(400).json({
      success: false,
      error: 'Title and goal_type are required'
    });
  }

  const validTypes = ['company', 'team', 'individual'];
  if (!validTypes.includes(goal_type)) {
    return res.status(400).json({
      success: false,
      error: `goal_type must be one of: ${validTypes.join(', ')}`
    });
  }

  // Only set owner_id/team_id if they are valid UUIDs
  const ownerId = req.user?.id && isValidUUID(req.user.id) ? req.user.id : null;
  const teamId = req.user?.teamId && isValidUUID(req.user.teamId) ? req.user.teamId : null;

  const { data, error } = await supabase
    .from('goals')
    .insert({
      title,
      description,
      goal_type,
      parent_goal_id: parent_goal_id && isValidUUID(parent_goal_id) ? parent_goal_id : null,
      owner_id: ownerId,
      team_id: teamId,
      quarter: quarter || getCurrentQuarter(),
      start_date: start_date || null,
      target_date: target_date || null,
      key_results: key_results || [],
      status: 'planning',
      progress: 0
    })
    .select()
    .single();

  if (error) throw error;

  res.status(201).json({
    success: true,
    data,
    message: 'Goal created successfully'
  });
}));

/**
 * GET /api/goals/stats/summary
 * Get goals summary statistics
 */
router.get('/stats/summary', asyncHandler(async (req, res) => {
  const { quarter } = req.query;

  let query = supabase.from('goals').select('*');

  // Only filter by quarter if specified
  if (quarter) {
    query = query.eq('quarter', quarter);
  }

  const { data: goals, error } = await query;

  if (isTableMissing(error)) {
    return res.json({
      success: true,
      data: {
        quarter: quarter || 'all',
        total: 0,
        byType: { company: 0, team: 0, individual: 0 },
        byStatus: { planning: 0, active: 0, completed: 0, abandoned: 0 },
        averageProgress: 0,
        onTrack: 0,
        atRisk: 0
      },
      notice: 'Goals table not yet created.'
    });
  }

  if (error) throw error;

  const stats = {
    quarter: quarter || 'all',
    total: goals.length,
    byType: {
      company: goals.filter(g => g.goal_type === 'company').length,
      team: goals.filter(g => g.goal_type === 'team').length,
      individual: goals.filter(g => g.goal_type === 'individual').length
    },
    byStatus: {
      planning: goals.filter(g => g.status === 'planning').length,
      active: goals.filter(g => g.status === 'active').length,
      completed: goals.filter(g => g.status === 'completed').length,
      abandoned: goals.filter(g => g.status === 'abandoned').length
    },
    averageProgress: goals.length > 0
      ? Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length)
      : 0,
    onTrack: goals.filter(g => g.progress >= 70).length,
    atRisk: goals.filter(g => g.progress < 30 && g.status === 'active').length
  };

  res.json({
    success: true,
    data: stats
  });
}));

/**
 * GET /api/goals/:id
 * Get goal details with key results
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return res.status(400).json({ success: false, error: 'Invalid goal ID' });
  }

  const { data: goal, error } = await supabase
    .from('goals')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;

  if (!goal) {
    return res.status(404).json({ success: false, error: 'Goal not found' });
  }

  // Get child goals
  const { data: children } = await supabase
    .from('goals')
    .select('*')
    .eq('parent_goal_id', id);

  // Get related tasks
  let relatedTasks = [];
  if (goal.related_tasks && goal.related_tasks.length > 0) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .in('id', goal.related_tasks);
    relatedTasks = tasks || [];
  }

  res.json({
    success: true,
    data: {
      ...goal,
      children: children || [],
      relatedTasks
    }
  });
}));

/**
 * PUT /api/goals/:id
 * Update goal
 */
router.put('/:id', validate(schemas.update), asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return res.status(400).json({ success: false, error: 'Invalid goal ID' });
  }

  const updates = { ...req.body, updated_at: new Date().toISOString() };
  delete updates.id;
  delete updates.created_at;

  const { data, error } = await supabase
    .from('goals')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  res.json({
    success: true,
    data,
    message: 'Goal updated successfully'
  });
}));

/**
 * DELETE /api/goals/:id
 * Delete goal
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return res.status(400).json({ success: false, error: 'Invalid goal ID' });
  }

  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', id);

  if (error) throw error;

  res.json({
    success: true,
    message: 'Goal deleted successfully'
  });
}));

/**
 * POST /api/goals/:id/key-results
 * Add key result to goal
 */
router.post('/:id/key-results', validate(schemas.createKeyResult), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, target, unit } = req.body;

  if (!title || target === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Title and target are required'
    });
  }

  // Get current goal
  const { data: goal, error: fetchError } = await supabase
    .from('goals')
    .select('key_results')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  // Add new key result
  const keyResults = goal.key_results || [];
  const newKR = {
    id: `kr_${Date.now()}`,
    title,
    target: Number(target),
    current: 0,
    unit: unit || '',
    created_at: new Date().toISOString()
  };
  keyResults.push(newKR);

  // Update goal
  const { data, error } = await supabase
    .from('goals')
    .update({
      key_results: keyResults,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  res.json({
    success: true,
    data,
    message: 'Key result added successfully'
  });
}));

/**
 * PUT /api/goals/:id/key-results/:krId
 * Update key result progress
 */
router.put('/:id/key-results/:krId', validate(schemas.updateKeyResult), asyncHandler(async (req, res) => {
  const { id, krId } = req.params;
  const { current, title, target } = req.body;

  // Get current goal
  const { data: goal, error: fetchError } = await supabase
    .from('goals')
    .select('key_results')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  // Update key result
  const keyResults = (goal.key_results || []).map(kr => {
    if (kr.id === krId) {
      return {
        ...kr,
        current: current !== undefined ? Number(current) : kr.current,
        title: title || kr.title,
        target: target !== undefined ? Number(target) : kr.target
      };
    }
    return kr;
  });

  // Calculate overall progress
  const totalProgress = keyResults.reduce((sum, kr) => {
    const progress = kr.target > 0 ? (kr.current / kr.target) * 100 : 0;
    return sum + Math.min(progress, 100);
  }, 0);
  const avgProgress = keyResults.length > 0 ? totalProgress / keyResults.length : 0;

  // Update goal
  const { data, error } = await supabase
    .from('goals')
    .update({
      key_results: keyResults,
      progress: Math.round(avgProgress * 100) / 100,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  res.json({
    success: true,
    data,
    message: 'Key result updated successfully'
  });
}));

/**
 * POST /api/goals/:id/link-task
 * Link a task to a goal
 */
router.post('/:id/link-task', validate(schemas.linkTask), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { task_id } = req.body;

  if (!task_id || !isValidUUID(task_id)) {
    return res.status(400).json({
      success: false,
      error: 'Valid task_id is required'
    });
  }

  const { data: goal, error: fetchError } = await supabase
    .from('goals')
    .select('related_tasks')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const relatedTasks = goal.related_tasks || [];
  if (!relatedTasks.includes(task_id)) {
    relatedTasks.push(task_id);
  }

  const { data, error } = await supabase
    .from('goals')
    .update({
      related_tasks: relatedTasks,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  res.json({
    success: true,
    data,
    message: 'Task linked to goal'
  });
}));

// Helper function to get current quarter
function getCurrentQuarter() {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `Q${quarter}-${now.getFullYear()}`;
}

module.exports = router;
