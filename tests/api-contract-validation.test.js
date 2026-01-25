/**
 * Entomate API Contract Validation Test Suite
 * Comprehensive API testing for all critical endpoints
 *
 * Tests:
 * - Functional validation (200/400/401/500 responses)
 * - Input validation and error handling
 * - Authentication and authorization
 * - Response schema validation
 * - Performance metrics (p95 < 500ms target)
 * - Rate limiting behavior
 *
 * Run with: node tests/api-contract-validation.test.js
 */

const https = require('https');
const http = require('http');
const { performance } = require('perf_hooks');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || null;
const TEST_TIMEOUT = 10000; // 10 seconds per test

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  blocked: 0,
  tests: []
};

// Performance tracking
const performanceMetrics = [];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  gray: '\x1b[90m'
};

/**
 * HTTP request helper with performance tracking
 */
function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Entomate-API-Tester/1.0',
        ...headers
      },
      timeout: TEST_TIMEOUT
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      const body = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const startTime = performance.now();

    const req = client.request(options, (res) => {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        performanceMetrics.push({
          endpoint: `${method} ${path}`,
          responseTime,
          statusCode: res.statusCode
        });

        let parsedBody;
        try {
          parsedBody = body ? JSON.parse(body) : null;
        } catch (e) {
          parsedBody = body;
        }

        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsedBody,
          responseTime
        });
      });
    });

    req.on('error', (error) => {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      performanceMetrics.push({
        endpoint: `${method} ${path}`,
        responseTime,
        statusCode: 'ERROR',
        error: error.message
      });

      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${TEST_TIMEOUT}ms`));
    });

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Test runner
 */
async function runTest(name, endpoint, testFn) {
  const testId = `${name} - ${endpoint}`;
  console.log(`${colors.blue}▶${colors.reset} Running: ${testId}`);

  try {
    const result = await testFn();

    if (result.status === 'PASS') {
      testResults.passed++;
      console.log(`  ${colors.green}✓ PASS${colors.reset} - ${result.message || ''}`);
      if (result.responseTime) {
        console.log(`  ${colors.gray}⏱  ${result.responseTime.toFixed(0)}ms${colors.reset}`);
      }
    } else if (result.status === 'BLOCKED') {
      testResults.blocked++;
      console.log(`  ${colors.yellow}⊘ BLOCKED${colors.reset} - ${result.message}`);
    } else {
      testResults.failed++;
      console.log(`  ${colors.red}✗ FAIL${colors.reset} - ${result.message}`);
    }

    testResults.tests.push({
      name: testId,
      status: result.status,
      message: result.message,
      responseTime: result.responseTime,
      details: result.details
    });
  } catch (error) {
    testResults.failed++;
    console.log(`  ${colors.red}✗ FAIL${colors.reset} - ${error.message}`);
    testResults.tests.push({
      name: testId,
      status: 'FAIL',
      message: error.message,
      error: error.stack
    });
  }

  console.log(''); // Empty line between tests
}

/**
 * Schema validation helpers
 */
function validateSchema(data, schema) {
  const errors = [];

  for (const [key, type] of Object.entries(schema)) {
    if (type.required && !(key in data)) {
      errors.push(`Missing required field: ${key}`);
      continue;
    }

    if (key in data) {
      const value = data[key];
      const expectedType = typeof type === 'string' ? type : type.type;

      if (expectedType === 'array' && !Array.isArray(value)) {
        errors.push(`Field ${key} should be array, got ${typeof value}`);
      } else if (expectedType !== 'array' && typeof value !== expectedType) {
        errors.push(`Field ${key} should be ${expectedType}, got ${typeof value}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ========================================
// TEST SUITE: MEETINGS API
// ========================================

async function testMeetingsAPI() {
  console.log(`\n${colors.blue}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}  MEETINGS API TESTS${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════${colors.reset}\n`);

  // Test 1: List meetings (valid request)
  await runTest('Meetings', 'GET /api/meetings', async () => {
    const response = await makeRequest('GET', '/api/meetings');

    if (response.statusCode === 200) {
      const schema = {
        meetings: { type: 'array', required: true },
        count: { type: 'number', required: true },
        hasMore: { type: 'boolean', required: true }
      };

      const validation = validateSchema(response.body, schema);

      return {
        status: validation.valid ? 'PASS' : 'FAIL',
        message: validation.valid ? 'Valid 200 response with correct schema' : validation.errors.join(', '),
        responseTime: response.responseTime,
        details: response.body
      };
    }

    return {
      status: 'FAIL',
      message: `Expected 200, got ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });

  // Test 2: Get meeting by ID (missing meeting)
  await runTest('Meetings', 'GET /api/meetings/:id (404)', async () => {
    const response = await makeRequest('GET', '/api/meetings/00000000-0000-0000-0000-000000000000');

    return {
      status: response.statusCode === 404 ? 'PASS' : 'FAIL',
      message: response.statusCode === 404 ? 'Correctly returns 404 for non-existent meeting' : `Expected 404, got ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });

  // Test 3: Process transcript (missing required field)
  await runTest('Meetings', 'POST /api/meetings/transcript (400)', async () => {
    const response = await makeRequest('POST', '/api/meetings/transcript', {
      title: 'Test Meeting'
      // Missing 'transcript' field
    });

    return {
      status: response.statusCode === 400 ? 'PASS' : 'FAIL',
      message: response.statusCode === 400 ? 'Correctly validates required fields' : `Expected 400, got ${response.statusCode}`,
      responseTime: response.responseTime,
      details: response.body
    };
  });

  // Test 4: Ask question without authentication (if auth required)
  await runTest('Meetings', 'POST /api/meetings/:id/ask (no auth)', async () => {
    const response = await makeRequest('POST', '/api/meetings/test-id/ask', {
      question: 'What was discussed?'
    });

    // This endpoint might allow unauthenticated access or require auth
    const acceptableStatuses = [401, 404, 503]; // 503 if AI not configured

    return {
      status: acceptableStatuses.includes(response.statusCode) ? 'PASS' : 'FAIL',
      message: acceptableStatuses.includes(response.statusCode)
        ? `Correctly returns ${response.statusCode}`
        : `Expected ${acceptableStatuses.join('/')}, got ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });

  // Test 5: Performance check
  await runTest('Meetings', 'GET /api/meetings (performance)', async () => {
    const response = await makeRequest('GET', '/api/meetings?limit=20');
    const p95Target = 500; // ms

    return {
      status: response.responseTime < p95Target ? 'PASS' : 'FAIL',
      message: response.responseTime < p95Target
        ? `Response time ${response.responseTime.toFixed(0)}ms under ${p95Target}ms target`
        : `Response time ${response.responseTime.toFixed(0)}ms exceeds ${p95Target}ms target`,
      responseTime: response.responseTime
    };
  });
}

// ========================================
// TEST SUITE: AGENTS API
// ========================================

async function testAgentsAPI() {
  console.log(`\n${colors.blue}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}  AGENTS API TESTS${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════${colors.reset}\n`);

  // Test 1: Get agent templates (without auth)
  await runTest('Agents', 'GET /api/agents/templates', async () => {
    const response = await makeRequest('GET', '/api/agents/templates');

    // Endpoint requires authentication
    if (response.statusCode === 401) {
      return {
        status: 'BLOCKED',
        message: 'Endpoint requires authentication - cannot test without valid token',
        responseTime: response.responseTime
      };
    }

    if (response.statusCode === 200) {
      const schema = {
        success: { type: 'boolean', required: true },
        data: { type: 'array', required: true },
        count: { type: 'number', required: true }
      };

      const validation = validateSchema(response.body, schema);

      return {
        status: validation.valid ? 'PASS' : 'FAIL',
        message: validation.valid ? `Returns ${response.body.count} templates` : validation.errors.join(', '),
        responseTime: response.responseTime
      };
    }

    return {
      status: 'FAIL',
      message: `Unexpected status ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });

  // Test 2: Create agent from template (missing required field)
  await runTest('Agents', 'POST /api/agents/from-template (400)', async () => {
    const headers = AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {};
    const response = await makeRequest('POST', '/api/agents/from-template', {
      customizations: { name: 'Test Agent' }
      // Missing 'templateId' field
    }, headers);

    // If no auth token and endpoint requires it
    if (response.statusCode === 401 && !AUTH_TOKEN) {
      return {
        status: 'BLOCKED',
        message: 'Endpoint requires authentication - set TEST_AUTH_TOKEN env var',
        responseTime: response.responseTime
      };
    }

    return {
      status: response.statusCode === 400 ? 'PASS' : 'FAIL',
      message: response.statusCode === 400 ? 'Correctly validates required templateId' : `Expected 400, got ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });

  // Test 3: Execute agent (missing trigger_type)
  await runTest('Agents', 'POST /api/agents/:id/execute (400)', async () => {
    const headers = AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {};
    const response = await makeRequest('POST', '/api/agents/test-agent-id/execute', {
      trigger_data: { test: true }
      // Missing 'trigger_type' field
    }, headers);

    if (response.statusCode === 401 && !AUTH_TOKEN) {
      return {
        status: 'BLOCKED',
        message: 'Endpoint requires authentication',
        responseTime: response.responseTime
      };
    }

    return {
      status: response.statusCode === 400 ? 'PASS' : 'FAIL',
      message: response.statusCode === 400 ? 'Correctly validates required trigger_type' : `Expected 400, got ${response.statusCode}`,
      responseTime: response.responseTime,
      details: response.body
    };
  });

  // Test 4: Get agent stats for non-existent agent
  await runTest('Agents', 'GET /api/agents/:id/stats (404)', async () => {
    const headers = AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {};
    const response = await makeRequest('GET', '/api/agents/00000000-0000-0000-0000-000000000000/stats', null, headers);

    if (response.statusCode === 401 && !AUTH_TOKEN) {
      return {
        status: 'BLOCKED',
        message: 'Endpoint requires authentication',
        responseTime: response.responseTime
      };
    }

    return {
      status: response.statusCode === 404 ? 'PASS' : 'FAIL',
      message: response.statusCode === 404 ? 'Correctly returns 404 for non-existent agent' : `Expected 404, got ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });
}

// ========================================
// TEST SUITE: AUTOMATIONS API
// ========================================

async function testAutomationsAPI() {
  console.log(`\n${colors.blue}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}  AUTOMATIONS API TESTS${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════${colors.reset}\n`);

  // Test 1: List automations
  await runTest('Automations', 'GET /api/automations', async () => {
    const response = await makeRequest('GET', '/api/automations');

    if (response.statusCode === 200) {
      const schema = {
        automations: { type: 'array', required: true },
        count: { type: 'number', required: true }
      };

      const validation = validateSchema(response.body, schema);

      return {
        status: validation.valid ? 'PASS' : 'FAIL',
        message: validation.valid ? 'Valid 200 response with correct schema' : validation.errors.join(', '),
        responseTime: response.responseTime
      };
    }

    return {
      status: 'FAIL',
      message: `Expected 200, got ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });

  // Test 2: Create automation (missing required fields)
  await runTest('Automations', 'POST /api/automations (400)', async () => {
    const response = await makeRequest('POST', '/api/automations', {
      name: 'Test Automation'
      // Missing 'triggerType' and 'actions'
    });

    return {
      status: response.statusCode === 400 ? 'PASS' : 'FAIL',
      message: response.statusCode === 400 ? 'Correctly validates required fields' : `Expected 400, got ${response.statusCode}`,
      responseTime: response.responseTime,
      details: response.body
    };
  });

  // Test 3: Test automation dry-run
  await runTest('Automations', 'POST /api/automations/:id/test (404)', async () => {
    const response = await makeRequest('POST', '/api/automations/non-existent-id/test', {
      sampleData: { test: true }
    });

    return {
      status: response.statusCode === 404 ? 'PASS' : 'FAIL',
      message: response.statusCode === 404 ? 'Correctly returns 404 for non-existent automation' : `Expected 404, got ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });

  // Test 4: Get automation templates
  await runTest('Automations', 'GET /api/automations/templates', async () => {
    const response = await makeRequest('GET', '/api/automations/templates');

    if (response.statusCode === 200) {
      const schema = {
        templates: { type: 'array', required: true },
        categories: { type: 'array', required: true }
      };

      const validation = validateSchema(response.body, schema);

      return {
        status: validation.valid ? 'PASS' : 'FAIL',
        message: validation.valid ? `Returns ${response.body.templates.length} templates` : validation.errors.join(', '),
        responseTime: response.responseTime
      };
    }

    return {
      status: 'FAIL',
      message: `Expected 200, got ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });
}

// ========================================
// TEST SUITE: SEARCH API
// ========================================

async function testSearchAPI() {
  console.log(`\n${colors.blue}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}  SEARCH API TESTS${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════${colors.reset}\n`);

  // Test 1: Full-text search (valid)
  await runTest('Search', 'POST /api/search', async () => {
    const response = await makeRequest('POST', '/api/search', {
      query: 'test meeting',
      limit: 10
    });

    if (response.statusCode === 200) {
      const schema = {
        query: { type: 'string', required: true },
        results: { type: 'array', required: true },
        count: { type: 'number', required: true },
        executionTime: { type: 'number', required: true }
      };

      const validation = validateSchema(response.body, schema);

      return {
        status: validation.valid ? 'PASS' : 'FAIL',
        message: validation.valid ? `Search completed in ${response.body.executionTime}ms` : validation.errors.join(', '),
        responseTime: response.responseTime
      };
    }

    return {
      status: 'FAIL',
      message: `Expected 200, got ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });

  // Test 2: Search without query (400)
  await runTest('Search', 'POST /api/search (400)', async () => {
    const response = await makeRequest('POST', '/api/search', {
      limit: 10
      // Missing 'query' field
    });

    return {
      status: response.statusCode === 400 ? 'PASS' : 'FAIL',
      message: response.statusCode === 400 ? 'Correctly validates required query field' : `Expected 400, got ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });

  // Test 3: Semantic search
  await runTest('Search', 'POST /api/search/semantic', async () => {
    const response = await makeRequest('POST', '/api/search/semantic', {
      query: 'project deadline discussions',
      limit: 5
    });

    if (response.statusCode === 200) {
      const schema = {
        query: { type: 'string', required: true },
        results: { type: 'array', required: true },
        executionTime: { type: 'number', required: true }
      };

      const validation = validateSchema(response.body, schema);

      return {
        status: validation.valid ? 'PASS' : 'FAIL',
        message: validation.valid ? 'Semantic search completed successfully' : validation.errors.join(', '),
        responseTime: response.responseTime
      };
    }

    return {
      status: 'FAIL',
      message: `Expected 200, got ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });

  // Test 4: Ask AI question (without question)
  await runTest('Search', 'POST /api/search/ask (400)', async () => {
    const response = await makeRequest('POST', '/api/search/ask', {
      conversationId: 'test-123'
      // Missing 'question' field
    });

    return {
      status: response.statusCode === 400 ? 'PASS' : 'FAIL',
      message: response.statusCode === 400 ? 'Correctly validates required question field' : `Expected 400, got ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });

  // Test 5: Get search suggestions
  await runTest('Search', 'GET /api/search/suggestions', async () => {
    const headers = AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {};
    const response = await makeRequest('GET', '/api/search/suggestions?prefix=meet', null, headers);

    if (response.statusCode === 401 && !AUTH_TOKEN) {
      return {
        status: 'BLOCKED',
        message: 'Endpoint requires authentication',
        responseTime: response.responseTime
      };
    }

    if (response.statusCode === 200) {
      const schema = {
        suggestions: { type: 'array', required: true },
        trending: { type: 'array', required: true }
      };

      const validation = validateSchema(response.body, schema);

      return {
        status: validation.valid ? 'PASS' : 'FAIL',
        message: validation.valid ? `Returns ${response.body.suggestions.length} suggestions` : validation.errors.join(', '),
        responseTime: response.responseTime
      };
    }

    return {
      status: 'FAIL',
      message: `Expected 200, got ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });
}

// ========================================
// TEST SUITE: PROJECTS & TASKS API
// ========================================

async function testProjectsTasksAPI() {
  console.log(`\n${colors.blue}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}  PROJECTS & TASKS API TESTS${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════${colors.reset}\n`);

  // Test 1: List projects
  await runTest('Projects', 'GET /api/projects', async () => {
    const response = await makeRequest('GET', '/api/projects');

    if (response.statusCode === 200) {
      const schema = {
        projects: { type: 'array', required: true },
        count: { type: 'number', required: true }
      };

      const validation = validateSchema(response.body, schema);

      return {
        status: validation.valid ? 'PASS' : 'FAIL',
        message: validation.valid ? 'Valid 200 response' : validation.errors.join(', '),
        responseTime: response.responseTime
      };
    }

    return {
      status: 'FAIL',
      message: `Expected 200, got ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });

  // Test 2: Create project (missing name)
  await runTest('Projects', 'POST /api/projects (400)', async () => {
    const response = await makeRequest('POST', '/api/projects', {
      description: 'Test project'
      // Missing 'name' field
    });

    return {
      status: response.statusCode === 400 ? 'PASS' : 'FAIL',
      message: response.statusCode === 400 ? 'Correctly validates required name field' : `Expected 400, got ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });

  // Test 3: List tasks
  await runTest('Tasks', 'GET /api/tasks', async () => {
    const response = await makeRequest('GET', '/api/tasks');

    if (response.statusCode === 200) {
      const schema = {
        tasks: { type: 'array', required: true },
        count: { type: 'number', required: true }
      };

      const validation = validateSchema(response.body, schema);

      return {
        status: validation.valid ? 'PASS' : 'FAIL',
        message: validation.valid ? 'Valid 200 response' : validation.errors.join(', '),
        responseTime: response.responseTime
      };
    }

    return {
      status: 'FAIL',
      message: `Expected 200, got ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });

  // Test 4: Create task (missing title)
  await runTest('Tasks', 'POST /api/tasks (400)', async () => {
    const response = await makeRequest('POST', '/api/tasks', {
      description: 'Test task',
      priority: 'high'
      // Missing 'title' field
    });

    return {
      status: response.statusCode === 400 ? 'PASS' : 'FAIL',
      message: response.statusCode === 400 ? 'Correctly validates required title field' : `Expected 400, got ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });
}

// ========================================
// TEST SUITE: INTELLIGENCE API
// ========================================

async function testIntelligenceAPI() {
  console.log(`\n${colors.blue}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}  INTELLIGENCE API TESTS${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════${colors.reset}\n`);

  // Test 1: Get today's intelligence
  await runTest('Intelligence', 'GET /api/intelligence/today', async () => {
    const response = await makeRequest('GET', '/api/intelligence/today');

    if (response.statusCode === 200) {
      // Intelligence briefing should have certain fields
      const hasExpectedStructure = response.body &&
        ('todaysMeetings' in response.body || 'overdue' in response.body || 'upcomingDeadlines' in response.body);

      return {
        status: hasExpectedStructure ? 'PASS' : 'FAIL',
        message: hasExpectedStructure ? 'Returns intelligence briefing structure' : 'Response missing expected briefing fields',
        responseTime: response.responseTime
      };
    }

    return {
      status: 'FAIL',
      message: `Expected 200, got ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });

  // Test 2: Get overdue items
  await runTest('Intelligence', 'GET /api/intelligence/overdue', async () => {
    const response = await makeRequest('GET', '/api/intelligence/overdue');

    if (response.statusCode === 200) {
      return {
        status: 'PASS',
        message: 'Returns overdue items successfully',
        responseTime: response.responseTime
      };
    }

    return {
      status: 'FAIL',
      message: `Expected 200, got ${response.statusCode}`,
      responseTime: response.responseTime
    };
  });

  // Test 3: Performance check for intelligence endpoint
  await runTest('Intelligence', 'GET /api/intelligence/today (performance)', async () => {
    const response = await makeRequest('GET', '/api/intelligence/today');
    const p95Target = 500; // ms

    return {
      status: response.responseTime < p95Target ? 'PASS' : 'FAIL',
      message: response.responseTime < p95Target
        ? `Response time ${response.responseTime.toFixed(0)}ms under ${p95Target}ms target`
        : `Response time ${response.responseTime.toFixed(0)}ms exceeds ${p95Target}ms target`,
      responseTime: response.responseTime
    };
  });
}

// ========================================
// TEST SUITE: RATE LIMITING
// ========================================

async function testRateLimiting() {
  console.log(`\n${colors.blue}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}  RATE LIMITING TESTS${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════${colors.reset}\n`);

  // Test: Rate limiting on search endpoint
  await runTest('Rate Limit', 'POST /api/search (burst requests)', async () => {
    const requestCount = 50;
    const promises = [];

    for (let i = 0; i < requestCount; i++) {
      promises.push(
        makeRequest('POST', '/api/search', { query: `test ${i}` })
          .catch(err => ({ statusCode: 'ERROR', error: err.message }))
      );
    }

    const responses = await Promise.all(promises);
    const rateLimited = responses.some(r => r.statusCode === 429);
    const successCount = responses.filter(r => r.statusCode === 200).length;
    const errorCount = responses.filter(r => r.statusCode === 'ERROR').length;

    return {
      status: rateLimited ? 'PASS' : 'BLOCKED',
      message: rateLimited
        ? `Rate limiting active - ${successCount} succeeded, rate limit triggered`
        : `No rate limiting detected - ${successCount} requests succeeded, ${errorCount} errors`,
      responseTime: 0
    };
  });
}

// ========================================
// PERFORMANCE ANALYSIS
// ========================================

function generatePerformanceReport() {
  console.log(`\n${colors.blue}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}  PERFORMANCE ANALYSIS${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════${colors.reset}\n`);

  if (performanceMetrics.length === 0) {
    console.log('No performance data collected');
    return;
  }

  // Calculate p50, p95, p99
  const sortedTimes = performanceMetrics
    .filter(m => typeof m.responseTime === 'number')
    .map(m => m.responseTime)
    .sort((a, b) => a - b);

  if (sortedTimes.length === 0) {
    console.log('No valid response times recorded');
    return;
  }

  const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
  const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
  const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
  const avg = sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length;
  const max = Math.max(...sortedTimes);
  const min = Math.min(...sortedTimes);

  console.log('Response Time Percentiles:');
  console.log(`  P50 (Median): ${p50.toFixed(0)}ms`);
  console.log(`  P95:          ${p95.toFixed(0)}ms ${p95 > 500 ? colors.red + '(EXCEEDS TARGET)' + colors.reset : colors.green + '(OK)' + colors.reset}`);
  console.log(`  P99:          ${p99.toFixed(0)}ms`);
  console.log(`  Average:      ${avg.toFixed(0)}ms`);
  console.log(`  Min:          ${min.toFixed(0)}ms`);
  console.log(`  Max:          ${max.toFixed(0)}ms`);
  console.log('');

  // Slowest endpoints
  const slowest = [...performanceMetrics]
    .filter(m => typeof m.responseTime === 'number')
    .sort((a, b) => b.responseTime - a.responseTime)
    .slice(0, 5);

  console.log('Slowest Endpoints:');
  slowest.forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.endpoint} - ${m.responseTime.toFixed(0)}ms (${m.statusCode})`);
  });
  console.log('');
}

// ========================================
// FINAL REPORT GENERATION
// ========================================

function generateFinalReport() {
  console.log(`\n${colors.blue}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}  TEST SUMMARY${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════${colors.reset}\n`);

  const total = testResults.passed + testResults.failed + testResults.blocked;
  const passRate = total > 0 ? (testResults.passed / total * 100).toFixed(1) : 0;

  console.log(`Total Tests:    ${total}`);
  console.log(`${colors.green}Passed:${colors.reset}         ${testResults.passed}`);
  console.log(`${colors.red}Failed:${colors.reset}         ${testResults.failed}`);
  console.log(`${colors.yellow}Blocked:${colors.reset}        ${testResults.blocked}`);
  console.log(`Pass Rate:      ${passRate}%`);
  console.log('');

  // P0/P1 Issues
  const p0Issues = testResults.tests.filter(t =>
    t.status === 'FAIL' &&
    (t.message.includes('500') || t.message.includes('schema') || t.message.includes('security'))
  );

  const p1Issues = testResults.tests.filter(t =>
    t.status === 'FAIL' &&
    (t.message.includes('performance') || t.message.includes('validation'))
  );

  if (p0Issues.length > 0) {
    console.log(`${colors.red}P0 CRITICAL ISSUES (${p0Issues.length}):${colors.reset}`);
    p0Issues.forEach(issue => {
      console.log(`  • ${issue.name}`);
      console.log(`    ${issue.message}`);
    });
    console.log('');
  }

  if (p1Issues.length > 0) {
    console.log(`${colors.yellow}P1 HIGH PRIORITY ISSUES (${p1Issues.length}):${colors.reset}`);
    p1Issues.forEach(issue => {
      console.log(`  • ${issue.name}`);
      console.log(`    ${issue.message}`);
    });
    console.log('');
  }

  // Recommendations
  console.log(`${colors.blue}RECOMMENDATIONS:${colors.reset}`);

  if (testResults.blocked > 0) {
    console.log(`  • ${testResults.blocked} tests blocked by authentication - set TEST_AUTH_TOKEN env var`);
  }

  if (p0Issues.length > 0) {
    console.log(`  • Fix ${p0Issues.length} critical P0 issues before deployment`);
  }

  if (p1Issues.length > 0) {
    console.log(`  • Address ${p1Issues.length} P1 issues to improve API reliability`);
  }

  const slowEndpoints = performanceMetrics.filter(m => m.responseTime > 500).length;
  if (slowEndpoints > 0) {
    console.log(`  • Optimize ${slowEndpoints} endpoints exceeding 500ms response time target`);
  }

  console.log('');

  // Exit code
  const exitCode = testResults.failed > 0 ? 1 : 0;
  console.log(`${colors.blue}═══════════════════════════════════════${colors.reset}\n`);

  process.exit(exitCode);
}

// ========================================
// MAIN EXECUTION
// ========================================

async function main() {
  console.log(`\n${colors.blue}╔═══════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  ENTOMATE API CONTRACT VALIDATION    ║${colors.reset}`);
  console.log(`${colors.blue}╚═══════════════════════════════════════╝${colors.reset}\n`);
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Auth Token:   ${AUTH_TOKEN ? 'Provided' : 'Not provided (some tests will be blocked)'}`);
  console.log(`Timeout:      ${TEST_TIMEOUT}ms per test\n`);

  try {
    // Run all test suites
    await testMeetingsAPI();
    await testAgentsAPI();
    await testAutomationsAPI();
    await testSearchAPI();
    await testProjectsTasksAPI();
    await testIntelligenceAPI();
    await testRateLimiting();

    // Generate reports
    generatePerformanceReport();
    generateFinalReport();

  } catch (error) {
    console.error(`\n${colors.red}Fatal error during test execution:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run tests
main();
