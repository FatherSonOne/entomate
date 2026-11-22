import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom'
import { describe, test, expect, beforeEach } from 'vitest'
import { Breadcrumbs } from '../components/bench/Breadcrumbs'
import NavTrailRecorder from '../components/NavTrailRecorder'
import { recordNavigation, rememberLabel, trailFor } from '../services/navTrail'

const loc = (path: string) => {
  const [pathname, q] = path.split('?')
  return { pathname: pathname as string, search: q ? `?${q}` : '' }
}

beforeEach(() => sessionStorage.clear())

describe('navTrail', () => {
  test('a detail page with no trail leads to its section', () => {
    expect(trailFor('/meetings/m1')).toEqual([{ to: '/meetings', label: 'Meetings' }])
    expect(trailFor('/projects/p1')).toEqual([{ to: '/projects', label: 'Projects' }])
    expect(trailFor('/tasks')).toEqual([])
  })

  test('a meeting opened from Tasks leads back to Tasks, keeping its filters', () => {
    recordNavigation(loc('/tasks?view=lanes'), loc('/meetings/m1'), 'PUSH', false)
    expect(trailFor('/meetings/m1')).toEqual([{ to: '/tasks?view=lanes', label: 'Tasks' }])
  })

  test('a meeting opened from a project shows Projects / project', () => {
    rememberLabel('/projects/p1', 'Acme rollout')
    recordNavigation(loc('/projects/p1'), loc('/meetings/m1'), 'PUSH', false)
    expect(trailFor('/meetings/m1')).toEqual([
      { to: '/projects', label: 'Projects' },
      { to: '/projects/p1', label: 'Acme rollout' },
    ])
  })

  test('crumb clicks and back/forward keep the trail', () => {
    recordNavigation(loc('/projects/p1'), loc('/meetings/m1'), 'PUSH', false)
    recordNavigation(loc('/dashboard'), loc('/projects/p1'), 'PUSH', false)
    // Crumb from the meeting back up to its project: the project keeps Today as its origin.
    recordNavigation(loc('/meetings/m1'), loc('/projects/p1'), 'PUSH', true)
    expect(trailFor('/projects/p1')).toEqual([{ to: '/dashboard', label: 'Today' }])
    recordNavigation(loc('/projects/p1'), loc('/meetings/m1'), 'POP', false)
    expect(trailFor('/meetings/m1')[1]?.to).toBe('/projects/p1')
  })

  test('an origin that is not a page in the trail falls back to the section', () => {
    recordNavigation(loc('/tasks'), loc('/meetings/m1'), 'PUSH', false)
    recordNavigation(loc('/settings'), loc('/meetings/m1'), 'PUSH', false)
    expect(trailFor('/meetings/m1')).toEqual([{ to: '/meetings', label: 'Meetings' }])
  })
})

describe('Breadcrumbs', () => {
  test('follows the page the meeting was opened from, and links back to it', () => {
    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <NavTrailRecorder />
        <Routes>
          <Route path="/tasks" element={<Link to="/meetings/m1">Open meeting</Link>} />
          <Route path="/meetings/:id" element={<Breadcrumbs current="Weekly sync" />} />
        </Routes>
      </MemoryRouter>,
    )
    act(() => { fireEvent.click(screen.getByText('Open meeting')) })

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(nav).toBeInTheDocument()
    const back = screen.getByRole('link', { name: /Tasks/ })
    expect(back).toHaveAttribute('href', '/tasks')
    expect(screen.getByText('Weekly sync').closest('li')).toHaveAttribute('aria-current', 'page')

    act(() => { fireEvent.click(back) })
    expect(screen.getByText('Open meeting')).toBeInTheDocument()
  })
})
