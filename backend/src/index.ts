import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import authRoutes from './routes/auth';

export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  STORAGE: R2Bucket;
  JWT_SECRET: string;
  APP_URL: string;
}

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', cors());
app.use('*', logger());

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', environment: 'local' });
});

// API routes
app.route('/api/v1/auth', authRoutes);
// app.route('/api/v1/fasts', fastRoutes);

export default app;
