# Entomate Integration Testing - Quick Reference Guide

**Last Updated:** January 24, 2026

---

## Quick Test Commands

### Test All Integrations Status
```bash
curl http://localhost:3000/api/integrations/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test CRM Integration
```bash
# Test connection
curl -X POST http://localhost:3000/api/integrations/crm/test \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check status
curl http://localhost:3000/api/integrations/crm/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Sync action items
curl -X POST http://localhost:3000/api/integrations/crm/sync-action-items \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"syncAll": false, "actionItemIds": []}'

# Get deals
curl http://localhost:3000/api/integrations/crm/deals?limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Chat Integration (Slack)
```bash
# Test connection
curl -X POST http://localhost:3000/api/slack/test \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check status
curl http://localhost:3000/api/slack/status

# List channels
curl http://localhost:3000/api/slack/channels \
  -H "Authorization: Bearer YOUR_TOKEN"

# Send test notification
curl -X POST http://localhost:3000/api/slack/notify \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "custom",
    "channel": "general",
    "data": {
      "title": "Test Notification",
      "message": "This is a test from Entomate"
    }
  }'

# Send overdue reminders
curl -X POST http://localhost:3000/api/slack/notify/overdue \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "general"}'
```

### Test Calendar Integration
```bash
# Check status
curl http://localhost:3000/api/calendar/status

# Get OAuth URL
curl http://localhost:3000/api/calendar/auth

# After OAuth: List calendars (requires tokens in cookie/session)
curl http://localhost:3000/api/calendar/calendars \
  -H "Cookie: calendar_tokens=YOUR_TOKENS"
```

### Check Integration Logs
```bash
# Get all logs
curl http://localhost:3000/api/integrations/logs?limit=50 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Filter by status
curl http://localhost:3000/api/integrations/logs?status=failed&limit=20 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get CRM sync logs
curl http://localhost:3000/api/integrations/crm/sync-logs?limit=50 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Environment Setup

### Minimal Setup (.env)
```bash
# Backend
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# Authentication
CLERK_SECRET_KEY=sk_test_your_key
SESSION_SECRET=your_session_secret
```

### CRM Integration Setup
```bash
# Choose provider: hubspot, salesforce, or pipedrive
CRM_PROVIDER=hubspot

# Add API key
CRM_API_KEY=your_crm_api_key

# For Salesforce only
SALESFORCE_INSTANCE_URL=https://yourinstance.salesforce.com
```

### Chat Integration Setup (Slack)
```bash
# Option 1: Bot token (full API access)
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_DEFAULT_CHANNEL=general

# Option 2: Webhook only (simpler, limited features)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# For webhook verification
SLACK_SIGNING_SECRET=your_signing_secret
```

### Calendar Integration Setup
```bash
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/callback
```

---

## Common Issues & Solutions

### Issue: CRM test returns "not configured"
**Solution:**
1. Check `CRM_API_KEY` is set in .env
2. Verify `CRM_PROVIDER` matches your CRM (hubspot/salesforce/pipedrive)
3. Restart backend server after changing .env

### Issue: Slack test returns 401
**Solution:**
1. Verify `SLACK_BOT_TOKEN` starts with `xoxb-`
2. Check token has required scopes: `chat:write`, `channels:read`
3. Test token: `curl https://slack.com/api/auth.test -H "Authorization: Bearer xoxb-your-token"`

### Issue: Calendar OAuth fails
**Solution:**
1. Verify Google Cloud Console has OAuth credentials configured
2. Check redirect URI matches exactly: `http://localhost:3000/api/calendar/callback`
3. Ensure Calendar API is enabled in Google Cloud Console
4. Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct

### Issue: Sync returns 0 items synced
**Solution:**
1. Check if action items have `crm_sync_status = 'pending'`
2. Verify action items have required fields (task_description, due_date)
3. Check integration logs: `GET /api/integrations/logs?status=failed`

### Issue: Webhooks not working
**Solution:**
1. For Slack: Ensure webhook URL is publicly accessible (use ngrok for local dev)
2. Check webhook endpoint logs for errors
3. Verify webhook signature (if implemented)
4. Test webhook manually: `curl -X POST http://localhost:3000/api/integrations/webhooks/crm -d '{"event":"test","data":{}}'`

---

## Test Data Setup

