import { Context, Hono } from 'hono';
import { db, servers, allocations, subusers } from '@octopus/database';
import { and, eq, isNull } from 'drizzle-orm';
import { ApiErrorCode, SessionUser, UserRole } from '@octopus/shared';
import { requireAuth } from '../../core/auth.js';
import { jsonError } from '../middleware/error.js';
import { AppEnv } from '../../types.js';

export const clientAllocationsRouter = new Hono<AppEnv>();
clientAllocationsRouter.use('*', requireAuth);

async function getServerAndAuthorize(c: Context<AppEnv>) {
  const user = c.get('user') as SessionUser;
  const param = c.req.param('id');
  if (!param) {
    throw new Error(ApiErrorCode.SERVER_NOT_FOUND);
  }
  const isNumeric = /^\d+$/.test(param);

  const server = await db.query.servers.findFirst({
    where: isNumeric ? eq(servers.id, parseInt(param, 10)) : eq(servers.uuid, param),
    with: {
      allocation: true,
    },
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

// GET /api/v1/client/servers/:id/allocations
clientAllocationsRouter.get('/:id/allocations', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);

    const allocList = await db.query.allocations.findMany({
      where: eq(allocations.serverId, server.id),
      orderBy: (allocs, { asc }) => [asc(allocs.port)],
    });

    const formatted = allocList.map((a) => ({
      id: a.id,
      nodeId: a.nodeId,
      ipAddress: a.ipAddress,
      port: a.port,
      alias: a.alias,
      note: a.note || (a.id === server.allocationId ? 'Primary Game Port' : 'Secondary Port'),
      isPrimary: a.id === server.allocationId,
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

// POST /api/v1/client/servers/:id/allocations - Request additional port
clientAllocationsRouter.post('/:id/allocations', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);
    const body = await c.req.json().catch(() => ({}));
    const note = body.note ? String(body.note).trim() : 'Additional Port';

    const freeAlloc = await db.query.allocations.findFirst({
      where: and(eq(allocations.nodeId, server.nodeId), isNull(allocations.serverId)),
      orderBy: (allocs, { asc }) => [asc(allocs.port)],
    });

    if (!freeAlloc) {
      return jsonError(
        c,
        ApiErrorCode.VALIDATION_ERROR,
        400,
        {},
        'No free port allocations available on this node. Please contact administrator.',
      );
    }

    const [assigned] = await db
      .update(allocations)
      .set({
        serverId: server.id,
        note,
      })
      .where(eq(allocations.id, freeAlloc.id))
      .returning();

    return c.json({
      success: true,
      data: {
        ...assigned,
        isPrimary: false,
      },
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

// POST /api/v1/client/servers/:id/allocations/:allocId/primary
clientAllocationsRouter.post('/:id/allocations/:allocId/primary', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);
    const allocId = parseInt(c.req.param('allocId'), 10);

    const alloc = await db.query.allocations.findFirst({
      where: and(eq(allocations.id, allocId), eq(allocations.serverId, server.id)),
    });

    if (!alloc) {
      return jsonError(c, ApiErrorCode.RESOURCE_NOT_FOUND, 404, {}, 'Allocation not found on this server');
    }

    await db.update(servers).set({ allocationId: alloc.id }).where(eq(servers.id, server.id));

    return c.json({
      success: true,
      data: { message: 'Primary port updated successfully' },
    });
  } catch (err: any) {
    return jsonError(c, ApiErrorCode.INTERNAL_ERROR, 500, { error: err.message });
  }
});

// POST /api/v1/client/servers/:id/allocations/:allocId/alias
clientAllocationsRouter.post('/:id/allocations/:allocId/alias', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);
    const allocId = parseInt(c.req.param('allocId'), 10);
    const body = await c.req.json().catch(() => ({}));

    const alloc = await db.query.allocations.findFirst({
      where: and(eq(allocations.id, allocId), eq(allocations.serverId, server.id)),
    });

    if (!alloc) {
      return jsonError(c, ApiErrorCode.RESOURCE_NOT_FOUND, 404, {}, 'Allocation not found on this server');
    }

    const [updated] = await db
      .update(allocations)
      .set({
        alias: body.alias !== undefined ? (body.alias ? String(body.alias).trim() : null) : alloc.alias,
        note: body.note !== undefined ? (body.note ? String(body.note).trim() : null) : alloc.note,
      })
      .where(eq(allocations.id, alloc.id))
      .returning();

    return c.json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    return jsonError(c, ApiErrorCode.INTERNAL_ERROR, 500, { error: err.message });
  }
});

// DELETE /api/v1/client/servers/:id/allocations/:allocId
clientAllocationsRouter.delete('/:id/allocations/:allocId', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);
    const allocId = parseInt(c.req.param('allocId'), 10);

    const alloc = await db.query.allocations.findFirst({
      where: and(eq(allocations.id, allocId), eq(allocations.serverId, server.id)),
    });

    if (!alloc) {
      return jsonError(c, ApiErrorCode.RESOURCE_NOT_FOUND, 404, {}, 'Allocation not found on this server');
    }

    if (alloc.id === server.allocationId) {
      return jsonError(
        c,
        ApiErrorCode.VALIDATION_ERROR,
        400,
        {},
        'Cannot delete primary port allocation. Please designate another allocation as primary first.',
      );
    }

    await db
      .update(allocations)
      .set({
        serverId: null,
        alias: null,
        note: null,
      })
      .where(eq(allocations.id, alloc.id));

    return c.json({
      success: true,
      data: { message: 'Allocation released successfully' },
    });
  } catch (err: any) {
    return jsonError(c, ApiErrorCode.INTERNAL_ERROR, 500, { error: err.message });
  }
});
