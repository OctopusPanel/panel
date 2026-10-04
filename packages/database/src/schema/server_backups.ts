import { pgTable, uuid, varchar, integer, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { servers } from './servers.js';

export const serverBackups = pgTable('server_backups', {
  id: uuid('id').defaultRandom().primaryKey(),
  serverId: integer('server_id')
    .notNull()
    .references(() => servers.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  bytes: integer('bytes').default(0).notNull(),
  isLocked: boolean('is_locked').default(false).notNull(),
  isSuccessful: boolean('is_successful').default(true).notNull(),
  checksum: varchar('checksum', { length: 255 }),
  ignoredFiles: jsonb('ignored_files').$type<string[]>().default([]).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const serverBackupsRelations = relations(serverBackups, ({ one }) => ({
  server: one(servers, {
    fields: [serverBackups.serverId],
    references: [servers.id],
  }),
}));

export type ServerBackupEntity = typeof serverBackups.$inferSelect;
export type NewServerBackupEntity = typeof serverBackups.$inferInsert;
