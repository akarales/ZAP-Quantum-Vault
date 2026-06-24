import { create } from "zustand";
import { api, type KeyEntry } from "@/lib/api";

interface KeyState {
  keys: KeyEntry[];
  loading: boolean;
  error: string | null;
  fetchKeys: () => Promise<void>;
  generateKey: (
    keyType: string,
    purpose: number,
    account: number,
    index: number
  ) => Promise<KeyEntry | null>;
  clearError: () => void;
  reset: () => void;
}

export const useKeyStore = create<KeyState>((set) => ({
  keys: [],
  loading: false,
  error: null,
  fetchKeys: async () => {
    set({ loading: true, error: null });
    try {
      const keys = await api.listKeys();
      set({ keys, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
  generateKey: async (keyType, purpose, account, index) => {
    set({ loading: true, error: null });
    try {
      const key = await api.generateKey(keyType, purpose, account, index);
      set((s) => ({ keys: [...s.keys, key], loading: false }));
      return key;
    } catch (e) {
      set({ error: String(e), loading: false });
      return null;
    }
  },
  clearError: () => set({ error: null }),
  reset: () => set({ keys: [], loading: false, error: null }),
}));
