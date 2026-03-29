/**
 * Validation Middleware Tests
 *
 * Tests the Zod-based request validation middleware.
 */

const { z } = require('zod');
const { validate } = require('../middleware/validate');

// Helper to create mock Express req/res/next
function createMocks(overrides = {}) {
  const req = {
    body: {},
    query: {},
    params: {},
    ...overrides
  };

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };

  const next = jest.fn();

  return { req, res, next };
}

describe('validate middleware', () => {
  // A schema that validates body.name (required string) and query.page (optional number)
  const testSchema = z.object({
    body: z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.string().email('Invalid email').optional()
    }),
    query: z.object({
      page: z.coerce.number().int().positive().optional()
    }).optional(),
    params: z.object({}).optional()
  });

  it('should call next() when input is valid', () => {
    const middleware = validate(testSchema);
    const { req, res, next } = createMocks({
      body: { name: 'Test User' }
    });

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should attach validated data to req.validated', () => {
    const middleware = validate(testSchema);
    const { req, res, next } = createMocks({
      body: { name: 'Test User', email: 'test@example.com' }
    });

    middleware(req, res, next);

    expect(req.validated).toBeDefined();
    expect(req.validated.body.name).toBe('Test User');
    expect(req.validated.body.email).toBe('test@example.com');
  });

  it('should return 400 when required field is missing', () => {
    const middleware = validate(testSchema);
    const { req, res, next } = createMocks({
      body: {} // name is missing
    });

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation failed'
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return proper error format with path and message', () => {
    const middleware = validate(testSchema);
    const { req, res, next } = createMocks({
      body: {} // name is missing
    });

    middleware(req, res, next);

    const response = res.json.mock.calls[0][0];
    expect(response.details).toBeInstanceOf(Array);
    expect(response.details.length).toBeGreaterThan(0);
    expect(response.details[0]).toHaveProperty('path');
    expect(response.details[0]).toHaveProperty('message');
  });

  it('should validate email format when provided', () => {
    const middleware = validate(testSchema);
    const { req, res, next } = createMocks({
      body: { name: 'Test', email: 'not-an-email' }
    });

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const response = res.json.mock.calls[0][0];
    expect(response.details.some(d => d.message.includes('email') || d.message.includes('Invalid'))).toBe(true);
  });

  it('should return multiple errors when multiple fields are invalid', () => {
    const strictSchema = z.object({
      body: z.object({
        name: z.string().min(1),
        age: z.number().positive()
      }),
      query: z.object({}).optional(),
      params: z.object({}).optional()
    });

    const middleware = validate(strictSchema);
    const { req, res, next } = createMocks({
      body: { name: '', age: -1 }
    });

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const response = res.json.mock.calls[0][0];
    expect(response.details.length).toBeGreaterThanOrEqual(2);
  });

  it('should pass non-Zod errors to next()', () => {
    // Create a schema that throws a non-Zod error
    const brokenSchema = {
      parse: () => { throw new Error('Unexpected failure'); }
    };

    const middleware = validate(brokenSchema);
    const { req, res, next } = createMocks();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('Unexpected failure');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should handle valid input with all optional fields', () => {
    const middleware = validate(testSchema);
    const { req, res, next } = createMocks({
      body: { name: 'Test' },
      query: {},
      params: {}
    });

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
