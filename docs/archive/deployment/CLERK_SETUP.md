# Clerk Authentication Setup Guide

This guide explains how to set up Clerk authentication for the Entomate application.

## Overview

Entomate now uses Clerk for authentication instead of Supabase Auth. Clerk provides a complete authentication solution with support for:
- Email/password authentication
- Social logins (Google, GitHub, etc.)
- User management
- Session management
- Multi-factor authentication

## Prerequisites

1. A Clerk account (sign up at https://clerk.com)
2. A Clerk application created in your Clerk dashboard

## Setup Steps

### 1. Create a Clerk Application

1. Go to https://dashboard.clerk.com
2. Create a new application or select an existing one
3. Note your **Publishable Key** and **Secret Key** from the API Keys section

### 2. Configure Environment Variables

#### Frontend (.env or .env.local)

Add the following to your frontend environment file:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

#### Backend (.env)

Add the following to your backend environment file:

```env
CLERK_SECRET_KEY=sk_test_...
```

**Important:** Never commit these keys to version control. Use environment variables or a secrets management system.

### 3. Configure Clerk Dashboard

1. Go to your Clerk dashboard
2. Navigate to **Settings** > **Paths**
3. Configure the following paths:
   - Sign-in path: `/sign-in`
   - Sign-up path: `/sign-up`
   - After sign-in redirect: `/dashboard`
   - After sign-up redirect: `/dashboard`

4. Navigate to **Settings** > **Domains**
5. Add your application domains (e.g., `localhost:5173` for development, your production domain)

### 4. Optional: Configure Social Logins

1. In Clerk dashboard, go to **User & Authentication** > **Social Connections**
2. Enable the providers you want (Google, GitHub, etc.)
3. Configure OAuth credentials for each provider

### 5. User Metadata (Optional)

If you need to store custom user metadata (like roles or team IDs), you can set them in Clerk:

- Go to **User & Authentication** > **Metadata**
- Add custom fields as needed
- Access them in the backend via `user.publicMetadata`

## How It Works

### Frontend

1. **ClerkProvider**: Wraps the entire app in `main.jsx` to provide Clerk context
2. **Protected Routes**: The `ProtectedRoute` component checks authentication before rendering protected pages
3. **Sign In/Up Pages**: Dedicated pages at `/sign-in` and `/sign-up` using Clerk's pre-built components
4. **API Integration**: The `ClerkAuthProvider` component sets up token retrieval for API calls
5. **User Button**: The `UserButton` component in the Layout provides user menu and sign-out

### Backend

1. **Auth Middleware**: The `authenticate` middleware verifies Clerk JWT tokens
2. **Token Verification**: Uses Clerk's SDK to verify tokens and extract user information
3. **User Object**: Attaches user information to `req.user` for use in route handlers

## API Usage

### Frontend

The API service automatically includes Clerk tokens in requests:

```javascript
import api from './services/api'

// Token is automatically added to headers
const data = await api.get('/some-endpoint')
```

For manual fetch calls, use the `useAuth` hook:

```javascript
import { useAuth } from '@clerk/clerk-react'

function MyComponent() {
  const { getToken } = useAuth()
  
  const fetchData = async () => {
    const token = await getToken()
    const response = await fetch('/api/endpoint', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
  }
}
```

### Backend

Protected routes automatically have access to user information:

```javascript
// In a route handler
app.get('/api/protected', authenticate, (req, res) => {
  // req.user contains:
  // - id: Clerk user ID
  // - email: User email
  // - firstName: User first name
  // - lastName: User last name
  // - role: From publicMetadata (default: 'member')
  // - teamId: From publicMetadata (default: 'default')
  
  res.json({ user: req.user })
})
```

## Migration from Supabase Auth

If you were previously using Supabase Auth:

1. **User Data**: You'll need to migrate existing users to Clerk or set up a migration script
2. **Tokens**: All existing tokens will be invalid - users will need to sign in again
3. **Metadata**: User roles and team IDs should be set in Clerk's `publicMetadata`

## Troubleshooting

### "Clerk token not available" errors

- Ensure `VITE_CLERK_PUBLISHABLE_KEY` is set in frontend
- Ensure `CLERK_SECRET_KEY` is set in backend
- Check that ClerkProvider is wrapping your app
- Verify the user is signed in

### Authentication not working

- Check browser console for Clerk errors
- Verify domain is added in Clerk dashboard
- Check that paths are configured correctly in Clerk dashboard
- Ensure environment variables are loaded correctly

### Backend authentication failures

- Verify `CLERK_SECRET_KEY` is correct
- Check that tokens are being sent in Authorization header
- Review backend logs for detailed error messages

## Security Best Practices

1. **Never expose secret keys** in frontend code
2. **Use environment variables** for all keys
3. **Enable HTTPS** in production
4. **Set up proper CORS** configuration
5. **Use Clerk's built-in security features** (rate limiting, etc.)
6. **Regularly rotate keys** if compromised

## Additional Resources

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk React SDK](https://clerk.com/docs/references/react/overview)
- [Clerk Node.js SDK](https://clerk.com/docs/references/backend-api/overview)

