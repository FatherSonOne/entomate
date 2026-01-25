import { SignUp } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'

export default function SignUpPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-base p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg mb-4" style={{ backgroundColor: 'var(--highlight-color)' }}>
            <span className="text-white font-bold text-2xl font-mono">E</span>
          </div>
          <h1 className="text-3xl font-bold text-content-primary mb-2">Join Entomate</h1>
          <p className="text-content-secondary">Create your account to get started</p>
        </div>
        <div className="flex justify-center">
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            afterSignUpUrl="/dashboard"
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

