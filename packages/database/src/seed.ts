import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { users } from './schema/index.js';
import { eq } from 'drizzle-orm';
import { UserRole } from '@octopus/shared';

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
  } else if (process.env.ADMIN_PASSWORD) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await db
      .update(users)
      .set({ passwordHash, role: UserRole.ADMIN, updatedAt: new Date() })
      .where(eq(users.id, existingAdmin.id));
    console.log(`✅ Admin user password synchronized: ${adminEmail}`);
  } else {
    console.log(`ℹ️ Admin user already exists: ${adminEmail}`);
  }

  console.log('✨ Database seeding complete (clean environment, zero dummy nodes/blueprints).');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}
