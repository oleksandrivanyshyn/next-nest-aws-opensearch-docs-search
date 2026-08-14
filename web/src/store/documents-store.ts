import { create } from 'zustand';
import type { DocumentDto } from '@/lib/types';

interface DocumentsState {
  documents: DocumentDto[];
  setDocuments: (documents: DocumentDto[]) => void;
  upsert: (document: DocumentDto) => void;
  remove: (id: string) => void;
}

export const useDocumentsStore = create<DocumentsState>()((set) => ({
  documents: [],
  setDocuments: (documents) => set({ documents }),
  upsert: (document) =>
    set((state) => {
      const index = state.documents.findIndex(
        (item) => item.id === document.id,
      );
      if (index === -1) return { documents: [document, ...state.documents] };

      const next = [...state.documents];
      next[index] = document;
      return { documents: next };
    }),
  remove: (id) =>
    set((state) => ({
      documents: state.documents.filter((document) => document.id !== id),
    })),
}));
