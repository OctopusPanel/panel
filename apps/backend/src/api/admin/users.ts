import { Hono } from 'hono';
import { db, users } from '@octopus/database';
import { eq } from 'drizzle-orm';
import { CreateUserSchema, UpdateUserSchema, ApiErrorCode, UserRole } from '@octopus/shared';
import { requireAdmin, hashPassword } from '../../core/auth.js';
import { jsonError, handleZodError } from '../middleware/error.js';
import { AppEnv } from '../../types.js';

export const adminUsersRouter = new Hono<AppEnv>();
adminUsersRouter.use('*', requireAdmin);

// GET /api/v1/admin/users
adminUsersRouter.get('/', async (c) => {
  const allUsers = await db.query.users.findMany({
    columns: {
      id: true,
      uuid: true,
      email: true,
      username: true,
      role: true,
      languagePreference: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      servers: true,
    },
  });

  return c.json({
    success: true,
    data: allUsers.map((u) => ({
      ...u,
      serversCount: u.servers.length,
    })),
  });
});

// POST /api/v1/admin/users
adminUsersRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = CreateUserSchema.safeParse(body);
  if (!parseResult.success) {
    return handleZodError(c, parseResult.error);
  }

  const { email, username, password, role, languagePreference } = parseResult.data;

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    return jsonError(c, ApiErrorCode.AUTH_USER_EXISTS, 409, { email });
  }

  const passwordHash = await hashPassword(password);
  const [created] = await db
    .insert(users)
    .values({
      email,
      username,
      passwordHash,
      role: role || UserRole.USER,
      languagePreference: languagePreference || 'en',
    })
    .returning();

  return c.json(
    {
      success: true,
      data: {
        id: created.id,
        uuid: created.uuid,
        email: created.email,
        username: created.username,
        role: created.role,
        languagePreference: created.languagePreference,
        createdAt: created.createdAt,
      },
    },
    201,
  );
});

// PUT /api/v1/admin/users/:id
adminUsersRouter.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json().catch(() => ({}));
  const parseResult = UpdateUserSchema.safeParse(body);
  if (!parseResult.success) {
    return handleZodError(c, parseResult.error);
  }

  const updates: Record<string, unknown> = {};
  if (parseResult.data.email) updates.email = parseResult.data.email;
  if (parseResult.data.username) updates.username = parseResult.data.username;
  if (parseResult.data.role) updates.role = parseResult.data.role;
  if (parseResult.data.languagePreference) updates.languagePreference = parseResult.data.languagePreference;
  if (parseResult.data.password) updates.passwordHash = await hashPassword(parseResult.data.password);

  const [updated] = await db
    .update(users)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();

  if (!updated) {
    return jsonError(c, ApiErrorCode.AUTH_USER_NOT_FOUND, 404, { id });
  }

  return c.json({
    success: true,
    data: {
      id: updated.id,
      uuid: updated.uuid,
      email: updated.email,
      username: updated.username,
      role: updated.role,
      languagePreference: updated.languagePreference,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    },
  });
});

// DELETE /api/v1/admin/users/:id
adminUsersRouter.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();
  if (!deleted) {
    return jsonError(c, ApiErrorCode.AUTH_USER_NOT_FOUND, 404, { id });
  }

  return c.json({
    success: true,
    data: { message: 'User deleted successfully' },
  });
});
