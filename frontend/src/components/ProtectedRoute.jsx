import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import EnhancedLoadingScreen from './EnhancedLoadingScreen'

export default function ProtectedRoute({ children }) {
  const { loading, isSignedIn } = useAuth()

  if (loading) {
    return <EnhancedLoadingScreen autoAnimate />
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />
  }

  return children
}
