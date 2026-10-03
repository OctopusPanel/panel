import { ApiResponse, ApiErrorResponse, PowerAction, ServerStatus } from '@octopus/shared';
import {
  demoUser,
  demoServers,
  demoNodes,
  demoBlueprints,
  demoAllocations,
  demoUsers,
  demoModules,
  demoFiles,
  demoFileContents,
} from './demo-data.js';

export class ApiService {
  private static baseUrl = '/api/v1';

  public static isDemoMode(): boolean {
    const val = localStorage.getItem('octopus_demo_mode');
    return val !== 'false';
  }

  public static setDemoMode(enabled: boolean): void {
    localStorage.setItem('octopus_demo_mode', enabled ? 'true' : 'false');
    if (enabled && !localStorage.getItem('octopus_token')) {
      localStorage.setItem('octopus_token', 'demo_jwt_token_sample');
    }
    window.location.reload();
  }

  private static getToken(): string | null {
    return localStorage.getItem('octopus_token');
  }

  private static async handleDemoRequest<T>(endpoint: string, method = 'GET', body?: unknown): Promise<T> {
    await new Promise((r) => setTimeout(r, 60)); // Small realistic latency

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    // Auth
    if (cleanEndpoint === '/auth/me') {
      return demoUser as unknown as T;
    }
    if (cleanEndpoint === '/auth/login' || cleanEndpoint === '/auth/register') {
      localStorage.setItem('octopus_token', 'demo_jwt_token_sample');
      return { token: 'demo_jwt_token_sample', user: demoUser } as unknown as T;
    }

    // Client Servers
    if (cleanEndpoint === '/client/servers' && method === 'GET') {
      return demoServers as unknown as T;
    }

    const srvDetailMatch = cleanEndpoint.match(/^\/client\/servers\/([^\/]+)$/);
    if (srvDetailMatch && method === 'GET') {
      const idOrUuid = srvDetailMatch[1];
      const found = demoServers.find((s) => s.id === Number(idOrUuid) || s.uuid === idOrUuid) || demoServers[0];
      return found as unknown as T;
    }

    // Power Actions
    const srvPowerMatch = cleanEndpoint.match(/^\/client\/servers\/([^\/]+)\/power$/);
    if (srvPowerMatch && method === 'POST') {
      const idOrUuid = srvPowerMatch[1];
      const action = (body as { action: PowerAction })?.action;
      const target = demoServers.find((s) => s.id === Number(idOrUuid) || s.uuid === idOrUuid);
      if (target) {
        if (action === PowerAction.START) target.status = ServerStatus.RUNNING;
        if (action === PowerAction.STOP) target.status = ServerStatus.OFFLINE;
        if (action === PowerAction.RESTART) target.status = ServerStatus.RUNNING;
        if (action === PowerAction.KILL) target.status = ServerStatus.OFFLINE;
      }
      return { message: `Power action ${action} dispatched successfully.` } as unknown as T;
    }

    // WebSocket Token for Live Console
    const srvWsMatch = cleanEndpoint.match(/^\/client\/servers\/([^\/]+)\/ws-token$/);
    if (srvWsMatch) {
      return {
        token: 'demo-ws-ephemeral-token',
        socketUrl: 'demo://mock-daemon-stream',
      } as unknown as T;
    }

    // Files List
    const srvFilesMatch = cleanEndpoint.match(/^\/client\/servers\/([^\/]+)\/files$/);
    if (srvFilesMatch) {
      return (demoFiles.root || []) as unknown as T;
    }

    // File Content
    const srvFileContentMatch = cleanEndpoint.match(/^\/client\/servers\/([^\/]+)\/files\/content/);
    if (srvFileContentMatch) {
      return { content: demoFileContents['server.properties'] } as unknown as T;
    }

    // Admin Nodes
    if (cleanEndpoint === '/admin/nodes') {
      if (method === 'POST') {
        const newId = demoNodes.length + 1;
        const b = body as any;
        const created = {
          id: newId,
          uuid: `nde_demo_${newId}`,
          name: b.name || `Node-${newId}`,
          fqdn: b.fqdn || 'node.octopus.network',
          apiPort: b.apiPort || 8080,
          sftpPort: b.sftpPort || 2022,
          memoryLimit: b.memoryLimit || 32768,
          diskLimit: b.diskLimit || 1048576,
          serversCount: 0,
          isMaintenance: false,
        };
        demoNodes.push(created);
        return {
          node: created,
          setupCommand: `curl -sSL https://get.octopuspanel.com/tentacle/install.sh | sudo bash -s -- --token oct_node_sec_demo${newId} --panel-url http://localhost:5173`,
        } as unknown as T;
      }
      return demoNodes as unknown as T;
    }

    const nodeCmdMatch = cleanEndpoint.match(/^\/admin\/nodes\/(\d+)\/setup-command$/);
    if (nodeCmdMatch) {
      const id = nodeCmdMatch[1];
      return {
        command: `curl -sSL https://get.octopuspanel.com/tentacle/install.sh | sudo bash -s -- --token oct_node_sec_demo${id} --panel-url http://localhost:5173`,
      } as unknown as T;
    }

    // Admin Blueprints
    if (cleanEndpoint === '/admin/blueprints') {
      return demoBlueprints as unknown as T;
    }
    if (cleanEndpoint === '/admin/blueprints/import-egg') {
      const b = body as any;
      const newBp = {
        id: demoBlueprints.length + 1,
        uuid: `bp_${Date.now()}`,
        name: b.name || 'Imported Community Egg',
        author: b.author || 'community@octopuspanel.io',
        dockerImage: b.image || 'ghcr.io/pterodactyl/yolks:java_21',
        startupCommand: b.startup || './start.sh',
        stopCommand: b.stop || 'stop',
        serversCount: 0,
      };
      demoBlueprints.push(newBp);
      return { success: true, blueprint: newBp } as unknown as T;
    }

    // Admin Allocations
    if (cleanEndpoint === '/admin/allocations') {
      return demoAllocations as unknown as T;
    }
    if (cleanEndpoint === '/admin/allocations/range') {
      return { success: true, count: 10 } as unknown as T;
    }

    // Admin Servers
    if (cleanEndpoint === '/admin/servers') {
      if (method === 'POST') {
        const b = body as any;
        const newServer = {
          id: demoServers.length + 1,
          uuid: `srv_custom_${Date.now()}`,
          identifier: `srv-${demoServers.length + 1}`,
          name: b.name || 'Custom Game Server',
          userId: b.userId || 1,
          nodeId: b.nodeId || 1,
          blueprintId: b.blueprintId || 1,
          allocationId: 5,
          memory: b.memory || 2048,
          cpu: b.cpu || 100,
          disk: b.disk || 10240,
          isSuspended: false,
          status: ServerStatus.STARTING,
          node: demoNodes[0],
          allocation: demoAllocations[0],
          blueprint: demoBlueprints[0],
        };
        demoServers.push(newServer);
        return newServer as unknown as T;
      }
      return demoServers as unknown as T;
    }

    // Admin Users
    if (cleanEndpoint === '/admin/users') {
      return demoUsers as unknown as T;
    }

    // Admin Modules
    if (cleanEndpoint === '/admin/modules') {
      return demoModules as unknown as T;
    }

    const modToggleMatch = cleanEndpoint.match(/^\/admin\/modules\/([^\/]+)\/toggle$/);
    if (modToggleMatch) {
      const modId = modToggleMatch[1];
      const target = demoModules.find((m) => m.id === modId);
      if (target) {
        target.isEnabled = !target.isEnabled;
      }
      return { success: true, module: target } as unknown as T;
    }

    return {} as unknown as T;
  }

  static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (this.isDemoMode()) {
      return this.handleDemoRequest<T>(endpoint, options.method || 'GET', options.body ? JSON.parse(options.body as string) : undefined);
    }

    const token = this.getToken();
    const headers = new Headers(options.headers || {});

    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = (await res.json().catch(() => ({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Invalid response from server' },
    }))) as ApiResponse<T>;

    if (!res.ok || !data.success) {
      const err = (data as ApiErrorResponse).error || {
        code: 'INTERNAL_ERROR',
        message: `HTTP ${res.status}: ${res.statusText}`,
      };
      throw err;
    }

    return (data as { success: true; data: T }).data;
  }

  static get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  static post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  static put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  static delete<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }
}
