# Entomate — Google / Microsoft / Apple OAuth Wiring

## Context

Entomate is a Node.js/Express + React (Vite) application.
- Backend: `f:\entomate\backend\`
- Frontend: `f:\entomate\frontend\`
- Auth currently uses **Clerk** (see `frontend/src/main.jsx`)
- Login UI is at `frontend/src/` (or can be the static `output/landing/login.html` promoted to a React route)
- The login screen (`output/landing/login.html`) already has Google, Microsoft, and Apple OAuth buttons wired to placeholder handlers

**Goal:** Wire all three OAuth providers so clicking each button completes the full sign-in flow and redirects to `/dashboard`.

---

## Option 1 — Clerk (Recommended, Already Installed)

Clerk already handles Google, Microsoft (Azure AD), and Apple OAuth out of the box.
The wiring is configuration, not code.

### Step 1 — Enable providers in Clerk Dashboard

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com)
2. Select your Entomate application
3. Navigate to **User & Authentication → Social Connections**
4. Enable:
   - ✅ **Google** — paste your Google OAuth Client ID + Secret
   - ✅ **Microsoft** — paste your Azure App Client ID + Secret
   - ✅ **Apple** — upload your Apple `.p8` key file + Key ID + Team ID

### Step 2 — Google OAuth credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (or use existing)
3. APIs & Services → Credentials → Create OAuth 2.0 Client ID
4. Application type: **Web application**
5. Authorized redirect URIs — add Clerk's callback URL:
   ```
   https://accounts.<your-clerk-domain>.clerk.accounts.dev/v1/oauth_callback
   ```
   (Clerk Dashboard → Configure → Domains shows your exact URL)
6. Copy **Client ID** and **Client Secret** → paste into Clerk Dashboard

### Step 3 — Microsoft OAuth credentials

1. Go to [portal.azure.com](https://portal.azure.com) → Azure Active Directory → App registrations
2. New registration → Name: "Entomate", Supported accounts: **Multitenant**
3. Redirect URI: Web → `https://accounts.<your-clerk-domain>.clerk.accounts.dev/v1/oauth_callback`
4. Copy **Application (client) ID** → Clerk Dashboard
5. Certificates & secrets → New client secret → copy value → Clerk Dashboard

### Step 4 — Apple OAuth credentials

1. Go to [developer.apple.com](https://developer.apple.com) → Certificates, Identifiers & Profiles
2. Create a **Services ID** (not App ID) — this is your Client ID (e.g., `com.entomate.login`)
3. Enable **Sign In with Apple** on that Services ID
4. Configure redirect URL: `https://accounts.<your-clerk-domain>.clerk.accounts.dev/v1/oauth_callback`
5. Keys → Create new key → enable Sign in with Apple → download `.p8` file
6. Note your **Key ID** and **Team ID**
7. Upload `.p8` + Key ID + Team ID → Clerk Dashboard

### Step 5 — Update React Login component

In the existing Clerk-powered login page, replace the button `onClick` handlers:

```jsx
import { useSignIn } from '@clerk/clerk-react'

function LoginPage() {
  const { signIn } = useSignIn()

  const handleGoogle = () =>
    signIn.authenticateWithRedirect({
      strategy: 'oauth_google',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/dashboard',
    })

  const handleMicrosoft = () =>
    signIn.authenticateWithRedirect({
      strategy: 'oauth_microsoft',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/dashboard',
    })

  const handleApple = () =>
    signIn.authenticateWithRedirect({
      strategy: 'oauth_apple',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/dashboard',
    })

  return (
    // ... existing JSX ...
    // Replace onClick on each button with the handler above
  )
}
```

### Step 6 — SSO callback route

Add a callback route to `frontend/src/App.jsx` or your router:

```jsx
import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react'

// In your routes:
<Route path="/sso-callback" element={<AuthenticateWithRedirectCallback />} />
```

### Step 7 — Test locally

```bash
# Start dev servers
cd backend && node server.js
cd frontend && npm run dev

# Test each provider:
# 1. Click "Continue with Google" → Google consent screen → redirect to /dashboard
# 2. Click "Continue with Microsoft" → Microsoft login → redirect to /dashboard
# 3. Click "Continue with Apple" → Apple ID → redirect to /dashboard
```

---

## Option 2 — Passport.js (Custom, Without Clerk)

If you want to remove Clerk and handle OAuth directly with Passport:

### Install

```bash
cd backend
npm install passport passport-google-oauth20 passport-microsoft passport-apple express-session
```

### Backend: `backend/routes/auth.js`

```javascript
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const MicrosoftStrategy = require('passport-microsoft').Strategy

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  '/auth/google/callback',
}, (accessToken, refreshToken, profile, done) => {
  // Find or create user in Supabase
  return done(null, profile)
}))

passport.use(new MicrosoftStrategy({
  clientID:     process.env.MICROSOFT_CLIENT_ID,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  callbackURL:  '/auth/microsoft/callback',
  scope:        ['user.read'],
}, (accessToken, refreshToken, profile, done) => {
  return done(null, profile)
}))

// Routes
router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }))

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => res.redirect('/dashboard'))

router.get('/auth/microsoft',
  passport.authenticate('microsoft'))

router.get('/auth/microsoft/callback',
  passport.authenticate('microsoft', { failureRedirect: '/login' }),
  (req, res) => res.redirect('/dashboard'))
```

### Environment variables to add

```bash
# .env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
MICROSOFT_CLIENT_ID=your-azure-app-id
MICROSOFT_CLIENT_SECRET=your-azure-client-secret
APPLE_CLIENT_ID=com.entomate.login
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_PRIVATE_KEY_PATH=./keys/AuthKey_XXXXXXXX.p8
SESSION_SECRET=a-long-random-string-here
```

### Frontend: wire button onClick

```javascript
// In login.html or LoginPage.jsx — replace placeholder handlers:
document.getElementById('btn-google').addEventListener('click', () => {
  window.location.href = '/auth/google'
})
document.getElementById('btn-microsoft').addEventListener('click', () => {
  window.location.href = '/auth/microsoft'
})
document.getElementById('btn-apple').addEventListener('click', () => {
  window.location.href = '/auth/apple'
})
```

---

## Recommendation

**Use Option 1 (Clerk)** — it's already installed, handles token refresh, session management,
webhook events, and user management. The only work is enabling providers in the dashboard
and adding 3 `authenticateWithRedirect` calls to the React login component.

Estimated time:
- Clerk dashboard config: ~30 min per provider (mostly waiting for credentials)
- Code changes: ~15 min total

---

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/pages/Login.jsx` (or create) | Add Clerk `useSignIn` + 3 OAuth handlers |
| `frontend/src/App.jsx` | Add `/sso-callback` route |
| `frontend/src/main.jsx` | Verify `ClerkProvider` is wrapping app (already done) |
| `.env` | Add OAuth credentials |
| Clerk Dashboard | Enable Google / Microsoft / Apple providers |

---

## Login Screen

The styled login screen is at: `output/landing/login.html`
To promote to a React route, convert to `frontend/src/pages/Login.jsx`
and replace the `<button>` onClick handlers with the Clerk OAuth calls above.
