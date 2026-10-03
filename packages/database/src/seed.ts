import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { users, nodes, blueprints, allocations } from './schema/index.js';
import { eq } from 'drizzle-orm';
import { UserRole } from '@octopus/shared';
import crypto from 'node:crypto';

export async function seed() {
  console.log('🌱 Seeding database...');

  // 1. Seed Admin User
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@octopuspanel.local';
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPass123!';

  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.email, adminEmail),
  });

  let adminUser = existingAdmin;
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const [inserted] = await db
      .insert(users)
      .values({
        email: adminEmail,
        username: adminUsername,
        passwordHash,
        role: UserRole.ADMIN,
        languagePreference: 'en',
      })
      .returning();
    adminUser = inserted;
    console.log(`✅ Admin user created: ${adminEmail} (password: ${adminPassword})`);
  } else {
    console.log(`ℹ️ Admin user already exists: ${adminEmail}`);
  }

  // 2. Seed Default Local Node
  const existingNode = await db.query.nodes.findFirst({
    where: eq(nodes.fqdn, '127.0.0.1'),
  });

  let defaultNode = existingNode;
  if (!existingNode) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [insertedNode] = await db
      .insert(nodes)
      .values({
        name: 'Local Node 1',
        fqdn: '127.0.0.1',
        apiPort: 8080,
        sftpPort: 2022,
        tokenHash,
        memoryLimit: 16384,
        diskLimit: 500000,
        isMaintenance: false,
      })
      .returning();
    defaultNode = insertedNode;
    console.log(`✅ Default node created: Local Node 1 (token: ${token})`);
  } else {
    console.log('ℹ️ Default node already exists');
  }

  // 3. Seed Default Blueprint (Minecraft Paper)
  const existingBlueprint = await db.query.blueprints.findFirst({
    where: eq(blueprints.name, 'Minecraft Paper'),
  });

  if (!existingBlueprint) {
    await db.insert(blueprints).values({
      name: 'Minecraft Paper',
      author: 'OctopusPanel',
      description: 'High-performance Minecraft server implementation aiming to repair gameplay and mechanics inconsistencies.',
      dockerImage: 'ghcr.io/pterodactyl/yolks:java_21',
      dockerImages: {
        'Java 21': 'ghcr.io/pterodactyl/yolks:java_21',
        'Java 17': 'ghcr.io/pterodactyl/yolks:java_17',
      },
      startupCommand: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}} nogui',
      stopCommand: 'stop',
      configFiles: {
        'server.properties': {
          file: 'server.properties',
          parser: 'properties',
          findAndReplace: {
            'server-port': '{{SERVER_PORT}}',
            'server-ip': '0.0.0.0',
          },
        },
      },
      variables: [
        {
          name: 'Server Jar File',
          description: 'The name of the executable jar file.',
          envVariable: 'SERVER_JARFILE',
          defaultValue: 'server.jar',
          userViewable: true,
          userEditable: true,
          rules: 'required|string|max:40',
        },
        {
          name: 'Minecraft Version',
          description: 'The version of Minecraft to download and run.',
          envVariable: 'MINECRAFT_VERSION',
          defaultValue: 'latest',
          userViewable: true,
          userEditable: true,
          rules: 'required|string|max:20',
        },
      ],
      installScript: '#!/bin/bash\ncurl -o server.jar https://api.papermc.io/v2/projects/paper/versions/latest/builds/latest/downloads/paper-latest.jar\necho "eula=true" > eula.txt\n',
      installContainer: 'ghcr.io/pterodactyl/installers:alpine',
      installEntrypoint: 'ash',
    });
    console.log('✅ Default blueprint created: Minecraft Paper');
  } else {
    console.log('ℹ️ Default blueprint already exists');
  }

  // 4. Seed Default Allocation for Local Node
  if (defaultNode) {
    const existingAllocation = await db.query.allocations.findFirst({
      where: eq(allocations.nodeId, defaultNode.id),
    });

    if (!existingAllocation) {
      await db.insert(allocations).values([
        {
          nodeId: defaultNode.id,
          ipAddress: '127.0.0.1',
          port: 25565,
          alias: 'mc.local',
          isPrimary: true,
        },
        {
          nodeId: defaultNode.id,
          ipAddress: '127.0.0.1',
          port: 25566,
          alias: null,
          isPrimary: false,
        },
      ]);
      console.log('✅ Default allocations created: 127.0.0.1:25565, 25566');
    }
  }

  console.log('✨ Database seeding complete.');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}
