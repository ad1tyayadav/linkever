"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Link2, Clipboard, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isValidUrl, detectPlatform, isSpotifyUrl } from "@/lib/platforms";

interface UrlInputProps {
    onUrlSubmit: (url: string) => void;
    isLoading?: boolean;
    disabled?: boolean;
}

export function UrlInput({ onUrlSubmit, isLoading = false, disabled = false }: UrlInputProps) {
    const [url, setUrl] = useState("");
    const [hasValidUrl, setHasValidUrl] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleChange = useCallback((value: string) => {
        setUrl(value);
        setHasValidUrl(isValidUrl(value.trim()));
    }, []);

    const handleSubmit = useCallback(() => {
        const trimmed = url.trim();
        if (isValidUrl(trimmed)) {
            onUrlSubmit(trimmed);
        }
    }, [url, onUrlSubmit]);

    const handlePaste = useCallback(
        (e: React.ClipboardEvent) => {
            const text = e.clipboardData.getData("text/plain").trim();
            if (isValidUrl(text)) {
                setTimeout(() => onUrlSubmit(text), 50);
            }
        },
        [onUrlSubmit]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && hasValidUrl && !isLoading) {
                handleSubmit();
            }
        },
        [hasValidUrl, isLoading, handleSubmit]
    );

    const pasteFromClipboard = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setUrl(text.trim());
                setHasValidUrl(isValidUrl(text.trim()));
                if (isValidUrl(text.trim())) {
                    onUrlSubmit(text.trim());
                }
            }
        } catch {
            // Clipboard API requires permission
        }
    }, [onUrlSubmit]);

    const platform = hasValidUrl ? detectPlatform(url) : null;
    const isSpotify = hasValidUrl && isSpotifyUrl(url);

    return (
        <div className="w-full max-w-2xl mx-auto px-4 sm:px-0">
            {/* Input Container */}
            <div
                className={cn(
                    "relative flex items-center gap-3 rounded-2xl border border-[var(--border)] px-6 py-4 bg-[var(--surface)] shadow-2xl shadow-black/[0.03] dark:shadow-none transition-all",
                    disabled ? "opacity-50 pointer-events-none" : "hover:border-[var(--foreground)]/20 focus-within:border-[var(--foreground)]/40 focus-within:shadow-[var(--foreground)]/[0.05]"
                )}
            >
                {/* Icon */}
                <div className="flex-shrink-0">
                    {isLoading ? (
                        <Loader2 className="h-5 w-5 text-[var(--muted-foreground)] animate-spin" />
                    ) : (
                        <Link2
                            className={cn(
                                "h-5 w-5 transition-colors",
                                hasValidUrl ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
                            )}
                        />
                    )}
                </div>

                {/* Input */}
                <input
                    ref={inputRef}
                    type="url"
                    value={url}
                    onChange={(e) => handleChange(e.target.value)}
                    onPaste={handlePaste}
                    onKeyDown={handleKeyDown}
                    placeholder="Paste a link to get started..."
                    className="flex-1 bg-transparent text-base text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
                    disabled={isLoading || disabled}
                    aria-label="Paste a URL to download media"
                    autoComplete="off"
                />

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {!hasValidUrl && !isLoading && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={pasteFromClipboard}
                            className="h-10 w-10 rounded-xl text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-all"
                            aria-label="Paste from clipboard"
                        >
                            <Clipboard className="h-4.5 w-4.5" />
                        </Button>
                    )}

                    {hasValidUrl && !isLoading && (
                        <Button
                            size="sm"
                            onClick={handleSubmit}
                            className={cn(
                                "h-10 px-6 rounded-xl bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-all font-medium",
                                isSpotify && "bg-[var(--color-spotify)] hover:opacity-90"
                            )}
                        >
                            <span className="hidden sm:inline mr-2">Go</span>
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Keyboard hint */}
            {!disabled && (
                <p className="mt-4 text-center text-[13px] text-[var(--muted-foreground)] font-medium">
                    Press <kbd className="rounded-md bg-[var(--surface)] px-2 py-0.5 text-[11px] font-bold text-[var(--foreground)] border border-[var(--border)] shadow-sm">⌘ V</kbd> to paste
                </p>
            )}
        </div>
    );
}
