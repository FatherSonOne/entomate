/**
 * useProposals — the write spine's interaction layer (EAI-05). Ported from Logos AI's
 * useProposals; the plan verbs (confirm/dismiss/undo a plan) come with EAI-06.
 *
 * It owns the busy / edit / typed-confirm state and every call that resolves a proposal:
 * confirm, dismiss, inline edit, undo, view. It does NOT own a proposal list: proposals hang
 * off the message that produced them (`msg.proposals`), so the panel's message array stays
 * the one source of truth and this hook gets one narrow patch primitive, `replaceProposal`.
 *
 * The typed-confirm gate lives in handleConfirm: for a sensitive verb the first click only
 * reveals the input; the second re-checks the token before calling the server, which checks
 * it again. Write and safe verbs confirm in one click.
 */
import { useCallback, useState } from 'react'
import { entoAiApi } from '../../services/api'
import { tokensMatch } from './ProposalCard'
import type { EntoProposal } from './ProposalCard'

interface ActionResponse {
  ok: boolean
  proposal?: EntoProposal
  error?: string
}

interface UseProposalsArgs {
  /** Swap one proposal on one message (owned by the panel's message state). */
  replaceProposal: (messageIdx: number, proposal: EntoProposal) => void
  navigate: (path: string) => void
  onClose: () => void
}

export function useProposals({ replaceProposal, navigate, onClose }: UseProposalsArgs) {
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Record<string, string>>({})
  const [editError, setEditError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [confirmError, setConfirmError] = useState<string | null>(null)
  // The last refusal per card ("changed since, so undo was not run").
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({})

  const setActionError = useCallback((id: string, message: string | null) => {
    setActionErrors((prev) => {
      const next = { ...prev }
      if (message) next[id] = message
      else delete next[id]
      return next
    })
  }, [])

  /** Runs one call for one card; paints whatever state the server reports, even on a refusal. */
  const resolve = useCallback(
    async (messageIdx: number, p: EntoProposal, call: () => Promise<ActionResponse>) => {
      setResolvingId(p.id)
      setActionError(p.id, null)
      try {
        const res = await call()
        if (res.proposal) replaceProposal(messageIdx, res.proposal)
        if (!res.ok) setActionError(p.id, res.error || 'That did not work. Try again.')
        return res
      } catch (e) {
        setActionError(p.id, (e as Error)?.message || 'Entomate AI could not be reached. Try again.')
        return null
      } finally {
        setResolvingId(null)
      }
    },
    [replaceProposal, setActionError],
  )

  const handleConfirm = useCallback(
    async (messageIdx: number, p: EntoProposal) => {
      const typed = p.riskClass === 'sensitive'
      if (typed && confirmingId !== p.id) {
        setConfirmingId(p.id)
        setConfirmText('')
        setConfirmError(null)
        return
      }
      if (typed && !tokensMatch(p.confirmToken, confirmText)) {
        setConfirmError(`Type "${p.confirmToken}" exactly to confirm.`)
        return
      }
      const res = await resolve(messageIdx, p, () => entoAiApi.actions.confirm(p.id, typed ? confirmText : undefined))
      if (res?.ok) {
        setConfirmingId(null)
        setConfirmText('')
        setConfirmError(null)
      }
    },
    [confirmingId, confirmText, resolve],
  )

  const handleCancelConfirm = useCallback(() => {
    setConfirmingId(null)
    setConfirmText('')
    setConfirmError(null)
  }, [])

  const handleConfirmTextChange = useCallback((value: string) => {
    setConfirmText(value)
    setConfirmError(null)
  }, [])

  const handleReject = useCallback(
    (messageIdx: number, p: EntoProposal) => resolve(messageIdx, p, () => entoAiApi.actions.reject(p.id)),
    [resolve],
  )

  const handleUndo = useCallback(
    (messageIdx: number, p: EntoProposal) => resolve(messageIdx, p, () => entoAiApi.actions.undo(p.id)),
    [resolve],
  )

  const handleStartEdit = useCallback((p: EntoProposal) => {
    const draft: Record<string, string> = {}
    for (const f of p.editable) {
      const v = p.payload?.[f.key]
      draft[f.key] = v === undefined || v === null ? '' : String(v)
    }
    setEditDraft(draft)
    setEditError(null)
    setEditingId(p.id)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setEditDraft({})
    setEditError(null)
  }, [])

  const handleEditField = useCallback((key: string, value: string) => {
    setEditDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSaveEdit = useCallback(
    async (messageIdx: number, p: EntoProposal) => {
      setResolvingId(p.id)
      setEditError(null)
      try {
        // Only the editable keys, as a merge patch; the server validates them again.
        const patch: Record<string, string> = {}
        for (const f of p.editable) patch[f.key] = editDraft[f.key] ?? ''
        const res = await entoAiApi.actions.edit(p.id, patch)
        if (res.proposal) replaceProposal(messageIdx, res.proposal)
        if (res.ok) {
          setEditingId(null)
          setEditDraft({})
        } else {
          setEditError(res.error || 'Could not save the changes.')
        }
      } catch (e) {
        setEditError((e as Error)?.message || 'Could not save the changes.')
      } finally {
        setResolvingId(null)
      }
    },
    [editDraft, replaceProposal],
  )

  const handleView = useCallback(
    (p: EntoProposal) => {
      if (!p.view) return
      navigate(p.view.path)
      onClose()
    },
    [navigate, onClose],
  )

  return {
    resolvingId,
    editingId,
    editDraft,
    editError,
    confirmingId,
    confirmText,
    confirmError,
    actionErrors,
    handleConfirm,
    handleCancelConfirm,
    handleConfirmTextChange,
    handleReject,
    handleUndo,
    handleStartEdit,
    handleCancelEdit,
    handleEditField,
    handleSaveEdit,
    handleView,
  }
}
