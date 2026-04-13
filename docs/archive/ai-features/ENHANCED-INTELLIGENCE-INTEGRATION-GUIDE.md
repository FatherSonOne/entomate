# Enhanced Intelligence Dashboard - Integration Guide

**Quick Start:** How to integrate the Enhanced Intelligence Dashboard into Entomate

---

## 🎯 Overview

You now have TWO intelligence components in your codebase:

1. **DailyBriefing.jsx** (Simple, compact) - Currently used in Dashboard
2. **IntelligenceDashboard.jsx** (Enhanced, AI-powered) - **NEW**

This guide shows you how to integrate the Enhanced Intelligence Dashboard.

---

## ✅ Prerequisites Checklist

Before integrating, ensure:

- [x] Backend migration completed (4 tables created in Supabase)
- [x] Backend services deployed
- [x] API routes accessible
- [x] OpenAI API key configured in backend/.env
- [ ] Frontend components tested
- [ ] API integration tested

---

## 🚀 Integration Options

### Option 1: Replace DailyBriefing (Recommended)

**When to use:** You want the Enhanced Intelligence Dashboard as the main dashboard component

**Steps:**

1. Open [frontend/src/pages/Dashboard.jsx](../frontend/src/pages/Dashboard.jsx)

2. Replace the import:

```jsx
// BEFORE (Line 5)
import DailyBriefing from '../components/DailyBriefing'

// AFTER
import IntelligenceDashboard from '../components/intelligence/IntelligenceDashboard'
```

3. Replace the component usage:

```jsx
// BEFORE (Line 83)
<DailyBriefing />

// AFTER
<IntelligenceDashboard />
```

4. **Done!** The Enhanced Intelligence Dashboard will now show on the main Dashboard page.

**Before/After:**

```jsx
// BEFORE
export default function Dashboard() {
  // ... stats and data loading ...

  return (
    <div className="space-y-4">
      <DailyBriefing />  {/* Old simple briefing */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {statCardsData.map(card => <StatCard key={card.label} {...card} />)}
      </div>
      {/* ... rest of dashboard ... */}
    </div>
  )
}

// AFTER
export default function Dashboard() {
  // ... stats and data loading ...

  return (
    <div className="space-y-4">
      <IntelligenceDashboard />  {/* New enhanced dashboard */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {statCardsData.map(card => <StatCard key={card.label} {...card} />)}
      </div>
      {/* ... rest of dashboard ... */}
    </div>
  )
}
```

---

### Option 2: Add as Dedicated Route

**When to use:** You want a separate "/intelligence" page for power users

**Steps:**

1. Open [frontend/src/App.jsx](../frontend/src/App.jsx)

2. Add the import at the top:

```jsx
import IntelligenceDashboard from './components/intelligence/IntelligenceDashboard'
```

3. Add a new route inside the Layout Routes:

```jsx
<Routes>
  <Route path="/" element={<Layout />}>
    <Route index element={<Navigate to="/dashboard" replace />} />
    <Route path="dashboard" element={<Dashboard />} />

    {/* NEW: Enhanced Intelligence Page */}
    <Route path="intelligence" element={<IntelligenceDashboard />} />

    <Route path="meetings" element={<Meetings />} />
    {/* ... rest of routes ... */}
  </Route>
</Routes>
```

4. Add a navigation link in the sidebar/menu:

   Open [frontend/src/components/Layout.jsx](../frontend/src/components/Layout.jsx) (or wherever your navigation is)

```jsx
<nav>
  {/* ... existing links ... */}
  <Link to="/intelligence" className="nav-link">
    <Sparkles className="w-5 h-5" />
    Intelligence
  </Link>
</nav>
```

5. **Done!** Navigate to `http://localhost:5173/intelligence` to see the Enhanced Dashboard.

---

### Option 3: Toggle Between Old and New

**When to use:** You want to A/B test or let users choose

**Steps:**

1. Open [frontend/src/pages/Dashboard.jsx](../frontend/src/pages/Dashboard.jsx)

