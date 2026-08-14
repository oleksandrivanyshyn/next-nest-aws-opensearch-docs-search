'use client';

import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { documentKeys, documentsService } from '@/services/documents.service';
import type { DocumentDto } from '@/types/document.types';
import { s3Service } from '@/services/s3.service';
import { resolveContentType, validateFile } from '@/utils/file-validation';

export const useUpload = (email: string) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (file: File): Promise<DocumentDto> => {
      const problem = validateFile(file);
      if (problem) throw new Error(problem);

      const contentType = resolveContentType(file.name);
      if (!contentType) throw new Error('Unsupported file type');

      const { uploadUrl, requiredHeaders, document } =
        await documentsService.createUploadUrl({
          email,
          filename: file.name,
          contentType,
          size: file.size,
        });

      await s3Service.upload(uploadUrl, requiredHeaders, file);
      return document;
    },
    onSuccess: (document) => {
      queryClient.setQueryData<DocumentDto[]>(
        documentKeys.list(email),
        (current) => (current ? [document, ...current] : [document]),
      );
    },
    onSettled: () => {
      if (inputRef.current) inputRef.current.value = '';
    },
  });

  return {
    inputRef,
    upload: mutation.mutate,
    uploading: mutation.isPending,
    error: mutation.error,
  };
};
