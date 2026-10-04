import { Context, Hono } from 'hono';
import { db, servers } from '@octopus/database';
import { eq } from 'drizzle-orm';
import { ApiErrorCode, SessionUser, UserRole } from '@octopus/shared';
import { requireAuth } from '../../core/auth.js';
import { jsonError } from '../middleware/error.js';
import { getTentacleClientForNode } from '../../core/tentacle-manager.js';
import { AppEnv } from '../../types.js';

export const clientFilesRouter = new Hono<AppEnv>();
clientFilesRouter.use('*', requireAuth);

async function getServerAndVerify(c: Context<AppEnv>) {
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
    throw new Error(ApiErrorCode.AUTH_FORBIDDEN);
  }

  return server;
}

function normalizeContainerPath(p?: string): string {
  if (!p) return '/';
  let clean = p.trim().replace(/^(\/home\/container|\/?home\/container)/, '');
  if (!clean.startsWith('/')) {
    clean = '/' + clean;
  }
  return clean === '' ? '/' : clean;
}

// GET /api/v1/client/servers/:id/files
clientFilesRouter.get('/:id/files', async (c) => {
  try {
    const server = await getServerAndVerify(c);
    const directory = normalizeContainerPath(c.req.query('directory'));
    const client = await getTentacleClientForNode(server.nodeId);
    const files = await client.listFiles(server.uuid, directory);

    return c.json({
      success: true,
      data: files,
    });
  } catch (err: any) {
    return jsonError(c, err.message || ApiErrorCode.FILE_OPERATION_FAILED, 400);
  }
});

// GET /api/v1/client/servers/:id/files/contents
clientFilesRouter.get('/:id/files/contents', async (c) => {
  try {
    const server = await getServerAndVerify(c);
    const rawFile = c.req.query('file');
    if (!rawFile) {
      return jsonError(c, ApiErrorCode.VALIDATION_ERROR, 422, {}, 'Query param "file" required');
    }
    const file = normalizeContainerPath(rawFile);

    const client = await getTentacleClientForNode(server.nodeId);
    const content = await client.readFile(server.uuid, file);

    return c.json({
      success: true,
      data: { content },
    });
  } catch (err: any) {
    return jsonError(c, err.message || ApiErrorCode.FILE_OPERATION_FAILED, 400);
  }
});

// POST /api/v1/client/servers/:id/files/contents
clientFilesRouter.post('/:id/files/contents', async (c) => {
  try {
    const server = await getServerAndVerify(c);
    const body = await c.req.json().catch(() => ({}));
    const { file: rawFile, content } = body;

    if (!rawFile || content === undefined) {
      return jsonError(c, ApiErrorCode.VALIDATION_ERROR, 422, {}, '"file" and "content" are required');
    }
    const file = normalizeContainerPath(rawFile);

    const client = await getTentacleClientForNode(server.nodeId);
    await client.writeFile(server.uuid, file, content);

    return c.json({
      success: true,
      data: { message: 'File written successfully' },
    });
  } catch (err: any) {
    return jsonError(c, err.message || ApiErrorCode.FILE_OPERATION_FAILED, 400);
  }
});

// POST /api/v1/client/servers/:id/files/directory
clientFilesRouter.post('/:id/files/directory', async (c) => {
  try {
    const server = await getServerAndVerify(c);
    const body = await c.req.json().catch(() => ({}));
    const { path: rawPath } = body;

    if (!rawPath) {
      return jsonError(c, ApiErrorCode.VALIDATION_ERROR, 422, {}, '"path" is required');
    }
    const path = normalizeContainerPath(rawPath);

    const client = await getTentacleClientForNode(server.nodeId);
    await client.createDirectory(server.uuid, path);

    return c.json({
      success: true,
      data: { message: 'Directory created successfully' },
    });
  } catch (err: any) {
    return jsonError(c, err.message || ApiErrorCode.FILE_OPERATION_FAILED, 400);
  }
});

// POST /api/v1/client/servers/:id/files/rename
clientFilesRouter.post('/:id/files/rename', async (c) => {
  try {
    const server = await getServerAndVerify(c);
    const body = await c.req.json().catch(() => ({}));
    const { root = '/', files } = body;

    if (!Array.isArray(files) || files.length === 0) {
      return jsonError(c, ApiErrorCode.VALIDATION_ERROR, 422, {}, '"files" array is required');
    }

    const normalizedRoot = normalizeContainerPath(root);
    const normalizedFiles = files.map((f: any) => ({
      from: normalizeContainerPath(f.from),
      to: normalizeContainerPath(f.to),
    }));

    const client = await getTentacleClientForNode(server.nodeId);
    await client.renameFile(server.uuid, normalizedRoot, normalizedFiles);

    return c.json({
      success: true,
      data: { message: 'Files renamed successfully' },
    });
  } catch (err: any) {
    return jsonError(c, err.message || ApiErrorCode.FILE_OPERATION_FAILED, 400);
  }
});

// DELETE /api/v1/client/servers/:id/files
clientFilesRouter.delete('/:id/files', async (c) => {
  try {
    const server = await getServerAndVerify(c);
    const body = await c.req.json().catch(() => ({}));
    const { paths } = body;

    if (!Array.isArray(paths) || paths.length === 0) {
      return jsonError(c, ApiErrorCode.VALIDATION_ERROR, 422, {}, '"paths" array is required');
    }

    const normalizedPaths = paths.map((p: string) => normalizeContainerPath(p));
    const client = await getTentacleClientForNode(server.nodeId);
    await client.deleteFile(server.uuid, normalizedPaths);

    return c.json({
      success: true,
      data: { message: 'Files deleted successfully' },
    });
  } catch (err: any) {
    return jsonError(c, err.message || ApiErrorCode.FILE_OPERATION_FAILED, 400);
  }
});
