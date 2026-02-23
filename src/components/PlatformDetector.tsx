"use client";

import { Music, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PlatformInfo } from "@/types";
import { isSpotifyUrl } from "@/lib/platforms";

interface PlatformDetectorProps {
    platform: PlatformInfo;
    url: string;
}

export function PlatformDetector({ platform, url }: PlatformDetectorProps) {
    const isSpotify = isSpotifyUrl(url);

    return (
        <div className="flex items-center justify-center gap-2">
            {/* Platform badge */}
            <Badge
                variant="secondary"
                className="text-xs py-1 px-3 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]"
            >
                <span
                    className="inline-block h-2 w-2 rounded-full mr-2"
                    style={{ backgroundColor: platform.color }}
                />
                {platform.name}
            </Badge>

            {/* Spotify bridge indicator */}
            {isSpotify && (
                <Badge variant="secondary" className="text-xs py-1 px-2 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]">
                    <Music className="h-3 w-3 mr-1" />
                    Music Bridge
                </Badge>
            )}

            {/* Unknown platform indicator */}
            {platform.id === "unknown" && (
                <Badge variant="outline" className="text-xs py-1 px-2">
                    <Globe className="h-3 w-3 mr-1" />
                    Auto-detect
                </Badge>
            )}
        </div>
    );
}
