import { Hono } from 'hono';
import { db, nodes, allocations, servers } from '@octopus/database';
import { eq } from 'drizzle-orm';
import { CreateNodeSchema, UpdateNodeSchema, ApiErrorCode } from '@octopus/shared';
import { requireAdmin } from '../../core/auth.js';
import { jsonError, handleZodError } from '../middleware/error.js';
import { getTentacleClientForNode } from '../../core/tentacle-manager.js';
import { config } from '../../config.js';
import { AppEnv } from '../../types.js';
import crypto from 'node:crypto';

export const adminNodesRouter = new Hono<AppEnv>();
adminNodesRouter.use('*', requireAdmin);

// GET /api/v1/admin/nodes
adminNodesRouter.get('/', async (c) => {
  const allNodes = await db.query.nodes.findMany({
    with: {
      allocations: true,
      servers: true,
    },
  });

  const enriched = allNodes.map((n) => ({
    id: n.id,
    uuid: n.uuid,
    name: n.name,
    fqdn: n.fqdn,
    apiPort: n.apiPort,
    sftpPort: n.sftpPort,
    memoryLimit: n.memoryLimit,
    diskLimit: n.diskLimit,
    isMaintenance: n.isMaintenance,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    allocationsCount: n.allocations.length,
    serversCount: n.servers.length,
  }));

  return c.json({
    success: true,
    data: enriched,
  });
});

// POST /api/v1/admin/nodes
adminNodesRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = CreateNodeSchema.safeParse(body);
  if (!parseResult.success) {
    return handleZodError(c, parseResult.error);
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const [created] = await db
    .insert(nodes)
    .values({
      ...parseResult.data,
      tokenHash,
    })
    .returning();

  const setupCommand = `curl -sSL ${config.panelUrl}/install-tentacle.sh | bash -s -- --panel-url ${config.panelUrl} --token ${rawToken} --port ${created.apiPort} --sftp-port ${created.sftpPort} --install-docker`;

  return c.json(
    {
      success: true,
      data: {
        node: created,
        setupToken: rawToken,
        setupCommand,
      },
    },
    201,
  );
});

// GET /api/v1/admin/nodes/:id
adminNodesRouter.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const node = await db.query.nodes.findFirst({
    where: eq(nodes.id, id),
    with: {
      allocations: true,
      servers: true,
    },
  });

  if (!node) {
    return jsonError(c, ApiErrorCode.NODE_NOT_FOUND, 404, { id });
  }

  let health = {
    isOnline: false,
    version: undefined as string | undefined,
    system: undefined as any,
  };

  try {
    const client = await getTentacleClientForNode(node.id);
    const [h, sys] = await Promise.all([client.getHealth(), client.getSystemStatus()]);
    health = {
      isOnline: h.status === 'healthy',
      version: h.version,
      system: sys,
    };
  } catch {
    health.isOnline = false;
  }

  return c.json({
    success: true,
    data: {
      ...node,
      health,
    },
  });
});

// GET /api/v1/admin/nodes/:id/setup-command
adminNodesRouter.get('/:id/setup-command', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const node = await db.query.nodes.findFirst({
    where: eq(nodes.id, id),
  });

  if (!node) {
    return jsonError(c, ApiErrorCode.NODE_NOT_FOUND, 404, { id });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await db.update(nodes).set({ tokenHash }).where(eq(nodes.id, id));

  const setupCommand = `curl -sSL ${config.panelUrl}/install-tentacle.sh | bash -s -- --panel-url ${config.panelUrl} --token ${rawToken} --port ${node.apiPort} --sftp-port ${node.sftpPort} --install-docker`;

  return c.json({
    success: true,
    data: {
      command: setupCommand,
      token: rawToken,
    },
  });
});

// PUT /api/v1/admin/nodes/:id
adminNodesRouter.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json().catch(() => ({}));
  const parseResult = UpdateNodeSchema.safeParse(body);
  if (!parseResult.success) {
    return handleZodError(c, parseResult.error);
  }

  const [updated] = await db
    .update(nodes)
    .set({
      ...parseResult.data,
      updatedAt: new Date(),
    })
    .where(eq(nodes.id, id))
    .returning();

  if (!updated) {
    return jsonError(c, ApiErrorCode.NODE_NOT_FOUND, 404, { id });
  }

  return c.json({
    success: true,
    data: updated,
  });
});

// DELETE /api/v1/admin/nodes/:id
adminNodesRouter.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);

  const existingServers = await db.query.servers.findFirst({
    where: eq(servers.nodeId, id),
  });

  if (existingServers) {
    return jsonError(c, ApiErrorCode.NODE_INSUFFICIENT_RESOURCES, 400, { id }, 'Cannot delete node with active servers');
  }

  const [deleted] = await db.delete(nodes).where(eq(nodes.id, id)).returning();
  if (!deleted) {
    return jsonError(c, ApiErrorCode.NODE_NOT_FOUND, 404, { id });
  }

  return c.json({
    success: true,
    data: { message: 'Node deleted successfully' },
  });
});

// POST /api/v1/admin/nodes/:id/update
adminNodesRouter.post('/:id/update', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const node = await db.query.nodes.findFirst({
    where: eq(nodes.id, id),
  });

  if (!node) {
    return jsonError(c, ApiErrorCode.NODE_NOT_FOUND, 404, { id });
  }

  const body = await c.req.json().catch(() => ({}));
  const targetVersion = (body.targetVersion as string) || 'v0.2.0';
  const sha256 = (body.sha256 as string) || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const downloadUrl =
    (body.downloadUrl as string) ||
    `https://github.com/OctopusPanel/tentacle/releases/download/${targetVersion}/tentacle-linux-x86_64.tar.gz`;

  try {
    const client = await getTentacleClientForNode(id);
    const result = await client.updateDaemon({
      targetVersion,
      sha256,
      downloadUrl,
    });

    return c.json({
      success: true,
      data: result,
      message: `Node update initiated: ${result.message}`,
    });
  } catch (err: any) {
    return c.json(
      {
        success: false,
        error: `Failed to trigger update on node: ${err?.message || err}`,
      },
      502
    );
  }
});
