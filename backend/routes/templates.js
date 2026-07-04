/**
 * Workflow Templates API Routes
 *
 * Endpoints for browsing and importing workflow templates
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const log = require('../utils/log');
const {
  getAllTemplates,
  getTemplatesByCategory,
  getTemplateById,
  getCategories,
  getCategoryMetadata,
  searchTemplates
} = require('../services/workflow/WorkflowTemplates');
const { getOrgIdForUser } = require('../utils/orgContext');

// ========================================
// TEMPLATE BROWSING ENDPOINTS
// ========================================

/**
 * GET /api/templates
 * List all available templates with optional filtering
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category, search, limit = 50, offset = 0 } = req.query;

    let templates;

    if (search) {
      // Search templates by query
      templates = searchTemplates(search);
    } else if (category) {
      // Filter by category
      templates = getTemplatesByCategory(category);
    } else {
      // Get all templates
      templates = getAllTemplates();
    }

    // Apply pagination
    const total = templates.length;
    const paginatedTemplates = templates.slice(
      parseInt(offset),
      parseInt(offset) + parseInt(limit)
    );

    // Add node count to each template
    const templatesWithMeta = paginatedTemplates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      icon: template.icon,
      estimatedTime: template.estimatedTime || 'Unknown',
      nodeCount: template.nodes?.length || 0,
      connectionCount: template.connections?.length || 0
    }));

    res.json({
      success: true,
      data: templatesWithMeta,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + paginatedTemplates.length < total
      }
    });

  } catch (error) {
    log.error('[Templates] List error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/templates/categories
 * Get all available template categories with metadata
 */
router.get('/categories', optionalAuth, async (req, res) => {
  try {
    const categoryMetadata = getCategoryMetadata();
    const availableCategories = getCategories();

    // Add template count to each category
    const categoriesWithCounts = availableCategories.map(categoryId => {
      const meta = categoryMetadata[categoryId] || {
        id: categoryId,
        label: categoryId.charAt(0).toUpperCase() + categoryId.slice(1).replace(/_/g, ' '),
        description: '',
        icon: 'folder',
        color: 'gray'
      };

      return {
        ...meta,
        templateCount: getTemplatesByCategory(categoryId).length
      };
    });

    res.json({
      success: true,
      data: categoriesWithCounts
    });

  } catch (error) {
    log.error('[Templates] Categories error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/templates/:id
 * Get detailed information about a specific template
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const template = getTemplateById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Get category metadata
    const categoryMetadata = getCategoryMetadata();
    const categoryMeta = categoryMetadata[template.category] || {
      label: template.category,
      color: 'gray'
    };

    res.json({
      success: true,
      data: {
        ...template,
        nodeCount: template.nodes?.length || 0,
        connectionCount: template.connections?.length || 0,
        categoryMeta
      }
    });

  } catch (error) {
    log.error('[Templates] Get error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/templates/:id/preview
 * Get a preview of the template (nodes and connections without full config)
 */
router.get('/:id/preview', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const template = getTemplateById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Return simplified preview data
    const preview = {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      icon: template.icon,
      estimatedTime: template.estimatedTime,
      nodes: template.nodes.map(node => ({
        id: node.id,
        type: node.type,
        subtype: node.subtype,
        position: node.position
      })),
      connections: template.connections.map(conn => ({
        id: conn.id,
        sourceNodeId: conn.sourceNodeId,
        targetNodeId: conn.targetNodeId
      }))
    };

    res.json({
      success: true,
      data: preview
    });

  } catch (error) {
    log.error('[Templates] Preview error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// TEMPLATE IMPORT ENDPOINTS
// ========================================

/**
 * POST /api/templates/:id/import
 * Import a template as a new workflow for the authenticated user
 */
router.post('/:id/import', authenticate, apiLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { name: customName, description: customDescription } = req.body;

    const template = getTemplateById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Generate unique IDs for the new workflow
    const nodeIdMap = {};
    const newNodes = template.nodes.map(node => {
      const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      nodeIdMap[node.id] = newId;
      return {
        ...node,
        id: newId
      };
    });

    // Update connection references
    const newConnections = template.connections.map(conn => ({
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sourceNodeId: nodeIdMap[conn.sourceNodeId],
      targetNodeId: nodeIdMap[conn.targetNodeId],
      sourceOutput: conn.sourceOutput,
      targetInput: conn.targetInput
    }));

    // Create the workflow
    const workflowData = {
      name: customName || `${template.name} (from template)`,
      description: customDescription || template.description,
      nodes: newNodes,
      connections: newConnections,
      settings: {
        sourceTemplate: template.id,
        importedAt: new Date().toISOString()
      },
      active: false,
      is_template: false,
      user_id: req.user?.id,
      org_id: await getOrgIdForUser(req.user?.id),
      version: 1
    };

    const { data: workflow, error } = await supabase
      .from('workflows')
      .insert(workflowData)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: workflow,
      message: `Successfully imported template: ${template.name}`
    });

  } catch (error) {
    log.error('[Templates] Import error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/templates/:id/duplicate
 * Create a copy of a template for customization (admin only)
 */
router.post('/:id/duplicate', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const template = getTemplateById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Create as a user template in the database
    const workflowData = {
      name: name || `${template.name} (Copy)`,
      description: description || template.description,
      nodes: template.nodes,
      connections: template.connections,
      settings: {
        sourceTemplate: template.id,
        duplicatedAt: new Date().toISOString()
      },
      active: false,
      is_template: true,
      user_id: req.user?.id,
      org_id: await getOrgIdForUser(req.user?.id),
      version: 1
    };

    const { data: workflow, error } = await supabase
      .from('workflows')
      .insert(workflowData)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: workflow,
      message: 'Template duplicated successfully'
    });

  } catch (error) {
    log.error('[Templates] Duplicate error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// TEMPLATE STATISTICS
// ========================================

/**
 * GET /api/templates/stats/popular
 * Get most popular templates based on import count
 */
router.get('/stats/popular', optionalAuth, async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    // Get import counts from workflows table
    const { data: importCounts, error } = await supabase
      .from('workflows')
      .select('settings')
      .not('settings->sourceTemplate', 'is', null);

    if (error) throw error;

    // Count imports per template
    const templateCounts = {};
    for (const workflow of (importCounts || [])) {
      const templateId = workflow.settings?.sourceTemplate;
      if (templateId) {
        templateCounts[templateId] = (templateCounts[templateId] || 0) + 1;
      }
    }

    // Get template details and sort by count
    const popularTemplates = Object.entries(templateCounts)
      .map(([templateId, count]) => {
        const template = getTemplateById(templateId);
        if (!template) return null;
        return {
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          icon: template.icon,
          importCount: count
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.importCount - a.importCount)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      data: popularTemplates
    });

  } catch (error) {
    log.error('[Templates] Popular stats error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
