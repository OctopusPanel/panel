import { Hono } from 'hono';
import { db, users } from '@octopus/database';
import { eq, or } from 'drizzle-orm';
import {
  LoginSchema,
  RegisterSchema,
  UpdateUserSchema,
  ApiErrorCode,
  UserRole,
  SessionUser,
} from '@octopus/shared';
import { hashPassword, verifyPassword, generateToken, requireAuth } from '../../core/auth.js';
import { jsonError, handleZodError } from '../middleware/error.js';
import { AppEnv } from '../../types.js';

export const authRouter = new Hono<AppEnv>();

// POST /api/v1/auth/login
authRouter.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = LoginSchema.safeParse(body);
  if (!parseResult.success) {
    return handleZodError(c, parseResult.error);
  }

  const { identifier, password } = parseResult.data;

  const user = await db.query.users.findFirst({
    where: or(eq(users.email, identifier), eq(users.username, identifier)),
  });

  if (!user) {
    return jsonError(c, ApiErrorCode.AUTH_INVALID_CREDENTIALS, 401, {}, 'Invalid username or password');
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return jsonError(c, ApiErrorCode.AUTH_INVALID_CREDENTIALS, 401, {}, 'Invalid username or password');
  }

  const token = generateToken({ id: user.id, email: user.email, role: user.role });

  const sessionUser: SessionUser = {
    id: user.id,
    uuid: user.uuid,
    email: user.email,
    username: user.username,
    role: user.role as UserRole,
    languagePreference: user.languagePreference,
  };

  return c.json({
    success: true,
    data: {
      token,
      user: sessionUser,
    },
  });
});

// POST /api/v1/auth/register
authRouter.post('/register', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = RegisterSchema.safeParse(body);
  if (!parseResult.success) {
    return handleZodError(c, parseResult.error);
  }

  const { email, username, password, languagePreference } = parseResult.data;

  const existing = await db.query.users.findFirst({
    where: or(eq(users.email, email), eq(users.username, username)),
  });

  if (existing) {
    return jsonError(c, ApiErrorCode.AUTH_USER_EXISTS, 409, { email, username }, 'User with this email or username already exists');
  }

  const passwordHash = await hashPassword(password);
  const [createdUser] = await db
    .insert(users)
    .values({
      email,
      username,
      passwordHash,
      role: UserRole.USER,
      languagePreference: languagePreference || 'en',
    })
    .returning();

  const token = generateToken({ id: createdUser.id, email: createdUser.email, role: createdUser.role });
  const sessionUser: SessionUser = {
    id: createdUser.id,
    uuid: createdUser.uuid,
    email: createdUser.email,
    username: createdUser.username,
    role: createdUser.role as UserRole,
    languagePreference: createdUser.languagePreference,
  };

  return c.json(
    {
      success: true,
      data: {
        token,
        user: sessionUser,
      },
    },
    201,
  );
});

// GET /api/v1/auth/me
authRouter.get('/me', requireAuth, async (c) => {
  const user = c.get('user') as SessionUser;
  return c.json({
    success: true,
    data: user,
  });
});

// PUT /api/v1/auth/profile
authRouter.put('/profile', requireAuth, async (c) => {
  const currentUserId = c.get('userId') as number;
  const body = await c.req.json().catch(() => ({}));

  const parseResult = UpdateUserSchema.safeParse(body);
  if (!parseResult.success) {
    return handleZodError(c, parseResult.error);
  }

  const updates: Record<string, unknown> = {};
  if (parseResult.data.languagePreference) updates.languagePreference = parseResult.data.languagePreference;
  if (parseResult.data.username) updates.username = parseResult.data.username;
  if (parseResult.data.email) updates.email = parseResult.data.email;
  if (parseResult.data.password) updates.passwordHash = await hashPassword(parseResult.data.password);

  const [updatedUser] = await db
    .update(users)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(users.id, currentUserId))
    .returning();

  return c.json({
    success: true,
    data: {
      id: updatedUser.id,
      uuid: updatedUser.uuid,
      email: updatedUser.email,
      username: updatedUser.username,
      role: updatedUser.role,
      languagePreference: updatedUser.languagePreference,
    },
  });
});

// POST /api/v1/auth/logout
authRouter.post('/logout', requireAuth, async (c) => {
  return c.json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
});