### Create Test Action Item (Supabase)
```sql
INSERT INTO action_items (
  id,
  task_description,
  priority,
  due_date,
  crm_sync_status,
  assigned_to_email,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Test CRM Sync',
  'high',
  CURRENT_DATE + INTERVAL '7 days',
  'pending',
  'test@example.com',
  NOW(),
  NOW()
);
```

### Create Test Meeting (Supabase)
```sql
INSERT INTO meetings (
  id,
  title,
  summary,
  sentiment_label,
  key_points,
  decisions,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Test Meeting',
  'This is a test meeting summary',
  'Positive',
  ARRAY['Key point 1', 'Key point 2'],
  ARRAY['Decision 1', 'Decision 2'],
  NOW(),
  NOW()
);
```

---

## Integration Health Checks

### Quick Health Check Script
```bash
#!/bin/bash
# Save as check_integrations.sh

API_BASE="http://localhost:3000"
TOKEN="YOUR_TOKEN_HERE"

echo "=== Entomate Integration Health Check ==="
echo ""

echo "1. Overall Status:"
curl -s "$API_BASE/api/integrations/status" -H "Authorization: Bearer $TOKEN" | jq .
echo ""

echo "2. CRM Status:"
curl -s "$API_BASE/api/integrations/crm/status" -H "Authorization: Bearer $TOKEN" | jq .
echo ""

echo "3. Chat Status:"
curl -s "$API_BASE/api/integrations/chat/status" | jq .
echo ""

echo "4. Calendar Status:"
curl -s "$API_BASE/api/calendar/status" | jq .
echo ""

echo "5. Recent Failures:"
curl -s "$API_BASE/api/integrations/logs?status=failed&limit=5" -H "Authorization: Bearer $TOKEN" | jq .
echo ""

echo "=== Health Check Complete ==="
```

---

## Integration Monitoring Queries

### Supabase Queries

**Failed sync items in last 24 hours:**
```sql
SELECT
  id,
  task_description,
  crm_sync_status,
  last_sync_error,
  last_sync_attempt
FROM action_items
WHERE crm_sync_status = 'failed'
  AND last_sync_attempt > NOW() - INTERVAL '24 hours'
ORDER BY last_sync_attempt DESC;
```

**Sync success rate:**
```sql
SELECT
  crm_sync_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM action_items
WHERE last_sync_attempt IS NOT NULL
GROUP BY crm_sync_status;
```

**Integration logs by type:**
```sql
SELECT
  destination_type,
  status,
  COUNT(*) as count
FROM integration_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY destination_type, status
ORDER BY destination_type, status;
```

---

## Rate Limit Recommendations

### CRM (Based on Provider)
| Provider | Limit | Recommendation |
|----------|-------|----------------|
| HubSpot | 100 req/10s | Max 10 sync/min |
| Salesforce | 15,000 req/24h | Max 10 sync/min |
| Pipedrive | 10,000 req/day | Max 6 sync/min |

### Chat
| Provider | Limit | Recommendation |
|----------|-------|----------------|
| Slack | 1 msg/sec per channel | Max 5 notify/min |
| Teams | 30 msg/min per webhook | Max 20 notify/min |
| Discord | 5 msg/5sec per channel | Max 3 notify/min |

### Calendar
| Provider | Limit | Recommendation |
|----------|-------|----------------|
| Google Calendar | 1000 req/100s | Max 20 sync/min |

---

## Priority Mapping Reference

### CRM Task Priority
| Entomate | HubSpot | Salesforce | Pipedrive |
|----------|---------|------------|-----------|
| high | HIGH | High | (custom field) |
| medium | MEDIUM | Normal | (custom field) |
| low | LOW | Low | (custom field) |

### Calendar Event Colors
| Priority | Google Calendar Color ID | Color |
|----------|-------------------------|-------|
| high | 11 | Red |
| medium | 5 | Yellow |
| low | 10 | Green |

---

## Support Contacts

**Integration Issues:**
- Check logs: `GET /api/integrations/logs?status=failed`
- Check status: `GET /api/integrations/status`
- Review error messages in action_items.last_sync_error

**Security Issues:**
- Review webhook endpoints for signature verification
- Check rate limiting implementation
- Audit API key storage and rotation

**Performance Issues:**
- Monitor sync duration in integration_logs
- Check for retry storms (high retry_count)
- Review rate limiting configuration

---

**For full test report:** See `INTEGRATION_TEST_REPORT.md`
**For executive summary:** See `INTEGRATION_TEST_SUMMARY.md`
