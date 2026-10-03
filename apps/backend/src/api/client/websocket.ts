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
  const idNum = parseInt(param, 10);

  const server = await db.query.servers.findFirst({
    where: isNaN(idNum) ? eq(servers.uuid, param) : eq(servers.id, idNum),
    with: {
      node: true,
    },
  });

  if (!server) {
    return jsonError(c, ApiErrorCode.SERVER_NOT_FOUND, 404, { id: param });
  }

  if (user.role !== UserRole.ADMIN && server.userId !== user.id) {
    return jsonError(c, ApiErrorCode.AUTH_FORBIDDEN, 403, {}, 'Access to server denied');
  }

  const token = generateWsToken(user.id, server.uuid);
  const node = server.node;
  const wsUrl = `ws://${node.fqdn}:${node.apiPort}/api/servers/${server.uuid}/ws`;

  return c.json({
    success: true,
    data: {
      token,
      socketUrl: wsUrl,
    },
  });
});
