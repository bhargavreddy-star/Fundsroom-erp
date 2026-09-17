const { ZodError } = require('zod');

/**
 * Middleware factory to validate request against a Zod schema
 * @param {import('zod').ZodSchema} schema - Zod validation schema
 * @param {'body' | 'query' | 'params'} source - Property on req to validate
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errorCode: 'VALIDATION_ERROR',
          errors,
        });
      }
      next(error);
    }
  };
};

module.exports = { validate };
