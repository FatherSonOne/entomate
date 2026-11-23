import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
vi.mock('../services/api', () => ({ default: {}, searchApi: {} }))
import { useNavigationShortcuts } from '../hooks/useNavigationShortcuts'

test('peek resets on release and lost focus, shortcuts honor typing and role restrictions', () => {
  const navigate = vi.fn()
  function Harness() {
    const held = useNavigationShortcuts(navigate, false)
    return <><p data-testid="held">{String(held)}</p><input aria-label="Editor" /></>
  }
  render(<Harness />)
  fireEvent.keyDown(window, { key: 'Control', ctrlKey: true })
  expect(screen.getByTestId('held')).toHaveTextContent('true')
  fireEvent.keyDown(window, { key: '4', ctrlKey: true })
  expect(navigate).toHaveBeenCalledWith('/projects')
  navigate.mockClear()
  fireEvent.keyDown(screen.getByLabelText('Editor'), { key: '4', ctrlKey: true })
  fireEvent.keyDown(window, { key: '9', ctrlKey: true })
  expect(navigate).not.toHaveBeenCalled()
  const handled = new KeyboardEvent('keydown', { key: ',', ctrlKey: true, cancelable: true })
  handled.preventDefault()
  fireEvent(window, handled)
  expect(navigate).not.toHaveBeenCalled()
  fireEvent.keyUp(window, { key: 'Control', ctrlKey: false })
  expect(screen.getByTestId('held')).toHaveTextContent('false')
  fireEvent.keyDown(window, { key: 'Control', ctrlKey: true })
  fireEvent.blur(window)
  expect(screen.getByTestId('held')).toHaveTextContent('false')
})
