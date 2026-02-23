import path from "path";
import fs from "fs/promises";
import { createReadStream } from "fs";
import { DOWNLOAD_DIR, ensureDownloadDir } from "@/lib/ytdlp";

const FILE_TTL_MS = parseInt(process.env.FILE_TTL_MINUTES || "10", 10) * 60 * 1000;

// ─── Local File Storage ─────────────────────────────────────────────────────

/**
 * Get the file path for a completed download.
 * Returns null if the file doesn't exist or has expired.
 */
export async function getFilePath(filepath: string): Promise<string | null> {
    try {
        const stat = await fs.stat(filepath);
        const age = Date.now() - stat.mtimeMs;

        if (age > FILE_TTL_MS) {
            // File expired, clean it up
            await fs.unlink(filepath).catch(() => { });
            return null;
        }

        return filepath;
    } catch {
        return null;
    }
}

const MIME_TYPES: Record<string, string> = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".aac": "audio/aac",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".rar": "application/x-rar-compressed",
    ".7z": "application/x-7z-compressed",
    ".gz": "application/gzip",
    ".tar": "application/x-tar",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".json": "application/json",
    ".xml": "application/xml",
};

/**
 * Get file metadata without reading the content.
 */
export async function getFileInfo(filepath: string) {
    const stat = await fs.stat(filepath);
    const filename = path.basename(filepath);
    const ext = path.extname(filepath).toLowerCase();

    return {
        filename,
        size: stat.size,
        mimeType: MIME_TYPES[ext] || "application/octet-stream",
    };
}

/**
 * Create a Web ReadableStream that streams a file from disk.
 * This avoids loading the entire file into memory.
 */
export function createFileStream(filepath: string): ReadableStream<Uint8Array> {
    const nodeStream = createReadStream(filepath);

    return new ReadableStream({
        start(controller) {
            nodeStream.on("data", (chunk: Buffer | string) => {
                const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
                controller.enqueue(new Uint8Array(buf));
            });
            nodeStream.on("end", () => {
                controller.close();
            });
            nodeStream.on("error", (err) => {
                controller.error(err);
            });
        },
        cancel() {
            nodeStream.destroy();
        },
    });
}

/**
 * Delete a specific file.
 */
export async function deleteFile(filepath: string): Promise<void> {
    try {
        await fs.unlink(filepath);
    } catch {
        // Already deleted
    }
}

/**
 * Clean up all expired files in the download directory.
 */
export async function cleanupExpiredFiles(): Promise<number> {
    const dir = await ensureDownloadDir();
    let deleted = 0;

    try {
        const files = await fs.readdir(dir);

        for (const file of files) {
            const filepath = path.join(dir, file);
            try {
                const stat = await fs.stat(filepath);
                if (Date.now() - stat.mtimeMs > FILE_TTL_MS) {
                    await fs.unlink(filepath);
                    deleted++;
                }
            } catch {
                // Skip files that can't be accessed
            }
        }
    } catch {
        // Directory doesn't exist yet
    }

    return deleted;
}

/**
 * Get the total size of all files in the download directory.
 */
export async function getStorageUsage(): Promise<{ files: number; totalBytes: number }> {
    const dir = await ensureDownloadDir();
    let files = 0;
    let totalBytes = 0;

    try {
        const entries = await fs.readdir(dir);
        for (const entry of entries) {
            try {
                const stat = await fs.stat(path.join(dir, entry));
                if (stat.isFile()) {
                    files++;
                    totalBytes += stat.size;
                }
            } catch {
                // Skip
            }
        }
    } catch {
        // Directory doesn't exist
    }

    return { files, totalBytes };
}
