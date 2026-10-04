import { Hono } from 'hono';
import { db, servers, subusers } from '@octopus/database';
import { eq, or } from 'drizzle-orm';
import { ApiErrorCode, Server, SessionUser, UserRole } from '@octopus/shared';
import { requireAuth } from '../../core/auth.js';
import { jsonError } from '../middleware/error.js';
import { globalProviders } from '@octopus/module-sdk';
import { AppEnv } from '../../types.js';

export const clientServersRouter = new Hono<AppEnv>();
clientServersRouter.use('*', requireAuth);

// GET /api/v1/client/servers
clientServersRouter.get('/', async (c) => {
  const user = c.get('user') as SessionUser;

  let userServers;
  if (user.role === UserRole.ADMIN) {
    userServers = await db.query.servers.findMany({
      with: {
        node: true,
        blueprint: true,
        allocation: true,
      },
    });
  } else {
    // User owned + subuser servers
    const userSubuserRecords = await db.query.subusers.findMany({
      where: eq(subusers.userId, user.id),
    });
    const subuserServerIds = userSubuserRecords.map((s) => s.serverId);

    userServers = await db.query.servers.findMany({
      where: subuserServerIds.length > 0 ? or(eq(servers.userId, user.id)) : eq(servers.userId, user.id),
      with: {
        node: true,
        blueprint: true,
        allocation: true,
      },
    });
  }

  return c.json({
    success: true,
    data: userServers,
  });
});

// GET /api/v1/client/servers/:id
clientServersRouter.get('/:id', async (c) => {
  const user = c.get('user') as SessionUser;
  const param = c.req.param('id');
  const isNumeric = /^\d+$/.test(param);

  const server = await db.query.servers.findFirst({
    where: isNumeric ? eq(servers.id, parseInt(param, 10)) : eq(servers.uuid, param),
    with: {
      node: true,
      blueprint: true,
      allocation: true,
    },
  });

  if (!server) {
    return jsonError(c, ApiErrorCode.SERVER_NOT_FOUND, 404, { id: param }, 'Server not found');
  }

  // Permission check
  if (user.role !== UserRole.ADMIN && server.userId !== user.id) {
    const subuser = await db.query.subusers.findFirst({
      where: eq(subusers.serverId, server.id),
    });
    if (!subuser || subuser.userId !== user.id) {
      return jsonError(c, ApiErrorCode.AUTH_FORBIDDEN, 403, {}, 'Access to server denied');
    }
  }

  // Fetch live metrics
  let metrics = null;
  try {
    const driver = globalProviders.get(server.providerType) || globalProviders.getDefault();
    metrics = await driver.getMetrics(server as unknown as Server);
  } catch (err) {
    metrics = null;
  }

  return c.json({
    success: true,
    data: {
      ...server,
      metrics,
    },
  });
});

// PUT /api/v1/client/servers/:id
clientServersRouter.put('/:id', async (c) => {
  const user = c.get('user') as SessionUser;
  const param = c.req.param('id');
  const isNumeric = /^\d+$/.test(param);

  const server = await db.query.servers.findFirst({
    where: isNumeric ? eq(servers.id, parseInt(param, 10)) : eq(servers.uuid, param),
  });

  if (!server) {
    return jsonError(c, ApiErrorCode.SERVER_NOT_FOUND, 404, { id: param }, 'Server not found');
  }

  if (user.role !== UserRole.ADMIN && server.userId !== user.id) {
    return jsonError(c, ApiErrorCode.AUTH_FORBIDDEN, 403, {}, 'Access to server denied');
  }

  const body = await c.req.json().catch(() => ({}));
  const updateData: any = { updatedAt: new Date() };
  if (typeof body.name === 'string' && body.name.trim()) updateData.name = body.name.trim();
  if (typeof body.description === 'string') updateData.description = body.description.trim();
  if (typeof body.dockerImage === 'string' && body.dockerImage.trim()) updateData.dockerImage = body.dockerImage.trim();

  const [updated] = await db
    .update(servers)
    .set(updateData)
    .where(eq(servers.id, server.id))
    .returning();

  return c.json({
    success: true,
    data: updated,
  });
});
