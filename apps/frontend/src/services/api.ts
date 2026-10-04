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
  demoBackups,
  demoDatabases,
  demoSchedules,
  demoSubusers,
  ServerBackup,
  ServerDatabase,
  ServerSchedule,
  ServerSubuser,
  EggVariable,
  DemoAllocation,
  DemoServer,
  demoSystemUpdates,
  demoDatabaseSnapshots,
  DemoSystemUpdateInfo,
  DemoDatabaseSnapshot,
} from './demo-data.js';

export class ApiService {
  private static baseUrl = '/api/v1';

  public static isDemoMode(): boolean {
    const val = localStorage.getItem('octopus_demo_mode');
    return val === 'true';
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

  private static async handleDemoRequest<T>(endpoint: string, method = 'GET', body?: any): Promise<T> {
    await new Promise((r) => setTimeout(r, 40)); // Snappy realistic response latency

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    // Auth
    if (cleanEndpoint === '/auth/me') {
      return demoUser as unknown as T;
    }
    if (cleanEndpoint === '/auth/login' || cleanEndpoint === '/auth/register') {
      localStorage.setItem('octopus_token', 'demo_jwt_token_sample');
      return { token: 'demo_jwt_token_sample', user: demoUser } as unknown as T;
    }

    // Client Servers List
    if (cleanEndpoint === '/client/servers' && method === 'GET') {
      return demoServers as unknown as T;
    }

    // Server Metrics
    const srvMetricsMatch = cleanEndpoint.match(/^\/client\/servers\/([^\/]+)\/metrics$/);
    if (srvMetricsMatch && method === 'GET') {
      const idOrUuid = srvMetricsMatch[1];
      const target = demoServers.find((s) => s.id === Number(idOrUuid) || s.uuid === idOrUuid) || demoServers[0];
      return (target.metrics || {
        cpuCurrent: 14.5,
        cpuLimit: target.cpu,
        memoryCurrentBytes: 1073741824,
        memoryLimitBytes: target.memory * 1024 * 1024,
        diskCurrentBytes: 5368709120,
        diskLimitBytes: target.disk * 1024 * 1024,
        networkRxBytes: 12048576,
        networkTxBytes: 38145728,
        uptimeSeconds: 86400,
      }) as unknown as T;
    }

    // Server Allocations / Ports
    const srvAllocationsMatch = cleanEndpoint.match(/^\/client\/servers\/([^\/]+)\/allocations$/);
    if (srvAllocationsMatch) {
      const idOrUuid = srvAllocationsMatch[1];
      const target = demoServers.find((s) => s.id === Number(idOrUuid) || s.uuid === idOrUuid) || demoServers[0];
      if (method === 'GET') {
        const allocs = demoAllocations.filter((a) => a.serverId === target.id);
        return allocs as unknown as T;
      }
      if (method === 'POST') {
        // Request additional port
        const unassigned = demoAllocations.find((a) => !a.serverId && a.nodeId === target.nodeId);
        if (unassigned) {
          unassigned.serverId = target.id;
          unassigned.note = body?.note || 'Additional Port';
          return unassigned as unknown as T;
        }
        const newAlloc: DemoAllocation = {
          id: demoAllocations.length + 1,
          nodeId: target.nodeId,
          ipAddress: target.allocation.ipAddress,
          port: 25570 + demoAllocations.length,
          alias: null,
          serverId: target.id,
          isPrimary: false,
          note: body?.note || 'Additional Port',
          node: { name: target.node.name },
        };
        demoAllocations.push(newAlloc);
        return newAlloc as unknown as T;
      }
    }

    // Allocation single actions
    const srvAllocActionMatch = cleanEndpoint.match(/^\/client\/servers\/([^\/]+)\/allocations\/(\d+)(?:\/([a-zA-Z]+))?$/);
    if (srvAllocActionMatch) {
      const [, idOrUuid, allocIdStr, action] = srvAllocActionMatch;
      const target = demoServers.find((s) => s.id === Number(idOrUuid) || s.uuid === idOrUuid) || demoServers[0];
      const allocId = Number(allocIdStr);
      const alloc = demoAllocations.find((a) => a.id === allocId);

      if (action === 'primary' && method === 'POST') {
        demoAllocations.forEach((a) => {
          if (a.serverId === target.id) a.isPrimary = a.id === allocId;
        });
        if (alloc) {
          target.allocation = { id: alloc.id, ipAddress: alloc.ipAddress, port: alloc.port, alias: alloc.alias, isPrimary: true };
        }
        return { success: true } as unknown as T;
      }

      if (action === 'alias' && method === 'POST') {
        if (alloc) {
          alloc.alias = body?.alias || null;
          alloc.note = body?.note || alloc.note;
        }
        return { success: true, allocation: alloc } as unknown as T;
      }

      if (method === 'DELETE') {
        if (alloc) {
          alloc.serverId = null;
          alloc.isPrimary = false;
        }
        return { success: true } as unknown as T;
      }
    }

    // Startup & Egg Variables
    const srvVarsMatch = cleanEndpoint.match(/^\/client\/servers\/([^\/]+)\/variables$/);
    if (srvVarsMatch) {
      const idOrUuid = srvVarsMatch[1];
      const target = demoServers.find((s) => s.id === Number(idOrUuid) || s.uuid === idOrUuid) || demoServers[0];
      const bp = demoBlueprints.find((b) => b.id === target.blueprintId) || demoBlueprints[0];

      if (method === 'GET') {
        return {
          variables: bp.variables,
          startupCommand: target.startupCommand || bp.startupCommand,
          dockerImage: target.dockerImage || bp.dockerImage,
          dockerImages: bp.dockerImages || [target.dockerImage],
        } as unknown as T;
      }

      if (method === 'PUT') {
        if (body?.variables) {
          bp.variables = body.variables;
        }
        if (body?.dockerImage) {
          target.dockerImage = body.dockerImage;
        }
        if (body?.startupCommand) {
          target.startupCommand = body.startupCommand;
        }
        return { success: true, restartRequired: true } as unknown as T;
      }
    }

    // Server Backups
    const srvBackupsMatch = cleanEndpoint.match(/^\/client\/servers\/([^\/]+)\/backups(?:\/([^\/]+)(?:\/([a-zA-Z]+))?)?$/);
    if (srvBackupsMatch) {
      const [, idOrUuid, backupId, action] = srvBackupsMatch;
      const target = demoServers.find((s) => s.id === Number(idOrUuid) || s.uuid === idOrUuid) || demoServers[0];
      if (!demoBackups[target.id]) demoBackups[target.id] = [];

      if (!backupId && method === 'GET') {
        return demoBackups[target.id] as unknown as T;
      }

      if (!backupId && method === 'POST') {
        const newBackup: ServerBackup = {
          id: `bkp_${Date.now()}`,
          serverId: target.id,
          name: body?.name || 'Manual Snapshot',
          sizeBytes: Math.floor(Math.random() * 800000000) + 400000000,
          isLocked: !!body?.isLocked,
          ignoredFiles: body?.ignoredFiles || [],
          status: 'completed',
          createdAt: new Date().toISOString(),
        };
        demoBackups[target.id].unshift(newBackup);
        return newBackup as unknown as T;
      }

      if (backupId && action === 'restore' && method === 'POST') {
        return { success: true, message: 'Backup restored successfully' } as unknown as T;
      }

      if (backupId && action === 'lock' && method === 'POST') {
        const b = demoBackups[target.id].find((x) => x.id === backupId);
        if (b) b.isLocked = !b.isLocked;
        return { success: true, backup: b } as unknown as T;
      }

      if (backupId && method === 'DELETE') {
        demoBackups[target.id] = demoBackups[target.id].filter((x) => x.id !== backupId);
        return { success: true } as unknown as T;
      }
    }

    // Server Databases
    const srvDbMatch = cleanEndpoint.match(/^\/client\/servers\/([^\/]+)\/databases(?:\/([^\/]+)(?:\/([a-zA-Z-]+))?)?$/);
    if (srvDbMatch) {
      const [, idOrUuid, dbId, action] = srvDbMatch;
      const target = demoServers.find((s) => s.id === Number(idOrUuid) || s.uuid === idOrUuid) || demoServers[0];
      if (!demoDatabases[target.id]) demoDatabases[target.id] = [];

      if (!dbId && method === 'GET') {
        return demoDatabases[target.id] as unknown as T;
      }

      if (!dbId && method === 'POST') {
        const type = body?.databaseType || 'mysql';
        const newDb: ServerDatabase = {
          id: `db_${Date.now()}`,
          serverId: target.id,
          name: body?.name || `s${target.id}_db_${Date.now().toString().slice(-4)}`,
          host: '127.0.0.1',
          port: type === 'mysql' ? 3306 : 5432,
          username: `u${target.id}_${Date.now().toString().slice(-6)}`,
          password: `Oct_Sec_Db_${Math.random().toString(36).substring(2, 10)}!`,
          databaseType: type,
          createdAt: new Date().toISOString(),
        };
        demoDatabases[target.id].push(newDb);
        return newDb as unknown as T;
      }

      if (dbId && action === 'reset-password' && method === 'POST') {
        const db = demoDatabases[target.id].find((d) => d.id === dbId);
        if (db) {
          db.password = `Oct_Sec_Db_${Math.random().toString(36).substring(2, 10)}!`;
        }
        return { success: true, database: db } as unknown as T;
      }

      if (dbId && method === 'DELETE') {
        demoDatabases[target.id] = demoDatabases[target.id].filter((d) => d.id !== dbId);
        return { success: true } as unknown as T;
      }
    }

    // Server Schedules
    const srvSchedMatch = cleanEndpoint.match(/^\/client\/servers\/([^\/]+)\/schedules(?:\/([^\/]+))?$/);
    if (srvSchedMatch) {
      const [, idOrUuid, schedId] = srvSchedMatch;
      const target = demoServers.find((s) => s.id === Number(idOrUuid) || s.uuid === idOrUuid) || demoServers[0];
      if (!demoSchedules[target.id]) demoSchedules[target.id] = [];

      if (!schedId && method === 'GET') {
        return demoSchedules[target.id] as unknown as T;
      }

      if (!schedId && method === 'POST') {
        const newSched: ServerSchedule = {
          id: `sch_${Date.now()}`,
          serverId: target.id,
          name: body?.name || 'New Automated Task',
          cron: body?.cron || '0 4 * * *',
          isActive: body?.isActive ?? true,
          lastRunAt: null,
          nextRunAt: new Date(Date.now() + 86400000).toISOString(),
          tasks: body?.tasks || [],
        };
        demoSchedules[target.id].push(newSched);
        return newSched as unknown as T;
      }

      if (schedId && method === 'PUT') {
        const s = demoSchedules[target.id].find((x) => x.id === schedId);
        if (s) {
          Object.assign(s, body);
        }
        return { success: true, schedule: s } as unknown as T;
      }

      if (schedId && method === 'DELETE') {
        demoSchedules[target.id] = demoSchedules[target.id].filter((x) => x.id !== schedId);
        return { success: true } as unknown as T;
      }
    }

    // Server Subusers
    const srvSubusersMatch = cleanEndpoint.match(/^\/client\/servers\/([^\/]+)\/subusers(?:\/(\d+))?$/);
    if (srvSubusersMatch) {
      const [, idOrUuid, subuserIdStr] = srvSubusersMatch;
      const target = demoServers.find((s) => s.id === Number(idOrUuid) || s.uuid === idOrUuid) || demoServers[0];
      if (!demoSubusers[target.id]) demoSubusers[target.id] = [];

      if (!subuserIdStr && method === 'GET') {
        return demoSubusers[target.id] as unknown as T;
      }

      if (!subuserIdStr && method === 'POST') {
        const newSubuser: ServerSubuser = {
          id: Date.now(),
          serverId: target.id,
          username: body?.email?.split('@')[0] || 'NewUser',
          email: body?.email || 'collaborator@example.com',
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=faces',
          permissions: body?.permissions || ['websocket.connect', 'control.start', 'file.read'],
          createdAt: new Date().toISOString(),
        };
        demoSubusers[target.id].push(newSubuser);
        return newSubuser as unknown as T;
      }

      if (subuserIdStr && method === 'DELETE') {
        const subId = Number(subuserIdStr);
        demoSubusers[target.id] = demoSubusers[target.id].filter((s) => s.id !== subId);
        return { success: true } as unknown as T;
      }
    }

    // Server Detail & Settings
    const srvDetailMatch = cleanEndpoint.match(/^\/client\/servers\/([^\/]+)$/);
    if (srvDetailMatch) {
      const idOrUuid = srvDetailMatch[1];
      const found = demoServers.find((s) => s.id === Number(idOrUuid) || s.uuid === idOrUuid) || demoServers[0];

      if (method === 'GET') {
        return found as unknown as T;
      }

      if (method === 'PUT') {
        if (body?.name) found.name = body.name;
        if (body?.description !== undefined) (found as any).description = body.description;
        return found as unknown as T;
      }

      if (method === 'DELETE') {
        const idx = demoServers.findIndex((s) => s.id === found.id);
        if (idx !== -1) demoServers.splice(idx, 1);
        return { success: true } as unknown as T;
      }
    }

    // Server Reinstall
    const srvReinstallMatch = cleanEndpoint.match(/^\/client\/servers\/([^\/]+)\/reinstall$/);
    if (srvReinstallMatch && method === 'POST') {
      const idOrUuid = srvReinstallMatch[1];
      const target = demoServers.find((s) => s.id === Number(idOrUuid) || s.uuid === idOrUuid);
      if (target) {
        target.status = ServerStatus.STARTING;
      }
      return { success: true, message: 'Server reinstallation queued' } as unknown as T;
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
    const srvFileContentMatch = cleanEndpoint.match(/^\/client\/servers\/([^\/]+)\/files\/contents/);
    if (srvFileContentMatch) {
      if (method === 'GET') {
        const fileParam = new URLSearchParams(cleanEndpoint.split('?')[1] || '').get('file') || 'server.properties';
        const baseName = fileParam.split('/').pop() || 'server.properties';
        return { content: demoFileContents[baseName] || `# File content for ${baseName}\nversion=1.0\n` } as unknown as T;
      }
      if (method === 'POST') {
        const { file, content } = body;
        const baseName = file?.split('/').pop() || 'server.properties';
        demoFileContents[baseName] = content;
        return { success: true } as unknown as T;
      }
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
          countryFlag: '🇩🇪',
          location: 'Frankfurt, Germany',
          pingMs: 15,
          fqdn: b.fqdn || 'node.octopus.network',
          apiPort: b.apiPort || 8080,
          sftpPort: b.sftpPort || 2022,
          memoryLimit: b.memoryLimit || 32768,
          memoryAllocated: 4096,
          diskLimit: b.diskLimit || 1048576,
          diskAllocated: 51200,
          serversCount: 0,
          isMaintenance: false,
          token: `oct_node_sec_demo${newId}`,
          hostOs: 'Ubuntu 24.04 LTS',
          kernelVersion: '6.8.0-generic',
          dockerVersion: 'Docker Engine v26.1.4',
          cgroupsV2: true,
          daemonStatus: 'online',
          daemonVersion: 'v0.1.0',
          loadAvg: [0.15, 0.2, 0.25],
        };
        demoNodes.push(created);
        return {
          node: created,
          setupCommand: `curl -sSL https://get.octopuspanel.com/tentacle/install.sh | sudo bash -s -- --token oct_node_sec_demo${newId} --panel-url http://localhost:5173`,
        } as unknown as T;
      }
      return demoNodes as unknown as T;
    }

    // Admin Node Details (/admin/nodes/:id)
    const adminNodeDetailMatch = cleanEndpoint.match(/^\/admin\/nodes\/(\d+)(?:\/([a-zA-Z-]+))?$/);
    if (adminNodeDetailMatch) {
      const [, nodeIdStr, action] = adminNodeDetailMatch;
      const nodeId = Number(nodeIdStr);
      const node = demoNodes.find((n) => n.id === nodeId) || demoNodes[0];

      if (action === 'toggle-maintenance' && method === 'POST') {
        node.isMaintenance = !node.isMaintenance;
        return { success: true, node } as unknown as T;
      }

      if (action === 'regenerate-token' && method === 'POST') {
        node.token = `oct_node_sec_${Date.now()}`;
        return { success: true, token: node.token } as unknown as T;
      }

      if (action === 'setup-command' && method === 'GET') {
        return {
          command: `curl -sSL https://get.octopuspanel.com/tentacle/install.sh | sudo bash -s -- --token ${node.token} --panel-url http://localhost:5173`,
        } as unknown as T;
      }

      if (action === 'update' && method === 'POST') {
        (node as any).daemonVersion = 'v0.2.0';
        return { success: true, message: `Node ${node.name} updated to v0.2.0` } as unknown as T;
      }

      if (method === 'GET') {
        const serversOnNode = demoServers.filter((s) => s.nodeId === node.id);
        const allocationsOnNode = demoAllocations.filter((a) => a.nodeId === node.id);
        return {
          ...node,
          servers: serversOnNode,
          allocations: allocationsOnNode,
        } as unknown as T;
      }

      if (method === 'PUT') {
        Object.assign(node, body);
        return { success: true, node } as unknown as T;
      }
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
        category: 'Custom',
        description: b.description || 'Imported Pterodactyl Egg',
        dockerImage: b.image || 'ghcr.io/pterodactyl/yolks:java_21',
        dockerImages: [b.image || 'ghcr.io/pterodactyl/yolks:java_21'],
        startupCommand: b.startup || './start.sh',
        stopCommand: b.stop || 'stop',
        serversCount: 0,
        installScript: b.scripts?.installation?.script || '#!/bin/bash\necho "Egg installed"',
        variables: b.variables || [],
        configRules: [],
      };
      demoBlueprints.push(newBp);
      return { success: true, blueprint: newBp } as unknown as T;
    }

