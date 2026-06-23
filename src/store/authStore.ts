import { create } from "zustand";

interface AuthState {
  isUnlocked: boolean;
  isInitialized: boolean;
  unlock: () => void;
  lock: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isUnlocked: false,
  isInitialized: false,
  unlock: () => set({ isUnlocked: true }),
  lock: () => set({ isUnlocked: false }),
  initialize: () => set({ isInitialized: true, isUnlocked: true }),
}));
