import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../core/db/drizzle/drizzle.module';
import { documents } from '../../core/db/drizzle/schema';
import type {
  Database,
  DocumentRow,
  DocumentStatus,
  NewDocumentRow,
} from '../../core/db/drizzle/types';

@Injectable()
export class DocumentsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(row: NewDocumentRow): Promise<DocumentRow> {
    const [created] = await this.db.insert(documents).values(row).returning();
    return created;
  }

  async findAllByEmail(email: string): Promise<DocumentRow[]> {
    return this.db
      .select()
      .from(documents)
      .where(eq(documents.userEmail, email))
      .orderBy(desc(documents.createdAt));
  }

  async findById(id: string): Promise<DocumentRow | undefined> {
    const [row] = await this.db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    return row;
  }

  async findByS3Key(s3Key: string): Promise<DocumentRow | undefined> {
    const [row] = await this.db
      .select()
      .from(documents)
      .where(eq(documents.s3Key, s3Key))
      .limit(1);
    return row;
  }

  async findManyByIds(ids: string[], email: string): Promise<DocumentRow[]> {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(documents)
      .where(and(eq(documents.userEmail, email), inArray(documents.id, ids)));
  }

  async updateStatus(
    id: string,
    status: DocumentStatus,
    errorMessage: string | null = null,
  ): Promise<DocumentRow> {
    const [updated] = await this.db
      .update(documents)
      .set({ status, errorMessage, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return updated;
  }

  async deleteById(id: string): Promise<void> {
    await this.db.delete(documents).where(eq(documents.id, id));
  }
}
