export interface VariableContext {
  memory: number; // in MB
  ip?: string;
  port?: number;
  environment: Record<string, string>;
}

export class VariableInterpolator {
  /**
   * Interpolate placeholders like {{SERVER_MEMORY}}, {{SERVER_PORT}}, and {{CUSTOM_VAR}}
   */
  static interpolateString(template: string, ctx: VariableContext): string {
    return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_match, varName: string) => {
      // 1. Built-in system substitutions
      if (varName === 'SERVER_MEMORY') {
        return String(ctx.memory);
      }
      if (varName === 'SERVER_PORT') {
        return ctx.port !== undefined ? String(ctx.port) : '25565';
      }
      if (varName === 'SERVER_IP') {
        return ctx.ip || '0.0.0.0';
      }

      // 2. Custom environment variables
      if (varName in ctx.environment) {
        return ctx.environment[varName];
      }

      // If undefined, keep the placeholder or return empty
      return ctx.environment[varName] ?? `{{${varName}}}`;
    });
  }

  /**
   * Recursively interpolate all strings in an object or record
   */
  static interpolateObject<T>(obj: T, ctx: VariableContext): T {
    if (typeof obj === 'string') {
      return this.interpolateString(obj, ctx) as unknown as T;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.interpolateObject(item, ctx)) as unknown as T;
    }
    if (obj !== null && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.interpolateObject(value, ctx);
      }
      return result as T;
    }
    return obj;
  }
}
