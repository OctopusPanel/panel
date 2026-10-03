import { Hono } from 'hono';
import { db, servers, allocations, blueprints, users, nodes } from '@octopus/database';
import { eq } from 'drizzle-orm';
import { CreateServerSchema, ApiErrorCode, ServerStatus, Server } from '@octopus/shared';
import { requireAdmin } from '../../core/auth.js';
import { jsonError, handleZodError } from '../middleware/error.js';
import { globalProviders, globalHooks } from '@octopus/module-sdk';
import { VariableInterpolator } from '../../eggs/variable-interpolator.js';
import { AppEnv } from '../../types.js';
import crypto from 'node:crypto';

export const adminServersRouter = new Hono<AppEnv>();
adminServersRouter.use('*', requireAdmin);

// GET /api/v1/admin/servers
adminServersRouter.get('/', async (c) => {
  const allServers = await db.query.servers.findMany({
    with: {
      user: true,
      node: true,
      blueprint: true,
      allocation: true,
    },
  });

  return c.json({
    success: true,
    data: allServers,
  });
});

// POST /api/v1/admin/servers
adminServersRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = CreateServerSchema.safeParse(body);
  if (!parseResult.success) {
    return handleZodError(c, parseResult.error);
  }

  const data = parseResult.data;

  // Verify Blueprint
  const blueprint = await db.query.blueprints.findFirst({
    where: eq(blueprints.id, data.blueprintId),
  });
  if (!blueprint) {
    return jsonError(c, ApiErrorCode.BLUEPRINT_NOT_FOUND, 404, { id: data.blueprintId });
  }

  // Verify Node
  const node = await db.query.nodes.findFirst({
    where: eq(nodes.id, data.nodeId),
  });
  if (!node) {
    return jsonError(c, ApiErrorCode.NODE_NOT_FOUND, 404, { id: data.nodeId });
  }

  // Find or verify Allocation
  let allocation = null;
  if (data.allocationId) {
    allocation = await db.query.allocations.findFirst({
      where: eq(allocations.id, data.allocationId),
    });
    if (!allocation || allocation.serverId) {
      return jsonError(c, ApiErrorCode.ALLOCATION_NOT_AVAILABLE, 400, { id: data.allocationId });
    }
  } else {
    // Pick first unassigned allocation on node
    allocation = await db.query.allocations.findFirst({
      where: eq(allocations.nodeId, data.nodeId),
    });
  }

  const serverUuid = crypto.randomUUID();
  const identifier = crypto.randomBytes(4).toString('hex');
  const dockerImage = data.dockerImage || blueprint.dockerImage;

  // Build environment defaults
  const env: Record<string, string> = {};
  if (Array.isArray(blueprint.variables)) {
    for (const v of blueprint.variables as any[]) {
      if (v.envVariable) {
        env[v.envVariable] = data.environment[v.envVariable] ?? v.defaultValue ?? '';
      }
    }
  }
  Object.assign(env, data.environment);

  // Interpolate startup command
  const startupCommand = VariableInterpolator.interpolateString(
    data.startupCommand || blueprint.startupCommand,
    {
      memory: data.memory,
      port: allocation?.port,
      ip: allocation?.ipAddress,
      environment: env,
    },
  );

  await globalHooks.emit('server:creating', {
    server: { uuid: serverUuid, name: data.name, memory: data.memory },
    context: { blueprint, node },
  });

  const [createdServer] = await db
    .insert(servers)
    .values({
      uuid: serverUuid,
      identifier,
      name: data.name,
      description: data.description,
      userId: data.userId,
      nodeId: data.nodeId,
      blueprintId: data.blueprintId,
      allocationId: allocation?.id || null,
      memory: data.memory,
      cpu: data.cpu,
      disk: data.disk,
      swap: data.swap,
      io: data.io,
      status: ServerStatus.OFFLINE,
      providerType: data.providerType,
      dockerImage,
      startupCommand,
      environment: env,
    })
    .returning();

  if (allocation) {
    await db
      .update(allocations)
      .set({ serverId: createdServer.id, isPrimary: true })
      .where(eq(allocations.id, allocation.id));
  }

  // Provision container via Driver
  try {
    const driver = globalProviders.get(createdServer.providerType) || globalProviders.getDefault();
    const ports = allocation ? [{ hostPort: allocation.port, containerPort: allocation.port }] : [];
    await driver.create(createdServer as unknown as Server, {
      ports,
      startOnCompletion: data.startOnCompletion,
    });
  } catch (err: any) {
    console.error('Failed to provision server on remote node:', err);
  }

  await globalHooks.emit('server:created', { server: createdServer as unknown as Server });

  return c.json(
    {
      success: true,
      data: createdServer,
    },
    201,
  );
});

// POST /api/v1/admin/servers/:id/suspend
adminServersRouter.post('/:id/suspend', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const server = await db.query.servers.findFirst({
    where: eq(servers.id, id),
  });

  if (!server) {
    return jsonError(c, ApiErrorCode.SERVER_NOT_FOUND, 404, { id });
  }

  const [updated] = await db
    .update(servers)
    .set({ isSuspended: true, status: ServerStatus.SUSPENDED, updatedAt: new Date() })
    .where(eq(servers.id, id))
    .returning();

  try {
    const driver = globalProviders.get(server.providerType) || globalProviders.getDefault();
    await driver.stop(server as unknown as Server);
  } catch {}

  await globalHooks.emit('server:suspended', { server: updated as unknown as Server });

  return c.json({
    success: true,
    data: updated,
  });
});

// POST /api/v1/admin/servers/:id/unsuspend
adminServersRouter.post('/:id/unsuspend', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const server = await db.query.servers.findFirst({
    where: eq(servers.id, id),
  });

  if (!server) {
    return jsonError(c, ApiErrorCode.SERVER_NOT_FOUND, 404, { id });
  }

  const [updated] = await db
    .update(servers)
    .set({ isSuspended: false, status: ServerStatus.OFFLINE, updatedAt: new Date() })
    .where(eq(servers.id, id))
    .returning();

  await globalHooks.emit('server:unsuspended', { server: updated as unknown as Server });

  return c.json({
    success: true,
    data: updated,
  });
});

// DELETE /api/v1/admin/servers/:id
adminServersRouter.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const server = await db.query.servers.findFirst({
    where: eq(servers.id, id),
  });

  if (!server) {
    return jsonError(c, ApiErrorCode.SERVER_NOT_FOUND, 404, { id });
  }

  try {
    const driver = globalProviders.get(server.providerType) || globalProviders.getDefault();
    await driver.delete(server as unknown as Server);
  } catch (err) {
    console.error('Failed to delete container from provider:', err);
  }

  // Free allocations
  await db.update(allocations).set({ serverId: null, isPrimary: false }).where(eq(allocations.serverId, id));
  await db.delete(servers).where(eq(servers.id, id));

  await globalHooks.emit('server:deleted', { serverId: id, uuid: server.uuid });

  return c.json({
    success: true,
    data: { message: 'Server deleted successfully' },
  });
});
