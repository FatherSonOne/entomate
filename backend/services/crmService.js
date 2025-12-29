/**
 * CRM Integration Service
 * Supports HubSpot, Salesforce, Pipedrive
 * Configure CRM_PROVIDER in .env to select provider
 */

const axios = require('axios');

class CRMService {
  constructor() {
    this.provider = process.env.CRM_PROVIDER || 'hubspot';
    this.apiKey = process.env.CRM_API_KEY;
    this.baseUrl = this.getBaseUrl();
    this.configured = !!this.apiKey;
  }

  getBaseUrl() {
    switch (this.provider) {
      case 'hubspot':
        return 'https://api.hubapi.com';
      case 'salesforce':
        return process.env.SALESFORCE_INSTANCE_URL || 'https://login.salesforce.com';
      case 'pipedrive':
        return 'https://api.pipedrive.com/v1';
      default:
        return null;
    }
  }

  /**
   * Get HTTP headers for API requests
   */
  getHeaders() {
    switch (this.provider) {
      case 'hubspot':
        return {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        };
      case 'salesforce':
        return {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        };
      case 'pipedrive':
        return {
          'Content-Type': 'application/json'
        };
      default:
        return {};
    }
  }

  /**
   * Check if CRM is configured and connected
   */
  async checkConnection() {
    if (!this.configured) {
      return { connected: false, message: 'CRM not configured' };
    }

    try {
      switch (this.provider) {
        case 'hubspot':
          await axios.get(`${this.baseUrl}/crm/v3/objects/contacts?limit=1`, {
            headers: this.getHeaders()
          });
          break;
        case 'pipedrive':
          await axios.get(`${this.baseUrl}/users/me?api_token=${this.apiKey}`);
          break;
        case 'salesforce':
          await axios.get(`${this.baseUrl}/services/data/v57.0/sobjects`, {
            headers: this.getHeaders()
          });
          break;
      }
      return { connected: true, provider: this.provider };
    } catch (error) {
      return {
        connected: false,
        message: error.response?.data?.message || error.message,
        provider: this.provider
      };
    }
  }

