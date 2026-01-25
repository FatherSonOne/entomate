# Entomate API Testing Suite

Comprehensive API contract validation testing for Entomate backend endpoints.

## Quick Start

### Prerequisites

1. **Start the backend server:**
   ```bash
   cd backend
   npm start
   # Server should be running on http://localhost:3000
   ```

2. **Set environment variables (optional):**
   ```bash
   # For testing authenticated endpoints
   export TEST_AUTH_TOKEN="your-clerk-jwt-token"

   # For testing against staging/production
   export API_BASE_URL="https://staging.entomate.com"
   ```

### Run Tests

```bash
# From backend directory
npm run test:api

# Or directly from tests directory
node api-contract-validation.test.js

# With authentication token
TEST_AUTH_TOKEN="your-token" npm run test:api

# Against staging environment
API_BASE_URL="https://staging.entomate.com" npm run test:api
```

## Test Coverage

The test suite validates **30+ endpoints** across 7 API categories:

### 1. Meetings API (6 endpoints)
- ✓ GET /api/meetings - List meetings with pagination
- ✓ GET /api/meetings/:id - Get meeting details
- ✓ POST /api/meetings/transcript - Process text transcript
- ✓ POST /api/meetings/:id/ask - Ask AI about meeting
- ✓ DELETE /api/meetings/:id - Delete meeting
- ⊘ POST /api/meetings/process - Audio upload (requires multipart testing)

### 2. Agents API (5 endpoints)
- ✓ GET /api/agents/templates - Get agent templates (auth required)
- ✓ POST /api/agents/from-template - Create from template
- ✓ POST /api/agents/:id/execute - Execute agent
- ✓ GET /api/agents/:id/stats - Get agent stats
- ✓ POST /api/agents/orchestrate - Parallel execution

### 3. Automations API (5 endpoints)
- ✓ GET /api/automations - List automations
- ✓ POST /api/automations - Create automation
- ✓ GET /api/automations/templates - Get templates
- ✓ POST /api/automations/:id/test - Dry-run test
- ✓ POST /api/automations/:id/execute - Execute automation

### 4. Search API (6 endpoints)
- ✓ POST /api/search - Full-text search
- ✓ POST /api/search/semantic - Semantic search
- ✓ POST /api/search/ask - Ask AI question
- ✓ POST /api/search/ask/stream - Streaming AI (SSE)
- ✓ GET /api/search/suggestions - Autocomplete (auth required)
- ✓ GET /api/search/analytics - Search analytics

### 5. Projects & Tasks API (4 endpoints)
- ✓ GET /api/projects - List projects
- ✓ POST /api/projects - Create project
- ✓ GET /api/tasks - List tasks
- ✓ POST /api/tasks - Create task

### 6. Intelligence API (3 endpoints)
- ✓ GET /api/intelligence/today - Today's briefing
- ✓ GET /api/intelligence/overdue - Overdue items
- ✓ GET /api/intelligence/deadlines - Upcoming deadlines

### 7. Rate Limiting (1 test)
- ⊘ Burst request handling (50 concurrent requests)

## Test Types

### Functional Validation
- Valid requests return 200 OK with correct data structure
- Invalid requests return appropriate 4xx error codes
- Missing data returns 400 Bad Request with error message
- Non-existent resources return 404 Not Found

### Input Validation
- Required fields are enforced (400 if missing)
- Type validation (strings, numbers, arrays, objects)
- Edge case handling (empty strings, null values, malformed data)

### Authentication & Authorization
- Protected endpoints return 401 Unauthorized without token
- Role-based access control enforced
- API key authentication for service-to-service calls

### Response Schema Validation
- Response structure matches documented contract
- Required fields present in all responses
- Data types correct (arrays, objects, strings, numbers, booleans)

### Performance Testing
- Response time measurement for all endpoints
- P95 latency target: < 500ms for non-AI endpoints
- Concurrent request handling

### Rate Limiting
- Burst request testing (50+ concurrent requests)
- 429 Too Many Requests validation
- Rate limit headers verification

## Expected Output

```
╔═══════════════════════════════════════╗
║  ENTOMATE API CONTRACT VALIDATION    ║
╚═══════════════════════════════════════╝

API Base URL: http://localhost:3000
Auth Token:   Not provided (some tests will be blocked)
Timeout:      10000ms per test

═══════════════════════════════════════
  MEETINGS API TESTS
═══════════════════════════════════════

▶ Running: Meetings - GET /api/meetings
  ✓ PASS - Valid 200 response with correct schema
  ⏱  120ms

▶ Running: Meetings - GET /api/meetings/:id (404)
  ✓ PASS - Correctly returns 404 for non-existent meeting
  ⏱  35ms

[... more tests ...]

═══════════════════════════════════════
  PERFORMANCE ANALYSIS
═══════════════════════════════════════

Response Time Percentiles:
  P50 (Median): 85ms
  P95:          320ms (OK)
  P99:          1200ms
  Average:      285ms
  Min:          25ms
  Max:          4100ms

Slowest Endpoints:
  1. POST /api/meetings/transcript - 3200ms (200)
  2. POST /api/agents/:id/execute - 2400ms (200)
  3. POST /api/search/semantic - 720ms (200)

═══════════════════════════════════════
  TEST SUMMARY
═══════════════════════════════════════

Total Tests:    30
Passed:         25
Failed:         0
Blocked:        5
Pass Rate:      100.0%

P0 CRITICAL ISSUES (0):
  (None)

P1 HIGH PRIORITY ISSUES (0):
  (None)

RECOMMENDATIONS:
  • 5 tests blocked by authentication - set TEST_AUTH_TOKEN env var
  • Optimize 3 endpoints exceeding 500ms response time target

═══════════════════════════════════════
```

