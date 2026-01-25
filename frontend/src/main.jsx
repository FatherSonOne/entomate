import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App'
import ClerkAuthProvider from './components/ClerkAuthProvider'
import { ThemeProvider } from './context/ThemeContext'

// Import brand theme CSS files first (Vite doesn't process @import in CSS)
import './styles/themes/synapse.css'
import './styles/themes/blueprint.css'
import './styles/themes/velocity.css'
import './styles/themes/neon-district.css'
import './styles/themes/serif-scholar.css'
import './styles/themes/aurora.css'
import './styles/themes/monolith.css'
import './styles/themes/horizon.css'
import './styles/themes/pastel-zen.css'
import './styles/themes/playground.css'

// Import main CSS (contains defaults and base styles)
import './styles/main.css'

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key')
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <ClerkAuthProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </ClerkAuthProvider>
    </ClerkProvider>
  </React.StrictMode>
)