  /**
   * Create a task in CRM
   */
  async createTask(taskData) {
    if (!this.configured) {
      console.log('CRM not configured, skipping task creation');
      return { success: false, message: 'CRM not configured' };
    }

    try {
      let result;

      switch (this.provider) {
        case 'hubspot':
          result = await this.createHubSpotTask(taskData);
          break;
        case 'salesforce':
          result = await this.createSalesforceTask(taskData);
          break;
        case 'pipedrive':
          result = await this.createPipedriveActivity(taskData);
          break;
        default:
          throw new Error(`Unsupported CRM provider: ${this.provider}`);
      }

      return { success: true, taskId: result.id, provider: this.provider };
    } catch (error) {
      console.error(`CRM task creation failed:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        provider: this.provider
      };
    }
  }

  /**
   * HubSpot: Create Task
   */
  async createHubSpotTask(taskData) {
    const hubspotTask = {
      properties: {
        hs_task_subject: taskData.title || taskData.task_description,
        hs_task_body: taskData.description || taskData.context || '',
        hs_task_status: 'NOT_STARTED',
        hs_task_priority: this.mapPriorityToHubSpot(taskData.priority),
        hs_timestamp: new Date().toISOString()
      }
    };

    if (taskData.due_date) {
      hubspotTask.properties.hs_task_due_date = new Date(taskData.due_date).getTime();
    }

    const response = await axios.post(
      `${this.baseUrl}/crm/v3/objects/tasks`,
      hubspotTask,
      { headers: this.getHeaders() }
    );

    // Associate with contact if email provided
    if (taskData.assigned_to_email) {
      await this.associateHubSpotTaskWithContact(response.data.id, taskData.assigned_to_email);
    }

    return response.data;
  }

  mapPriorityToHubSpot(priority) {
    const mapping = {
      'high': 'HIGH',
      'medium': 'MEDIUM',
      'low': 'LOW'
    };
    return mapping[priority?.toLowerCase()] || 'MEDIUM';
  }

  async associateHubSpotTaskWithContact(taskId, email) {
    try {
      // Search for contact by email
      const searchResponse = await axios.post(
        `${this.baseUrl}/crm/v3/objects/contacts/search`,
        {
          filterGroups: [{
            filters: [{
              propertyName: 'email',
              operator: 'EQ',
              value: email
            }]
          }]
        },
        { headers: this.getHeaders() }
      );

      if (searchResponse.data.results.length > 0) {
        const contactId = searchResponse.data.results[0].id;
        await axios.put(
          `${this.baseUrl}/crm/v3/objects/tasks/${taskId}/associations/contacts/${contactId}/task_to_contact`,
          {},
          { headers: this.getHeaders() }
        );
      }
    } catch (error) {
      console.error('Failed to associate task with contact:', error.message);
    }
  }

  /**
   * Salesforce: Create Task
   */
  async createSalesforceTask(taskData) {
    const sfTask = {
      Subject: taskData.title || taskData.task_description,
      Description: taskData.description || taskData.context || '',
      Status: 'Not Started',
      Priority: this.mapPriorityToSalesforce(taskData.priority)
    };

    if (taskData.due_date) {
      sfTask.ActivityDate = taskData.due_date;
    }

    const response = await axios.post(
      `${this.baseUrl}/services/data/v57.0/sobjects/Task`,
      sfTask,
      { headers: this.getHeaders() }
    );

    return { id: response.data.id };
  }

  mapPriorityToSalesforce(priority) {
    const mapping = {
      'high': 'High',
      'medium': 'Normal',
      'low': 'Low'
    };
    return mapping[priority?.toLowerCase()] || 'Normal';
  }

  /**
   * Pipedrive: Create Activity
   */
  async createPipedriveActivity(taskData) {
    const activity = {
      subject: taskData.title || taskData.task_description,
      type: 'task',
      note: taskData.description || taskData.context || '',
      done: 0
    };

    if (taskData.due_date) {
      activity.due_date = taskData.due_date;
    }

    const response = await axios.post(
      `${this.baseUrl}/activities?api_token=${this.apiKey}`,
      activity,
      { headers: { 'Content-Type': 'application/json' } }
    );

    return { id: response.data.data.id };
  }

  /**
   * Get deals/opportunities from CRM
   */
  async getDeals(limit = 10) {
    if (!this.configured) {
      return { success: false, deals: [], message: 'CRM not configured' };
    }

    try {
      let deals = [];

      switch (this.provider) {
        case 'hubspot':
          const hubspotResponse = await axios.get(
            `${this.baseUrl}/crm/v3/objects/deals?limit=${limit}&properties=dealname,amount,dealstage`,
            { headers: this.getHeaders() }
          );
          deals = hubspotResponse.data.results.map(d => ({
            id: d.id,
            name: d.properties.dealname,
            value: d.properties.amount,
            stage: d.properties.dealstage
          }));
          break;

        case 'pipedrive':
          const pipedriveResponse = await axios.get(
            `${this.baseUrl}/deals?api_token=${this.apiKey}&limit=${limit}`
          );
          deals = pipedriveResponse.data.data?.map(d => ({
            id: d.id,
            name: d.title,
            value: d.value,
            stage: d.stage_id
          })) || [];
          break;

        case 'salesforce':
          const sfResponse = await axios.get(
            `${this.baseUrl}/services/data/v57.0/query?q=SELECT+Id,Name,Amount,StageName+FROM+Opportunity+LIMIT+${limit}`,
            { headers: this.getHeaders() }
          );
          deals = sfResponse.data.records.map(d => ({
            id: d.Id,
            name: d.Name,
            value: d.Amount,
            stage: d.StageName
          }));
          break;
      }

      return { success: true, deals, provider: this.provider };
    } catch (error) {
      return {
        success: false,
        deals: [],
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Get contacts from CRM
   */
  async getContacts(limit = 10) {
    if (!this.configured) {
      return { success: false, contacts: [], message: 'CRM not configured' };
    }

    try {
      let contacts = [];

      switch (this.provider) {
        case 'hubspot':
          const hubspotResponse = await axios.get(
            `${this.baseUrl}/crm/v3/objects/contacts?limit=${limit}&properties=firstname,lastname,email`,
            { headers: this.getHeaders() }
          );
          contacts = hubspotResponse.data.results.map(c => ({
            id: c.id,
            name: `${c.properties.firstname || ''} ${c.properties.lastname || ''}`.trim(),
            email: c.properties.email
          }));
          break;

        case 'pipedrive':
          const pipedriveResponse = await axios.get(
            `${this.baseUrl}/persons?api_token=${this.apiKey}&limit=${limit}`
          );
          contacts = pipedriveResponse.data.data?.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email?.[0]?.value
          })) || [];
          break;

        case 'salesforce':
          const sfResponse = await axios.get(
            `${this.baseUrl}/services/data/v57.0/query?q=SELECT+Id,Name,Email+FROM+Contact+LIMIT+${limit}`,
            { headers: this.getHeaders() }
          );
          contacts = sfResponse.data.records.map(c => ({
            id: c.Id,
            name: c.Name,
            email: c.Email
          }));
          break;
      }

      return { success: true, contacts, provider: this.provider };
    } catch (error) {
      return {
        success: false,
        contacts: [],
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Update task status in CRM
   */
  async updateTaskStatus(taskId, status) {
    if (!this.configured || !taskId) {
      return { success: false, message: 'CRM not configured or invalid task ID' };
    }

    try {
      switch (this.provider) {
        case 'hubspot':
          await axios.patch(
            `${this.baseUrl}/crm/v3/objects/tasks/${taskId}`,
            {
              properties: {
                hs_task_status: status === 'done' ? 'COMPLETED' : 'NOT_STARTED'
              }
            },
            { headers: this.getHeaders() }
          );
          break;

        case 'salesforce':
          await axios.patch(
            `${this.baseUrl}/services/data/v57.0/sobjects/Task/${taskId}`,
            { Status: status === 'done' ? 'Completed' : 'Not Started' },
            { headers: this.getHeaders() }
          );
          break;

        case 'pipedrive':
          await axios.put(
            `${this.baseUrl}/activities/${taskId}?api_token=${this.apiKey}`,
            { done: status === 'done' ? 1 : 0 }
          );
          break;
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }
}

module.exports = new CRMService();
