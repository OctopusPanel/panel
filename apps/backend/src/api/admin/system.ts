import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import fs from 'node:fs';
import { requireAdmin } from '../../core/auth.js';
import { updateRunner, UpdateStreamEvent } from '../../core/update-runner.js';
import { snapshotManager } from '../../core/snapshot-manager.js';
import { AppEnv } from '../../types.js';

export const adminSystemRouter = new Hono<AppEnv>();

// Require admin for all system routes
adminSystemRouter.use('*', requireAdmin);

// GET /api/v1/admin/system/updates
adminSystemRouter.get('/updates', async (c) => {
  const info = await updateRunner.checkForUpdates();
  return c.json({
    success: true,
    data: info,
  });
});

// POST /api/v1/admin/system/update-panel
adminSystemRouter.post('/update-panel', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const targetVersion = (body.targetVersion as string) || '0.2.0';

  const status = updateRunner.getStatus();
  if (status.isUpdating) {
    return c.json(
      {
        success: false,
        error: 'An update is already currently running.',
      },
      409
    );
  }

  // Trigger update asynchronously
  updateRunner.runPanelUpdate(targetVersion).catch((err) => {
    console.error('Panel update execution failed:', err);
  });

  return c.json({
    success: true,
    message: 'Update pipeline successfully initiated.',
    targetVersion,
  });
});

// GET /api/v1/admin/system/update-stream (SSE)
adminSystemRouter.get('/update-stream', (c) => {
  return streamSSE(c, async (stream) => {
    const status = updateRunner.getStatus();

    // Replay history
    for (const item of status.history) {
      await stream.writeSSE({
        data: JSON.stringify(item),
        event: 'update_event',
      });
    }

    const listener = async (event: UpdateStreamEvent) => {
      try {
        await stream.writeSSE({
          data: JSON.stringify(event),
          event: 'update_event',
        });
      } catch {
        // Stream closed
      }
    };

    updateRunner.on('event', listener);

    stream.onAbort(() => {
      updateRunner.off('event', listener);
    });

    // Keep stream alive
    while (!stream.aborted) {
      await stream.sleep(15000);
      try {
        await stream.writeSSE({
          data: JSON.stringify({ type: 'ping' }),
          event: 'ping',
        });
      } catch {
        break;
      }
    }

    updateRunner.off('event', listener);
  });
});

// GET /api/v1/admin/system/database-snapshots
adminSystemRouter.get('/database-snapshots', async (c) => {
  const snapshots = await snapshotManager.listSnapshots();
  return c.json({
    success: true,
    data: snapshots,
  });
});

// POST /api/v1/admin/system/database-snapshots
adminSystemRouter.post('/database-snapshots', async (c) => {
  const currentVersion = updateRunner.getCurrentVersion();
  const snapshot = await snapshotManager.createSnapshot('manual', currentVersion);
  return c.json({
    success: true,
    message: 'Database snapshot created successfully',
    data: snapshot,
  });
});

// POST /api/v1/admin/system/database-snapshots/:id/restore
adminSystemRouter.post('/database-snapshots/:id/restore', async (c) => {
  const id = c.req.param('id');
  const result = await snapshotManager.restoreSnapshot(id);
  return c.json({
    success: true,
    message: result.message,
  });
});

// DELETE /api/v1/admin/system/database-snapshots/:id
adminSystemRouter.delete('/database-snapshots/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await snapshotManager.deleteSnapshot(id);
  if (!deleted) {
    return c.json(
      {
        success: false,
        error: 'Snapshot not found or could not be deleted',
      },
      404
    );
  }
  return c.json({
    success: true,
    message: `Snapshot ${id} deleted successfully`,
  });
});

// GET /api/v1/admin/system/database-snapshots/:id/download
adminSystemRouter.get('/database-snapshots/:id/download', async (c) => {
  const id = c.req.param('id');
  const snapshot = await snapshotManager.getSnapshot(id);
  if (!snapshot || !fs.existsSync(snapshot.filepath)) {
    return c.json({ success: false, error: 'Snapshot not found' }, 404);
  }

  const fileStream = fs.createReadStream(snapshot.filepath);
  return new Response(fileStream as any, {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${snapshot.filename}"`,
      'Content-Length': snapshot.sizeBytes.toString(),
    },
  });
});
