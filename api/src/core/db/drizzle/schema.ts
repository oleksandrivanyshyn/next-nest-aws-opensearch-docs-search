import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const documentStatusEnum = pgEnum('document_status', [
  'PENDING',
  'INDEXED',
  'ERROR',
]);

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userEmail: varchar('user_email', { length: 255 }).notNull(),
  userFilename: text('user_filename').notNull(),
  s3Key: text('s3_key').notNull().unique(),
  status: documentStatusEnum('status').default('PENDING').notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
