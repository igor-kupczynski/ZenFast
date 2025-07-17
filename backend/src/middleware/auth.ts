import { Context, Next } from 'hono';
import { AuthService, AuthTokenPayload } from '../services/authService';
import { UserRepository } from '../repositories/userRepository';
import type { Env } from '../index';

export async function authenticate(
  c: Context<{ Bindings: Env; Variables: { userId: string; user: AuthTokenPayload } }>,
  next: Next
) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const userRepository = new UserRepository(c.env.DB);
    const authService = new AuthService(userRepository, c.env.JWT_SECRET);

    const payload = await authService.verifyJWT(token);

    // Set user info in context for downstream handlers
    c.set('userId', payload.sub);
    c.set('user', payload);

    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
}
