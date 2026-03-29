import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './components/vc/ToastProvider'
import { ConfirmProvider } from './components/vc/ConfirmDialog'

// Import main CSS (contains defaults and base styles)
import './styles/main.css'

// Import Void × Crimson component system
import './styles/vc-components.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
