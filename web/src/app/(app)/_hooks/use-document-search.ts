'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { documentKeys, documentsService } from '@/services/documents.service';

export const useDocumentSearch = (email: string) => {
  const [query, setQuery] = useState('');
  const activeQuery = useDebounce(query, 300).trim();

  const result = useQuery({
    queryKey: documentKeys.search(email, activeQuery),
    queryFn: () => documentsService.search(email, activeQuery),
    enabled: activeQuery.length > 0,
  });

  return {
    query,
    setQuery,
    activeQuery,
    hits: result.data?.hits ?? null,
    isLoading: result.isFetching,
    error: result.error,
  };
};
