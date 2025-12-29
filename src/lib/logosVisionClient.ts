/**
 * Logos Vision CRM Client
 *
 * This client connects to the Logos Vision CRM Supabase instance
 * for syncing action items, meetings, and projects.
 *
 * Environment Variables Required:
 * - VITE_LOGOS_VISION_SUPABASE_URL: Logos Vision Supabase URL
 * - VITE_LOGOS_VISION_SUPABASE_ANON_KEY: Logos Vision Supabase anon key
 *
 * If not configured, falls back to the main Entomate Supabase instance
 * (for cases where both apps share the same database).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { supabase as mainSupabase } from './supabase'

// Get Logos Vision specific environment variables
// @ts-ignore - defined by vite.config.ts
const logosVisionUrl = process.env.VITE_LOGOS_VISION_SUPABASE_URL as string
// @ts-ignore - defined by vite.config.ts
const logosVisionKey = process.env.VITE_LOGOS_VISION_SUPABASE_ANON_KEY as string

// Create Logos Vision client if configured, otherwise use main client
let logosVisionClient: SupabaseClient

if (logosVisionUrl && logosVisionKey) {
  console.log('[LogosVision] Using dedicated Logos Vision Supabase instance')
  logosVisionClient = createClient(logosVisionUrl, logosVisionKey)
} else {
  console.log('[LogosVision] Using shared Supabase instance (Logos Vision env vars not set)')
  logosVisionClient = mainSupabase
}

export const logosVisionSupabase = logosVisionClient

// ============================================
// LOGOS VISION DATA TYPES
// ============================================

export interface LogosVisionTeamMember {
  id: string
  name: string
  email: string
  role: string
}

export interface LogosVisionTask {
  id: string
  description: string
  team_member_id: string | null
  due_date: string | null
  status: 'To Do' | 'In Progress' | 'Done'
  priority?: string
  notes?: string
  entomate_action_item_id?: string
  entomate_meeting_id?: string
  created_at?: string
  updated_at?: string
}

export interface LogosVisionActivity {
  id: string
  type: 'Call' | 'Email' | 'Meeting' | 'Note'
  title: string
  project_id?: string | null
  client_id?: string | null
  activity_date: string
  activity_time?: string
  status: 'Scheduled' | 'Completed' | 'Cancelled'
  notes?: string
  created_by_id: string
  entomate_meeting_id?: string
  created_at?: string
  updated_at?: string
}

export interface LogosVisionProject {
  id: string
  name: string
  description?: string
  client_id?: string | null
  status: string
  start_date?: string
  end_date?: string
  entomate_project_id?: string
  entomate_deal_id?: string
  created_at?: string
  updated_at?: string
}

export interface LogosVisionClient {
  id: string
  name: string
  contact_person?: string
  email?: string
  phone?: string
  location?: string
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Test connection to Logos Vision database
 */
export async function testLogosVisionConnection(): Promise<{
  success: boolean
  message: string
  isSharedInstance: boolean
}> {
  const isSharedInstance = !(logosVisionUrl && logosVisionKey)

  try {
    const { data, error } = await logosVisionSupabase
      .from('team_members')
      .select('count')
      .limit(1)

    if (error) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
        isSharedInstance,
      }
    }

    return {
      success: true,
      message: 'Connected to Logos Vision CRM',
      isSharedInstance,
    }
  } catch (error) {
    return {
      success: false,
      message: `Connection error: ${error instanceof Error ? error.message : 'Unknown'}`,
      isSharedInstance,
    }
  }
}

/**
 * Get Logos Vision connection info
 */
export function getConnectionInfo(): {
  isConfigured: boolean
  url: string | null
  isSharedInstance: boolean
} {
  return {
    isConfigured: !!(logosVisionUrl && logosVisionKey),
    url: logosVisionUrl || null,
    isSharedInstance: !(logosVisionUrl && logosVisionKey),
  }
}

export default logosVisionSupabase
