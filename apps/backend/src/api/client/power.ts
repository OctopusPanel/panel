import { Hono } from 'hono';
import { db, servers } from '@octopus/database';
import { eq } from 'drizzle-orm';
import { ServerPowerActionSchema, ApiErrorCode, PowerAction, Server, SessionUser, UserRole } from '@octopus/shared';
import { requireAuth } from '../../core/auth.js';
import { jsonError, handleZodError } from '../middleware/error.js';
import { globalProviders, globalHooks } from '@octopus/module-sdk';
import { AppEnv } from '../../types.js';

export const clientPowerRouter = new Hono<AppEnv>();
clientPowerRouter.use('*', requireAuth);

// POST /api/v1/client/servers/:id/power
clientPowerRouter.post('/:id/power', async (c) => {
  const user = c.get('user') as SessionUser;
  const param = c.req.param('id');
  const isNumeric = /^\d+$/.test(param);

  const server = await db.query.servers.findFirst({
    where: isNumeric ? eq(servers.id, parseInt(param, 10)) : eq(servers.uuid, param),
  });

  if (!server) {
    return jsonError(c, ApiErrorCode.SERVER_NOT_FOUND, 404, { id: param }, 'Server not found');
  }

  if (server.isSuspended) {
    return jsonError(c, ApiErrorCode.SERVER_SUSPENDED, 403, { id: param }, 'Suspended servers cannot be controlled');
  }

  if (user.role !== UserRole.ADMIN && server.userId !== user.id) {
    return jsonError(c, ApiErrorCode.AUTH_FORBIDDEN, 403, {}, 'Access to server denied');
  }

  const body = await c.req.json().catch(() => ({}));
  const parseResult = ServerPowerActionSchema.safeParse(body);
  if (!parseResult.success) {
    return handleZodError(c, parseResult.error);
  }

  const action = parseResult.data.action;
  const driver = globalProviders.get(server.providerType) || globalProviders.getDefault();

  try {
    switch (action) {
      case PowerAction.START:
        await globalHooks.emit('server:starting', { server: server as unknown as Server });
        await driver.start(server as unknown as Server);
        await globalHooks.emit('server:started', { server: server as unknown as Server });
        break;
      case PowerAction.STOP:
        await globalHooks.emit('server:stopping', { server: server as unknown as Server });
        await driver.stop(server as unknown as Server);
        await globalHooks.emit('server:stopped', { server: server as unknown as Server });
        break;
      case PowerAction.RESTART:
        await driver.restart(server as unknown as Server);
        break;
      case PowerAction.KILL:
        await driver.kill(server as unknown as Server);
        break;
    }

    return c.json({
      success: true,
      data: { message: `Power action '${action}' dispatched successfully` },
    });
  } catch (err: any) {
    return jsonError(c, ApiErrorCode.SERVER_POWER_ACTION_FAILED, 500, { error: err.message });
  }
});
