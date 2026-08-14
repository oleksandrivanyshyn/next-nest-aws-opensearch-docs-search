import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UserState {
  email: string | null;
  setEmail: (email: string) => void;
  signOut: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      email: null,
      setEmail: (email) => set({ email: email.trim().toLowerCase() }),
      signOut: () => set({ email: null }),
    }),
    {
      name: 'docsearch-user',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
