import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { loginSchema } from '../schemas/auth';
import { AuthService } from '../services/authService';
import { UserRepository } from '../repositories/userRepository';
import type { Env } from '../index';

const auth = new Hono<{ Bindings: Env }>();

auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const userRepository = new UserRepository(c.env.DB);
  const authService = new AuthService(userRepository, c.env.JWT_SECRET);

  const result = await authService.authenticateUser(email, password);

  if (!result) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  return c.json({
    token: result.token,
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    },
  });
});

export default auth;
