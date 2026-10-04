import { Context, Hono } from 'hono';
import crypto from 'node:crypto';
import { db, servers, serverDatabases, subusers } from '@octopus/database';
import { and, eq, desc } from 'drizzle-orm';
import { ApiErrorCode, SessionUser, UserRole } from '@octopus/shared';
import { requireAuth } from '../../core/auth.js';
import { jsonError } from '../middleware/error.js';
import { AppEnv } from '../../types.js';

export const clientDatabasesRouter = new Hono<AppEnv>();
clientDatabasesRouter.use('*', requireAuth);

async function getServerAndAuthorize(c: Context<AppEnv>) {
  const user = c.get('user') as SessionUser;
  const param = c.req.param('id');
  if (!param) {
    throw new Error(ApiErrorCode.SERVER_NOT_FOUND);
  }
  const isNumeric = /^\d+$/.test(param);

  const server = await db.query.servers.findFirst({
    where: isNumeric ? eq(servers.id, parseInt(param, 10)) : eq(servers.uuid, param),
  });

  if (!server) {
    throw new Error(ApiErrorCode.SERVER_NOT_FOUND);
  }

  if (user.role !== UserRole.ADMIN && server.userId !== user.id) {
    const subuser = await db.query.subusers.findFirst({
      where: and(eq(subusers.serverId, server.id), eq(subusers.userId, user.id)),
    });
    if (!subuser) {
      throw new Error(ApiErrorCode.AUTH_FORBIDDEN);
    }
  }

  return server;
}

function generateSecurePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let pass = '';
  for (let i = 0; i < 20; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

// GET /api/v1/client/servers/:id/databases
clientDatabasesRouter.get('/:id/databases', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);

    const records = await db.query.serverDatabases.findMany({
      where: eq(serverDatabases.serverId, server.id),
      orderBy: [desc(serverDatabases.createdAt)],
    });

    const formatted = records.map((d) => ({
      id: d.id,
      serverId: d.serverId,
      name: d.name,
      username: d.username,
      password: d.password,
      host: d.host,
      port: d.port,
      databaseType: d.databaseType,
      maxConnections: d.maxConnections,
      createdAt: d.createdAt.toISOString(),
    }));

    return c.json({
      success: true,
      data: formatted,
    });
  } catch (err: any) {
    if (err.message === ApiErrorCode.SERVER_NOT_FOUND) {
      return jsonError(c, ApiErrorCode.SERVER_NOT_FOUND, 404, {}, 'Server not found');
    }
    if (err.message === ApiErrorCode.AUTH_FORBIDDEN) {
      return jsonError(c, ApiErrorCode.AUTH_FORBIDDEN, 403, {}, 'Access to server denied');
    }
    return jsonError(c, ApiErrorCode.INTERNAL_ERROR, 500, { error: err.message });
  }
});

// POST /api/v1/client/servers/:id/databases - Create database
clientDatabasesRouter.post('/:id/databases', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);
    const body = await c.req.json().catch(() => ({}));

    const dbType = body.databaseType === 'postgres' ? 'postgres' : 'mysql';
    const randSuffix = crypto.randomBytes(3).toString('hex');
    const rawName = body.name ? String(body.name).replace(/[^a-zA-Z0-9_]/g, '') : '';
    const dbName = rawName ? `s${server.id}_${rawName}` : `s${server.id}_db_${randSuffix}`;
    const username = `u${server.id}_${randSuffix}`;
    const password = generateSecurePassword();

    const [created] = await db
      .insert(serverDatabases)
      .values({
        serverId: server.id,
        name: dbName,
        username,
        password,
        host: '127.0.0.1',
        port: dbType === 'mysql' ? 3306 : 5432,
        databaseType: dbType,
        maxConnections: 10,
      })
      .returning();

    const formatted = {
      id: created.id,
      serverId: created.serverId,
      name: created.name,
      username: created.username,
      password: created.password,
      host: created.host,
      port: created.port,
      databaseType: created.databaseType,
      maxConnections: created.maxConnections,
      createdAt: created.createdAt.toISOString(),
    };

    return c.json({
      success: true,
      data: formatted,
    });
  } catch (err: any) {
    return jsonError(c, ApiErrorCode.INTERNAL_ERROR, 500, { error: err.message });
  }
});

// POST /api/v1/client/servers/:id/databases/:dbId/reset-password
clientDatabasesRouter.post('/:id/databases/:dbId/reset-password', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);
    const dbId = c.req.param('dbId');

    const targetDb = await db.query.serverDatabases.findFirst({
      where: and(eq(serverDatabases.id, dbId), eq(serverDatabases.serverId, server.id)),
    });

    if (!targetDb) {
      return jsonError(c, ApiErrorCode.RESOURCE_NOT_FOUND, 404, {}, 'Database not found');
    }

    const newPassword = generateSecurePassword();

    const [updated] = await db
      .update(serverDatabases)
      .set({ password: newPassword })
      .where(eq(serverDatabases.id, targetDb.id))
      .returning();

    const formatted = {
      id: updated.id,
      serverId: updated.serverId,
      name: updated.name,
      username: updated.username,
      password: updated.password,
      host: updated.host,
      port: updated.port,
      databaseType: updated.databaseType,
      maxConnections: updated.maxConnections,
      createdAt: updated.createdAt.toISOString(),
    };

    return c.json({
      success: true,
      data: {
        database: formatted,
      },
    });
  } catch (err: any) {
    return jsonError(c, ApiErrorCode.INTERNAL_ERROR, 500, { error: err.message });
  }
});

// DELETE /api/v1/client/servers/:id/databases/:dbId
clientDatabasesRouter.delete('/:id/databases/:dbId', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);
    const dbId = c.req.param('dbId');

    const targetDb = await db.query.serverDatabases.findFirst({
      where: and(eq(serverDatabases.id, dbId), eq(serverDatabases.serverId, server.id)),
    });

    if (!targetDb) {
      return jsonError(c, ApiErrorCode.RESOURCE_NOT_FOUND, 404, {}, 'Database not found');
    }

    await db.delete(serverDatabases).where(eq(serverDatabases.id, targetDb.id));

    return c.json({
      success: true,
      data: { message: 'Database deleted successfully' },
    });
  } catch (err: any) {
    return jsonError(c, ApiErrorCode.INTERNAL_ERROR, 500, { error: err.message });
  }
});
