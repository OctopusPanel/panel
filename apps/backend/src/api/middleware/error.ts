import { Context } from 'hono';
import { ApiErrorCode, ApiErrorResponse } from '@octopus/shared';
import { ZodError } from 'zod';

export function jsonError(
  c: Context,
  code: ApiErrorCode | string,
  status: any = 400,
  params?: Record<string, unknown>,
  message?: string,
) {
  const payload: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message: message || (typeof code === 'string' ? code : 'An error occurred'),
      params,
    },
  };
  return c.json(payload, status);
}

export function handleZodError(c: Context, error: ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'body';
    fieldErrors[key] = fieldErrors[key] || [];
    fieldErrors[key].push(issue.message);
  }

  return jsonError(c, ApiErrorCode.VALIDATION_ERROR, 422, { fields: fieldErrors }, 'Validation failed');
}
