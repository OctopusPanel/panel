import { pgTable, serial, uuid, varchar, text, integer, boolean, jsonb, timestamp, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';
import { nodes } from './nodes.js';
import { blueprints } from './blueprints.js';
import { allocations } from './allocations.js';
import { subusers } from './subusers.js';

export const servers = pgTable('servers', {
  id: serial('id').primaryKey(),
  uuid: uuid('uuid').defaultRandom().notNull().unique(),
  identifier: varchar('identifier', { length: 8 }).notNull().unique(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  nodeId: integer('node_id')
    .notNull()
    .references(() => nodes.id, { onDelete: 'restrict' }),
  blueprintId: integer('blueprint_id')
    .notNull()
    .references(() => blueprints.id, { onDelete: 'restrict' }),
  allocationId: integer('allocation_id').references((): AnyPgColumn => allocations.id, { onDelete: 'set null' }),
  memory: integer('memory').notNull(), // MB
  cpu: integer('cpu').default(100).notNull(), // %
  disk: integer('disk').notNull(), // MB
  swap: integer('swap').default(0).notNull(), // MB
  io: integer('io').default(500).notNull(),
  isSuspended: boolean('is_suspended').default(false).notNull(),
  status: varchar('status', { length: 32 }).default('offline').notNull(),
  providerType: varchar('provider_type', { length: 64 }).default('tentacle-docker').notNull(),
  dockerImage: varchar('docker_image', { length: 255 }).notNull(),
  startupCommand: text('startup_command').notNull(),
  environment: jsonb('environment').$type<Record<string, string>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const serversRelations = relations(servers, ({ one, many }) => ({
  user: one(users, {
    fields: [servers.userId],
    references: [users.id],
  }),
  node: one(nodes, {
    fields: [servers.nodeId],
    references: [nodes.id],
  }),
  blueprint: one(blueprints, {
    fields: [servers.blueprintId],
    references: [blueprints.id],
  }),
  allocation: one(allocations, {
    fields: [servers.allocationId],
    references: [allocations.id],
  }),
  subusers: many(subusers),
}));

export type ServerEntity = typeof servers.$inferSelect;
export type NewServerEntity = typeof servers.$inferInsert;
