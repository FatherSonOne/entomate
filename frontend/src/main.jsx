import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import AccountLogoSync from './components/AccountLogoSync'
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
import { installIconDraw } from './components/bench/iconDraw'
import { initBoot } from './services/bootProgress'
import { installChunkReload } from './services/chunkReload'
import { initMonitoring } from './services/monitoring'

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
// A tab left open across a deploy reloads onto the new build instead of erroring
installChunkReload()
// Sentry, when VITE_SENTRY_DSN is set (loads after first paint)
initMonitoring()
initReduceMotion()
installIconDraw()

// First load into the app: the loading screen reports real stages (services/bootProgress)
initBoot()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary scope="app">
    <LoadingProvider>
    <AuthProvider>
      <AccountLogoSync />
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
