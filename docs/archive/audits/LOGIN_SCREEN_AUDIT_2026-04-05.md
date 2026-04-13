# LOGIN SCREEN AUDIT — 2026-04-05

## Files Identified

| File | Lines | Role |
|------|-------|------|
| `frontend/src/pages/SignIn.jsx` | 656 | Main sign-in page (component + inline CSS) |
| `frontend/src/pages/AuthCallback.jsx` | 65 | OAuth redirect handler |
| `frontend/src/contexts/AuthContext.jsx` | 130 | Auth state provider |
| `frontend/src/services/authService.js` | 102 | Supabase auth wrapper |
| `frontend/src/services/supabaseClient.js` | 11 | Supabase client init |
| `frontend/src/App.jsx` | ~70 (routes) | Route definitions |

## Architecture

```
                    ┌──────────────────┐
                    │    App.jsx       │
                    │  /sign-in route  │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   SignIn.jsx      │
                    │  (Login Page)     │
                    └──┬──────────┬────┘
                       │          │
              Google   │          │  Email/Password
              OAuth    │          │
                       │          │
              ┌────────▼──┐  ┌───▼───────────┐
              │ authService│  │  authService   │
              │ signInWith │  │  signIn /      │
              │ OAuth()    │  │  signUp()      │
              └────────┬───┘  └───┬───────────┘
                       │          │
              ┌────────▼──────────▼───┐
              │   supabase.auth       │
              │   (Supabase Client)   │
              └───────────────────────┘
                       │
              ┌────────▼──────────────┐
              │  AuthCallback.jsx     │
              │  /auth/callback       │
              │  (OAuth redirect)     │
              └───────────────────────┘
```

## Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Google OAuth sign-in | ✅ Working | Calls `signInWithOAuth('google')`, redirects to `/auth/callback` |
| Email/password sign-in | ✅ Working | Uses `signInWithPassword`, error handling in place |
| Email/password sign-up | ✅ Working | Name + email + password, passes metadata |
| Toggle sign-in / sign-up | ✅ Working | Switches form mode with state |
| Auth callback handler | ✅ Working | Picks up tokens from URL hash, redirects to `/dashboard` |
| Session detection + redirect | ✅ Working | `isSignedIn` check redirects to `/dashboard` |
| Loading states + spinners | ✅ Working | Per-method loading indicators |
| Error display | ✅ Working | Error banner with clear styling |
| Responsive layout | ✅ Working | Brand panel hides at `<800px` |
| `prefers-reduced-motion` | ✅ Working | Disables animations |
| Dark mode design | ✅ Working | Dark-only (no light mode toggle needed for login) |

## Issues Found

### 🔴 Critical — False Information

#### 1. "24+ native integrations" — FALSE
**Location:** `SignIn.jsx:96`
```jsx
'24+ native integrations',
```
**Reality:** The landing page, metrics section, and all other references consistently say **7+ integrations** (Slack, Salesforce, HubSpot, Google Calendar, Webhooks, Email, Cron). The sign-in page inflates this number by 3.4x.

**Fix:** Change to `'7+ native integrations'`

### 🟡 Medium

#### 2. `/terms` and `/privacy` routes do not exist
**Location:** `SignIn.jsx:251-253, 264`
```jsx
<a href="/terms">Terms of Service</a>
<a href="/privacy">Privacy Policy</a>
```
**Reality:** `App.jsx` has no `/terms` or `/privacy` routes. These links lead to the `NotFound` (404) page. The "Privacy Policy" link in the security badges section has the same problem.

**Fix:** Either create placeholder pages or link to external URLs. For now, these could link to `#` with a `(coming soon)` note, or to an external policy host.

#### 3. "Back to home" link styling could be missed
The `← Back to home` link at the top of the auth panel uses a very low opacity (`rgba(255,248,250,0.4)`) which is barely visible. It's functional but could cause accessibility contrast issues.

### 🟢 Nice-to-Have

#### 4. No "forgot password" flow
There's no password reset link in the email sign-in form. Supabase supports `resetPasswordForEmail()` but it's not wired up.

#### 5. No email confirmation feedback
After sign-up, there's no message telling the user to check their email for confirmation (if Supabase email confirmation is enabled).

#### 6. Inline CSS is 380+ lines
The entire stylesheet is embedded in the component's JSX. Works fine but makes the component 656 lines. Not a bug, just a maintenance note.

---

## Revisal Plan

### Phase 1: Fix False Information (Critical)

1. **Fix integration count** — Change `'24+ native integrations'` to `'7+ native integrations'` in `SignIn.jsx:96`

### Phase 2: Fix Broken Links

2. **Fix Terms/Privacy links** — Either:
   - Create `/terms` and `/privacy` routes with placeholder content, OR
   - Point links to external URLs (e.g., `https://entomate.app/terms`)

### Phase 3: Polish (Optional)

3. Add "Forgot password?" link to email form
4. Add post-signup confirmation message
5. Improve "Back to home" link contrast

---

## Claude Agent Prompt

```
You are fixing the Entomate login screen. The project is at f:\entomate.

TASK 1 — Fix false integration count (CRITICAL):
- File: frontend/src/pages/SignIn.jsx, line 96
- Change '24+ native integrations' to '7+ native integrations'
- The landing page (LandingPage.jsx) consistently says "7+" — the sign-in page must match

TASK 2 — Fix dead Terms/Privacy links:
- File: frontend/src/pages/SignIn.jsx, lines 251-253 and 264
- The /terms and /privacy routes don't exist in App.jsx
- Replace href="/terms" and href="/privacy" with "#" and add onClick handlers
  that show a toast or modal saying "Coming soon"
- OR create minimal placeholder route components

No other changes needed. Do not refactor the CSS or restructure the component.
```
