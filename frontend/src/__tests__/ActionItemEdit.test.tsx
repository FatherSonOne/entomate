import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import ActionItemEdit from '../components/tasks/ActionItemEdit'
import { fromActionItem } from '../services/tasksView'

const updateActionItem = vi.hoisted(() => vi.fn())
vi.mock('../services/api', () => ({ meetingsApi: { updateActionItem } }))

test('saves a priority correction from the edit drawer', async () => {
  const row = { id: 'item-1', task_description: 'Review invoices', priority: 'high', updated_at: '2026-11-24T05:00:00Z' }
  const saved = { ...row, priority: 'low' }
  const onSaved = vi.fn()
  updateActionItem.mockResolvedValue(saved)
  render(<ActionItemEdit item={fromActionItem(row)} onSaved={onSaved} onClose={vi.fn()} />)

  const priority = screen.getByRole('combobox', { name: 'Priority' })
  expect(priority).toHaveValue('high')
  fireEvent.change(priority, { target: { value: 'low' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save action item' }))

  expect(updateActionItem).toHaveBeenCalledWith('item-1', { priority: 'low', version: row.updated_at })
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
})
