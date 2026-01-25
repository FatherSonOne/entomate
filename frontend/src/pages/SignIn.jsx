import { SignIn } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'

export default function SignInPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-base p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg mb-4" style={{ backgroundColor: 'var(--highlight-color)' }}>
            <span className="text-white font-bold text-2xl font-mono">E</span>
          </div>
          <h1 className="text-3xl font-bold text-content-primary mb-2">Welcome to Entomate</h1>
          <p className="text-content-secondary">Sign in to continue</p>
        </div>
        <div className="flex justify-center">
          <SignIn
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            afterSignInUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: 'mx-auto',
                card: 'shadow-lg',
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}

