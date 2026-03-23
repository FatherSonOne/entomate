import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children }) {
  const { loading, isSignedIn } = useAuth()

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
          <p className="text-content-secondary">Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect to landing/sign-in if not authenticated
  if (!isSignedIn) {
    return <Navigate to="/" replace />
  }

  return children
}
