import { db } from './db.js';
import { nodes, allocations, blueprints, servers } from './schema/index.js';
import { eq } from 'drizzle-orm';

async function purgeFixtures() {
  console.log('🧹 Purging dummy nodes, allocations, and blueprints...');

  // 1. Purge dummy local node 127.0.0.1 and its allocations
  const dummyNodes = await db.query.nodes.findMany({
    where: eq(nodes.fqdn, '127.0.0.1'),
  });

  for (const node of dummyNodes) {
    const srvs = await db.query.servers.findMany({
      where: eq(servers.nodeId, node.id),
    });
    if (srvs.length === 0) {
      await db.delete(allocations).where(eq(allocations.nodeId, node.id));
      await db.delete(nodes).where(eq(nodes.id, node.id));
      console.log(`🗑️ Deleted dummy node '${node.name}' (ID: ${node.id}) and all associated allocations.`);
    } else {
      console.log(`⚠️ Skipped node '${node.name}' because servers are actively attached.`);
    }
  }

  // 2. Clean up any leftover dummy allocations pointing to 127.0.0.1 without server
  await db.delete(allocations).where(eq(allocations.ipAddress, '127.0.0.1'));

  // 3. Purge dummy blueprint 'Minecraft Paper' if unused
  const dummyBlueprints = await db.query.blueprints.findMany({
    where: eq(blueprints.name, 'Minecraft Paper'),
  });
  for (const bp of dummyBlueprints) {
    const srvs = await db.query.servers.findMany({
      where: eq(servers.blueprintId, bp.id),
    });
    if (srvs.length === 0) {
      await db.delete(blueprints).where(eq(blueprints.id, bp.id));
      console.log(`🗑️ Deleted dummy blueprint '${bp.name}' (ID: ${bp.id}).`);
    } else {
      console.log(`⚠️ Skipped blueprint '${bp.name}' because servers are actively attached.`);
    }
  }

  console.log('✨ Cleanup finished! System is completely fresh and clean.');
}

purgeFixtures().catch((err) => {
  console.error('Purge fixtures failed:', err);
  process.exit(1);
});
