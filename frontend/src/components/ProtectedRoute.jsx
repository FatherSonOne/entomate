import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import EnhancedLoadingScreen from './EnhancedLoadingScreen'
import { BootMark } from './BootLoader'

export default function ProtectedRoute({ children }) {
  const { loading, isSignedIn } = useAuth()

  if (loading) {
    return <EnhancedLoadingScreen stage="session" />
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />
  }

  return <><BootMark stage="session" />{children}</>
}
