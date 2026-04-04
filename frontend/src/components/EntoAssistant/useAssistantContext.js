/**
 * useAssistantContext — loads section-specific data when the AI panel opens
 */
import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  resolveSection,
  getSectionLabel,
  getSectionSummary,
  loadSectionData,
} from '../../services/entoAssistantService'

export default function useAssistantContext(isOpen) {
  const location = useLocation()
  const [context, setContext] = useState({ section: 'dashboard', sectionLabel: 'Dashboard', data: {} })
  const [sectionSummary, setSectionSummary] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const cancelRef = useRef(false)

  const section = resolveSection(location.pathname)
  const sectionLabel = getSectionLabel(section)

  useEffect(() => {
    // Always keep section updated even when closed
    setContext(prev => ({ ...prev, section, sectionLabel }))
  }, [section, sectionLabel])

  useEffect(() => {
    if (!isOpen) {
      // Clear data when panel closes to free memory
      setContext(prev => ({ ...prev, data: {} }))
      setSectionSummary('')
      return
    }

    cancelRef.current = false
    setIsLoading(true)

    loadSectionData(section).then(data => {
      if (cancelRef.current) return
      setContext(prev => ({ ...prev, section, sectionLabel, data }))
      setSectionSummary(getSectionSummary(section, data))
      setIsLoading(false)
    }).catch(() => {
      if (cancelRef.current) return
      setIsLoading(false)
    })

    return () => { cancelRef.current = true }
  }, [isOpen, section, sectionLabel])

  return { context, sectionSummary, sectionLabel, isLoading }
}
