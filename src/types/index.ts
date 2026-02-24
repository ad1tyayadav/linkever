// ─── Platform Detection ─────────────────────────────────────────────────────

export type Platform =
    | "youtube"
    | "spotify"
    | "instagram"
    | "tiktok"
    | "twitter"
    | "facebook"
    | "reddit"
    | "vimeo"
    | "soundcloud"
    | "pinterest"
    | "twitch"
    | "dailymotion"
    | "bandcamp"
    | "mixcloud"
    | "unknown";

export interface PlatformInfo {
    id: Platform;
    name: string;
    color: string;
    icon: string; // SVG path or lucide icon name
}

// ─── Media Metadata ─────────────────────────────────────────────────────────

export interface MediaMetadata {
    title: string;
    author: string;
    thumbnail: string;
    duration: number; // seconds
    platform: Platform;
    type: MediaType;
    trackCount?: number; // for playlists/albums
    isLive?: boolean;
    originalUrl: string;
    fileSize?: number; // for generic file downloads
    contentType?: string; // MIME type for generic files
}

export type MediaType = "video" | "audio" | "image" | "file" | "playlist" | "album";

// ─── Quality & Format ───────────────────────────────────────────────────────

export interface FormatOption {
    id: string;
    label: string;
    quality: string;
    format: string;
    estimatedSize?: string;
    filesize?: number;
    isDefault?: boolean;
}

export type VideoQuality = "8k" | "4k" | "1080p60" | "1080p" | "720p60" | "720p" | "480p";
export type AudioQuality = "flac" | "wav" | "aac256" | "mp3_320" | "mp3_128";

// ─── Download Job ───────────────────────────────────────────────────────────

export type JobStatus =
    | "queued"
    | "downloading"
    | "converting"
    | "tagging"
    | "done"
    | "error";

export interface DownloadJob {
    jobId: string;
    url: string;
    platform: Platform;
    type: MediaType;
    title: string;
    status: JobStatus;
    trackCount?: number;
    progressUrl: string;
    createdAt: string;
}

// ─── Progress Events (SSE) ──────────────────────────────────────────────────

export interface ProgressEvent {
    status: JobStatus;
    percent: number;
    speed: string;
    eta: string;
    step: string;
    currentTrack?: number;
    totalTracks?: number;
    trackTitle?: string;
    overallPercent?: number;
}

export interface DoneEvent {
    status: "done";
    downloadUrl: string;
    filename: string;
    size: string;
    tracksCompleted?: number;
    tracksFailed?: number;
}

export interface ErrorEvent {
    status: "error";
    error: string;
    message: string;
    suggestion?: string;
}

export type SSEEvent = ProgressEvent | DoneEvent | ErrorEvent;

// ─── API Request/Response ───────────────────────────────────────────────────

export interface DownloadRequest {
    url: string;
    format?: string;
    quality?: string;
    audioOnly?: boolean;
    embedMetadata?: boolean;
    subtitles?: boolean;
}

export interface DownloadResponse {
    jobId: string;
    platform: Platform;
    type: MediaType;
    title: string;
    trackCount?: number;
    progressUrl: string;
}

export interface MetadataResponse extends MediaMetadata {
    formats: FormatOption[];
}

export interface ErrorResponse {
    error: string;
    message: string;
    suggestion?: string;
}

// ─── Spotify Types ──────────────────────────────────────────────────────────

export interface SpotifyTrack {
    id: string;
    title: string;
    artist: string;
    album: string;
    albumArt: string;
    duration: number;
    trackNumber: number;
    isrc?: string;
    matchConfidence?: "high" | "approximate" | "low";
}

export interface SpotifyCollection {
    id: string;
    type: "album" | "playlist";
    title: string;
    author: string;
    coverArt: string;
    trackCount: number;
    tracks: SpotifyTrack[];
}

// ─── App Store ──────────────────────────────────────────────────────────────

export interface AppState {
    // Current job
    currentUrl: string;
    detectedPlatform: PlatformInfo | null;
    metadata: MediaMetadata | null;
    activeJob: DownloadJob | null;
    progress: ProgressEvent | null;

    // Actions
    setCurrentUrl: (url: string) => void;
    setDetectedPlatform: (platform: PlatformInfo | null) => void;
    setMetadata: (metadata: MediaMetadata | null) => void;
    setActiveJob: (job: DownloadJob | null) => void;
    setProgress: (progress: ProgressEvent | null) => void;
    reset: () => void;
}
