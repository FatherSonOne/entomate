import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import EnhancedLoadingScreen from './EnhancedLoadingScreen'
import { BootMark } from './BootLoader'
import { signInPath } from '../services/authDestination'

export default function ProtectedRoute({ children }) {
  const { loading, isSignedIn } = useAuth()
  const { pathname, search, hash } = useLocation()

  if (loading) {
    return <EnhancedLoadingScreen stage="session" />
  }

  if (!isSignedIn) {
    return <Navigate to={signInPath(pathname + search + hash)} replace />
  }

  return <><BootMark stage="session" />{children}</>
}
