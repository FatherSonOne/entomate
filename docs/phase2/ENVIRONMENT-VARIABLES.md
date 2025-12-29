# Environment Variables - Phase 2

## Required Variables

### Supabase
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
- **VITE_SUPABASE_URL**: Supabase project URL
- **VITE_SUPABASE_ANON_KEY**: Public anon key for client-side access

### Google AI (Gemini)
```env
GEMINI_API_KEY=your-gemini-api-key
```
- Used for: Meeting transcription, sentiment analysis, action item extraction, RAG generation

---

## Optional Variables (Phase 2 Integrations)

### Logos Vision CRM
```env
LOGOS_VISION_BASE_URL=https://api.logosvision.com
LOGOS_VISION_API_KEY=your-crm-api-key
```
- **Required for**: Deal sync, CRM task creation
- **Used by**: Deal Risk Monitor agent, sync_to_crm action

### Pulse Messaging
```env
PULSE_BASE_URL=https://api.pulse.example.com
PULSE_API_KEY=your-pulse-api-key
```
- **Required for**: Team notifications, post_to_pulse action
- **Used by**: All agents that send Pulse messages

### Redis (Optional Queue)
```env
REDIS_URL=redis://localhost:6379
```
- **Required for**: Job queue (BullMQ) if implemented
- **Not required**: If using synchronous agent execution

---

## Development vs Production

### Development (.env.local)
```env
# Supabase (dev project)
VITE_SUPABASE_URL=https://dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=dev-anon-key

# Gemini
GEMINI_API_KEY=your-dev-api-key

# Optional: Mock external services
LOGOS_VISION_BASE_URL=http://localhost:4000/mock-crm
PULSE_BASE_URL=http://localhost:4000/mock-pulse

# Agent safety
AGENTS_DRY_RUN=true
```

### Production (.env.production)
```env
# Supabase (prod project)
VITE_SUPABASE_URL=https://prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=prod-anon-key

# Gemini
GEMINI_API_KEY=prod-api-key

# CRM
LOGOS_VISION_BASE_URL=https://api.logosvision.com
LOGOS_VISION_API_KEY=prod-crm-key

# Pulse
PULSE_BASE_URL=https://api.pulse.example.com
PULSE_API_KEY=prod-pulse-key

# Agent safety
AGENTS_DRY_RUN=false
```

---

## Security Notes

### Never Commit
- `.env` files
- API keys
- Credentials

### Rotation Schedule
| Variable | Rotation Frequency |
|----------|-------------------|
| GEMINI_API_KEY | Quarterly |
| LOGOS_VISION_API_KEY | Quarterly |
| PULSE_API_KEY | Quarterly |
| SUPABASE_ANON_KEY | Only if compromised |

### Access Control
- Store production secrets in secure vault (e.g., 1Password, AWS Secrets Manager)
- Use environment-specific API keys
- Rotate immediately if any key is exposed

---

## Validation

### Check Required Variables
```typescript
// src/utils/envValidation.ts
const REQUIRED_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'GEMINI_API_KEY'
];

export function validateEnv(): { valid: boolean; missing: string[] } {
  const missing = REQUIRED_VARS.filter(v => !import.meta.env[v]);
  return {
    valid: missing.length === 0,
    missing
  };
}
```

### Runtime Check
```typescript
// In app initialization
const env = validateEnv();
if (!env.valid) {
  console.error('Missing environment variables:', env.missing);
  throw new Error('Configuration incomplete');
}
```

---

## Troubleshooting

### "Supabase not connected"
- Check `VITE_SUPABASE_URL` is correct
- Check `VITE_SUPABASE_ANON_KEY` matches project

### "Gemini API error"
- Check `GEMINI_API_KEY` is valid
- Check API quota limits
- Verify API is enabled in Google Cloud Console

### "CRM sync failed"
- Check `LOGOS_VISION_BASE_URL` is reachable
- Check `LOGOS_VISION_API_KEY` has correct permissions
- Verify CRM API is not rate limiting

### "Pulse messages not sending"
- Check `PULSE_BASE_URL` is correct
- Check `PULSE_API_KEY` has write permissions
- Verify target channel exists
