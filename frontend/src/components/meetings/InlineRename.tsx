import React, { useEffect, useRef, useState } from 'react'
import { Key } from '../bench'

export interface InlineRenameProps {
  /** The current (auto) title, shown as the placeholder. */
  title: string
  /** Save the new name; reject to keep the field open with an error. */
  onSave: (title: string) => Promise<void>
}

/**
 * A "Rename" key beside a made-up meeting title. One click turns it into a
 * field: Enter saves, Esc or a blank name cancels.
 */
export function InlineRename({ title, onSave }: InlineRenameProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  const close = (): void => { setOpen(false); setValue(''); setError(null) }

  const save = async (): Promise<void> => {
    const next = value.trim()
    if (!next || next === title) { close(); return }
    setBusy(true)
    setError(null)
    try {
      await onSave(next)
      close()
    } catch {
      setError('Could not rename. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Key size="sm" className="bs-mtg-rename" onClick={() => setOpen(true)} aria-label={`Rename ${title}`}>
        Rename
      </Key>
    )
  }

  return (
    <form
      className="bs-mtg-renamer"
      onSubmit={(e) => { e.preventDefault(); void save() }}
    >
      <input
        ref={inputRef}
        className="bs-mtg-rename-in"
        value={value}
        placeholder={title}
        aria-label="New meeting name"
        disabled={busy}
        maxLength={200}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() } }}
        onBlur={() => { if (!busy && !value.trim()) close() }}
      />
      <Key size="sm" type="submit" disabled={busy}>Save</Key>
      {error && <span role="alert" className="bs-mtg-rename-err">{error}</span>}
    </form>
  )
}

export default InlineRename
