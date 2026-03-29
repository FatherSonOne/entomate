/**
 * CRM Node Handlers for Logos Vision Integration
 *
 * N8N-style workflow nodes for CRM operations:
 * - Triggers: Deal stage changes, contact events, task events
 * - Actions: Create/update deals, contacts, tasks, activities
 * - Data: Lookup, search, calculate scores
 */

const BaseNode = require('./BaseNode');
const crmService = require('../../crmService');
const { supabase } = require('../../../config/supabase');
const log = require('../../../utils/log');

// ============================================================================
// CRM TRIGGER NODES
// ============================================================================

/**
 * Deal Stage Changed Trigger
 * Fires when a deal moves to a different pipeline stage
 */
class DealStageChangedTrigger extends BaseNode {
  static async execute(config, inputData, context) {
    // Trigger nodes pass through data from the event
    const { fromStage, toStage, dealId, deal } = inputData;

    log.info(`[DealStageChangedTrigger] Deal ${dealId} moved from ${fromStage} to ${toStage}`);

    // Check stage filters if configured
    if (config.fromStages?.length > 0 && !config.fromStages.includes(fromStage)) {
      return { output: 'skip', data: inputData };
    }

    if (config.toStages?.length > 0 && !config.toStages.includes(toStage)) {
      return { output: 'skip', data: inputData };
    }

    return {
      output: 'main',
      data: {
        ...inputData,
        trigger: 'deal_stage_changed',
        deal: deal || { id: dealId, fromStage, toStage },
        timestamp: new Date().toISOString()
      }
    };
  }

  static getTestData() {
    return {
      dealId: 'deal_123',
      fromStage: 'qualification',
      toStage: 'proposal',
      deal: {
        id: 'deal_123',
        name: 'Acme Corp Enterprise Deal',
        value: 50000,
        owner: 'john@company.com'
      }
    };
  }
}

/**
 * Contact Created Trigger
 * Fires when a new contact is added to CRM
 */
class ContactCreatedTrigger extends BaseNode {
  static async execute(config, inputData, context) {
    const { contactId, contact } = inputData;

    log.info(`[ContactCreatedTrigger] New contact: ${contactId}`);

    // Check source filter
    if (config.sources?.length > 0 && !config.sources.includes(contact?.source)) {
      return { output: 'skip', data: inputData };
    }

    return {
      output: 'main',
      data: {
        ...inputData,
        trigger: 'contact_created',
        contact: contact || { id: contactId },
        timestamp: new Date().toISOString()
      }
    };
  }

  static getTestData() {
    return {
      contactId: 'contact_456',
      contact: {
        id: 'contact_456',
        name: 'Jane Smith',
        email: 'jane@acme.com',
        company: 'Acme Corp',
        source: 'website_form'
      }
    };
  }
}

/**
 * Deal Closed Trigger
 * Fires when a deal is won or lost
 */
class DealClosedTrigger extends BaseNode {
  static async execute(config, inputData, context) {
    const { dealId, deal, outcome } = inputData;

    log.info(`[DealClosedTrigger] Deal ${dealId} closed: ${outcome}`);

    // Check outcome filter (won, lost, or both)
    if (config.outcomes?.length > 0 && !config.outcomes.includes(outcome)) {
      return { output: 'skip', data: inputData };
    }

    return {
      output: outcome === 'won' ? 'won' : 'lost',
      data: {
        ...inputData,
        trigger: 'deal_closed',
        outcome,
        deal: deal || { id: dealId },
        timestamp: new Date().toISOString()
      }
    };
  }

  static getTestData() {
    return {
      dealId: 'deal_789',
      outcome: 'won',
      deal: {
        id: 'deal_789',
        name: 'BigCorp Platform License',
        value: 120000,
        stage: 'closed_won'
      }
    };
  }
}

/**
 * Task Overdue Trigger
 * Fires when a CRM task passes its due date
 */
class TaskOverdueTrigger extends BaseNode {
  static async execute(config, inputData, context) {
    const { taskId, task, daysOverdue } = inputData;

    log.info(`[TaskOverdueTrigger] Task ${taskId} is ${daysOverdue} days overdue`);

    // Check minimum days overdue
    if (config.minDaysOverdue && daysOverdue < config.minDaysOverdue) {
      return { output: 'skip', data: inputData };
    }

    return {
      output: 'main',
      data: {
        ...inputData,
        trigger: 'task_overdue',
        task: task || { id: taskId },
        daysOverdue,
        timestamp: new Date().toISOString()
      }
    };
  }