2. Add both imports:

```jsx
import DailyBriefing from '../components/DailyBriefing'
import IntelligenceDashboard from '../components/intelligence/IntelligenceDashboard'
```

3. Add state to toggle:

```jsx
export default function Dashboard() {
  const [useEnhancedIntelligence, setUseEnhancedIntelligence] = useState(true);

  // ... rest of component ...

  return (
    <div className="space-y-4">
      {/* Toggle Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setUseEnhancedIntelligence(!useEnhancedIntelligence)}
          className="text-sm text-primary-600 hover:underline"
        >
          {useEnhancedIntelligence ? 'Use Simple Briefing' : 'Use Enhanced Intelligence'}
        </button>
      </div>

      {/* Conditional Rendering */}
      {useEnhancedIntelligence ? (
        <IntelligenceDashboard />
      ) : (
        <DailyBriefing />
      )}

      {/* ... rest of dashboard ... */}
    </div>
  )
}
```

4. **Done!** Users can toggle between the two intelligence views.

---

## 🔧 Configuration

### Environment Variables

Ensure these are set in [backend/.env](../backend/.env):

```bash
# Required for AI meeting briefs and talking points
OPENAI_API_KEY=sk-...

# Supabase (should already be configured)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...  # Required for writing risk scores
```

### User Preferences (Optional)

The Enhanced Dashboard supports user preferences. To enable customization:

1. Add a settings page route (already exists at `/settings`)

2. Add a section for Intelligence Dashboard preferences:

```jsx
// In Settings.jsx
<section>
  <h3>Intelligence Dashboard Preferences</h3>

  <label>
    Refresh Interval (minutes)
    <input
      type="number"
      min="1"
      max="60"
      value={preferences.refresh_interval_minutes || 5}
      onChange={(e) => updatePreference('refresh_interval_minutes', e.target.value)}
    />
  </label>

  <label>
    Card Order
    <select multiple onChange={handleCardOrderChange}>
      <option value="meeting_prep">Meeting Prep</option>
      <option value="deal_risks">Deal Risks</option>
      <option value="action_items">Action Items</option>
      <option value="relationships">Relationships</option>
    </select>
  </label>
</section>
```

---

## 🧪 Testing Integration

### 1. Visual Test Checklist

After integration, verify:

- [ ] Dashboard loads without errors
- [ ] All 4 card types are visible (Meeting Prep, Deal Risks, Action Items, Relationships)
- [ ] Cards expand/collapse smoothly
- [ ] Auto-refresh works (5 minutes)
- [ ] Loading states show correctly
- [ ] Error states show correctly
- [ ] Quick actions are clickable
- [ ] Mobile responsive layout works

### 2. API Test Checklist

Test the backend endpoints:

```bash
# 1. Main dashboard endpoint
curl http://localhost:3000/api/intelligence/dashboard \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"

# Expected: 200 OK with JSON response containing all 4 intelligence types

# 2. Meeting prep endpoint
curl http://localhost:3000/api/intelligence/meeting-prep/MEETING_ID

# Expected: 200 OK with meeting prep data

# 3. Deal risks endpoint
curl http://localhost:3000/api/intelligence/deal-risks

# Expected: 200 OK with at-risk deals

# 4. Action items endpoint
curl http://localhost:3000/api/intelligence/action-items

# Expected: 200 OK with action item analytics
```

### 3. Database Test Checklist

Verify the database tables:

```sql
-- In Supabase SQL Editor

-- 1. Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('deal_risk_scores', 'stakeholder_intelligence', 'action_item_dependencies', 'intelligence_preferences');

-- Expected: All 4 tables listed

-- 2. Check RLS policies
SELECT tablename, policyname FROM pg_policies
WHERE tablename IN ('deal_risk_scores', 'stakeholder_intelligence', 'action_item_dependencies', 'intelligence_preferences');

-- Expected: Multiple policies for each table

-- 3. Test data query (should work)
SELECT * FROM deal_risk_scores LIMIT 1;

-- Expected: No permission errors
```

