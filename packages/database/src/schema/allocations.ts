import { pgTable, serial, varchar, integer, boolean, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { nodes } from './nodes.js';
import { servers } from './servers.js';

export const allocations = pgTable('allocations', {
  id: serial('id').primaryKey(),
  nodeId: integer('node_id')
    .notNull()
    .references(() => nodes.id, { onDelete: 'cascade' }),
  ipAddress: varchar('ip_address', { length: 64 }).notNull(),
  port: integer('port').notNull(),
  alias: varchar('alias', { length: 255 }),
  serverId: integer('server_id').references((): AnyPgColumn => servers.id, { onDelete: 'set null' }),
  isPrimary: boolean('is_primary').default(false).notNull(),
});

export const allocationsRelations = relations(allocations, ({ one }) => ({
  node: one(nodes, {
    fields: [allocations.nodeId],
    references: [nodes.id],
  }),
  server: one(servers, {
    fields: [allocations.serverId],
    references: [servers.id],
  }),
}));

export type AllocationEntity = typeof allocations.$inferSelect;
export type NewAllocationEntity = typeof allocations.$inferInsert;
