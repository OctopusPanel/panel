import { db, nodes } from '@octopus/database';
import { eq } from 'drizzle-orm';
import { TentacleHttpClient } from '@octopus/tentacle-client';
import { globalProviders, TentacleProviderDriver } from '@octopus/module-sdk';

const clientCache = new Map<number, { client: TentacleHttpClient; updatedAt: number }>();

export async function getTentacleClientForNode(nodeId: number): Promise<TentacleHttpClient> {
  const cached = clientCache.get(nodeId);
  // Cache for 60 seconds
  if (cached && Date.now() - cached.updatedAt < 60000) {
    return cached.client;
  }

  const node = await db.query.nodes.findFirst({
    where: eq(nodes.id, nodeId),
  });

  if (!node) {
    throw new Error(`Node with ID ${nodeId} not found in database`);
  }

  const protocol = node.fqdn.startsWith('https://') || node.fqdn.startsWith('http://') ? '' : 'http://';
  const baseUrl = `${protocol}${node.fqdn}:${node.apiPort}`;

  // In production, tokenHash is either verified or raw token is securely stored/derived.
  const client = new TentacleHttpClient({
    baseUrl,
    token: node.tokenHash,
    timeoutMs: 10000,
  });

  clientCache.set(nodeId, { client, updatedAt: Date.now() });
  return client;
}

export function registerDefaultProviders(): void {
  const tentacleDriver = new TentacleProviderDriver(getTentacleClientForNode);
  globalProviders.register(tentacleDriver, true);
}
