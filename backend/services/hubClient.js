/**
 * Shared Hub Client — Singleton factory for the cross-app Supabase hub
 *
 * Uses HUB_SUPABASE_URL if configured (separate hub DB),
 * falls back to SUPABASE_URL for single-DB development.
 */

const { createClient } = require('@supabase/supabase-js')
const log = require('../utils/log');

let hubClient = null

function getHubClient() {
  if (hubClient) return hubClient

  const hubUrl = process.env.HUB_SUPABASE_URL || process.env.SUPABASE_URL
  const hubKey = process.env.HUB_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!hubUrl || !hubKey) {
    return null
  }

  hubClient = createClient(hubUrl, hubKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  log.info('[HubClient] Initialized:', hubUrl === process.env.HUB_SUPABASE_URL ? 'dedicated hub' : 'shared DB mode')
  return hubClient
}

function isHubConfigured() {
  return !!(process.env.HUB_SUPABASE_URL || process.env.SUPABASE_URL)
}

module.exports = { getHubClient, isHubConfigured }
