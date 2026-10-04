import { Hono } from 'hono';
import { db, servers, nodes } from '@octopus/database';
import { eq } from 'drizzle-orm';
import { ApiErrorCode, SessionUser, UserRole } from '@octopus/shared';
import { requireAuth, generateWsToken } from '../../core/auth.js';
import { jsonError } from '../middleware/error.js';
import { AppEnv } from '../../types.js';

export const clientWsRouter = new Hono<AppEnv>();
clientWsRouter.use('*', requireAuth);

// GET /api/v1/client/servers/:id/ws-token
clientWsRouter.get('/:id/ws-token', async (c) => {
  const user = c.get('user') as SessionUser;
  const param = c.req.param('id');
  const isNumeric = /^\d+$/.test(param);

  const server = await db.query.servers.findFirst({
    where: isNumeric ? eq(servers.id, parseInt(param, 10)) : eq(servers.uuid, param),
    with: {
      node: true,
    },
  });

  if (!server) {
    return jsonError(c, ApiErrorCode.SERVER_NOT_FOUND, 404, { id: param }, 'Server not found');
  }

  if (user.role !== UserRole.ADMIN && server.userId !== user.id) {
    return jsonError(c, ApiErrorCode.AUTH_FORBIDDEN, 403, {}, 'Access to server denied');
  }

  const token = generateWsToken(user.id, server.uuid);
  const host = c.req.header('x-forwarded-host') || c.req.header('host') || 'localhost:3000';
  const proto = c.req.header('x-forwarded-proto') || (c.req.url.startsWith('https:') ? 'https' : 'http');
  const wsScheme = proto === 'https' ? 'wss' : 'ws';
  const wsUrl = `${wsScheme}://${host}/api/v1/client/servers/${server.uuid}/ws`;

  return c.json({
    success: true,
    data: {
      token,
      socketUrl: wsUrl,
    },
  });
});
