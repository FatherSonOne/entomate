import { supabase, EntomateMeeting, EntoamteActionItem } from '../lib/supabase'
import {
  processMeetingRelationships,
  linkMeetingToActionItem
} from '../graph/relationshipHooks'

// ==================== MEETINGS ====================

export async function createMeeting(meeting: Partial<EntomateMeeting>): Promise<EntomateMeeting | null> {
  const { data, error } = await supabase
    .from('entomate_meetings')
    .insert([meeting])
    .select()
    .single()

  if (error) {
    console.error('Error creating meeting:', error)
    return null
  }

  // Create Knowledge Graph relationships for the meeting
  if (data) {
    try {
      await processMeetingRelationships(data)
    } catch (graphError) {
      console.error('Error creating meeting relationships:', graphError)
      // Don't fail the meeting creation if graph update fails
    }
  }

  return data
}

export async function getMeetings(): Promise<EntomateMeeting[]> {
  const { data, error } = await supabase
    .from('entomate_meetings')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching meetings:', error)
    return []
  }
  return data || []
}

export async function getMeetingById(id: string): Promise<EntomateMeeting | null> {
  const { data, error } = await supabase
    .from('entomate_meetings')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching meeting:', error)
    return null
  }
  return data
}

export async function updateMeeting(id: string, updates: Partial<EntomateMeeting>): Promise<EntomateMeeting | null> {
  const { data, error } = await supabase
    .from('entomate_meetings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating meeting:', error)
    return null
  }
  return data
}

export async function deleteMeeting(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('entomate_meetings')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting meeting:', error)
    return false
  }
  return true
}

// ==================== ACTION ITEMS ====================

export async function createActionItem(actionItem: Partial<EntoamteActionItem>): Promise<EntoamteActionItem | null> {
  const { data, error } = await supabase
    .from('entomate_action_items')
    .insert([actionItem])
    .select()
    .single()

  if (error) {
    console.error('Error creating action item:', error)
    return null
  }
  return data
}

export async function getActionItemsByMeeting(meetingId: string): Promise<EntoamteActionItem[]> {
  const { data, error } = await supabase
    .from('entomate_action_items')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching action items:', error)
    return []
  }
  return data || []
}

export async function getAllActionItems(): Promise<EntoamteActionItem[]> {
  const { data, error } = await supabase
    .from('entomate_action_items')
    .select('*')
    .order('due_date', { ascending: true })

  if (error) {
    console.error('Error fetching action items:', error)
    return []
  }
  return data || []
}

export async function updateActionItem(id: string, updates: Partial<EntoamteActionItem>): Promise<EntoamteActionItem | null> {
  const { data, error } = await supabase
    .from('entomate_action_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating action item:', error)
    return null
  }
  return data
}

export async function deleteActionItem(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('entomate_action_items')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting action item:', error)
    return false
  }
  return true
}

// ==================== BULK OPERATIONS ====================

export async function createActionItemsFromMeeting(
  meetingId: string,
  actionItems: Partial<EntoamteActionItem>[]
): Promise<EntoamteActionItem[]> {
  const itemsWithMeetingId = actionItems.map(item => ({
    ...item,
    meeting_id: meetingId
  }))

  const { data, error } = await supabase
    .from('entomate_action_items')
    .insert(itemsWithMeetingId)
    .select()

  if (error) {
    console.error('Error creating action items:', error)
    return []
  }

  // Create Knowledge Graph relationships for action items
  if (data && data.length > 0) {
    try {
      for (const item of data) {
        await linkMeetingToActionItem(meetingId, item.id)
      }
      console.log(`[KnowledgeGraph] Linked ${data.length} action items to meeting:${meetingId}`)
    } catch (graphError) {
      console.error('Error creating action item relationships:', graphError)
      // Don't fail if graph update fails
    }
  }

  return data || []
}
