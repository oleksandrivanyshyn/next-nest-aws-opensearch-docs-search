import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;
export type DocumentRow = typeof schema.documents.$inferSelect;
export type NewDocumentRow = typeof schema.documents.$inferInsert;
export type DocumentStatus = DocumentRow['status'];
