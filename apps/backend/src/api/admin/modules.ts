import { Hono } from 'hono';
import { db, modules } from '@octopus/database';
import { eq } from 'drizzle-orm';
import { ToggleModuleSchema, UpdateModuleConfigSchema, ApiErrorCode } from '@octopus/shared';
import { requireAdmin } from '../../core/auth.js';
import { jsonError, handleZodError } from '../middleware/error.js';
import { moduleLoader } from '../../core/module-loader.js';
import { AppEnv } from '../../types.js';

export const adminModulesRouter = new Hono<AppEnv>();
adminModulesRouter.use('*', requireAdmin);

// GET /api/v1/admin/modules
adminModulesRouter.get('/', async (c) => {
  const dbModules = await db.query.modules.findMany();
  const loaded = moduleLoader.listLoaded();

  const merged = dbModules.map((m) => {
    const codeDef = loaded.find((l) => l.id === m.id);
    return {
      ...m,
      author: codeDef?.author || 'Community',
      slotsCount: codeDef?.slots?.length || 0,
      driversCount: codeDef?.drivers?.length || 0,
    };
  });

  return c.json({
    success: true,
    data: merged,
  });
});

// POST /api/v1/admin/modules/:id/toggle
adminModulesRouter.post('/:id/toggle', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parseResult = ToggleModuleSchema.safeParse(body);
  if (!parseResult.success) {
    return handleZodError(c, parseResult.error);
  }

  const { enabled } = parseResult.data;
  if (enabled) {
    await moduleLoader.enable(id);
  } else {
    await moduleLoader.disable(id);
  }

  const updated = await db.query.modules.findFirst({
    where: eq(modules.id, id),
  });

  return c.json({
    success: true,
    data: updated,
  });
});

// PUT /api/v1/admin/modules/:id/config
adminModulesRouter.put('/:id/config', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parseResult = UpdateModuleConfigSchema.safeParse(body);
  if (!parseResult.success) {
    return handleZodError(c, parseResult.error);
  }

  const [updated] = await db
    .update(modules)
    .set({ config: parseResult.data.config })
    .where(eq(modules.id, id))
    .returning();

  if (!updated) {
    return jsonError(c, ApiErrorCode.MODULE_NOT_FOUND, 404, { id });
  }

  return c.json({
    success: true,
    data: updated,
  });
});
