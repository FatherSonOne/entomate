/** Types for guideData.js (the guide's content stays in plain JS so /users-guide can edit it). */

export interface GuideSubsection {
  id: string
  title: string
  description?: string
  steps: string[]
  note?: string
}

export interface GuideQuestion {
  id: string
  title: string
  scenario: string
  steps: string[]
}

export interface GuideSection {
  id: string
  title: string
  summary: string
  steps?: string[]
  subsections?: GuideSubsection[]
  tips?: string[]
  useCases?: GuideQuestion[]
}

export interface GuideCategory {
  label: string
  ids: string[]
}

export interface GuideChange {
  /** YYYY-MM-DD */
  date: string
  /** Section id the change links to. */
  section: string
  text: string
}

export interface GuideShortcut {
  keys: string[]
  label: string
  /** Shown in the guide's context column. */
  top?: boolean
}

export const guideVersion: string
export const guideUpdated: string
export const GUIDE_VERSION_KEY: string
export const CATEGORIES: GuideCategory[]
export const GUIDE_CHANGES: GuideChange[]
export const SHORTCUTS: GuideShortcut[]
export const guideSections: GuideSection[]
