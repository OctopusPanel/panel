import { z } from 'zod';
import { UserRole } from '../enums/index.js';

export const UserSchema = z.object({
  id: z.number().int().positive(),
  uuid: z.string().uuid(),
  email: z.string().email(),
  username: z.string().min(3).max(32),
  role: z.nativeEnum(UserRole),
  languagePreference: z.string().min(2).max(10).default('en'),
  twoFactorEnabled: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, underscores and hyphens'),
  password: z.string().min(8).max(128),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
  languagePreference: z.string().min(2).max(10).default('en'),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(3).max(32).optional(),
  password: z.string().min(8).max(128).optional(),
  role: z.nativeEnum(UserRole).optional(),
  languagePreference: z.string().min(2).max(10).optional(),
  twoFactorEnabled: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const LoginSchema = z.object({
  identifier: z.string().min(1), // email or username
  password: z.string().min(1),
  twoFactorCode: z.string().length(6).optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, underscores and hyphens'),
  password: z.string().min(8).max(128),
  languagePreference: z.string().min(2).max(10).default('en'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
