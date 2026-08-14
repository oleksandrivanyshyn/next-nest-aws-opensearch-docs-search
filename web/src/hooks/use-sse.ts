'use client';

import { useEffect, useState } from 'react';
import { useDocumentsStore } from '@/store/documents-store';
import type { DocumentDto } from '@/lib/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';

export function useSse(email: string | null): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const upsert = useDocumentsStore((state) => state.upsert);

  useEffect(() => {
    if (!email) return;

    const source = new EventSource(
      `${API_URL}/notifications/sse?email=${encodeURIComponent(email)}`,
    );

    source.addEventListener('open', () => setConnected(true));
    source.addEventListener('ping', () => setConnected(true));
    source.addEventListener('document', (event) => {
      setConnected(true);
      upsert(JSON.parse((event as MessageEvent<string>).data) as DocumentDto);
    });
    source.onerror = () => setConnected(false);

    return () => source.close();
  }, [email, upsert]);

  return { connected };
}
