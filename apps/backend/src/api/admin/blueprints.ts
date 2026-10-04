import { Hono } from 'hono';
import { db, blueprints } from '@octopus/database';
import { eq } from 'drizzle-orm';
import { CreateBlueprintSchema, UpdateBlueprintSchema, ApiErrorCode } from '@octopus/shared';
import { requireAdmin } from '../../core/auth.js';
import { jsonError, handleZodError } from '../middleware/error.js';
import { EggParser } from '../../eggs/egg-parser.js';
import { AppEnv } from '../../types.js';

export const adminBlueprintsRouter = new Hono<AppEnv>();
adminBlueprintsRouter.use('*', requireAdmin);

// GET /api/v1/admin/blueprints
adminBlueprintsRouter.get('/', async (c) => {
  const allBlueprints = await db.query.blueprints.findMany({
    with: {
      servers: true,
    },
  });

  return c.json({
    success: true,
    data: allBlueprints.map((b) => ({
      ...b,
      serversCount: b.servers.length,
    })),
  });
});

// POST /api/v1/admin/blueprints
adminBlueprintsRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = CreateBlueprintSchema.safeParse(body);
  if (!parseResult.success) {
    return handleZodError(c, parseResult.error);
  }

  const [created] = await db.insert(blueprints).values(parseResult.data).returning();

  return c.json(
    {
      success: true,
      data: created,
    },
    201,
  );
});

// POST /api/v1/admin/blueprints/import-egg
adminBlueprintsRouter.post('/import-egg', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  try {
    const egg = EggParser.parse(body);
    const blueprintInput = EggParser.toBlueprintInput(egg);

    const [created] = await db.insert(blueprints).values(blueprintInput).returning();

    return c.json(
      {
        success: true,
        data: created,
      },
      201,
    );
  } catch (err: any) {
    let message = err.message || 'Failed to parse Pterodactyl egg';
    if (err.errors && Array.isArray(err.errors)) {
      message = err.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
    }
    return jsonError(c, ApiErrorCode.BLUEPRINT_PARSER_ERROR, 422, { error: message }, `Failed to parse Pterodactyl egg: ${message}`);
  }
});

// GET /api/v1/admin/blueprints/:id
adminBlueprintsRouter.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const blueprint = await db.query.blueprints.findFirst({
    where: eq(blueprints.id, id),
    with: {
      servers: true,
    },
  });

  if (!blueprint) {
    return jsonError(c, ApiErrorCode.BLUEPRINT_NOT_FOUND, 404, { id });
  }

  return c.json({
    success: true,
    data: blueprint,
  });
});

// PUT /api/v1/admin/blueprints/:id
adminBlueprintsRouter.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json().catch(() => ({}));
  const parseResult = UpdateBlueprintSchema.safeParse(body);
  if (!parseResult.success) {
    return handleZodError(c, parseResult.error);
  }

  const [updated] = await db
    .update(blueprints)
    .set({
      ...parseResult.data,
      updatedAt: new Date(),
    })
    .where(eq(blueprints.id, id))
    .returning();

  if (!updated) {
    return jsonError(c, ApiErrorCode.BLUEPRINT_NOT_FOUND, 404, { id });
  }

  return c.json({
    success: true,
    data: updated,
  });
});

// DELETE /api/v1/admin/blueprints/:id
adminBlueprintsRouter.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const [deleted] = await db.delete(blueprints).where(eq(blueprints.id, id)).returning();
  if (!deleted) {
    return jsonError(c, ApiErrorCode.BLUEPRINT_NOT_FOUND, 404, { id });
  }

  return c.json({
    success: true,
    data: { message: 'Blueprint deleted successfully' },
  });
});
