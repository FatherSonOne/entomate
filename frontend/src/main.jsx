import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
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
import './styles/themes/void-crimson.css'

// Import main CSS (contains defaults and base styles)
import './styles/main.css'

// Import Void × Crimson component system
import './styles/vc-components.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>
)