    // Admin Blueprint Detail (/admin/blueprints/:id)
    const adminBpDetailMatch = cleanEndpoint.match(/^\/admin\/blueprints\/([^\/]+)(?:\/([a-zA-Z-]+))?$/);
    if (adminBpDetailMatch) {
      const [, bpIdStr, action] = adminBpDetailMatch;
      const bp = demoBlueprints.find((b) => String(b.id) === bpIdStr || b.uuid === bpIdStr || b.id === Number(bpIdStr)) || demoBlueprints[0];

      if (action === 'export' && method === 'GET') {
        const eggExport = {
          meta: { version: 'PTDL_v2', update_url: null },
          exported_at: new Date().toISOString(),
          name: bp.name,
          author: bp.author,
          description: bp.description,
          features: null,
          docker_images: (bp.dockerImages || [bp.dockerImage]).reduce((acc, img) => {
            acc[img] = img;
            return acc;
          }, {} as Record<string, string>),
          startup: bp.startupCommand,
          config: {
            files: '{}',
            startup: '{\n    "done": ")\\\\! For help, type "\n}',
            stop: bp.stopCommand,
            logs: '{}',
          },
          scripts: {
            installation: {
              script: bp.installScript || '',
              container: 'ghcr.io/pterodactyl/installers:alpine',
              entrypoint: 'ash',
            },
          },
          variables: bp.variables.map((v) => ({
            name: v.name,
            description: v.description,
            env_variable: v.key,
            default_value: v.defaultValue,
            user_viewable: v.userViewable,
            user_editable: v.userEditable,
            rules: v.rules,
            field_type: v.fieldType,
          })),
        };
        return eggExport as unknown as T;
      }

      if (method === 'GET') {
        return bp as unknown as T;
      }

      if (method === 'PUT') {
        Object.assign(bp, body);
        return { success: true, blueprint: bp } as unknown as T;
      }
    }

