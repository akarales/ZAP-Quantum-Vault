import { create } from "zustand";
import { api } from "@/lib/api";
import { useKeyStore } from "@/store/keyStore";

interface AuthState {
  isUnlocked: boolean;
  isInitialized: boolean;
  statusChecked: boolean;
  loading: boolean;
  error: string | null;
  checkStatus: () => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  initialize: (password: string) => Promise<boolean>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isUnlocked: false,
  isInitialized: false,
  statusChecked: false,
  loading: false,
  error: null,
  checkStatus: async () => {
    try {
      const initialized = await api.vaultStatus();
      set({ isInitialized: initialized, statusChecked: true });
    } catch (e) {
      set({ error: String(e), statusChecked: true });
    }
  },
  unlock: async (password: string) => {
    set({ loading: true, error: null });
    try {
      await api.unlockVault(password);
      set({ isUnlocked: true, loading: false });
      return true;
    } catch (e) {
      set({ error: String(e), loading: false });
      return false;
    }
  },
  lock: () => {
    // Drop the backend session key and decrypted keys, then clear the
    // in-memory frontend keystore so nothing sensitive lingers.
    api.lockVault().catch(() => {});
    useKeyStore.getState().reset();
    set({ isUnlocked: false });
  },
  initialize: async (password: string) => {
    set({ loading: true, error: null });
    try {
      await api.createVault(password);
      set({ isInitialized: true, isUnlocked: true, loading: false });
      return true;
    } catch (e) {
      set({ error: String(e), loading: false });
      return false;
    }
  },
  changePassword: async (oldPassword: string, newPassword: string) => {
    set({ loading: true, error: null });
    try {
      await api.changePassword(oldPassword, newPassword);
      set({ loading: false });
      return true;
    } catch (e) {
      set({ error: String(e), loading: false });
      return false;
    }
  },
  clearError: () => set({ error: null }),
}));
