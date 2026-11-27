import type { SearchResponse } from './searchEngine'
import type { PassageAnchor } from './meetingSourceLink'

export interface AskMeeting { type?: string; id?: string; title?: string; date?: string }

export interface AskCitation {
  id: string
  title: string
  date?: string | null
  speaker: string | null
  quote: string
  atMs: number | null
  passage: PassageAnchor
  role?: 'before' | 'after' | 'source'
  period?: 'previous' | 'current'
}

export interface AskClaim { text: string; citations: AskCitation[]; topic?: string }

export interface MonthlyRecap {
  startDate: string
  endDate: string
  timeZone: string
  totalMeetings: number
  reviewedMeetings: number
  meetingsWithoutTranscripts: number
  unindexedMeetings: number
  unsampledMeetings: number
}

export interface MonthComparison {
  previous: MonthlyRecap
  current: MonthlyRecap
}

export interface CompletedAnswer {
  question: string
  text: string
  meetings: AskMeeting[]
  claims?: AskClaim[]
  recap?: MonthlyRecap
  comparison?: MonthComparison
}

export interface SearchVisit {
  owner: string
  search: string
  draft: string
  results: SearchResponse | null
  meaning: boolean
  answer: CompletedAnswer | null
  linkId: string
  scrollY: number
}

// Keep the last few round trips in this tab's memory. The history entry carries only a key.
const visits = new Map<string, SearchVisit>()

export function rememberSearchVisit(key: string, visit: SearchVisit): void {
  visits.delete(key)
  visits.set(key, visit)
  if (visits.size > 8) visits.delete(visits.keys().next().value!)
}

export function readSearchVisit(key: string, owner: string | null, search: string): SearchVisit | null {
  const visit = visits.get(key)
  return visit && visit.owner === owner && visit.search === search ? visit : null
}
