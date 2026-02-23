"use client";

import { useCallback, useEffect, useRef } from "react";
import { isValidUrl } from "@/lib/platforms";

interface UseClipboardOptions {
    onUrlDetected: (url: string) => void;
    enabled?: boolean;
}

export function useClipboard({ onUrlDetected, enabled = true }: UseClipboardOptions) {
    const lastUrl = useRef("");

    const handlePaste = useCallback(
        (e: ClipboardEvent) => {
            if (!enabled) return;
            const text = e.clipboardData?.getData("text/plain")?.trim();
            if (text && isValidUrl(text) && text !== lastUrl.current) {
                lastUrl.current = text;
                onUrlDetected(text);
            }
        },
        [onUrlDetected, enabled]
    );

    useEffect(() => {
        document.addEventListener("paste", handlePaste);
        return () => document.removeEventListener("paste", handlePaste);
    }, [handlePaste]);

    // Try reading clipboard on focus (requires permission)
    const readClipboard = useCallback(async () => {
        if (!enabled) return;
        try {
            const text = await navigator.clipboard.readText();
            if (text && isValidUrl(text.trim()) && text.trim() !== lastUrl.current) {
                lastUrl.current = text.trim();
                onUrlDetected(text.trim());
            }
        } catch {
            // Clipboard API requires permission — silently ignore
        }
    }, [onUrlDetected, enabled]);

    return { readClipboard };
}
