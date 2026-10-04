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

  const enriched = await Promise.all(
    allNodes.map(async (n) => {
      let isOnline = false;
      let daemonVersion = 'v0.1.7';

      try {
        const client = await getTentacleClientForNode(n.id);
        const health = await client.getHealth(2500);
        if (health && health.status === 'healthy') {
          isOnline = true;
          if (health.version) {
            daemonVersion = health.version.startsWith('v') ? health.version : `v${health.version}`;
          }
        }
      } catch {
        isOnline = false;
      }

      return {
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
        isOnline,
        daemonVersion,
      };
    })
  );

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
  const tokenHash = rawToken;

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
      token: node.tokenHash,
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

  let rawToken = node.tokenHash;
  if (!rawToken) {
    rawToken = crypto.randomBytes(32).toString('hex');
    await db.update(nodes).set({ tokenHash: rawToken }).where(eq(nodes.id, id));
  }

  const setupCommand = `curl -sSL ${config.panelUrl}/install-tentacle.sh | bash -s -- --panel-url ${config.panelUrl} --token ${rawToken} --port ${node.apiPort} --sftp-port ${node.sftpPort} --install-docker`;

  return c.json({
    success: true,
    data: {
      command: setupCommand,
      token: rawToken,
    },
  });
});

// POST /api/v1/admin/nodes/:id/regenerate-token
adminNodesRouter.post('/:id/regenerate-token', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const node = await db.query.nodes.findFirst({
    where: eq(nodes.id, id),
  });

  if (!node) {
    return jsonError(c, ApiErrorCode.NODE_NOT_FOUND, 404, { id });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  await db.update(nodes).set({ tokenHash: rawToken }).where(eq(nodes.id, id));

  const setupCommand = `curl -sSL ${config.panelUrl}/install-tentacle.sh | bash -s -- --panel-url ${config.panelUrl} --token ${rawToken} --port ${node.apiPort} --sftp-port ${node.sftpPort} --install-docker`;

  return c.json({
    success: true,
    data: {
      command: setupCommand,
      token: rawToken,
    },
  });
});

// POST /api/v1/admin/nodes/:id/set-token
adminNodesRouter.post('/:id/set-token', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const node = await db.query.nodes.findFirst({
    where: eq(nodes.id, id),
  });

  if (!node) {
    return jsonError(c, ApiErrorCode.NODE_NOT_FOUND, 404, { id });
  }

  const body = await c.req.json().catch(() => ({}));
  if (!body.token || typeof body.token !== 'string') {
    return jsonError(c, ApiErrorCode.VALIDATION_ERROR, 422, {}, 'Token is required');
  }

  const rawToken = body.token.trim();
  await db.update(nodes).set({ tokenHash: rawToken }).where(eq(nodes.id, id));

  return c.json({
    success: true,
    data: {
      message: 'Node token updated successfully',
      token: rawToken,
    },
  });
});

// POST /api/v1/admin/nodes/:id/toggle-maintenance
adminNodesRouter.post('/:id/toggle-maintenance', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const node = await db.query.nodes.findFirst({
    where: eq(nodes.id, id),
  });

  if (!node) {
    return jsonError(c, ApiErrorCode.NODE_NOT_FOUND, 404, { id });
  }

  const [updated] = await db
    .update(nodes)
    .set({
      isMaintenance: !node.isMaintenance,
      updatedAt: new Date(),
    })
    .where(eq(nodes.id, id))
    .returning();

  return c.json({
    success: true,
    data: {
      isMaintenance: updated.isMaintenance,
      node: updated,
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

  const updateData: any = {
    ...parseResult.data,
    updatedAt: new Date(),
  };
  if (body.token && typeof body.token === 'string' && body.token.trim().length > 0) {
    updateData.tokenHash = body.token.trim();
  }

  const [updated] = await db
    .update(nodes)
    .set(updateData)
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
  let targetVersion = (body.targetVersion as string)?.trim();

  // If targetVersion is omitted or points to panel version (e.g. 0.2.x), resolve latest tentacle release
  if (!targetVersion || targetVersion.startsWith('v0.2') || targetVersion.startsWith('0.2')) {
    try {
      const ghRes = await fetch('https://api.github.com/repos/OctopusPanel/tentacle/releases/latest', {
        headers: { 'User-Agent': 'OctopusPanel-UpdateService' },
        signal: AbortSignal.timeout(4000),
      });
      if (ghRes.ok) {
        const ghData = (await ghRes.json()) as any;
        if (ghData.tag_name) {
          targetVersion = ghData.tag_name;
        }
      }
    } catch {}
  }

  if (!targetVersion || targetVersion.startsWith('v0.2') || targetVersion.startsWith('0.2')) {
    targetVersion = 'v0.1.8';
  }
  if (!targetVersion.startsWith('v')) {
    targetVersion = `v${targetVersion}`;
  }

  const defaultAsset = 'tentacle-x86_64-unknown-linux-gnu.tar.gz';
  const downloadUrl =
    (body.downloadUrl as string) ||
    `https://github.com/OctopusPanel/tentacle/releases/download/${targetVersion}/${defaultAsset}`;

  let sha256 = (body.sha256 as string)?.trim();
  if (!sha256) {
    try {
      const shaRes = await fetch(`${downloadUrl}.sha256`, {
        signal: AbortSignal.timeout(4000),
      });
      if (shaRes.ok) {
        const text = await shaRes.text();
        sha256 = text.trim().split(/\s+/)[0];
      }
    } catch {}
  }

  if (!sha256) {
    sha256 = 'skip';
  }

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
