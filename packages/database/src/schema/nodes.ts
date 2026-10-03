import { pgTable, serial, uuid, varchar, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { allocations } from './allocations.js';
import { servers } from './servers.js';

export const nodes = pgTable('nodes', {
  id: serial('id').primaryKey(),
  uuid: uuid('uuid').defaultRandom().notNull().unique(),
  name: varchar('name', { length: 128 }).notNull(),
  fqdn: varchar('fqdn', { length: 255 }).notNull(),
  apiPort: integer('api_port').default(8080).notNull(),
  sftpPort: integer('sftp_port').default(2022).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  memoryLimit: integer('memory_limit').notNull(), // MB
  diskLimit: integer('disk_limit').notNull(), // MB
  isMaintenance: boolean('is_maintenance').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const nodesRelations = relations(nodes, ({ many }) => ({
  allocations: many(allocations),
  servers: many(servers),
}));

export type NodeEntity = typeof nodes.$inferSelect;
export type NewNodeEntity = typeof nodes.$inferInsert;
