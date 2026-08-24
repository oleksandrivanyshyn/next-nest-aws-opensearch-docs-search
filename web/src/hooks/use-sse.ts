'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { documentKeys } from '@/services/documents.service';
import type { DocumentDto } from '@/types/document.types';
import { upsertDocument } from '@/utils/upsert-document';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';

export function useSse(email: string | null): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!email) return;

    const source = new EventSource(
      `${API_URL}/notifications/sse?email=${encodeURIComponent(email)}`,
    );

    source.addEventListener('open', () => setConnected(true));
    source.addEventListener('ping', () => setConnected(true));
    source.addEventListener('document', (event) => {
      setConnected(true);

      const updated = JSON.parse(
        (event as MessageEvent<string>).data,
      ) as DocumentDto;

      queryClient.setQueryData<DocumentDto[]>(
        documentKeys.list(email),
        (current) => (current ? upsertDocument(current, updated) : current),
      );
      void queryClient.invalidateQueries({ queryKey: documentKeys.all });
    });
    source.onerror = () => setConnected(false);

    return () => source.close();
  }, [email, queryClient]);

  return { connected };
}
