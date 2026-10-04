import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createMiddleware } from 'hono/factory';
import { config } from '../config.js';
import { db, users } from '@octopus/database';
import { eq } from 'drizzle-orm';
import { UserRole, ApiErrorCode, SessionUser } from '@octopus/shared';
import { AppEnv } from '../types.js';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: { id: number; email: string; role: string }): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as any },
  );
}

export function generateWsToken(userId: number, serverUuid: string): string {
  return jwt.sign(
    {
      sub: userId,
      serverUuid,
      type: 'ws_console',
    },
    config.jwtSecret,
    { expiresIn: config.wsTokenExpiresInSeconds },
  );
}

export function extractToken(c: any): string | null {
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const queryToken = c.req.query('token');
  if (queryToken && typeof queryToken === 'string' && queryToken.trim().length > 0) {
    return queryToken.trim();
  }
  return null;
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = extractToken(c);
  if (!token) {
    return c.json(
      {
        success: false,
        error: {
          code: ApiErrorCode.AUTH_UNAUTHORIZED,
          message: 'Missing or invalid authentication token',
        },
      },
      401,
    );
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as unknown as {
      sub: number;
      email: string;
      role: UserRole;
    };
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
    });

    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            code: ApiErrorCode.AUTH_USER_NOT_FOUND,
            message: 'Authenticated user no longer exists',
          },
        },
        401,
      );
    }

    const sessionUser: SessionUser = {
      id: user.id,
      uuid: user.uuid,
      email: user.email,
      username: user.username,
      role: user.role as UserRole,
      languagePreference: user.languagePreference,
    };

    c.set('user', sessionUser);
    c.set('userId', user.id);
    await next();
  } catch {
    return c.json(
      {
        success: false,
        error: {
          code: ApiErrorCode.AUTH_TOKEN_EXPIRED,
          message: 'Invalid or expired authentication token',
        },
      },
      401,
    );
  }
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  if (!user) {
    // If auth hasn't run yet, run auth check first
    const token = extractToken(c);
    if (!token) {
      return c.json(
        {
          success: false,
          error: {
            code: ApiErrorCode.AUTH_UNAUTHORIZED,
            message: 'Missing or invalid authentication token',
          },
        },
        401,
      );
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret) as unknown as {
        sub: number;
        email: string;
        role: UserRole;
      };
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, payload.sub),
      });

      if (!dbUser) {
        return c.json(
          {
            success: false,
            error: {
              code: ApiErrorCode.AUTH_USER_NOT_FOUND,
              message: 'Authenticated user no longer exists',
            },
          },
          401,
        );
      }

      const sessionUser: SessionUser = {
        id: dbUser.id,
        uuid: dbUser.uuid,
        email: dbUser.email,
        username: dbUser.username,
        role: dbUser.role as UserRole,
        languagePreference: dbUser.languagePreference,
      };

      c.set('user', sessionUser);
      c.set('userId', dbUser.id);

      if (sessionUser.role !== UserRole.ADMIN) {
        return c.json(
          {
            success: false,
            error: {
              code: ApiErrorCode.AUTH_FORBIDDEN,
              message: 'Admin privileges required',
            },
          },
          403,
        );
      }
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: ApiErrorCode.AUTH_TOKEN_EXPIRED,
            message: 'Invalid or expired authentication token',
          },
        },
        401,
      );
    }
  } else if (user.role !== UserRole.ADMIN) {
    return c.json(
      {
        success: false,
        error: {
          code: ApiErrorCode.AUTH_FORBIDDEN,
          message: 'Admin privileges required',
        },
      },
      403,
    );
  }

  await next();
});
