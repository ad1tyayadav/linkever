"use client";

import { Music, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Platform, PlatformInfo } from "@/types";
import { isSpotifyUrl } from "@/lib/platforms";
import { YoutubeIcon, SpotifyIcon, InstagramIcon, TiktokIcon, TwitterIcon, FacebookIcon, RedditIcon, VimeoIcon, SoundCloudIcon, PinterestIcon, TwitchIcon, DailymotionIcon, BandcampIcon, MixcloudIcon, GlobeIcon, PLATFORM_ICONS } from "./PlatformIcons";

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
                <span className="h-3.5 w-3.5 mr-2 flex items-center justify-center">
                    {(() => {
                        const Icon = PLATFORM_ICONS[platform.id] || GlobeIcon;
                        return <Icon className="h-full w-full" />;
                    })()}
                </span>
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
