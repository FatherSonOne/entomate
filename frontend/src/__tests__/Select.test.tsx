import React, { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi, beforeAll } from 'vitest'
import { Select } from '../components/bench/Select'

const SCOPES = [
  { value: 'organized', label: 'Meetings I organise' },
  { value: 'accepted', label: 'Meetings I accepted' },
  { value: 'all', label: 'All meetings' },
  { value: 'none', label: 'None', disabled: true },
]

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

function Harness({ onChange }: { onChange?: (v: string) => void }) {
  const [v, setV] = useState('organized')
  return <Select label="Join" value={v} options={SCOPES} onChange={(next) => { setV(next); onChange?.(next) }} />
}

const field = () => screen.getByRole('combobox', { name: 'Join' })

describe('Select', () => {
  test('shows the chosen label and opens on click with that row marked', () => {
    render(<Harness />)
    expect(field()).toHaveTextContent('Meetings I organise')
    fireEvent.click(field())
    expect(field()).toHaveAttribute('aria-expanded', 'true')
    const chosen = screen.getByRole('option', { name: 'Meetings I organise' })
    expect(chosen).toHaveAttribute('aria-selected', 'true')
    expect(field()).toHaveAttribute('aria-activedescendant', chosen.id)
  })

  test('arrow keys move, Enter picks and closes', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('accepted')
    expect(field()).toHaveAttribute('aria-expanded', 'false')
    expect(field()).toHaveTextContent('Meetings I accepted')
  })

  test('skips disabled rows and stops at the ends', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    fireEvent.keyDown(field(), { key: 'End' })
    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('all')
  })

  test('typing jumps to the first match', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.keyDown(field(), { key: 'a' })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('all')
  })

  test('Esc closes without changing and does not reach outer handlers', () => {
    const outer = vi.fn()
    const onChange = vi.fn()
    render(<div onKeyDown={outer}><Harness onChange={onChange} /></div>)
    fireEvent.click(field())
    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    fireEvent.keyDown(field(), { key: 'Escape' })
    expect(field()).toHaveAttribute('aria-expanded', 'false')
    expect(onChange).not.toHaveBeenCalled()
    expect(outer).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }))
  })

  test('clicking a row picks it', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.click(field())
    fireEvent.click(screen.getByRole('option', { name: 'All meetings' }))
    expect(onChange).toHaveBeenCalledWith('all')
  })

  test('disabled does not open', () => {
    render(<Select label="Join" value="all" options={SCOPES} onChange={() => {}} disabled />)
    fireEvent.click(field())
    expect(field()).toHaveAttribute('aria-expanded', 'false')
  })
})
