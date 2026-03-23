import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg0)',
          color: 'var(--t0)',
          padding: '2rem'
        }}>
          <div className="vc" style={{
            maxWidth: 480,
            padding: '2.5rem',
            textAlign: 'center',
            borderRadius: 12
          }}>
            <div style={{ fontSize: 48, marginBottom: '1rem', opacity: 0.5 }}>!</div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              Something went wrong
            </h1>
            <p style={{ color: 'var(--t1)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              An unexpected error occurred. Try reloading the page.
            </p>
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <pre style={{
                textAlign: 'left',
                fontSize: '0.75rem',
                background: 'var(--bg1)',
                padding: '1rem',
                borderRadius: 8,
                overflow: 'auto',
                marginBottom: '1.5rem',
                color: 'var(--c)',
                maxHeight: 200
              }}>
                {this.state.error.toString()}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="vc-btn vc-btn-primary"
              style={{ padding: '0.5rem 1.5rem' }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
