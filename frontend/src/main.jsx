import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App'
import ClerkAuthProvider from './components/ClerkAuthProvider'
import { ThemeProvider } from './context/ThemeContext'
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
