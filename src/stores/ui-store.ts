"use client";

import { create } from "zustand";

interface UiState {
  /** Mobile slide-over navigation drawer. */
  mobileNavOpen: boolean;
  setMobileNav: (open: boolean) => void;
  toggleMobileNav: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  mobileNavOpen: false,
  setMobileNav: (open) => set({ mobileNavOpen: open }),
  toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),
}));