## Getting Authentication Token

### For Development

1. Sign in to Entomate frontend (http://localhost:5173)
2. Open browser DevTools → Network tab
3. Make any authenticated API request
4. Copy the `Authorization` header value (starts with "Bearer ")
5. Set as environment variable:
   ```bash
   export TEST_AUTH_TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
   ```

### For CI/CD

Create a test user in Clerk and use Clerk's API to generate a token:

```javascript
// generate-test-token.js
const { Clerk } = require('@clerk/clerk-sdk-node');

const clerk = Clerk({
  secretKey: process.env.CLERK_SECRET_KEY
});

async function generateTestToken() {
  const user = await clerk.users.getUserList({
    emailAddress: ['test@entomate.com']
  });

  const session = await clerk.sessions.createSession({
    userId: user[0].id
  });

  const token = await session.getToken();
  console.log('TEST_AUTH_TOKEN=' + token);
}

generateTestToken();
```

## Troubleshooting

### Tests Failing with Connection Errors

**Problem:** `ECONNREFUSED` or timeout errors

**Solution:**
1. Verify backend is running: `curl http://localhost:3000/health`
2. Check correct port in API_BASE_URL
3. Ensure no firewall blocking connections

### Tests Blocked by Authentication

**Problem:** Many tests show `⊘ BLOCKED` status

**Solution:**
1. Get a valid Clerk JWT token (see above)
2. Set `TEST_AUTH_TOKEN` environment variable
3. Re-run tests

### Performance Tests Failing

**Problem:** Tests fail due to slow response times

**Solution:**
1. Check system load (high CPU/memory usage)
2. Verify database connection is fast
3. Check AI service (OpenAI/Gemini) response times
4. Consider increasing timeout: `export TEST_TIMEOUT=20000`

### Rate Limiting Tests Blocked

**Problem:** Rate limit test shows `BLOCKED` status

**Solution:**
1. Verify rate limiting is enabled in backend configuration
2. Check `backend/middleware/rateLimiter.js` configuration
3. Ensure express-rate-limit middleware is applied

## Test Result Interpretation

### Test Statuses

- **✓ PASS** - Test passed successfully
- **✗ FAIL** - Test failed, requires investigation
- **⊘ BLOCKED** - Test cannot run (missing auth, dependency unavailable)

### Performance Targets

- **P50 (Median):** < 100ms (target for most endpoints)
- **P95:** < 500ms (SLA target)
- **P99:** < 1000ms (acceptable for complex operations)

### Exit Codes

- **0** - All tests passed
- **1** - One or more tests failed

## Continuous Integration

### GitHub Actions Example

```yaml
name: API Contract Tests

on: [push, pull_request]

jobs:
  api-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd backend
          npm ci

      - name: Start backend
        run: |
          cd backend
          npm start &
          sleep 5
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/entomate_test
          CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}

      - name: Run API tests
        run: npm run test:api
        env:
          API_BASE_URL: http://localhost:3000
          TEST_AUTH_TOKEN: ${{ secrets.TEST_AUTH_TOKEN }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: api-test-results
          path: test-results/
```

## Advanced Usage

### Test Specific Endpoints

Modify `api-contract-validation.test.js` to run only specific suites:

```javascript
// Comment out suites you don't want to run
async function main() {
  // await testMeetingsAPI();
  await testAgentsAPI();  // Only run agents tests
  // await testAutomationsAPI();
  // ...
}
```

### Custom Assertions

Add custom validation logic:

```javascript
// In test function
const response = await makeRequest('GET', '/api/meetings');

// Custom assertion
if (response.body.meetings.length > 100) {
  return {
    status: 'FAIL',
    message: 'Too many meetings returned, pagination not working'
  };
}
```

### Load Testing

For load testing, use Artillery instead:

```bash
cd tests
artillery run load-test.yml
```

## Documentation

- Full API testing report: `docs/API-TESTING-REPORT.md`
- Backend architecture: `docs/ARCHITECTURE.md`
- API documentation: `docs/API.md` (if exists)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the full testing report in `docs/API-TESTING-REPORT.md`
3. Contact the backend team
4. Open an issue in the project repository

---

**Last Updated:** 2026-01-24
**Test Suite Version:** 1.0.0
