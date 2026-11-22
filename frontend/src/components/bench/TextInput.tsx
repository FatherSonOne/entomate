import React, { forwardRef } from 'react'
import { cx } from './cx'

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Leading glyph (a search icon). */
  icon?: React.ReactNode
}

/** A sunk input: the bench's text field. */
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { icon, className, type = 'text', ...rest },
  ref
) {
  if (!icon) return <input ref={ref} type={type} className={cx('bs-input', className)} {...rest} />
  return (
    <span className={cx('bs-input-wrap', className)}>
      <span className="bs-input-icon" aria-hidden="true">{icon}</span>
      <input ref={ref} type={type} className="bs-input" {...rest} />
    </span>
  )
})

export type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

/** Multi-line sunk field. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx('bs-input', 'bs-textarea', className)} {...rest} />
})