  static getTestData() {
    return {
      taskId: 'task_101',
      daysOverdue: 3,
      task: {
        id: 'task_101',
        title: 'Follow up with prospect',
        dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        assignee: 'sales@company.com'
      }
    };
  }
}

/**
 * Activity Logged Trigger
 * Fires when a call, email, or meeting is logged
 */
class ActivityLoggedTrigger extends BaseNode {
  static async execute(config, inputData, context) {
    const { activityId, activity, activityType } = inputData;

    log.info(`[ActivityLoggedTrigger] ${activityType} logged: ${activityId}`);

    // Check activity type filter
    if (config.activityTypes?.length > 0 && !config.activityTypes.includes(activityType)) {
      return { output: 'skip', data: inputData };
    }

    return {
      output: 'main',
      data: {
        ...inputData,
        trigger: 'activity_logged',
        activityType,
        activity: activity || { id: activityId },
        timestamp: new Date().toISOString()
      }
    };
  }

  static getTestData() {
    return {
      activityId: 'activity_202',
      activityType: 'call',
      activity: {
        id: 'activity_202',
        type: 'call',
        subject: 'Discovery call with prospect',
        duration: 30,
        outcome: 'interested'
      }
    };
  }
}

// ============================================================================
// CRM ACTION NODES
// ============================================================================

/**
 * Create Deal Node
 * Creates a new deal/opportunity in CRM
 */
class CreateDealNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      name,
      value,
      stage,
      contactId,
      ownerId,
      customFields = {},
      outputField = 'createdDeal'
    } = config;

    // Interpolate values
    const dealData = {
      name: this.interpolate(name, inputData),
      value: parseFloat(this.interpolate(String(value || 0), inputData)),
      stage: this.interpolate(stage, inputData),
      contactId: this.interpolate(contactId, inputData),
      ownerId: this.interpolate(ownerId, inputData),
      customFields: {}
    };

    // Interpolate custom fields
    for (const [key, val] of Object.entries(customFields)) {
      dealData.customFields[key] = this.interpolate(val, inputData);
    }

    log.info(`[CreateDealNode] Creating deal: ${dealData.name}`);

    // Use CRM service or store locally
    let result;
    if (crmService.configured) {
      result = await crmService.createDeal(dealData);
    } else {
      // Store in local deals table
      const { data, error } = await supabase
        .from('deals')
        .insert({
          name: dealData.name,
          value: dealData.value,
          stage: dealData.stage || 'new',
          contact_id: dealData.contactId,
          owner_id: dealData.ownerId,
          custom_fields: dealData.customFields,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      result = { success: true, deal: data };
    }

    return {
      output: 'main',
      data: {
        ...inputData,
        [outputField]: result.deal || result
      }
    };
  }

  static getTestData() {
    return {
      contactName: 'Acme Corp',
      meetingOutcome: 'interested',
      estimatedValue: 25000
    };
  }
}

/**
 * Update Deal Node
 * Updates an existing deal in CRM
 */
class UpdateDealNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      dealId,
      dealIdField,
      updates = {},
      stage,
      value,
      outputField = 'updatedDeal'
    } = config;

    // Get deal ID from config or input data
    const resolvedDealId = dealId || this.getNestedValue(inputData, dealIdField);

    if (!resolvedDealId) {
      throw new Error('Deal ID is required');
    }

    const updateData = {};

    // Apply specific updates
    if (stage) updateData.stage = this.interpolate(stage, inputData);
    if (value !== undefined) updateData.value = parseFloat(this.interpolate(String(value), inputData));

    // Apply custom updates
    for (const [key, val] of Object.entries(updates)) {
      updateData[key] = this.interpolate(val, inputData);
    }

    log.info(`[UpdateDealNode] Updating deal ${resolvedDealId}:`, updateData);

    // Update in database
    const { data, error } = await supabase
      .from('deals')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', resolvedDealId)
      .select()
      .single();

    if (error) throw error;

    return {
      output: 'main',
      data: {
        ...inputData,
        [outputField]: data
      }
    };
  }
}

/**
 * Create Contact Node
 * Creates a new contact in CRM
 */
class CreateContactNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      name,
      email,
      phone,
      company,
      title,
      source,
      customFields = {},
      outputField = 'createdContact'
    } = config;

    const contactData = {
      name: this.interpolate(name, inputData),
      email: this.interpolate(email, inputData),
      phone: this.interpolate(phone, inputData),
      company: this.interpolate(company, inputData),
      title: this.interpolate(title, inputData),
      source: this.interpolate(source, inputData) || 'workflow',
      customFields: {}
    };

    for (const [key, val] of Object.entries(customFields)) {
      contactData.customFields[key] = this.interpolate(val, inputData);
    }

    log.info(`[CreateContactNode] Creating contact: ${contactData.email}`);

    let result;
    if (crmService.configured) {
      result = await crmService.createContact(contactData);
    } else {
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          name: contactData.name,
          email: contactData.email,
          phone: contactData.phone,
          company: contactData.company,
          title: contactData.title,
          source: contactData.source,
          custom_fields: contactData.customFields,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      result = { success: true, contact: data };
    }

    return {
      output: 'main',
      data: {
        ...inputData,
        [outputField]: result.contact || result
      }
    };
  }
}

/**
 * Update Contact Node
 * Updates an existing contact in CRM
 */
class UpdateContactNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      contactId,
      contactIdField,
      updates = {},
      outputField = 'updatedContact'
    } = config;

    const resolvedContactId = contactId || this.getNestedValue(inputData, contactIdField);

    if (!resolvedContactId) {
      throw new Error('Contact ID is required');
    }

    const updateData = {};
    for (const [key, val] of Object.entries(updates)) {
      updateData[key] = this.interpolate(val, inputData);
    }

    log.info(`[UpdateContactNode] Updating contact ${resolvedContactId}`);

    const { data, error } = await supabase
      .from('contacts')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', resolvedContactId)
      .select()
      .single();

    if (error) throw error;

    return {
      output: 'main',
      data: {
        ...inputData,
        [outputField]: data
      }
    };
  }
}

/**
 * Create CRM Task Node
 * Creates a task in CRM
 */
class CreateCRMTaskNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      title,
      description,
      dueDate,
      priority,
      assignee,
      relatedDealId,
      relatedContactId,
      outputField = 'createdTask'
    } = config;

    const taskData = {
      title: this.interpolate(title, inputData),
      description: this.interpolate(description, inputData),
      due_date: this.interpolate(dueDate, inputData),
      priority: this.interpolate(priority, inputData) || 'medium',
      assigned_to_email: this.interpolate(assignee, inputData),
      deal_id: this.interpolate(relatedDealId, inputData),
      contact_id: this.interpolate(relatedContactId, inputData)
    };

    log.info(`[CreateCRMTaskNode] Creating task: ${taskData.title}`);

    // Use CRM service
    const result = await crmService.createTask(taskData);

    if (!result.success) {
      // Fallback to local storage
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: taskData.title,
          description: taskData.description,
          due_date: taskData.due_date,
          priority: taskData.priority,
          assignee: taskData.assigned_to_email,
          deal_id: taskData.deal_id,
          contact_id: taskData.contact_id,
          status: 'todo',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      result.task = data;
    }

    return {
      output: 'main',
      data: {
        ...inputData,
        [outputField]: result.task || result
      }
    };
  }

  static getTestData() {
    return {
      deal: { name: 'Test Deal', owner: 'sales@company.com' },
      nextSteps: 'Schedule demo call'
    };
  }
}

/**
 * Log Activity Node
 * Logs a call, email, or meeting in CRM
 */
class LogActivityNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      activityType,
      subject,
      description,
      outcome,
      duration,
      relatedDealId,
      relatedContactId,
      outputField = 'loggedActivity'
    } = config;

    const activityData = {
      type: this.interpolate(activityType, inputData) || 'note',
      subject: this.interpolate(subject, inputData),
      description: this.interpolate(description, inputData),
      outcome: this.interpolate(outcome, inputData),
      duration: parseInt(this.interpolate(String(duration || 0), inputData)),
      deal_id: this.interpolate(relatedDealId, inputData),
      contact_id: this.interpolate(relatedContactId, inputData)
    };

    log.info(`[LogActivityNode] Logging ${activityData.type}: ${activityData.subject}`);

    const { data, error } = await supabase
      .from('activities')
      .insert({
        ...activityData,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return {
      output: 'main',
      data: {
        ...inputData,
        [outputField]: data
      }
    };
  }
}

/**
 * Assign Owner Node
 * Changes the owner of a deal or contact
 */
class AssignOwnerNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      objectType,
      objectId,
      objectIdField,
      newOwnerId,
      newOwnerIdField,
      outputField = 'assignmentResult'
    } = config;

    const resolvedObjectId = objectId || this.getNestedValue(inputData, objectIdField);
    const resolvedOwnerId = newOwnerId || this.getNestedValue(inputData, newOwnerIdField);

    if (!resolvedObjectId || !resolvedOwnerId) {
      throw new Error('Object ID and Owner ID are required');
    }

    const table = objectType === 'contact' ? 'contacts' : 'deals';

    log.info(`[AssignOwnerNode] Assigning ${table} ${resolvedObjectId} to ${resolvedOwnerId}`);

    const { data, error } = await supabase
      .from(table)
      .update({
        owner_id: resolvedOwnerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', resolvedObjectId)
      .select()
      .single();

    if (error) throw error;

    return {
      output: 'main',
      data: {
        ...inputData,
        [outputField]: { success: true, object: data }
      }
    };
  }
}

// ============================================================================
// CRM DATA NODES
// ============================================================================

/**
 * Lookup Contact Node
 * Find a contact by email, phone, or other criteria
 */
class LookupContactNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      searchBy,
      searchValue,
      searchValueField,
      outputField = 'contact'
    } = config;

    const resolvedValue = searchValue || this.getNestedValue(inputData, searchValueField);

    if (!resolvedValue) {
      return {
        output: 'not_found',
        data: { ...inputData, [outputField]: null }
      };
    }

    log.info(`[LookupContactNode] Searching by ${searchBy}: ${resolvedValue}`);

    // Search in CRM first
    if (crmService.configured) {
      const result = await crmService.searchContact(searchBy, resolvedValue);
      if (result.success && result.contact) {
        return {
          output: 'found',
          data: { ...inputData, [outputField]: result.contact }
        };
      }
    }

    // Fallback to local database
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq(searchBy, resolvedValue)
      .single();

    if (error || !data) {
      return {
        output: 'not_found',
        data: { ...inputData, [outputField]: null }
      };
    }

    return {
      output: 'found',
      data: { ...inputData, [outputField]: data }
    };
  }
}

/**
 * Lookup Deal Node
 * Find a deal by name, ID, or contact
 */
class LookupDealNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      searchBy,
      searchValue,
      searchValueField,
      includeActivities = false,
      outputField = 'deal'
    } = config;

    const resolvedValue = searchValue || this.getNestedValue(inputData, searchValueField);

    log.info(`[LookupDealNode] Searching by ${searchBy}: ${resolvedValue}`);

    let query = supabase.from('deals').select('*');

    if (searchBy === 'contact_id') {
      query = query.eq('contact_id', resolvedValue);
    } else if (searchBy === 'name') {
      query = query.ilike('name', `%${resolvedValue}%`);
    } else {
      query = query.eq(searchBy, resolvedValue);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return {
        output: 'not_found',
        data: { ...inputData, [outputField]: null }
      };
    }

    // Optionally include activities
    if (includeActivities) {
      const { data: activities } = await supabase
        .from('activities')
        .select('*')
        .eq('deal_id', data.id)
        .order('created_at', { ascending: false })
        .limit(10);

      data.activities = activities || [];
    }

    return {
      output: 'found',
      data: { ...inputData, [outputField]: data }
    };
  }
}

/**
 * Get Pipeline Stages Node
 * Retrieve pipeline stages for deal management
 */
class GetPipelineNode extends BaseNode {
  static async execute(config, inputData, context) {
    const { pipelineId, outputField = 'pipeline' } = config;

    log.info(`[GetPipelineNode] Getting pipeline stages`);

    // Default pipeline stages if not configured
    const defaultStages = [
      { id: 'new', name: 'New', order: 1, probability: 10 },
      { id: 'qualification', name: 'Qualification', order: 2, probability: 20 },
      { id: 'discovery', name: 'Discovery', order: 3, probability: 40 },
      { id: 'proposal', name: 'Proposal', order: 4, probability: 60 },
      { id: 'negotiation', name: 'Negotiation', order: 5, probability: 80 },
      { id: 'closed_won', name: 'Closed Won', order: 6, probability: 100 },
      { id: 'closed_lost', name: 'Closed Lost', order: 7, probability: 0 }
    ];

    const { data: stages } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('pipeline_id', pipelineId || 'default')
      .order('order', { ascending: true });

    return {
      output: 'main',
      data: {
        ...inputData,
        [outputField]: {
          stages: stages?.length > 0 ? stages : defaultStages
        }
      }
    };
  }
}

/**
 * Calculate Lead Score Node
 * AI-powered lead scoring based on various factors
 */
class CalculateLeadScoreNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      contactIdField,
      factors = {},
      outputField = 'leadScore'
    } = config;

    const contactId = this.getNestedValue(inputData, contactIdField);
    const contact = inputData.contact || {};

    log.info(`[CalculateLeadScoreNode] Calculating score for contact`);

    // Scoring factors
    let score = 0;
    const breakdown = [];

    // Company size
    if (contact.company_size) {
      const sizeScores = { enterprise: 30, mid_market: 20, smb: 10 };
      const sizeScore = sizeScores[contact.company_size] || 5;
      score += sizeScore;
      breakdown.push({ factor: 'Company Size', score: sizeScore });
    }

    // Engagement (activities count)
    const activityCount = contact.activity_count || 0;
    const engagementScore = Math.min(activityCount * 5, 25);
    score += engagementScore;
    breakdown.push({ factor: 'Engagement', score: engagementScore });

    // Source quality
    const sourceScores = {
      referral: 20,
      organic: 15,
      paid: 10,
      cold_outreach: 5
    };
    const sourceScore = sourceScores[contact.source] || 5;
    score += sourceScore;
    breakdown.push({ factor: 'Source', score: sourceScore });

    // Title/Role
    const titleKeywords = {
      ceo: 25, cto: 25, cfo: 20, vp: 20, director: 15, manager: 10
    };
    const title = (contact.title || '').toLowerCase();
    for (const [keyword, titleScore] of Object.entries(titleKeywords)) {
      if (title.includes(keyword)) {
        score += titleScore;
        breakdown.push({ factor: 'Title', score: titleScore });
        break;
      }
    }

    // Cap at 100
    score = Math.min(score, 100);

    // Determine tier
    let tier;
    if (score >= 75) tier = 'hot';
    else if (score >= 50) tier = 'warm';
    else if (score >= 25) tier = 'cool';
    else tier = 'cold';

    return {
      output: 'main',
      data: {
        ...inputData,
        [outputField]: {
          score,
          tier,
          breakdown,
          calculatedAt: new Date().toISOString()
        }
      }
    };
  }
}

/**
 * Search CRM Node
 * Search across deals, contacts, and activities
 */
class SearchCRMNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      query,
      queryField,
      objectTypes = ['deals', 'contacts'],
      limit = 10,
      outputField = 'searchResults'
    } = config;

    const searchQuery = query || this.getNestedValue(inputData, queryField);

    log.info(`[SearchCRMNode] Searching for: ${searchQuery}`);

    const results = {
      deals: [],
      contacts: [],
      activities: []
    };

    // Search deals
    if (objectTypes.includes('deals')) {
      const { data: deals } = await supabase
        .from('deals')
        .select('*')
        .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .limit(limit);
      results.deals = deals || [];
    }

    // Search contacts
    if (objectTypes.includes('contacts')) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('*')
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,company.ilike.%${searchQuery}%`)
        .limit(limit);
      results.contacts = contacts || [];
    }

    return {
      output: 'main',
      data: {
        ...inputData,
        [outputField]: results
      }
    };
  }
}

/**
 * Get Stale Deals Node
 * Find deals with no recent activity
 */
class GetStaleDealsNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      staleDays = 7,
      stages,
      limit = 50,
      outputField = 'staleDeals'
    } = config;

    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - staleDays);

    log.info(`[GetStaleDealsNode] Finding deals with no activity since ${staleDate.toISOString()}`);

    let query = supabase
      .from('deals')
      .select('*, activities(id, created_at)')
      .lt('updated_at', staleDate.toISOString())
      .not('stage', 'in', '("closed_won","closed_lost")')
      .order('updated_at', { ascending: true })
      .limit(limit);

    if (stages?.length > 0) {
      query = query.in('stage', stages);
    }

    const { data: deals, error } = await query;

    if (error) throw error;

    // Calculate days since last activity
    const staleDeals = (deals || []).map(deal => ({
      ...deal,
      daysSinceActivity: Math.floor(
        (Date.now() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      )
    }));

    return {
      output: 'main',
      data: {
        ...inputData,
        [outputField]: staleDeals
      }
    };
  }
}

// Export all nodes
module.exports = {
  // Triggers
  DealStageChangedTrigger,
  ContactCreatedTrigger,
  DealClosedTrigger,
  TaskOverdueTrigger,
  ActivityLoggedTrigger,

  // Actions
  CreateDealNode,
  UpdateDealNode,
  CreateContactNode,
  UpdateContactNode,
  CreateCRMTaskNode,
  LogActivityNode,
  AssignOwnerNode,

  // Data
  LookupContactNode,
  LookupDealNode,
  GetPipelineNode,
  CalculateLeadScoreNode,
  SearchCRMNode,
  GetStaleDealsNode
};
