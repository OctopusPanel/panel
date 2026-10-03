import { Hono } from 'hono';
import { db, allocations } from '@octopus/database';
import { eq, and, isNull } from 'drizzle-orm';
import { CreateAllocationSchema, CreateAllocationRangeSchema, ApiErrorCode } from '@octopus/shared';
import { requireAdmin } from '../../core/auth.js';
import { jsonError, handleZodError } from '../middleware/error.js';
import { AppEnv } from '../../types.js';

export const adminAllocationsRouter = new Hono<AppEnv>();
adminAllocationsRouter.use('*', requireAdmin);

// GET /api/v1/admin/allocations
adminAllocationsRouter.get('/', async (c) => {
  const nodeId = c.req.query('nodeId') ? parseInt(c.req.query('nodeId')!, 10) : undefined;
  const unassignedOnly = c.req.query('unassigned') === 'true';

  let list = await db.query.allocations.findMany({
    with: {
      node: true,
      server: true,
    },
  });

  if (nodeId) {
    list = list.filter((a) => a.nodeId === nodeId);
  }
  if (unassignedOnly) {
    list = list.filter((a) => !a.serverId);
  }

  return c.json({
    success: true,
    data: list,
  });
});

// POST /api/v1/admin/allocations
adminAllocationsRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = CreateAllocationSchema.safeParse(body);
  if (!parseResult.success) {
    return handleZodError(c, parseResult.error);
  }

  const [created] = await db.insert(allocations).values(parseResult.data).returning();

  return c.json(
    {
      success: true,
      data: created,
    },
    201,
  );
});

// POST /api/v1/admin/allocations/range
adminAllocationsRouter.post('/range', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = CreateAllocationRangeSchema.safeParse(body);
  if (!parseResult.success) {
    return handleZodError(c, parseResult.error);
  }

  const { nodeId, ipAddress, startPort, endPort, alias } = parseResult.data;
  const items = [];
  for (let port = startPort; port <= endPort; port++) {
    items.push({
      nodeId,
      ipAddress,
      port,
      alias: alias || null,
      isPrimary: false,
    });
  }

  const created = await db.insert(allocations).values(items).returning();

  return c.json(
    {
      success: true,
      data: created,
      count: created.length,
    },
    201,
  );
});

// DELETE /api/v1/admin/allocations/:id
adminAllocationsRouter.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const alloc = await db.query.allocations.findFirst({
    where: eq(allocations.id, id),
  });

  if (!alloc) {
    return jsonError(c, ApiErrorCode.ALLOCATION_NOT_FOUND, 404, { id });
  }

  if (alloc.serverId) {
    return jsonError(c, ApiErrorCode.ALLOCATION_ALREADY_ASSIGNED, 400, { id }, 'Cannot delete allocation assigned to server');
  }

  await db.delete(allocations).where(eq(allocations.id, id));

  return c.json({
    success: true,
    data: { message: 'Allocation deleted successfully' },
  });
});
