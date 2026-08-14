import type { DocumentDto } from '@/types/document.types';

export function upsertDocument(
  documents: DocumentDto[],
  incoming: DocumentDto,
): DocumentDto[] {
  const index = documents.findIndex((item) => item.id === incoming.id);
  if (index === -1) return [incoming, ...documents];

  const next = [...documents];
  next[index] = incoming;
  return next;
}
