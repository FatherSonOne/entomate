/**
 * EAI-02c: the Share panel under an answer, ported from Logos AI (LV `AnswerSharePanel.tsx`),
 * opened from the Share button in the answer's action row. Same markup and classes as LV, so
 * the copied CSS (`la-share-*`, `la-action-item*`) lays it out unchanged.
 *
 *   Print or save as PDF -> the browser's print dialog (see printAnswer)
 *   Copy as plain text   -> the answer without Markdown, for pasting anywhere
 *
 * LV hides an option when the organization lacks its module. Entomate has none of the three
 * (Documents, the Email Command Center, Contacts), so "Save PDF to Documents", "Start an email
 * draft" (an unsent LV campaign draft) and "Add as a note on a contact" are not ported.
 */
import React, { useCallback, useState } from 'react'
import { Check, Copy, Printer, Share2 } from 'lucide-react'
import { answerPlainText } from './answerText'

export interface AnswerSharePanelProps {
  answer: string
  /** Opens the print dialog for this answer. False when it could not. */
  onPrint: () => boolean
}

type Outcome = { kind: 'idle' } | { kind: 'error'; label: string }

export const AnswerSharePanel: React.FC<AnswerSharePanelProps> = ({ answer, onPrint }) => {
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' })
  const [copied, setCopied] = useState(false)

  const handlePrint = useCallback(() => {
    setOutcome({ kind: 'idle' })
    if (!onPrint()) setOutcome({ kind: 'error', label: 'Could not open the print dialog. Try again, or copy the answer instead.' })
  }, [onPrint])

  const handleCopyPlain = useCallback(() => {
    navigator.clipboard.writeText(answerPlainText(answer)).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => setOutcome({ kind: 'error', label: 'Could not copy. Select the answer and copy it instead.' }),
    )
  }, [answer])

  return (
    <div className="la-action-items-panel la-share-panel" role="region" aria-label="Share this answer">
      <div className="la-action-items-header">
        <Share2 size={14} />
        <span>Share this answer</span>
      </div>
      <div className="la-action-items-list">
        <button type="button" className="la-action-item" onClick={handlePrint}>
          <Printer size={14} />
          <span className="la-action-item-text">
            Print or save as PDF
            <span className="la-share-hint">Your browser&apos;s print dialog can also save it as a PDF</span>
          </span>
        </button>
        <button type="button" className="la-action-item" onClick={handleCopyPlain}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span className="la-action-item-text">
            {copied ? 'Copied' : 'Copy as plain text'}
            <span className="la-share-hint">No formatting marks, ready to paste anywhere</span>
          </span>
        </button>
      </div>
      {outcome.kind !== 'idle' && (
        <div className={`la-share-status la-share-status-${outcome.kind}`} role="status" aria-live="polite">
          <span>{outcome.label}</span>
        </div>
      )}
    </div>
  )
}

export default AnswerSharePanel
