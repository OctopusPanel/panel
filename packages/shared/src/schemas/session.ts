import { z } from 'zod';
import { UserRole } from '../enums/index.js';

export const SessionUserSchema = z.object({
  id: z.number().int().positive(),
  uuid: z.string().uuid(),
  email: z.string().email(),
  username: z.string(),
  role: z.nativeEnum(UserRole),
  languagePreference: z.string().default('en'),
});

export type SessionUser = z.infer<typeof SessionUserSchema>;

export const AuthTokenPayloadSchema = z.object({
  sub: z.number().int().positive(),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export type AuthTokenPayload = z.infer<typeof AuthTokenPayloadSchema>;

export const AuthResponseSchema = z.object({
  token: z.string(),
  user: SessionUserSchema,
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;
