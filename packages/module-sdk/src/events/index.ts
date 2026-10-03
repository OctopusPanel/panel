import { Server, User, Node } from '@octopus/shared';

export interface EventPayloadMap {
  'server:creating': { server: Partial<Server>; context: Record<string, unknown> };
  'server:created': { server: Server };
  'server:starting': { server: Server };
  'server:started': { server: Server };
  'server:stopping': { server: Server; signal?: string };
  'server:stopped': { server: Server };
  'server:suspended': { server: Server };
  'server:unsuspended': { server: Server };
  'server:deleting': { server: Server };
  'server:deleted': { serverId: number; uuid: string };
  'user:registered': { user: User };
  'user:authenticated': { user: User };
  'user:updated': { user: User };
  'node:connected': { node: Node };
  'node:heartbeat_failed': { node: Node; error: string };
  'invoice:paid': { invoiceId: string; amount: number; currency: string; metadata?: Record<string, unknown> };
}

export type HookEventName = keyof EventPayloadMap | (string & {});
export type HookHandler<T = unknown> = (payload: T) => Promise<void | boolean> | void | boolean;

interface RegisteredHook {
  id: string;
  handler: HookHandler<any>;
  priority: number;
}

export class HookRegistry {
  private hooks = new Map<string, RegisteredHook[]>();
  private hookCounter = 0;

  /**
   * Register a hook listener. Priority defaults to 100 (lower number runs earlier).
   */
  register<K extends keyof EventPayloadMap>(
    event: K,
    handler: (payload: EventPayloadMap[K]) => Promise<void | boolean> | void | boolean,
    priority?: number,
  ): () => void;
  register(
    event: string,
    handler: HookHandler<any>,
    priority?: number,
  ): () => void;
  register(
    event: string,
    handler: HookHandler<any>,
    priority = 100,
  ): () => void {
    const hookId = `hook_${++this.hookCounter}`;
    const list = this.hooks.get(event) || [];
    list.push({ id: hookId, handler, priority });
    list.sort((a, b) => a.priority - b.priority);
    this.hooks.set(event, list);

    return () => {
      const current = this.hooks.get(event);
      if (current) {
        this.hooks.set(
          event,
          current.filter((h) => h.id !== hookId),
        );
      }
    };
  }

  /**
   * Emit an event asynchronously through all registered handlers.
   */
  async emit<K extends keyof EventPayloadMap>(event: K, payload: EventPayloadMap[K]): Promise<void>;
  async emit(event: string, payload: unknown): Promise<void>;
  async emit(event: string, payload: unknown): Promise<void> {
    const list = this.hooks.get(event);
    if (!list || list.length === 0) return;

    for (const hook of list) {
      try {
        await hook.handler(payload);
      } catch (err) {
        console.error(`Error in hook [${event}] handler:`, err);
      }
    }
  }

  /**
   * Clear all registered hooks.
   */
  clear(): void {
    this.hooks.clear();
  }
}

export const globalHooks = new HookRegistry();
