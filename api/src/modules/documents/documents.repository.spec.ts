import { DocumentsRepository } from './documents.repository';
import type { Database } from '../../core/db/drizzle/types';

describe('DocumentsRepository.findManyByIds', () => {
  it('skips the query entirely when the index returned no ids', async () => {
    const select = jest.fn(() => {
      throw new Error('inArray cannot build a predicate from an empty list');
    });
    const repository = new DocumentsRepository({
      select,
    } as unknown as Database);

    await expect(
      repository.findManyByIds([], 'owner@example.com'),
    ).resolves.toEqual([]);
    expect(select).not.toHaveBeenCalled();
  });
});
