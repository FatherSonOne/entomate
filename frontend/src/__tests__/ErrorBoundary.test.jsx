/**
 * ErrorBoundary + ErrorScreen tests (error kinds, scopes, stale-deploy reload)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ErrorBoundary from '../components/ErrorBoundary';

function Throw({ error }) {
  throw error;
}

const realLocation = window.location;
let reloadMock;
let assignMock;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  sessionStorage.clear();
  reloadMock = vi.fn();
  assignMock = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { reload: reloadMock, assign: assignMock, pathname: '/tasks' },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', { value: realLocation, writable: true, configurable: true });
});

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(<ErrorBoundary><div>Hello World</div></ErrorBoundary>);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('shows the page-error screen with the error message under details', () => {
    render(<ErrorBoundary><Throw error={new Error('Test error')} /></ErrorBoundary>);
    expect(screen.getByRole('heading', { name: 'This page hit a problem' })).toBeInTheDocument();
    expect(screen.getByText('Error details')).toBeInTheDocument();
    expect(screen.getAllByText(/Test error/).length).toBeGreaterThan(0);
  });

  it('app scope: Try again reloads the window', () => {
    render(<ErrorBoundary scope="app"><Throw error={new Error('Test error')} /></ErrorBoundary>);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('page scope: Try again draws the page again without reloading', () => {
    let fail = true;
    function Flaky() {
      if (fail) throw new Error('once');
      return <div>Recovered</div>;
    }
    render(<ErrorBoundary scope="page"><Flaky /></ErrorBoundary>);
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Recovered')).toBeInTheDocument();
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('page scope clears when the route (resetKey) changes', () => {
    const { rerender } = render(
      <ErrorBoundary scope="page" resetKey="/tasks"><Throw error={new Error('x')} /></ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(<ErrorBoundary scope="page" resetKey="/meetings"><div>Meetings</div></ErrorBoundary>);
    expect(screen.getByText('Meetings')).toBeInTheDocument();
  });

  it('signed-out errors offer Sign in', () => {
    render(<ErrorBoundary><Throw error={Object.assign(new Error('Unauthorized'), { status: 401 })} /></ErrorBoundary>);
    expect(screen.getByRole('heading', { name: 'Your session has ended' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(assignMock).toHaveBeenCalledWith('/sign-in');
  });

  it('a stale page file reloads once quietly instead of showing the error', () => {
    const stale = new TypeError('Failed to fetch dynamically imported module: /assets/Tasks-old.js');
    render(<ErrorBoundary><Throw error={stale} /></ErrorBoundary>);
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
