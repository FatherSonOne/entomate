import React from 'react'
import { VCBadge } from '../components/vc'

export function getStatusBadge(status) {
  switch (status) {
    case 'active':    return <VCBadge color="mint">{status}</VCBadge>
    case 'planning':  return <VCBadge color="amber">{status}</VCBadge>
    case 'completed': return <VCBadge color="neutral">{status}</VCBadge>
    case 'archived':  return <VCBadge color="neutral">{status}</VCBadge>
    default:          return <VCBadge color="neutral">{status}</VCBadge>
  }
}

export function getPriorityBadge(priority) {
  switch (priority) {
    case 'high':   return <VCBadge color="crimson">{priority}</VCBadge>
    case 'medium': return <VCBadge color="amber">{priority}</VCBadge>
    case 'low':    return <VCBadge color="mint">{priority}</VCBadge>
    default:       return <VCBadge color="neutral">{priority}</VCBadge>
  }
}

export function getTaskStatusBadge(status) {
  switch (status) {
    case 'open':        return <VCBadge color="neutral">open</VCBadge>
    case 'in_progress': return <VCBadge color="amber">in progress</VCBadge>
    case 'review':      return <VCBadge color="mint">review</VCBadge>
    case 'done':        return <VCBadge color="mint">done</VCBadge>
    case 'blocked':     return <VCBadge color="crimson">blocked</VCBadge>
    default:            return <VCBadge color="neutral">{status}</VCBadge>
  }
}
