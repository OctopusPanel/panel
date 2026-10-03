import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { config } from './config.js';
import { apiRouter } from './api/routes.js';
import { registerDefaultProviders } from './core/tentacle-manager.js';
import { moduleLoader } from './core/module-loader.js';

const app = new Hono();

// Global Middlewares
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposeHeaders: ['Content-Length', 'X-Request-Id'],
    maxAge: 86400,
  }),
);

// Mount API
app.route('/api/v1', apiRouter);

// Root fallback / health
app.get('/', (c) => {
  return c.json({
    name: 'OctopusPanel API',
    version: '0.1.0',
    documentation: '/docs',
    status: 'running',
  });
});

async function bootstrap() {
  console.log('🐙 Initializing OctopusPanel Core Engine...');

  // Register Built-in Providers
  registerDefaultProviders();

  // Initialize Module Loader
  try {
    await moduleLoader.init();
  } catch (err) {
    console.warn('Module loader initialization skipped/failed:', err);
  }

  // Start HTTP Server
  serve(
    {
      fetch: app.fetch,
      port: config.port,
      hostname: config.host,
    },
    (info) => {
      console.log(`🚀 OctopusPanel API listening on http://${info.address}:${info.port}`);
    },
  );
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});

export default app;
