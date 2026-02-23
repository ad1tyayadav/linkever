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

// ─── Progress Steps ─────────────────────────────────────────────────────────

export const PROGRESS_STEPS: Record<string, string> = {
    queued: "Waiting in queue...",
    downloading: "Downloading media...",
    converting: "Converting format...",
    tagging: "Embedding metadata...",
    done: "Complete!",
    error: "Something went wrong",
};

// ─── Misc ───────────────────────────────────────────────────────────────────

export const MAX_PLAYLIST_TRACKS = 200;
export const FILE_TTL_MINUTES = 10;
export const MAX_JOBS_PER_HOUR = 15;
