import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { apiRouter } from './api/routes.js';
import { registerDefaultProviders } from './core/tentacle-manager.js';
import { moduleLoader } from './core/module-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// System Health Alias
app.get('/api/system/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'octopus-panel-backend',
    version: '0.1.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Serve Tentacle Node Installer Shell Script
const serveTentacleInstaller = (c: any) => {
  const candidatePaths = [
    path.resolve(process.cwd(), 'scripts/install-tentacle.sh'),
    path.resolve(__dirname, '../../../../scripts/install-tentacle.sh'),
    path.resolve(__dirname, '../../../scripts/install-tentacle.sh'),
    path.resolve(__dirname, '../../scripts/install-tentacle.sh'),
  ];
  const scriptPath = candidatePaths.find((p) => fs.existsSync(p));

  if (scriptPath) {
    const script = fs.readFileSync(scriptPath, 'utf-8');
    c.header('Content-Type', 'text/x-shellscript; charset=utf-8');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    return c.body(script);
  }

  return c.text('echo "Error: Tentacle installer script not found on panel server" >&2; exit 1\n', 404, {
    'Content-Type': 'text/plain; charset=utf-8',
  });
};

app.get('/install-tentacle.sh', serveTentacleInstaller);
app.get('/tentacle/install.sh', serveTentacleInstaller);

// Locate frontend dist directory across monorepo layouts
const candidateFrontendDirs = [
  path.resolve(process.cwd(), 'apps/frontend/dist'),
  path.resolve(__dirname, '../../../frontend/dist'),
  path.resolve(__dirname, '../../frontend/dist'),
];
const frontendDist = candidateFrontendDirs.find((dir) => fs.existsSync(dir));

if (frontendDist) {
  const relativeRoot = path.relative(process.cwd(), frontendDist).replace(/\\/g, '/');
  app.use('/*', serveStatic({ root: relativeRoot }));
  app.get('*', (c) => {
    const indexPath = path.join(frontendDist, 'index.html');
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath, 'utf-8');
      return c.html(html);
    }
    return c.text('OctopusPanel Frontend Loading...', 404);
  });
} else {
  // Root fallback when frontend not yet compiled
  app.get('/', (c) => {
    return c.json({
      name: 'OctopusPanel API',
      version: '0.1.0',
      documentation: '/docs',
      status: 'running',
    });
  });
}

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
