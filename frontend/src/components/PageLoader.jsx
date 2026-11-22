import React from 'react'
import EnhancedLoadingScreen from './EnhancedLoadingScreen'

// Suspense fallback while a page's code loads.
export default function PageLoader() {
  return <EnhancedLoadingScreen stage="page" />
}
