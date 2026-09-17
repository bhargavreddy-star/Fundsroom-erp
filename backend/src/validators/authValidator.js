const { z } = require('zod');

const loginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters long').max(50),
  password: z.string().min(5, 'Password must be at least 5 characters long'),
});

module.exports = {
  loginSchema,
};
