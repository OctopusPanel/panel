import { db, users, nodes, allocations, blueprints, servers } from '@octopus/database';
import { EggParser } from '../eggs/egg-parser.js';
import { UserRole, ServerStatus, ProviderType } from '@octopus/shared';
import crypto from 'node:crypto';

export interface PterodactylApiConfig {
  baseUrl: string; // e.g. https://panel.example.com
  apiKey: string; // Application API Key (ptla_...)
}

export interface MigrationSummary {
  usersMigrated: number;
  nodesMigrated: number;
  allocationsMigrated: number;
  blueprintsMigrated: number;
  serversMigrated: number;
  storageVolumeSymlinks: Array<{ pterodactylPath: string; octopusPath: string }>;
}

export class PterodactylImporter {
  private config: PterodactylApiConfig;

  constructor(config: PterodactylApiConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/+$/, ''),
      apiKey: config.apiKey,
    };
  }

  private async fetchApi<T>(path: string): Promise<T> {
    const url = `${this.config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Pterodactyl API request failed: ${res.status} ${res.statusText}`);
    }

    return (await res.json()) as T;
  }

  /**
   * Run full migration from Pterodactyl Application API
   */
  async migrateAll(): Promise<MigrationSummary> {
    const summary: MigrationSummary = {
      usersMigrated: 0,
      nodesMigrated: 0,
      allocationsMigrated: 0,
      blueprintsMigrated: 0,
      serversMigrated: 0,
      storageVolumeSymlinks: [],
    };

    // 1. Migrate Users
    const pteroUsers = await this.fetchApi<{ data: Array<{ attributes: any }> }>('/api/application/users');
    const userMap = new Map<number, number>(); // pteroUserId -> octopusUserId

    for (const item of pteroUsers.data) {
      const attr = item.attributes;
      const role = attr.root_admin ? UserRole.ADMIN : UserRole.USER;
      const placeholderPassword = crypto.randomBytes(16).toString('hex');

      const [created] = await db
        .insert(users)
        .values({
          email: attr.email,
          username: attr.username,
          passwordHash: `$2a$12$${crypto.randomBytes(24).toString('base64')}`, // temporary hash, password reset required or synced
          role,
          languagePreference: attr.language || 'en',
        })
        .onConflictDoNothing()
        .returning();

      if (created) {
        userMap.set(attr.id, created.id);
        summary.usersMigrated++;
      }
    }

    // 2. Migrate Nodes & Allocations
    const pteroNodes = await this.fetchApi<{ data: Array<{ attributes: any }> }>('/api/application/nodes?include=allocations');
    const nodeMap = new Map<number, number>(); // pteroNodeId -> octopusNodeId
    const allocMap = new Map<number, number>(); // pteroAllocId -> octopusAllocId

    for (const item of pteroNodes.data) {
      const attr = item.attributes;
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const [createdNode] = await db
        .insert(nodes)
        .values({
          name: attr.name,
          fqdn: attr.fqdn,
          apiPort: attr.daemon_listen || 8080,
          sftpPort: attr.daemon_sftp || 2022,
          tokenHash,
          memoryLimit: attr.memory,
          diskLimit: attr.disk,
          isMaintenance: attr.maintenance_mode || false,
        })
        .onConflictDoNothing()
        .returning();

      if (createdNode) {
        nodeMap.set(attr.id, createdNode.id);
        summary.nodesMigrated++;

        // Import Allocations
        if (attr.relationships && attr.relationships.allocations && attr.relationships.allocations.data) {
          for (const allocItem of attr.relationships.allocations.data) {
            const a = allocItem.attributes;
            const [createdAlloc] = await db
              .insert(allocations)
              .values({
                nodeId: createdNode.id,
                ipAddress: a.ip,
                port: a.port,
                alias: a.alias || null,
                isPrimary: false,
              })
              .returning();

            if (createdAlloc) {
              allocMap.set(a.id, createdAlloc.id);
              summary.allocationsMigrated++;
            }
          }
        }
      }
    }

    // 3. Migrate Nests & Eggs -> Blueprints
    const pteroNests = await this.fetchApi<{ data: Array<{ attributes: any }> }>('/api/application/nests?include=eggs');
    const eggMap = new Map<number, number>(); // pteroEggId -> octopusBlueprintId

    for (const nest of pteroNests.data) {
      const nestId = nest.attributes.id;
      const eggsList = await this.fetchApi<{ data: Array<{ attributes: any }> }>(`/api/application/nests/${nestId}/eggs?include=variables`);

      for (const eggItem of eggsList.data) {
        const eggAttr = eggItem.attributes;
        const blueprintInput = EggParser.toBlueprintInput({
          meta: { version: 'PTDL_v1' },
          name: eggAttr.name,
          author: eggAttr.author || 'Pterodactyl Import',
          description: eggAttr.description,
          image: eggAttr.docker_image,
          docker_images: eggAttr.docker_images,
          startup: eggAttr.startup,
          config: eggAttr.config,
          scripts: { installation: { script: eggAttr.script_install, container: eggAttr.script_container, entrypoint: eggAttr.script_entry } },
          variables: eggAttr.relationships?.variables?.data?.map((v: any) => v.attributes) || [],
        });

        const [createdBp] = await db
          .insert(blueprints)
          .values({
            name: blueprintInput.name,
            author: blueprintInput.author,
            description: blueprintInput.description,
            dockerImage: blueprintInput.dockerImage,
            dockerImages: blueprintInput.dockerImages,
            startupCommand: blueprintInput.startupCommand,
            stopCommand: blueprintInput.stopCommand,
            configFiles: blueprintInput.configFiles,
            variables: blueprintInput.variables,
            installScript: blueprintInput.installScript,
            installContainer: blueprintInput.installContainer,
            installEntrypoint: blueprintInput.installEntrypoint,
          })
          .returning();

        if (createdBp) {
          eggMap.set(eggAttr.id, createdBp.id);
          summary.blueprintsMigrated++;
        }
      }
    }

    // 4. Migrate Servers
    const pteroServers = await this.fetchApi<{ data: Array<{ attributes: any }> }>('/api/application/servers');

    for (const s of pteroServers.data) {
      const attr = s.attributes;
      const targetUserId = userMap.get(attr.user) || 1;
      const targetNodeId = nodeMap.get(attr.node) || 1;
      const targetBpId = eggMap.get(attr.egg) || 1;
      const targetAllocId = allocMap.get(attr.allocation) || null;

      const [createdServer] = await db
        .insert(servers)
        .values({
          uuid: attr.uuid,
          identifier: attr.identifier,
          name: attr.name,
          description: attr.description || null,
          userId: targetUserId,
          nodeId: targetNodeId,
          blueprintId: targetBpId,
          allocationId: targetAllocId,
          memory: attr.limits?.memory || 1024,
          cpu: attr.limits?.cpu || 100,
          disk: attr.limits?.disk || 10240,
          swap: attr.limits?.swap || 0,
          io: attr.limits?.io || 500,
          isSuspended: attr.suspended || false,
          status: attr.status ? (attr.status as ServerStatus) : ServerStatus.OFFLINE,
          providerType: ProviderType.TENTACLE_DOCKER,
          dockerImage: attr.container?.image || 'ghcr.io/pterodactyl/yolks:java_21',
          startupCommand: attr.container?.startup_command || '',
          environment: attr.container?.environment || {},
        })
        .onConflictDoNothing()
        .returning();

      if (createdServer) {
        summary.serversMigrated++;
        summary.storageVolumeSymlinks.push({
          pterodactylPath: `/var/lib/pterodactyl/volumes/${attr.uuid}`,
          octopusPath: `/var/lib/octopus/volumes/${attr.uuid}`,
        });
      }
    }

    return summary;
  }
}
