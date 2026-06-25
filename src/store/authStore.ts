import { create } from "zustand";
import { api } from "@/lib/api";
import { useKeyStore } from "@/store/keyStore";

interface AuthState {
  isUnlocked: boolean;
  isInitialized: boolean;
  statusChecked: boolean;
  loading: boolean;
  error: string | null;
  /** Recovery phrase from the most recent vault creation, shown once for backup. */
  mnemonic: string | null;
  checkStatus: () => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  initialize: (password: string) => Promise<boolean>;
  restore: (mnemonic: string, password: string) => Promise<boolean>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  clearError: () => void;
  /** Wipe the cached recovery phrase once the user confirms they saved it. */
  clearMnemonic: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isUnlocked: false,
  isInitialized: false,
  statusChecked: false,
  loading: false,
  error: null,
  mnemonic: null,
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
      const { mnemonic } = await api.createVault(password);
      // Vault is unlocked immediately, but we hold the mnemonic so the UI can
      // force a one-time backup step before proceeding.
      set({ isInitialized: true, isUnlocked: true, loading: false, mnemonic });
      return true;
    } catch (e) {
      set({ error: String(e), loading: false });
      return false;
    }
  },
  restore: async (mnemonic: string, password: string) => {
    set({ loading: true, error: null });
    try {
      await api.restoreFromMnemonic(mnemonic, password);
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
  clearMnemonic: () => set({ mnemonic: null }),
}));
