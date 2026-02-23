"use client";

import { useState } from "react";
import { Check, ChevronDown, Video, Music, FileDown, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormatOption, MediaType } from "@/types";

interface FormatSelectorProps {
    formats: FormatOption[];
    mediaType: MediaType;
    onSelect: (format: FormatOption) => void;
    selectedId?: string;
    disabled?: boolean;
}

export function FormatSelector({ formats, mediaType, onSelect, selectedId, disabled = false }: FormatSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const selected = formats.find((f) => f.id === selectedId) || formats[0];

    if (!formats.length || formats.length <= 1) return null;

    return (
        <div className="w-full max-w-xl mx-auto">
            <div className="relative">
                {/* Trigger */}
                <button
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={cn(
                        "flex w-full items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm",
                        disabled && "opacity-50 cursor-not-allowed",
                        !disabled && "hover:bg-[var(--surface-hover)]"
                    )}
                >
                    <div className="flex items-center gap-2">
                        {mediaType === "file" || mediaType === "image" ? (
                            <FileDown className="h-4 w-4 text-[var(--muted)]" />
                        ) : mediaType === "audio" || mediaType === "album" ? (
                            <Music className="h-4 w-4 text-[var(--muted)]" />
                        ) : (
                            <Video className="h-4 w-4 text-[var(--muted)]" />
                        )}
                        <span className="font-medium">{selected.label}</span>
                        <span className="text-[var(--muted)]">· {selected.quality}</span>
                    </div>
                    <ChevronDown
                        className={cn(
                            "h-4 w-4 text-[var(--muted)]",
                            isOpen && "rotate-180"
                        )}
                    />
                </button>

                {/* Dropdown */}
                {isOpen && !disabled && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)]">
                        {formats.map((format) => (
                            <button
                                key={format.id}
                                onClick={() => {
                                    onSelect(format);
                                    setIsOpen(false);
                                }}
                                className={cn(
                                    "flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-[var(--surface-hover)]",
                                    format.id === selected.id && "bg-[var(--surface-hover)]"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{format.label}</span>
                                    <span className="text-[var(--muted)]">{format.quality} · {format.format}</span>
                                </div>
                                {format.id === selected.id && (
                                    <Check className="h-4 w-4 text-[var(--foreground)]" />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
