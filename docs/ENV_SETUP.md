# Environment Variables Setup Guide

This guide explains how to set up environment variables for the Entomate application.

## Quick Start

1. **Frontend Setup:**
   ```bash
   cd frontend
   cp env.example .env.local
   # Edit .env.local and add your Clerk publishable key
   ```

2. **Backend Setup:**
   ```bash
   cd backend
   cp env.example .env
   # Edit .env and add your Clerk secret key and other configuration
   ```

## Required Variables

### Frontend (`.env.local` or `.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key from dashboard | ✅ Yes |
| `VITE_API_URL` | Backend API URL (optional, uses proxy if empty) | ❌ No |

### Backend (`.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `CLERK_SECRET_KEY` | Clerk secret key from dashboard | ✅ Yes |
| `PORT` | Server port (default: 3000) | ❌ No |
| `NODE_ENV` | Environment (development/production) | ❌ No |
| `FRONTEND_URL` | Frontend URL for CORS | ✅ Yes |
| `SESSION_SECRET` | Secret for session cookies | ✅ Yes |
| `SUPABASE_URL` | Supabase project URL | ⚠️ If using Supabase |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | ⚠️ If using Supabase |
| `SUPABASE_SERVICE_KEY` | Supabase service key | ⚠️ If using Supabase |

## Getting Your Clerk Keys

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application (or create a new one)
3. Go to **API Keys** section
4. Copy:
   - **Publishable Key** → Use in frontend as `VITE_CLERK_PUBLISHABLE_KEY`
   - **Secret Key** → Use in backend as `CLERK_SECRET_KEY`

## Security Notes

⚠️ **IMPORTANT:**
- Never commit `.env` or `.env.local` files to version control
- The `CLERK_SECRET_KEY` and `SUPABASE_SERVICE_KEY` are sensitive - keep them secret
- The `VITE_CLERK_PUBLISHABLE_KEY` is safe to expose in frontend code
- Use different keys for development and production environments

## File Locations

- **Frontend:** `frontend/.env.local` or `frontend/.env`
- **Backend:** `backend/.env`

## Example Files

Template files are provided:
- `frontend/env.example` - Frontend environment template
- `backend/env.example` - Backend environment template

Copy these to create your actual `.env` files and fill in your values.

## Troubleshooting

### "Clerk token not available" errors
- Check that `VITE_CLERK_PUBLISHABLE_KEY` is set correctly in frontend
- Verify the key starts with `pk_test_` or `pk_live_`

### Backend authentication failures
- Verify `CLERK_SECRET_KEY` is set correctly in backend
- Check that the key starts with `sk_test_` or `sk_live_`
- Ensure the key matches the publishable key's environment (test/live)

### CORS errors
- Set `FRONTEND_URL` in backend `.env` to match your frontend URL
- For multiple origins, use `CORS_ORIGINS` with comma-separated values

For more detailed Clerk setup instructions, see [docs/CLERK_SETUP.md](docs/CLERK_SETUP.md).

