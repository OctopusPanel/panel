import { Context, Hono } from 'hono';
import { db, servers, subusers, users } from '@octopus/database';
import { and, eq, desc } from 'drizzle-orm';
import { ApiErrorCode, SessionUser, UserRole } from '@octopus/shared';
import { requireAuth } from '../../core/auth.js';
import { jsonError } from '../middleware/error.js';
import { AppEnv } from '../../types.js';

export const clientSubusersRouter = new Hono<AppEnv>();
clientSubusersRouter.use('*', requireAuth);

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

  // Only server owner or admin can manage subusers
  if (user.role !== UserRole.ADMIN && server.userId !== user.id) {
    throw new Error(ApiErrorCode.AUTH_FORBIDDEN);
  }

  return server;
}

// GET /api/v1/client/servers/:id/subusers
clientSubusersRouter.get('/:id/subusers', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);

    const records = await db.query.subusers.findMany({
      where: eq(subusers.serverId, server.id),
      with: {
        user: true,
      },
      orderBy: [desc(subusers.createdAt)],
    });

    const formatted = records.map((sub) => ({
      id: sub.id,
      userId: sub.userId,
      username: sub.user?.username || 'Collaborator',
      email: sub.user?.email || 'collaborator@example.com',
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${sub.user?.username || sub.id}`,
      permissions: sub.permissions || [],
      createdAt: sub.createdAt.toISOString(),
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
      return jsonError(c, ApiErrorCode.AUTH_FORBIDDEN, 403, {}, 'Only the server owner can manage collaborators');
    }
    return jsonError(c, ApiErrorCode.INTERNAL_ERROR, 500, { error: err.message });
  }
});

// POST /api/v1/client/servers/:id/subusers - Invite / add subuser
clientSubusersRouter.post('/:id/subusers', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);
    const body = await c.req.json().catch(() => ({}));

    const email = String(body.email || '').trim().toLowerCase();
    const permissions = Array.isArray(body.permissions) ? body.permissions : [];

    if (!email) {
      return jsonError(c, ApiErrorCode.VALIDATION_ERROR, 422, {}, 'Email address is required');
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!targetUser) {
      return jsonError(
        c,
        ApiErrorCode.RESOURCE_NOT_FOUND,
        404,
        {},
        `No account found with email "${email}". The collaborator must register first.`,
      );
    }

    if (targetUser.id === server.userId) {
      return jsonError(c, ApiErrorCode.VALIDATION_ERROR, 400, {}, 'Cannot add the server owner as a subuser');
    }

    // Check if already a subuser
    const existing = await db.query.subusers.findFirst({
      where: and(eq(subusers.serverId, server.id), eq(subusers.userId, targetUser.id)),
    });

    let savedId: number;
    if (existing) {
      const [updated] = await db
        .update(subusers)
        .set({ permissions })
        .where(eq(subusers.id, existing.id))
        .returning();
      savedId = updated.id;
    } else {
      const [created] = await db
        .insert(subusers)
        .values({
          serverId: server.id,
          userId: targetUser.id,
          permissions,
        })
        .returning();
      savedId = created.id;
    }

    return c.json({
      success: true,
      data: {
        id: savedId,
        userId: targetUser.id,
        username: targetUser.username,
        email: targetUser.email,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${targetUser.username}`,
        permissions,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    if (err.message === ApiErrorCode.SERVER_NOT_FOUND) {
      return jsonError(c, ApiErrorCode.SERVER_NOT_FOUND, 404, {}, 'Server not found');
    }
    if (err.message === ApiErrorCode.AUTH_FORBIDDEN) {
      return jsonError(c, ApiErrorCode.AUTH_FORBIDDEN, 403, {}, 'Only the server owner can manage collaborators');
    }
    return jsonError(c, ApiErrorCode.INTERNAL_ERROR, 500, { error: err.message });
  }
});

// DELETE /api/v1/client/servers/:id/subusers/:subuserId
clientSubusersRouter.delete('/:id/subusers/:subuserId', async (c) => {
  try {
    const server = await getServerAndAuthorize(c);
    const subuserId = parseInt(c.req.param('subuserId'), 10);

    const target = await db.query.subusers.findFirst({
      where: and(eq(subusers.id, subuserId), eq(subusers.serverId, server.id)),
    });

    if (!target) {
      return jsonError(c, ApiErrorCode.RESOURCE_NOT_FOUND, 404, {}, 'Subuser not found');
    }

    await db.delete(subusers).where(eq(subusers.id, target.id));

    return c.json({
      success: true,
      data: { message: 'Collaborator revoked successfully' },
    });
  } catch (err: any) {
    return jsonError(c, ApiErrorCode.INTERNAL_ERROR, 500, { error: err.message });
  }
});
