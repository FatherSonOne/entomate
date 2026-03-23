/**
 * Logos Vision Service — CRM integration through the Shared Hub
 *
 * Logos Vision is the ecosystem's own CRM. Instead of external API calls,
 * it reads/writes through the hub's shared_contacts and cross_app_events tables.
 * This allows bidirectional sync: Entomate publishes meeting intelligence,
 * Logos Vision publishes deal updates and contact changes.
 */

const { getHubClient } = require('./hubClient')
const log = require('../utils/log');

class LogosVisionService {
  get hub() {
    return getHubClient()
  }

  get configured() {
    return !!this.hub
  }

  /**
   * Look up a contact by email in the shared hub
   */
  async lookupContact(email) {
    if (!this.hub) return null

    try {
      const { data, error } = await this.hub
        .from('shared_contacts')
        .select('id, name, email, phone, company_name, job_title, department, linkedin_url, tags, custom_fields')
        .eq('email', email)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data || null
    } catch (err) {
      log.error('[LogosVision] Contact lookup failed:', err.message)
      return null
    }
  }

  /**
   * Bulk lookup contacts by email
   */
  async lookupContacts(emails) {
    if (!this.hub || !emails?.length) return []

    try {
      const { data, error } = await this.hub
        .from('shared_contacts')
        .select('id, name, email, company_name, job_title, department, tags')
        .in('email', emails)

      if (error) throw error
      return data || []
    } catch (err) {
      log.error('[LogosVision] Bulk contact lookup failed:', err.message)
      return []
    }
  }

  /**
   * Upsert a contact discovered during meeting processing
   */
  async upsertContact({ email, name, company, jobTitle, source = 'entomate', ownerId = null, orgId = null }) {
    if (!this.hub || !email) return null

    try {
      const { data, error } = await this.hub
        .from('shared_contacts')
        .upsert({
          email,
          name: name || undefined,
          company_name: company || undefined,
          job_title: jobTitle || undefined,
          source,
          owner_id: ownerId,
          organization_id: orgId,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'email',
          ignoreDuplicates: false
        })
        .select('id')
        .single()

      if (error) throw error
      return data
    } catch (err) {
      log.error('[LogosVision] Contact upsert failed:', err.message)
      return null
    }
  }

  /**
   * Sync an action item to Logos Vision as a task (via hub event)
   */
  async syncActionItem(actionItem) {
    if (!this.hub) return { success: false, error: 'Hub not configured' }

    const hubEventPublisher = require('./hubEventPublisher')
    const eventId = await hubEventPublisher.actionItemCreated(actionItem, actionItem.meeting_id)

    return eventId
      ? { success: true, eventId }
      : { success: false, error: 'Failed to publish event' }
  }

  /**
   * Push a meeting activity record to Logos Vision
   */
  async syncMeetingActivity(meeting) {
    if (!this.hub) return { success: false, error: 'Hub not configured' }

    const hubEventPublisher = require('./hubEventPublisher')
    const eventId = await hubEventPublisher.meetingCompleted(meeting)

    return eventId
      ? { success: true, eventId }
      : { success: false, error: 'Failed to publish event' }
  }

  /**
   * Get recent deal events from Logos Vision through the hub
   */
  async getDeals({ limit = 20 } = {}) {
    if (!this.hub) return []

    try {
      const { data, error } = await this.hub
        .from('cross_app_events')
        .select('payload, created_at')
        .eq('source_app', 'logos_crm')
        .eq('event_category', 'deal')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return (data || []).map(e => ({ ...e.payload, eventDate: e.created_at }))
    } catch (err) {
      log.error('[LogosVision] Get deals failed:', err.message)
      return []
    }
  }

  /**
   * Get recent contacts from the shared hub
   */
  async getRecentContacts({ limit = 10, since } = {}) {
    if (!this.hub) return []

    try {
      let query = this.hub
        .from('shared_contacts')
        .select('id, name, email, phone, company_name, job_title, tags, created_at')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (since) {
        query = query.gte('created_at', since)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    } catch (err) {
      log.error('[LogosVision] Get recent contacts failed:', err.message)
      return []
    }
  }

  /**
   * Check connection status
   */
  async checkConnection() {
    if (!this.hub) return { connected: false, reason: 'Hub not configured' }

    try {
      const { count, error } = await this.hub
        .from('shared_contacts')
        .select('id', { count: 'exact', head: true })

      if (error) throw error
      return { connected: true, contactCount: count }
    } catch (err) {
      return { connected: false, reason: err.message }
    }
  }
}

module.exports = new LogosVisionService()
