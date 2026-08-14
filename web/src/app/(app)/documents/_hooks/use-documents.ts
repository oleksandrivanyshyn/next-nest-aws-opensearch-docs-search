'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentKeys, documentsService } from '@/services/documents.service';
import type { DocumentDto } from '@/types/document.types';

export const useDocuments = (email: string) => {
  return useQuery({
    queryKey: documentKeys.list(email),
    queryFn: () => documentsService.list(email),
    enabled: !!email,
  });
};

export const useDeleteDocument = (email: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => documentsService.delete(id, email),
    onSuccess: (_, id) => {
      queryClient.setQueryData<DocumentDto[]>(
        documentKeys.list(email),
        (current) => current?.filter((document) => document.id !== id),
      );
      void queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
};
