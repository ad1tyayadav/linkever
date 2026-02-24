import { create } from "zustand";
import type { AppState } from "@/types";

export const useAppStore = create<AppState>((set) => ({
    // State
    currentUrl: "",
    detectedPlatform: null,
    metadata: null,
    activeJob: null,
    progress: null,

    // Actions
    setCurrentUrl: (url) => set({ currentUrl: url }),
    setDetectedPlatform: (platform) => set({ detectedPlatform: platform }),
    setMetadata: (metadata) => set({ metadata }),
    setActiveJob: (job) => set({ activeJob: job }),
    setProgress: (progress) => set({ progress }),

    reset: () =>
        set({
            currentUrl: "",
            detectedPlatform: null,
            metadata: null,
            activeJob: null,
            progress: null,
        }),
}));