---

## 🐛 Troubleshooting

### Issue: "Failed to fetch dashboard intelligence"

**Possible Causes:**
1. Backend server not running
2. Clerk authentication not working
3. API endpoint not accessible

**Solutions:**
```bash
# 1. Check backend is running
cd backend
npm start

# 2. Check Clerk token is being sent
# In browser DevTools > Network > Headers
# Look for: Authorization: Bearer eyJhbGci...

# 3. Test API directly
curl http://localhost:3000/api/intelligence/dashboard
```

---

### Issue: "OpenAI API error" or missing talking points

**Possible Causes:**
1. OPENAI_API_KEY not set
2. Invalid API key
3. OpenAI rate limit exceeded

**Solutions:**
```bash
# 1. Check environment variable
cd backend
cat .env | grep OPENAI_API_KEY

# 2. Test API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# 3. Use fallback: The system will work without OpenAI, just won't generate AI talking points
```

---

### Issue: Empty cards or "No data available"

**Possible Causes:**
1. No data in database
2. User has no assigned meetings/deals/tasks

**Solutions:**
```bash
# 1. Check if you have test data
# In Supabase SQL Editor:
SELECT COUNT(*) FROM meetings;
SELECT COUNT(*) FROM action_items;

# 2. Create test data using the API
# Use Postman or curl to create a meeting
curl -X POST http://localhost:3000/api/meetings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Meeting", "summary": "Test summary"}'
```

---

### Issue: Cards not expanding/collapsing

**Possible Causes:**
1. JavaScript error in console
2. State not updating

**Solutions:**
```javascript
// 1. Check browser console for errors
// Press F12 > Console tab

// 2. Check React DevTools
// Install React DevTools extension
// Check component state

// 3. Verify ExpandableCard is being used correctly
// Each card should wrap content in ExpandableCard
```

---

## 📊 Performance Tips

### 1. Reduce API Calls

The dashboard auto-refreshes every 5 minutes. To change this:

```jsx
// In IntelligenceDashboard.jsx
useEffect(() => {
  loadIntelligence();
  const interval = setInterval(loadIntelligence, 10 * 60 * 1000);  // 10 minutes
  return () => clearInterval(interval);
}, [preferences]);
```

### 2. Lazy Load Expanded Content

Only fetch detailed data when a card is expanded:

```jsx
const [expanded, setExpanded] = useState(false);
const [detailedData, setDetailedData] = useState(null);

useEffect(() => {
  if (expanded && !detailedData) {
    fetchDetailedData();
  }
}, [expanded]);
```

### 3. Cache User Preferences

Store preferences in localStorage:

```jsx
// Save preferences
localStorage.setItem('intelligence_prefs', JSON.stringify(preferences));

// Load preferences on mount
useEffect(() => {
  const saved = localStorage.getItem('intelligence_prefs');
  if (saved) {
    setPreferences(JSON.parse(saved));
  }
}, []);
```

---

## 🎨 Customization Examples

### Change Card Colors

Edit the card components to use different color schemes:

```jsx
// In DealRiskAlertCard.jsx
const riskColors = {
  low: 'bg-blue-100 text-blue-800 border-blue-200',      // Changed from green
  medium: 'bg-purple-100 text-purple-800 border-purple-200',  // Changed from yellow
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200'
};
```

### Add Custom Actions

Add custom quick actions to cards:

```jsx
// In MeetingPrepCard.jsx
const actions = [
  {
    label: 'Prepare Brief',
    onClick: () => generateBrief(meeting.id)
  },
  {
    label: 'Reschedule',
    onClick: () => openRescheduleModal(meeting.id)
  },
  // NEW: Add custom action
  {
    label: 'Add to Calendar',
    onClick: () => addToGoogleCalendar(meeting)
  }
];
```

### Change Card Order

Modify the default card order:

