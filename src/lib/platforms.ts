import type { Platform, PlatformInfo } from "@/types";

// ─── Platform Registry ─────────────────────────────────────────────────────

const PLATFORM_DEFINITIONS: Record<Platform, Omit<PlatformInfo, "id">> = {
    youtube: { name: "YouTube", color: "#FF0000", icon: "youtube" },
    spotify: { name: "Spotify", color: "#1DB954", icon: "music" },
    instagram: { name: "Instagram", color: "#E4405F", icon: "instagram" },
    tiktok: { name: "TikTok", color: "#000000", icon: "clapperboard" },
    twitter: { name: "X (Twitter)", color: "#1DA1F2", icon: "twitter" },
    facebook: { name: "Facebook", color: "#1877F2", icon: "facebook" },
    reddit: { name: "Reddit", color: "#FF4500", icon: "message-circle" },
    vimeo: { name: "Vimeo", color: "#1AB7EA", icon: "play-circle" },
    soundcloud: { name: "SoundCloud", color: "#FF5500", icon: "cloud" },
    pinterest: { name: "Pinterest", color: "#E60023", icon: "pin" },
    twitch: { name: "Twitch", color: "#9146FF", icon: "twitch" },
    dailymotion: { name: "Dailymotion", color: "#0066DC", icon: "play" },
    bandcamp: { name: "Bandcamp", color: "#629AA9", icon: "disc" },
    mixcloud: { name: "Mixcloud", color: "#5000FF", icon: "headphones" },
    unknown: { name: "Website", color: "#6E7681", icon: "globe" },
};

// ─── URL Matchers ───────────────────────────────────────────────────────────

const URL_PATTERNS: [Platform, RegExp][] = [
    ["youtube", /(?:youtube\.com|youtu\.be|music\.youtube\.com)/i],
    ["spotify", /(?:open\.spotify\.com|spotify\.link)/i],
    ["instagram", /(?:instagram\.com|instagr\.am)/i],
    ["tiktok", /(?:tiktok\.com|vm\.tiktok\.com)/i],
    ["twitter", /(?:^|\/\/)(?:www\.)?(?:twitter\.com|x\.com|t\.co)(?:\/|$)/i],
    ["facebook", /(?:facebook\.com|fb\.watch|fb\.com)/i],
    ["reddit", /(?:^|\/\/)(?:www\.)?(?:reddit\.com|v\.redd\.it)(?:\/|$)/i],
    ["vimeo", /vimeo\.com/i],
    ["soundcloud", /soundcloud\.com/i],
    ["pinterest", /(?:pinterest\.com|pin\.it)/i],
    ["twitch", /(?:twitch\.tv|clips\.twitch\.tv)/i],
    ["dailymotion", /(?:dailymotion\.com|dai\.ly)/i],
    ["bandcamp", /bandcamp\.com/i],
    ["mixcloud", /mixcloud\.com/i],
];

// ─── Public API ─────────────────────────────────────────────────────────────

export function detectPlatform(url: string): PlatformInfo {
    const matched = URL_PATTERNS.find(([, pattern]) => pattern.test(url));
    const platform: Platform = matched ? matched[0] : "unknown";
    return { id: platform, ...PLATFORM_DEFINITIONS[platform] };
}

export function getPlatformInfo(platform: Platform): PlatformInfo {
    return { id: platform, ...PLATFORM_DEFINITIONS[platform] };
}

export function isSpotifyUrl(url: string): boolean {
    return /(?:open\.spotify\.com|spotify\.link)/i.test(url);
}

export function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/** All platform infos for the marquee display */
export const ALL_PLATFORMS: PlatformInfo[] = Object.entries(PLATFORM_DEFINITIONS)
    .filter(([id]) => id !== "unknown")
    .map(([id, info]) => ({ id: id as Platform, ...info }));
