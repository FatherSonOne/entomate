import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './contexts/AuthContext'
import { OrgProvider } from './contexts/OrgContext'
import { LoadingProvider } from './contexts/LoadingContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './components/vc/ToastProvider'
import { ConfirmProvider } from './components/vc/ConfirmDialog'

// Import main CSS (contains defaults and base styles)
import './styles/main.css'

// Shared motion tokens and primitives (every style uses them)
import './styles/motion.css'
import { initReduceMotion } from './components/bench/motion'

// Import Void × Crimson component system
import './styles/vc-components.css'

// Import animated icon system
import './styles/animated-icons.css'

// Held Light foundation — surface treatment behind [data-foundation="held-light"]
// (scoped rules only; inert until the flag is on)
import './styles/themes/held-light.css'

// Design styles — each scoped to html[data-style="..."], picked in
// Settings → Appearance. Bench Swiss is the default (see ThemeContext).
import './styles/themes/orbital.css'
import './styles/themes/folio.css'
import './styles/themes/bench.css'
import './styles/themes/minutes.css'
import './styles/themes/bench-swiss.css'
import './styles/design-style-picker.css'

// Settings > Appearance > Reduce motion, remembered from the last visit
initReduceMotion()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
    <LoadingProvider>
    <AuthProvider>
      <OrgProvider>
      <ThemeProvider>
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
      </OrgProvider>
    </AuthProvider>
    </LoadingProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
