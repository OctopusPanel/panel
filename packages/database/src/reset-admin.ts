import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { users } from './schema/index.js';
import { eq, or } from 'drizzle-orm';
import { UserRole } from '@octopus/shared';

async function resetPassword() {
  const identifier = process.argv[2] || process.env.ADMIN_EMAIL || 'admin';
  const newPassword = process.argv[3] || process.env.ADMIN_PASSWORD;

  if (!newPassword) {
    console.log('Usage: pnpm run reset-admin <email_or_username> <new_password>');
    process.exit(1);
  }

  const user = await db.query.users.findFirst({
    where: or(eq(users.email, identifier), eq(users.username, identifier)),
  });

  if (!user) {
    console.error(`User '${identifier}' not found in database.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db
    .update(users)
    .set({
      passwordHash,
      role: UserRole.ADMIN,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  console.log(`\n🎉 Success! Password for '${user.email}' (${user.username}) has been successfully updated.`);
}

resetPassword().catch((err) => {
  console.error('Password reset failed:', err);
  process.exit(1);
});
