import type { FormatOption } from "@/types";

// ─── Quality Ladders ────────────────────────────────────────────────────────

export const VIDEO_FORMATS: FormatOption[] = [
    { id: "best-video", label: "Best Quality", quality: "Up to 8K", format: "MP4", isDefault: true },
    { id: "4k", label: "4K Ultra HD", quality: "2160p", format: "MP4", estimatedSize: "~2 GB" },
    { id: "1080p", label: "Full HD", quality: "1080p", format: "MP4", estimatedSize: "~500 MB" },
    { id: "720p", label: "HD", quality: "720p", format: "MP4", estimatedSize: "~250 MB" },
    { id: "480p", label: "Standard", quality: "480p", format: "MP4", estimatedSize: "~120 MB" },
];

export const AUDIO_FORMATS: FormatOption[] = [
    { id: "best-audio", label: "Best Quality", quality: "FLAC/WAV", format: "FLAC", isDefault: true },
    { id: "mp3-320", label: "MP3 High", quality: "320 kbps", format: "MP3", estimatedSize: "~8 MB" },
    { id: "mp3-128", label: "MP3 Standard", quality: "128 kbps", format: "MP3", estimatedSize: "~4 MB" },
    { id: "aac-256", label: "AAC High", quality: "256 kbps", format: "AAC", estimatedSize: "~6 MB" },
];

export const FILE_FORMATS: FormatOption[] = [
    { id: "original", label: "Original File", quality: "As-is", format: "Original", isDefault: true },
];

// ─── Error Messages ─────────────────────────────────────────────────────────

export const ERROR_MESSAGES: Record<string, string> = {
    PRIVATE: "This video is private — we can't access it.",
    DRM: "This platform uses DRM encryption. Try pasting a Spotify link instead of a stream URL.",
    NOT_FOUND: "No public match found for this content. It may be region-locked or removed.",
    LIVE_STREAM: "This URL points to a live stream — we can only download completed videos.",
    RATE_LIMITED: "Rate limit reached. You can download 15 files per hour.",
    TOO_LARGE: "This file exceeds the 2 GB limit.",
    INVALID_URL: "That doesn't look like a valid URL. Please check and try again.",
    NETWORK: "Could not reach the server. Please check your connection.",
};

// ─── Progress Steps (Fun & Engaging) ──────────────────────────────────────

const FUN_STEPS = {
    downloading: [
        "Snatching media from the internet...",
        "Stealing pixels for you... 🔥",
        "Negotiating with the server...",
        "Convincing the CDN to cooperate...",
        "Downloading the goods... 🚀",
        "Grabbing those bytes...",
        "Making the download magic happen...",
    ],
    converting: [
        "Mixing audio and video like a pro...",
        "Welding formats together... ⚡",
        "Perfecting the file...",
        "Adding the finishing touches...",
        "Merging the media sauce...",
    ],
    tagging: [
        "Sprucing up the metadata... ✨",
        "Adding the pretty thumbnails...",
        "Making it look professional...",
        "Polishing the file...",
    ],
    done: [
        "Ta-da! Your media is ready! 🎉",
        "Download complete! You're awesome! ⭐",
        "All done! Enjoy your content! 🎊",
    ],
};

export const PROGRESS_STEPS: Record<string, string> = {
    queued: "Warming up the engines...",
    downloading: FUN_STEPS.downloading[Math.floor(Math.random() * FUN_STEPS.downloading.length)],
    converting: FUN_STEPS.converting[Math.floor(Math.random() * FUN_STEPS.converting.length)],
    tagging: FUN_STEPS.tagging[Math.floor(Math.random() * FUN_STEPS.tagging.length)],
    done: FUN_STEPS.done[Math.floor(Math.random() * FUN_STEPS.done.length)],
    error: "Oops! Something went sideways... 😬",
};

// Get a random fun step message
export function getFunStepMessage(status: "downloading" | "converting" | "tagging" | "done", currentStep?: string): string {
    const steps = FUN_STEPS[status];
    if (!steps) return currentStep || PROGRESS_STEPS[status] || "Working on it...";
    return steps[Math.floor(Math.random() * steps.length)];
}

// ─── Misc ───────────────────────────────────────────────────────────────────

export const MAX_PLAYLIST_TRACKS = 200;
export const FILE_TTL_MINUTES = 10;
export const MAX_JOBS_PER_HOUR = 15;