    // Admin Allocations
    if (cleanEndpoint === '/admin/allocations') {
      return demoAllocations as unknown as T;
    }
    if (cleanEndpoint === '/admin/allocations/range') {
      const { nodeId, ipAddress, startPort, endPort } = body || {};
      const sPort = Number(startPort) || 25600;
      const ePort = Number(endPort) || (sPort + 10);
      const node = demoNodes.find((n) => n.id === Number(nodeId)) || demoNodes[0];
      let added = 0;

      for (let p = sPort; p <= ePort; p++) {
        if (!demoAllocations.some((a) => a.nodeId === node.id && a.port === p)) {
          demoAllocations.push({
            id: demoAllocations.length + 1,
            nodeId: node.id,
            ipAddress: ipAddress || '198.51.100.24',
            port: p,
            alias: null,
            serverId: null,
            isPrimary: false,
            note: null,
            node: { name: node.name },
          });
          added++;
        }
      }
      return { success: true, count: added } as unknown as T;
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
          description: b.description || 'Newly created server instance.',
          userId: b.userId || 1,
          nodeId: b.nodeId || 1,
          blueprintId: b.blueprintId || 1,
          allocationId: 5,
          memory: b.memory || 2048,
          cpu: b.cpu || 100,
          disk: b.disk || 10240,
          isSuspended: false,
          status: ServerStatus.STARTING,
          providerType: 'tentacle_docker',
          dockerImage: 'ghcr.io/pterodactyl/yolks:java_21',
          startupCommand: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar',
          node: demoNodes[0],
          allocation: {
            id: demoAllocations[0].id,
            ipAddress: demoAllocations[0].ipAddress,
            port: demoAllocations[0].port,
            alias: demoAllocations[0].alias,
            isPrimary: true,
          },
          blueprint: demoBlueprints[0],
          sftp: {
            host: demoNodes[0].fqdn,
            port: 2022,
            username: `DemoAdmin.srv-${demoServers.length + 1}`,
            passwordPreview: 'oct_sftp_auto_generated',
          },
          metrics: {
            cpuCurrent: 0,
            cpuLimit: b.cpu || 100,
            memoryCurrentBytes: 0,
            memoryLimitBytes: (b.memory || 2048) * 1024 * 1024,
            diskCurrentBytes: 104857600,
            diskLimitBytes: (b.disk || 10240) * 1024 * 1024,
            networkRxBytes: 0,
            networkTxBytes: 0,
            uptimeSeconds: 0,
          },
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

    // Admin System & Updates
    if (cleanEndpoint === '/admin/system/updates') {
      return demoSystemUpdates as unknown as T;
    }

    if (cleanEndpoint === '/admin/system/update-panel' && method === 'POST') {
      demoSystemUpdates.currentVersion = demoSystemUpdates.latestVersion;
      demoSystemUpdates.hasUpdate = false;
      return { success: true, message: 'OctopusPanel successfully updated.' } as unknown as T;
    }

    if (cleanEndpoint === '/admin/system/database-snapshots') {
      if (method === 'GET') {
        return demoDatabaseSnapshots as unknown as T;
      }
      if (method === 'POST') {
        const now = new Date();
        const id = `manual-backup-v${demoSystemUpdates.currentVersion}-${now.getTime()}.sql.gz`;
        const newSnap: DemoDatabaseSnapshot = {
          id,
          filename: id,
          sizeBytes: 2516582,
          sizeFormatted: '2.40 MB',
          createdAt: now.toISOString(),
          type: 'manual',
          version: demoSystemUpdates.currentVersion,
        };
        demoDatabaseSnapshots.unshift(newSnap);
        return newSnap as unknown as T;
      }
    }

    if (cleanEndpoint.startsWith('/admin/system/database-snapshots/')) {
      const snapId = cleanEndpoint
        .replace('/admin/system/database-snapshots/', '')
        .replace('/restore', '')
        .replace('/download', '');

      if (cleanEndpoint.endsWith('/restore') && method === 'POST') {
        return { success: true, message: `Database successfully restored from snapshot ${snapId}` } as unknown as T;
      }

      if (method === 'DELETE') {
        const idx = demoDatabaseSnapshots.findIndex((s) => s.id === snapId);
        if (idx !== -1) {
          demoDatabaseSnapshots.splice(idx, 1);
        }
        return { success: true, message: `Snapshot ${snapId} deleted` } as unknown as T;
      }
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
      if (!err.message) {
        err.message = (err as any).code || `HTTP ${res.status}: ${res.statusText}`;
      }
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

  // System & Updates API
  static async getSystemUpdates(): Promise<DemoSystemUpdateInfo> {
    return this.get<DemoSystemUpdateInfo>('/admin/system/updates');
  }

  static async updatePanel(targetVersion?: string): Promise<{ success: boolean; message: string }> {
    return this.post<{ success: boolean; message: string }>('/admin/system/update-panel', { targetVersion });
  }

  static async updateNode(
    nodeId: number,
    payload?: { targetVersion?: string; sha256?: string; downloadUrl?: string }
  ): Promise<{ success: boolean; message: string }> {
    return this.post<{ success: boolean; message: string }>(`/admin/nodes/${nodeId}/update`, payload || {});
  }

  static async getDatabaseSnapshots(): Promise<DemoDatabaseSnapshot[]> {
    return this.get<DemoDatabaseSnapshot[]>('/admin/system/database-snapshots');
  }

  static async createDatabaseSnapshot(): Promise<DemoDatabaseSnapshot> {
    return this.post<DemoDatabaseSnapshot>('/admin/system/database-snapshots');
  }

  static async restoreDatabaseSnapshot(id: string): Promise<{ success: boolean; message: string }> {
    return this.post<{ success: boolean; message: string }>(`/admin/system/database-snapshots/${id}/restore`);
  }

  static async deleteDatabaseSnapshot(id: string): Promise<{ success: boolean; message: string }> {
    return this.delete<{ success: boolean; message: string }>(`/admin/system/database-snapshots/${id}`);
  }

  static downloadDatabaseSnapshotUrl(id: string): string {
    return `/api/v1/admin/system/database-snapshots/${id}/download`;
  }

  static subscribeUpdateStream(
    onEvent: (event: {
      type: 'step' | 'log' | 'done';
      step?: number;
      totalSteps?: number;
      title?: string;
      progress?: number;
      line?: string;
      stream?: string;
      success?: boolean;
      message?: string;
    }) => void
  ): () => void {
    if (this.isDemoMode()) {
      let aborted = false;
      const steps = [
        {
          step: 1,
          totalSteps: 4,
          title: 'Safety Pre-Check & Automated DB Snapshot',
          progress: 25,
          logs: [
            '> Backing up configuration environment...',
            '> Creating pre-migration database snapshot...',
            `> Snapshot saved: pre-migration-backup-v0.1.0-${Date.now()}.sql.gz (2.42 MB)`,
          ],
        },
        {
          step: 2,
          totalSteps: 4,
          title: 'Pulling Latest Codebase & Release Assets',
          progress: 50,
          logs: [
            '> git fetch origin && git pull --ff-only',
            '> Updating 4874831..2a9f110',
            '> Fast-forwarding code repository to v0.2.0 release tag',
          ],
        },
        {
          step: 3,
          totalSteps: 4,
          title: 'Building Dependencies & Compiling Production Bundles',
          progress: 75,
          logs: [
            '> pnpm install --frozen-lockfile: verifying dependencies... Done in 2.1s',
            '> pnpm build: 6 packages built successfully',
            '> Frontend Vite assets compiled to dist/',
          ],
        },
        {
          step: 4,
          totalSteps: 4,
          title: 'Executing Database Schema Migrations',
          progress: 90,
          logs: [
            '> Checking pending database schema migrations with Drizzle ORM...',
            '> Applying migration: 0002_add_cluster_metrics.sql',
            '> All database schema migrations verified and applied without errors.',
          ],
        },
      ];

      (async () => {
        onEvent({
          type: 'log',
          line: '🐙 Initializing OctopusPanel 1-Click Self-Update Orchestration...',
          stream: 'info',
        });

        for (const s of steps) {
          if (aborted) return;
          await new Promise((r) => setTimeout(r, 600));
          if (aborted) return;

          onEvent({
            type: 'step',
            step: s.step,
            totalSteps: s.totalSteps,
            title: s.title,
            progress: s.progress,
          });

          for (const l of s.logs) {
            if (aborted) return;
            await new Promise((r) => setTimeout(r, 300));
            if (aborted) return;
            onEvent({ type: 'log', line: l, stream: 'stdout' });
          }
        }

        if (aborted) return;
        await new Promise((r) => setTimeout(r, 600));
        demoSystemUpdates.currentVersion = demoSystemUpdates.latestVersion;
        demoSystemUpdates.hasUpdate = false;

        onEvent({
          type: 'step',
          step: 4,
          totalSteps: 4,
          title: 'Update Complete',
          progress: 100,
        });
        onEvent({
          type: 'log',
          line: '\n✨ OctopusPanel successfully updated to v0.2.0! Reloading services...',
          stream: 'info',
        });
        onEvent({
          type: 'done',
          success: true,
          message: 'Update completed successfully!',
        });
      })();

      return () => {
        aborted = true;
      };
    }

    const eventSource = new EventSource('/api/v1/admin/system/update-stream');
    eventSource.addEventListener('update_event', (e) => {
      try {
        const parsed = JSON.parse(e.data);
        onEvent(parsed);
      } catch {}
    });

    return () => {
      eventSource.close();
    };
  }
}
