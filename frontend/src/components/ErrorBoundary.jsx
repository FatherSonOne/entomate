import React from 'react';
import ErrorScreen from './ErrorScreen';
import { chunkReloadPending, isChunkError, reloadForStaleChunk } from '../services/chunkReload';
import { classifyError } from '../services/errorKinds';
import { reportError } from '../services/monitoring';

/**
 * Catches render errors and shows ErrorScreen with words for the kind of
 * error (stale deploy, offline, session, access, not found, server, page).
 *
 * scope="app" (main.jsx) covers the window. scope="page" (Layout, around the
 * Outlet) keeps the shell, and resetKey (the pathname) clears it when the
 * person navigates away, so one broken page never blocks the rest.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, componentStack: undefined, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error) {
    return { error: error ?? new Error('Unknown error') };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return { error: null, componentStack: undefined, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error, errorInfo) {
    // A page chunk from an older deploy: reload once onto the new build
    if (isChunkError(error) && reloadForStaleChunk()) return;
    console.error(`[ErrorBoundary:${this.props.scope ?? 'app'}] ${classifyError(error)}:`, error, errorInfo?.componentStack);
    reportError(error, {
      source: `boundary:${this.props.scope ?? 'app'}`,
      extra: { route: window.location.pathname },
      componentStack: errorInfo?.componentStack,
    });
    this.setState({ componentStack: errorInfo?.componentStack });
  }

  retry = () => {
    this.setState({ error: null, componentStack: undefined });
  };

  render() {
    const { error, componentStack } = this.state;
    if (error) {
      // Reloading for a new deploy: keep the screen quiet instead of flashing the error
      if (chunkReloadPending() || (isChunkError(error) && reloadForStaleChunk())) {
        return <div className={this.props.scope === 'page' ? undefined : 'en-err-quiet'} aria-busy="true" />;
      }
      return (
        <ErrorScreen
          error={error}
          componentStack={componentStack}
          scope={this.props.scope ?? 'app'}
          onRetry={this.retry}
        />
      );
    }
    return this.props.children;
  }
}
