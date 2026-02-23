import { create } from "zustand";
import type { AppState } from "@/types";

const HISTORY_KEY = "linkever-history";

export const useAppStore = create<AppState>((set) => ({
    // State
    currentUrl: "",
    detectedPlatform: null,
    metadata: null,
    activeJob: null,
    progress: null,
    history: typeof window !== "undefined"
        ? JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]")
        : [],

    // Actions
    setCurrentUrl: (url) => set({ currentUrl: url }),
    setDetectedPlatform: (platform) => set({ detectedPlatform: platform }),
    setMetadata: (metadata) => set({ metadata }),
    setActiveJob: (job) => set({ activeJob: job }),
    setProgress: (progress) => set({ progress }),

    addHistoryEntry: (entry) =>
        set((state) => {
            const updated = [entry, ...state.history].slice(0, 50); // keep last 50
            if (typeof window !== "undefined") {
                localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
            }
            return { history: updated };
        }),

    clearHistory: () => {
        if (typeof window !== "undefined") {
            localStorage.removeItem(HISTORY_KEY);
        }
        set({ history: [] });
    },

    reset: () =>
        set({
            currentUrl: "",
            detectedPlatform: null,
            metadata: null,
            activeJob: null,
            progress: null,
        }),
}));
