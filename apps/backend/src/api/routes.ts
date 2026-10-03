import { Hono } from 'hono';
import { authRouter } from './auth/index.js';
import { adminNodesRouter } from './admin/nodes.js';
import { adminBlueprintsRouter } from './admin/blueprints.js';
import { adminAllocationsRouter } from './admin/allocations.js';
import { adminServersRouter } from './admin/servers.js';
import { adminUsersRouter } from './admin/users.js';
import { adminModulesRouter } from './admin/modules.js';
import { clientServersRouter } from './client/servers.js';
import { clientPowerRouter } from './client/power.js';
import { clientFilesRouter } from './client/files.js';
import { clientWsRouter } from './client/websocket.js';
import { AppEnv } from '../types.js';

export const apiRouter = new Hono<AppEnv>();

// System Health
apiRouter.get('/system/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'octopus-panel-backend',
    version: '0.1.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Authentication
apiRouter.route('/auth', authRouter);

// Admin Routes
apiRouter.route('/admin/nodes', adminNodesRouter);
apiRouter.route('/admin/blueprints', adminBlueprintsRouter);
apiRouter.route('/admin/allocations', adminAllocationsRouter);
apiRouter.route('/admin/servers', adminServersRouter);
apiRouter.route('/admin/users', adminUsersRouter);
apiRouter.route('/admin/modules', adminModulesRouter);

// Client Routes
apiRouter.route('/client/servers', clientServersRouter);
apiRouter.route('/client/servers', clientPowerRouter);
apiRouter.route('/client/servers', clientFilesRouter);
apiRouter.route('/client/servers', clientWsRouter);