```jsx
// In IntelligenceDashboard.jsx
const [preferences, setPreferences] = useState({
  cardOrder: [
    'deal_risks',        // Show risks first
    'action_items',      // Then action items
    'meeting_prep',      // Then meetings
    'relationships'      // Finally relationships
  ]
});
```

---

## 📱 Mobile Responsiveness

The Enhanced Intelligence Dashboard is mobile-responsive by default. Test on different screen sizes:

```css
/* The grid automatically adjusts: */

/* Mobile (< 768px): 1 column */
grid-cols-1

/* Tablet (768px - 1024px): 1 column */
grid-cols-1

/* Desktop (> 1024px): 2 columns */
lg:grid-cols-2
```

To force full-width cards on desktop:

```jsx
// In IntelligenceDashboard.jsx
<div className="grid grid-cols-1 gap-6">  {/* Changed from lg:grid-cols-2 */}
  {/* Cards */}
</div>
```

---

## 🔐 Security Considerations

### 1. Authentication

All API endpoints require Clerk authentication:

```javascript
// In backend/routes/intelligence.js
router.get('/dashboard', async (req, res) => {
  const userId = req.user?.id;  // From Clerk auth middleware

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  // ... rest of endpoint
});
```

### 2. Row Level Security (RLS)

All database tables have RLS enabled:

```sql
-- Users can only see their own data
CREATE POLICY "Users can view their own risk scores"
ON deal_risk_scores FOR SELECT
USING (user_id = auth.uid());
```

### 3. Service Role Access

Backend uses service role for writing cache data:

```javascript
// In DealRiskService.js
const { error } = await supabaseAdmin  // Service role, not user role
  .from('deal_risk_scores')
  .upsert(riskScoresToCache);
```

---

## ✅ Integration Checklist

Before going to production:

### Backend
- [ ] Migration run successfully in Supabase
- [ ] All 4 services deployed
- [ ] API endpoints accessible
- [ ] OpenAI API key configured
- [ ] Service role key configured
- [ ] RLS policies verified

### Frontend
- [ ] Components rendering correctly
- [ ] API integration working
- [ ] Authentication working (Clerk)
- [ ] Loading states functional
- [ ] Error states functional
- [ ] Mobile responsive
- [ ] Auto-refresh working

### Testing
- [ ] Main dashboard endpoint tested
- [ ] All 7 API endpoints tested
- [ ] Database queries working
- [ ] No console errors
- [ ] Performance acceptable (< 2s load)

### User Experience
- [ ] Cards expand/collapse smoothly
- [ ] Quick actions work
- [ ] Data refreshes correctly
- [ ] Empty states show correctly
- [ ] Error messages are clear

---

## 🚀 Going to Production

When ready to deploy:

1. **Environment Variables:**
   ```bash
   # Production backend/.env
   NODE_ENV=production
   OPENAI_API_KEY=sk-prod-...
   SUPABASE_URL=https://your-prod-project.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbGci...  # Production service key
   ```

2. **Build Frontend:**
   ```bash
   cd frontend
   npm run build
   ```

3. **Deploy Backend:**
   ```bash
   # If using Docker
   docker build -t entomate-backend .
   docker push your-registry/entomate-backend

   # If using traditional deployment
   pm2 start backend/server.js --name entomate-backend
   ```

4. **Database Migration:**
   ```bash
   # In Supabase production dashboard:
   # 1. Go to SQL Editor
   # 2. Run migration script
   # 3. Verify tables created
   ```

5. **Monitoring:**
   - Set up error tracking (Sentry)
   - Monitor API response times
   - Track OpenAI API usage
   - Watch database performance

---

## 📞 Support

If you encounter issues during integration:

1. Check the main documentation: [ENHANCED-INTELLIGENCE-COMPLETE.md](./ENHANCED-INTELLIGENCE-COMPLETE.md)
2. Review error messages in browser console (F12)
3. Check backend logs
4. Verify database schema in Supabase
5. Test API endpoints directly with curl

---

**Happy Integrating!** 🎉

---

**Last Updated:** 2026-01-24
**Version:** 1.0
