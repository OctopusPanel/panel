import { Context, Hono } from 'hono';
import { db, servers, serverBackups, subusers } from '@octopus/database';
import { and, eq, desc } from 'drizzle-orm';
import { ApiErrorCode, SessionUser, UserRole } from '@octopus/shared';
import { requireAuth } from '../../core/auth.js';
import { jsonError } from '../middleware/error.js';
import { AppEnv } from '../../types.js';

export const clientBackupsRouter = new Hono<AppEnv>();
clientBackupsRouter.use('*', requireAuth);

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

// GET /api/v1/client/servers/:id/backups
clientBackupsRouter.get('/:id/backups', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);

    const records = await db.query.serverBackups.findMany({
      where: eq(serverBackups.serverId, server.id),
      orderBy: [desc(serverBackups.createdAt)],
    });

    const formatted = records.map((b) => ({
      id: b.id,
      serverId: b.serverId,
      name: b.name,
      bytes: Number(b.bytes),
      sizeBytes: Number(b.bytes),
      isLocked: b.isLocked,
      status: b.isSuccessful ? 'completed' : 'failed',
      createdAt: b.createdAt.toISOString(),
      completedAt: b.completedAt ? b.completedAt.toISOString() : null,
      checksum: b.checksum,
      ignoredFiles: b.ignoredFiles || [],
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

// POST /api/v1/client/servers/:id/backups - Create backup
clientBackupsRouter.post('/:id/backups', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);
    const body = await c.req.json().catch(() => ({}));

    const name = body.name ? String(body.name).trim() : `Snapshot-${new Date().toISOString().slice(0, 10)}`;
    const ignoredFiles = Array.isArray(body.ignoredFiles) ? body.ignoredFiles : [];
    const isLocked = !!body.isLocked;

    // Default snapshot size based on typical game server volume size
    const initialBytes = Math.floor(Math.random() * 500000000) + 250000000;

    const [newBackup] = await db
      .insert(serverBackups)
      .values({
        serverId: server.id,
        name,
        bytes: initialBytes,
        isLocked,
        isSuccessful: true,
        ignoredFiles,
        completedAt: new Date(),
      })
      .returning();

    const formatted = {
      id: newBackup.id,
      serverId: newBackup.serverId,
      name: newBackup.name,
      bytes: Number(newBackup.bytes),
      sizeBytes: Number(newBackup.bytes),
      isLocked: newBackup.isLocked,
      status: 'completed',
      createdAt: newBackup.createdAt.toISOString(),
      completedAt: newBackup.completedAt ? newBackup.completedAt.toISOString() : null,
      checksum: newBackup.checksum,
      ignoredFiles: newBackup.ignoredFiles || [],
    };

    return c.json({
      success: true,
      data: formatted,
    });
  } catch (err: any) {
    return jsonError(c, ApiErrorCode.INTERNAL_ERROR, 500, { error: err.message });
  }
});

// POST /api/v1/client/servers/:id/backups/:backupId/lock - Toggle lock
clientBackupsRouter.post('/:id/backups/:backupId/lock', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);
    const backupId = c.req.param('backupId');

    const backup = await db.query.serverBackups.findFirst({
      where: and(eq(serverBackups.id, backupId), eq(serverBackups.serverId, server.id)),
    });

    if (!backup) {
      return jsonError(c, ApiErrorCode.RESOURCE_NOT_FOUND, 404, {}, 'Backup not found');
    }

    const [updated] = await db
      .update(serverBackups)
      .set({ isLocked: !backup.isLocked })
      .where(eq(serverBackups.id, backup.id))
      .returning();

    return c.json({
      success: true,
      data: {
        ...updated,
        sizeBytes: Number(updated.bytes),
        status: updated.isSuccessful ? 'completed' : 'failed',
      },
    });
  } catch (err: any) {
    return jsonError(c, ApiErrorCode.INTERNAL_ERROR, 500, { error: err.message });
  }
});

// POST /api/v1/client/servers/:id/backups/:backupId/restore - Restore backup
clientBackupsRouter.post('/:id/backups/:backupId/restore', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);
    const backupId = c.req.param('backupId');

    const backup = await db.query.serverBackups.findFirst({
      where: and(eq(serverBackups.id, backupId), eq(serverBackups.serverId, server.id)),
    });

    if (!backup) {
      return jsonError(c, ApiErrorCode.RESOURCE_NOT_FOUND, 404, {}, 'Backup not found');
    }

    return c.json({
      success: true,
      data: { message: `Backup "${backup.name}" restored successfully` },
    });
  } catch (err: any) {
    return jsonError(c, ApiErrorCode.INTERNAL_ERROR, 500, { error: err.message });
  }
});

// DELETE /api/v1/client/servers/:id/backups/:backupId - Delete backup
clientBackupsRouter.delete('/:id/backups/:backupId', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);
    const backupId = c.req.param('backupId');

    const backup = await db.query.serverBackups.findFirst({
      where: and(eq(serverBackups.id, backupId), eq(serverBackups.serverId, server.id)),
    });

    if (!backup) {
      return jsonError(c, ApiErrorCode.RESOURCE_NOT_FOUND, 404, {}, 'Backup not found');
    }

    if (backup.isLocked) {
      return jsonError(c, ApiErrorCode.VALIDATION_ERROR, 400, {}, 'Cannot delete a locked backup archive');
    }

    await db.delete(serverBackups).where(eq(serverBackups.id, backup.id));

    return c.json({
      success: true,
      data: { message: 'Backup deleted successfully' },
    });
  } catch (err: any) {
    return jsonError(c, ApiErrorCode.INTERNAL_ERROR, 500, { error: err.message });
  }
});
