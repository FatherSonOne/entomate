import { createClient } from '@supabase/supabase-js'

// @ts-ignore - defined by vite.config.ts
const supabaseUrl = process.env.VITE_SUPABASE_URL as string
// @ts-ignore - defined by vite.config.ts
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', { supabaseUrl, supabaseAnonKey })
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

// Database types for Entomate tables
export interface EntomateMeeting {
  id: string
  title: string
  description?: string
  transcript?: string
  summary?: string
  key_points?: string[]
  decisions?: string[]
  sentiment_score?: number
  sentiment_label?: string
  audio_file_url?: string
  start_time?: string
  end_time?: string
  duration_minutes?: number
  attendees?: string[]
  pulse_channel_id?: string
  pulse_synced_at?: string
  crm_deal_id?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface EntoamteActionItem {
  id: string
  meeting_id: string
  task_description: string
  assigned_to_user_id?: string
  assigned_to_name?: string
  assigned_to_email?: string
  due_date?: string
  priority: 'low' | 'medium' | 'high'
  status: 'open' | 'in_progress' | 'completed'
  crm_sync_status: 'pending' | 'synced' | 'failed'
  crm_task_id?: string
  pulse_task_id?: string
  created_at: string
  updated_at: string
}

export interface EntoamteProject {
  id: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'on_hold'
  logos_project_id?: string
  crm_deal_id?: string
  deal_value?: number
  start_date?: string
  end_date?: string
  owner_id?: string
  team_ids?: string[]
  created_at: string
  updated_at: string
}

export interface EntoamteProjectTask {
  id: string
  project_id: string
  title: string
  description?: string
  assigned_to?: string
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  due_date?: string
  meeting_id?: string
  created_at: string
  updated_at: string
}

export interface EntoamteAutomation {
  id: string
  name: string
  description?: string
  trigger_type: string
  trigger_config: Record<string, any>
  actions: Record<string, any>[]
  is_active: boolean
  created_by?: string
  last_run_at?: string
  run_count: number
  created_at: string
  updated_at: string
}
