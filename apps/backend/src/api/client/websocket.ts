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
  const node = server.node;
  const cleanFqdn = node.fqdn.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const isHttps = node.fqdn.startsWith('https://') || c.req.header('x-forwarded-proto') === 'https';
  const scheme = node.fqdn.startsWith('https://') ? 'wss' : (node.fqdn.startsWith('http://') ? 'ws' : (isHttps ? 'wss' : 'ws'));
  const wsUrl = `${scheme}://${cleanFqdn}:${node.apiPort}/api/servers/${server.uuid}/ws`;

  return c.json({
    success: true,
    data: {
      token,
      socketUrl: wsUrl,
    },
  });
});
