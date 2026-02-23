import path from "path";
import os from "os";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import type { MediaMetadata, MediaType } from "@/types";
import { detectPlatform } from "@/lib/platforms";
import type { ProgressCallback } from "@/lib/ytdlp";

const DOWNLOAD_DIR = path.join(os.tmpdir(), "linkever-downloads");

async function ensureDir(dir: string) {
    await fs.mkdir(dir, { recursive: true });
}

// ─── URL Pattern → MediaType mapping ─────────────────────────────────────
// Check URL patterns for media hints before making HTTP requests

const URL_PATTERNS: [RegExp, MediaType][] = [
    // Video patterns - file extensions
    [/\.(mp4|webm|mov|avi|mkv|flv|wmv|3gp)(\?|$)/i, "video"],
    // Video patterns - path segments
    [/\/(video|watch|stream|clip)s?\//i, "video"],
    
    // Audio patterns - file extensions
    [/\.(mp3|wav|flac|aac|ogg|m4a|wma|opus)(\?|$)/i, "audio"],
    // Audio patterns - path segments
    [/\/(audio|music|sound|track)s?\//i, "audio"],
    
    // Image patterns - file extensions
    [/\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|tiff|heic|heif)(\?|$)/i, "image"],
    // Image patterns - path segments
    [/\/(image|photo|picture)s?\//i, "image"],
    // Pinterest specific
    [/i\.pinimg\.com\//i, "image"],
];

/**
 * Detect media type from URL patterns before making HTTP request.
 * This provides fast initial detection without network call.
 */
export function detectMediaTypeFromUrl(url: string): MediaType | null {
    for (const [pattern, type] of URL_PATTERNS) {
        if (pattern.test(url)) {
            return type;
        }
    }
    return null;
}

// ─── Content-Type → MediaType mapping ───────────────────────────────────────

function contentTypeToMediaType(contentType: string, url: string): MediaType {
    const ct = contentType.toLowerCase();
    
    // Check content-type prefix
    if (ct.startsWith("video/")) return "video";
    if (ct.startsWith("audio/")) return "audio";
    if (ct.startsWith("image/")) return "image";
    
    // Additional content-type specific mappings
    if (ct.includes("octet-stream") || ct.includes("stream")) {
        // Try to infer from URL for octet-stream
        const urlType = detectMediaTypeFromUrl(url);
        if (urlType) return urlType;
    }
    
    // Application types that might be media
    if (ct.includes("quicktime") || ct.includes("x-msvideo")) return "video";
    if (ct.includes("x-matroska")) return "video";
    
    return "file";
}

// ─── Content-Type → file extension ──────────────────────────────────────────

const CT_TO_EXT: Record<string, string> = {
    "application/pdf": ".pdf",
    "application/zip": ".zip",
    "application/x-rar-compressed": ".rar",
    "application/x-7z-compressed": ".7z",
    "application/gzip": ".gz",
    "application/x-tar": ".tar",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "application/json": ".json",
    "application/xml": ".xml",
    "text/plain": ".txt",
    "text/csv": ".csv",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/flac": ".flac",
    "audio/wav": ".wav",
    "audio/ogg": ".ogg",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "application/octet-stream": "",
};

function extFromContentType(contentType: string): string {
    const base = contentType.split(";")[0].trim().toLowerCase();
    return CT_TO_EXT[base] || "";
}

// ─── Filename Extraction ────────────────────────────────────────────────────

function extractFilename(url: string, headers: Headers): string {
    // 1. Content-Disposition header
    const disposition = headers.get("content-disposition");
    if (disposition) {
        // filename*=UTF-8''encoded or filename="quoted"
        const utf8Match = disposition.match(/filename\*=(?:UTF-8''|utf-8'')([^;\s]+)/i);
        if (utf8Match) return decodeURIComponent(utf8Match[1]);

        const quotedMatch = disposition.match(/filename="([^"]+)"/i);
        if (quotedMatch) return quotedMatch[1];

        const unquotedMatch = disposition.match(/filename=([^;\s]+)/i);
        if (unquotedMatch) return unquotedMatch[1];
    }

    // 2. URL path basename
    try {
        const urlPath = new URL(url).pathname;
        const basename = path.basename(urlPath);
        if (basename && basename.includes(".") && basename.length < 256) {
            return decodeURIComponent(basename);
        }
    } catch {
        // ignore
    }

    // 3. Fallback
    const contentType = headers.get("content-type") || "application/octet-stream";
    const ext = extFromContentType(contentType);
    return `download${ext || ""}`;
}

function sanitizeFilename(name: string): string {
    return name
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
        .replace(/\.{2,}/g, ".")
        .slice(0, 200);
}

// ─── Metadata Fetch ─────────────────────────────────────────────────────────

export async function fetchGenericMetadata(url: string): Promise<MediaMetadata> {
    const response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Could not access this URL.`);
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const contentLength = response.headers.get("content-length");
    const disposition = response.headers.get("content-disposition");

    // If it's HTML and not an attachment, it's a web page — not directly downloadable
    if (contentType.includes("text/html") && !disposition?.includes("attachment")) {
        throw new Error("This webpage doesn't contain a directly downloadable file. Try a direct file or media link.");
    }

    const filename = sanitizeFilename(extractFilename(url, response.headers));
    const type = contentTypeToMediaType(contentType, url);
    const platform = detectPlatform(url);

    let hostname = "Unknown";
    try {
        hostname = new URL(url).hostname.replace(/^www\./, "");
    } catch {
        // ignore
    }

    return {
        title: filename,
        author: hostname,
        thumbnail: "",
        duration: 0,
        platform: platform.id,
        type,
        originalUrl: url,
        fileSize: contentLength ? parseInt(contentLength, 10) : undefined,
        contentType: contentType.split(";")[0].trim(),
    };
}

// ─── Generic Download ───────────────────────────────────────────────────────

export async function genericDownload(
    url: string,
    onProgress: ProgressCallback,
    jobId?: string
): Promise<{ filepath: string; filename: string; filesize: number }> {
    const baseDir = DOWNLOAD_DIR;
    const dir = path.join(baseDir, jobId || `dl_${Date.now()}`);
    await ensureDir(dir);

    onProgress({
        status: "downloading",
        percent: 0,
        speed: "",
        eta: "",
        step: "Connecting to server...",
    });

    const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(600_000), // 10 min timeout
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to download file.`);
    }

    if (!response.body) {
        throw new Error("No response body received.");
    }

    // Reject HTML pages that aren't file attachments
    const contentType = response.headers.get("content-type") || "";
    const disposition = response.headers.get("content-disposition");
    if (contentType.includes("text/html") && !disposition?.includes("attachment")) {
        throw new Error("This URL points to a webpage, not a downloadable file.");
    }

    const filename = sanitizeFilename(extractFilename(url, response.headers));
    const filepath = path.join(dir, filename);
    const totalBytes = parseInt(response.headers.get("content-length") || "0", 10);

    const writer = createWriteStream(filepath);
    const reader = response.body.getReader();

    let receivedBytes = 0;
    const startTime = Date.now();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            writer.write(Buffer.from(value));
            receivedBytes += value.length;

            const elapsed = (Date.now() - startTime) / 1000;
            const speed = elapsed > 0 ? receivedBytes / elapsed : 0;
            const percent = totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 0;
            const remaining = totalBytes > 0 && speed > 0 ? (totalBytes - receivedBytes) / speed : 0;

            const speedStr = formatSpeed(speed);
            const etaStr = remaining > 0 ? formatEta(remaining) : "";

            onProgress({
                status: "downloading",
                percent: Math.min(percent, 99.9),
                speed: speedStr,
                eta: etaStr,
                step: totalBytes > 0
                    ? `Downloading... ${percent.toFixed(1)}%`
                    : `Downloading... ${formatBytes(receivedBytes)}`,
            });
        }
    } finally {
        writer.end();
    }

    // Wait for write to finish
    await new Promise<void>((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
    });

    const stat = await fs.stat(filepath);

    onProgress({
        status: "done",
        percent: 100,
        speed: "",
        eta: "",
        step: "Download complete!",
        filename,
        filesize: stat.size,
    });

    return {
        filepath,
        filename,
        filesize: stat.size,
    };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatSpeed(bytesPerSec: number): string {
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatEta(seconds: number): string {
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function isUnsupportedUrlError(errorMessage: string): boolean {
    return (
        errorMessage.includes("Unsupported URL") ||
        errorMessage.includes("no suitable InfoExtractor") ||
        errorMessage.includes("is not supported")
    );
}
