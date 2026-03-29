const { z } = require('zod');

function validate(schema) {
  return (req, res, next) => {
    try {
      const result = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      req.validated = result;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issues = err.issues || err.errors || [];
        return res.status(400).json({
          error: 'Validation failed',
          details: issues.map(e => ({
            path: (e.path || []).join('.'),
            message: e.message
          }))
        });
      }
      next(err);
    }
  };
}

module.exports = { validate };
