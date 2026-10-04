import { Context, Hono } from 'hono';
import { db, servers, serverSchedules, subusers } from '@octopus/database';
import { and, eq, desc } from 'drizzle-orm';
import { ApiErrorCode, SessionUser, UserRole } from '@octopus/shared';
import { requireAuth } from '../../core/auth.js';
import { jsonError } from '../middleware/error.js';
import { AppEnv } from '../../types.js';

export const clientSchedulesRouter = new Hono<AppEnv>();
clientSchedulesRouter.use('*', requireAuth);

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

// GET /api/v1/client/servers/:id/schedules
clientSchedulesRouter.get('/:id/schedules', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);

    const records = await db.query.serverSchedules.findMany({
      where: eq(serverSchedules.serverId, server.id),
      orderBy: [desc(serverSchedules.createdAt)],
    });

    const formatted = records.map((s) => ({
      id: s.id,
      serverId: s.serverId,
      name: s.name,
      cron: s.cron,
      isActive: s.isActive,
      tasks: s.tasks || [],
      lastRunAt: s.lastRunAt ? s.lastRunAt.toISOString() : null,
      nextRunAt: s.nextRunAt ? s.nextRunAt.toISOString() : new Date(Date.now() + 3600000).toISOString(),
      createdAt: s.createdAt.toISOString(),
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

// POST /api/v1/client/servers/:id/schedules - Create schedule
clientSchedulesRouter.post('/:id/schedules', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);
    const body = await c.req.json().catch(() => ({}));

    const name = String(body.name || 'Automated Schedule').trim();
    const cron = String(body.cron || '0 4 * * *').trim();
    const tasks = Array.isArray(body.tasks) ? body.tasks : [];
    const isActive = body.isActive !== undefined ? !!body.isActive : true;

    const [created] = await db
      .insert(serverSchedules)
      .values({
        serverId: server.id,
        name,
        cron,
        tasks,
        isActive,
        nextRunAt: new Date(Date.now() + 86400000),
      })
      .returning();

    const formatted = {
      id: created.id,
      serverId: created.serverId,
      name: created.name,
      cron: created.cron,
      isActive: created.isActive,
      tasks: created.tasks || [],
      lastRunAt: created.lastRunAt ? created.lastRunAt.toISOString() : null,
      nextRunAt: created.nextRunAt ? created.nextRunAt.toISOString() : null,
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

// PUT /api/v1/client/servers/:id/schedules/:schedId - Update schedule
clientSchedulesRouter.put('/:id/schedules/:schedId', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);
    const schedId = c.req.param('schedId');
    const body = await c.req.json().catch(() => ({}));

    const target = await db.query.serverSchedules.findFirst({
      where: and(eq(serverSchedules.id, schedId), eq(serverSchedules.serverId, server.id)),
    });

    if (!target) {
      return jsonError(c, ApiErrorCode.RESOURCE_NOT_FOUND, 404, {}, 'Schedule not found');
    }

    const updateData: any = {};
    if (typeof body.isActive === 'boolean') updateData.isActive = body.isActive;
    if (typeof body.name === 'string' && body.name.trim()) updateData.name = body.name.trim();
    if (typeof body.cron === 'string' && body.cron.trim()) updateData.cron = body.cron.trim();
    if (Array.isArray(body.tasks)) updateData.tasks = body.tasks;

    const [updated] = await db
      .update(serverSchedules)
      .set(updateData)
      .where(eq(serverSchedules.id, target.id))
      .returning();

    return c.json({
      success: true,
      data: {
        id: updated.id,
        serverId: updated.serverId,
        name: updated.name,
        cron: updated.cron,
        isActive: updated.isActive,
        tasks: updated.tasks || [],
        lastRunAt: updated.lastRunAt ? updated.lastRunAt.toISOString() : null,
        nextRunAt: updated.nextRunAt ? updated.nextRunAt.toISOString() : null,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (err: any) {
    return jsonError(c, ApiErrorCode.INTERNAL_ERROR, 500, { error: err.message });
  }
});

// DELETE /api/v1/client/servers/:id/schedules/:schedId
clientSchedulesRouter.delete('/:id/schedules/:schedId', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);
    const schedId = c.req.param('schedId');

    const target = await db.query.serverSchedules.findFirst({
      where: and(eq(serverSchedules.id, schedId), eq(serverSchedules.serverId, server.id)),
    });

    if (!target) {
      return jsonError(c, ApiErrorCode.RESOURCE_NOT_FOUND, 404, {}, 'Schedule not found');
    }

    await db.delete(serverSchedules).where(eq(serverSchedules.id, target.id));

    return c.json({
      success: true,
      data: { message: 'Schedule deleted successfully' },
    });
  } catch (err: any) {
    return jsonError(c, ApiErrorCode.INTERNAL_ERROR, 500, { error: err.message });
  }
});
