import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { servers } from './servers.js';

export const serverDatabases = pgTable('server_databases', {
  id: uuid('id').defaultRandom().primaryKey(),
  serverId: integer('server_id')
    .notNull()
    .references(() => servers.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 64 }).notNull(),
  username: varchar('username', { length: 64 }).notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  host: varchar('host', { length: 255 }).default('127.0.0.1').notNull(),
  port: integer('port').default(3306).notNull(),
  databaseType: varchar('database_type', { length: 32 }).default('mysql').notNull(),
  maxConnections: integer('max_connections').default(10).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const serverDatabasesRelations = relations(serverDatabases, ({ one }) => ({
  server: one(servers, {
    fields: [serverDatabases.serverId],
    references: [servers.id],
  }),
}));

export type ServerDatabaseEntity = typeof serverDatabases.$inferSelect;
export type NewServerDatabaseEntity = typeof serverDatabases.$inferInsert;
