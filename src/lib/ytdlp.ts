import { spawn } from "child_process";
import path from "path";
import os from "os";
import fs from "fs/promises";
import fsSync from "fs";
import type { MediaMetadata, Platform, MediaType, FormatOption } from "@/types";
import { detectPlatform, isSpotifyUrl } from "@/lib/platforms";
import { VIDEO_FORMATS, AUDIO_FORMATS } from "@/lib/constants";

// ─── Config ─────────────────────────────────────────────────────────────────

const YTDLP = process.env.YTDLP_PATH || "yt-dlp";
const YTDLP_REMOTE_COMPONENTS = process.env.YTDLP_REMOTE_COMPONENTS || "ejs:github";
const YTDLP_JS_RUNTIMES = process.env.YTDLP_JS_RUNTIMES || "deno";
// Only use FFMPEG_PATH if it's a real absolute path, not just "ffmpeg"
const rawFfmpeg = process.env.FFMPEG_PATH || "";
const FFMPEG_PATH = rawFfmpeg && rawFfmpeg !== "ffmpeg" && (path.isAbsolute(rawFfmpeg) || process.platform === "win32") ? rawFfmpeg : "";
const DOWNLOAD_DIR = path.join(os.tmpdir(), "linkever-downloads");

type YtdlpErrorKind =
    | "BOT_CHECK"
    | "INVALID_COOKIES"
    | "AGE_RESTRICTED"
    | "RATE_LIMIT"
    | "UNSUPPORTED"
    | "DRM"
    | "UNAVAILABLE"
    | "LIVE"
    | "UNKNOWN";

let runtimeCookiesPath: string | null = null;
let runtimeCookiesInitAttempted = false;

// Ensure download dir exists
async function ensureDownloadDir() {
    await fs.mkdir(DOWNLOAD_DIR, { recursive: true });
    return DOWNLOAD_DIR;
}

function tryInitRuntimeCookiesFromEnv(): string | null {
    if (runtimeCookiesInitAttempted) return runtimeCookiesPath;
    runtimeCookiesInitAttempted = true;

    const b64 = (process.env.YTDLP_COOKIES_B64 || "").trim();
    if (!b64) return null;

    try {
        const decoded = Buffer.from(b64, "base64").toString("utf8");
        if (!decoded || decoded.length < 10) return null;

        const target = path.join(os.tmpdir(), "linkever-ytdlp-cookies.txt");
        fsSync.writeFileSync(target, decoded, { encoding: "utf8", mode: 0o600 });
        runtimeCookiesPath = target;
        return target;
    } catch {
        return null;
    }
}

function resolveCookiesArgs(): { used: boolean; args: string[]; source?: "path" | "b64" | "default" } {
    const disabled = (process.env.YTDLP_DISABLE_COOKIES || "").trim().toLowerCase();
    if (disabled === "1" || disabled === "true" || disabled === "yes") {
        return { used: false, args: [] };
    }

    const configured = (process.env.YTDLP_COOKIES_PATH || "").trim();
    if (configured && fsSync.existsSync(configured)) {
        return { used: true, args: ["--cookies", configured], source: "path" };
    }

    const envPath = tryInitRuntimeCookiesFromEnv();
    if (envPath && fsSync.existsSync(envPath)) {
        return { used: true, args: ["--cookies", envPath], source: "b64" };
    }

    const defaultPath = path.join(process.cwd(), "cookies.txt");
    if (fsSync.existsSync(defaultPath)) {
        return { used: true, args: ["--cookies", defaultPath], source: "default" };
    }

    return { used: false, args: [] };
}

function isInvalidCookiesError(text: string): boolean {
    const lower = text.toLowerCase();
    return (
        lower.includes("cookies are no longer valid") ||
        lower.includes("provided youtube account cookies are no longer valid") ||
        lower.includes("provided youtube cookies are no longer valid")
    );
}

function appendJsRuntimes(args: string[]) {
    // yt-dlp expects one runtime per flag: --js-runtimes RUNTIME[:PATH]
    const raw = (YTDLP_JS_RUNTIMES || "").trim();
    if (!raw) return;

    for (const part of raw.split(/[,\s]+/g)) {
        const token = part.trim();
        if (!token) continue;
        args.push("--js-runtimes", token);
    }
}

// ─── Types ──────────────────────────────────────────────────────────────────

function classifyYtdlpStderr(stderr: string): YtdlpErrorKind {
    const lower = (stderr || "").toLowerCase();

    if (lower.includes("sign in to confirm youre not a bot") || lower.includes("sign in to confirm you're not a bot")) {
        return "BOT_CHECK";
    }
    if (isInvalidCookiesError(stderr)) return "INVALID_COOKIES";

    if (lower.includes("sign in to confirm your age") || lower.includes("age-restricted")) return "AGE_RESTRICTED";
    if (lower.includes("http error 429") || lower.includes("too many requests")) return "RATE_LIMIT";
    if (lower.includes("unsupported url") || lower.includes("no suitable infoextractor")) return "UNSUPPORTED";
    if (lower.includes("drm")) return "DRM";
    if (lower.includes("video unavailable") || lower.includes("not available") || lower.includes("this video is unavailable")) return "UNAVAILABLE";
    if (lower.includes("this live event has not started") || lower.includes("is_live")) return "LIVE";

    return "UNKNOWN";
}

interface YtdlpRawFormat {
    format_id: string;
    ext: string;
    height?: number;
    width?: number;
    filesize?: number;
    filesize_approx?: number;
    abr?: number;
    vcodec?: string;
    acodec?: string;
    tbr?: number;
    fps?: number;
    format_note?: string;
}

export interface YtdlpMetadata {
    title: string;
    uploader: string;
    thumbnail: string;
    duration: number;
    webpage_url: string;
    extractor_key: string;
    is_live: boolean;
    formats?: YtdlpRawFormat[];
}

export interface DownloadProgress {
    status: "downloading" | "converting" | "tagging" | "done" | "error";
    percent: number;
    speed: string;
    eta: string;
    step: string;
    filename?: string;
    filesize?: number;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

// ─── Metadata Fetch ─────────────────────────────────────────────────────────

export async function fetchMetadata(url: string): Promise<MediaMetadata & { availableFormats: FormatOption[] }> {
    const runOnce = (withCookies: boolean) =>
        new Promise<MediaMetadata & { availableFormats: FormatOption[] }>((resolve, reject) => {
            const args = [
                "--dump-json",
                "--no-playlist",
                "--no-download",
                "--no-warnings",
                "--socket-timeout", "30",
                "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "--add-header", "Accept-Language:en-US,en;q=0.9",
                "--add-header", "Referer:https://www.google.com/",
                "--geo-bypass",
                "--extractor-args", "youtube:player_client=android,web;ios:player_client=apple_tv",
                url,
            ];

            if (YTDLP_REMOTE_COMPONENTS) {
                args.splice(args.length - 1, 0, "--remote-components", YTDLP_REMOTE_COMPONENTS);
            }

            // Use proxy if available
            if (process.env.PROXY_URL) {
                args.push("--proxy", process.env.PROXY_URL);
            }

            if (withCookies) {
                args.push(...resolveCookiesArgs().args);
            }

            appendJsRuntimes(args);

            const proc = spawn(YTDLP, args, { timeout: 30_000 });
            let stdout = "";
            let stderr = "";

            proc.stdout.on("data", (chunk: Buffer) => {
                stdout += chunk.toString();
            });

            proc.stderr.on("data", (chunk: Buffer) => {
                stderr += chunk.toString();
            });

            proc.on("close", (code) => {
                if (code !== 0) {
                    const kind = classifyYtdlpStderr(stderr);
                    const errorMsg = parseYtdlpError(stderr);
                    reject(Object.assign(new Error(errorMsg), { stderr, kind }));
                    return;
                }

                try {
                    const data: YtdlpMetadata = JSON.parse(stdout.trim());
                    const platform = detectPlatform(url);
                    const type = determineMediaType(data, platform.id);
                    const availableFormats = extractAvailableFormats(data.formats, type, data.duration || 0);

                    resolve({
                        title: data.title || "Unknown Title",
                        author: data.uploader || "Unknown",
                        thumbnail: data.thumbnail || "",
                        duration: data.duration || 0,
                        platform: platform.id,
                        type,
                        isLive: data.is_live || false,
                        originalUrl: url,
                        availableFormats,
                    });
                } catch {
                    reject(new Error("Failed to parse media metadata"));
                }
            });

            proc.on("error", (err) => {
                const isNoent = (err as NodeJS.ErrnoException).code === "ENOENT";
                const msg = isNoent
                    ? `yt-dlp not found at "${YTDLP}". Please check YTDLP_PATH in .env or install yt-dlp.`
                    : `yt-dlp execution failed: ${err.message}`;
                reject(new Error(msg));
            });
        });

    const cookies = resolveCookiesArgs();
    if (!cookies.used) return runOnce(false);

    try {
        return await runOnce(true);
    } catch (err) {
        const stderr =
            err && typeof err === "object" && "stderr" in err
                ? (err as Record<string, unknown>).stderr
                : undefined;

        if (typeof stderr === "string" && isInvalidCookiesError(stderr)) {
            return await runOnce(false);
        }
        throw err;
    }
}

// ─── Download ───────────────────────────────────────────────────────────────

export interface DownloadOptions {
    format?: string;
    quality?: string;
    audioOnly?: boolean;
    embedMetadata?: boolean;
    outputDir?: string;
    duration?: number;
}

export async function download(
    url: string,
    options: DownloadOptions,
    onProgress: ProgressCallback,
    jobId?: string
): Promise<{ filepath: string; filename: string; filesize: number }> {
    // Each job gets its own subdirectory to prevent file mixups
    const baseDir = await ensureDownloadDir();
    const dir = path.join(baseDir, jobId || `dl_${Date.now()}`);
    await fs.mkdir(dir, { recursive: true });

    const outputTemplate = path.join(dir, "%(title)s.%(ext)s");

    const args: string[] = [
        "--no-playlist",
        "--newline",
        "--no-warnings",
        "--socket-timeout", "30",
        "--no-check-certificates",
        "--retries", "5",
        "--fragment-retries", "10",
        "--force-overwrites",
        "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "--add-header", "Accept-Language:en-US,en;q=0.9",
        "--add-header", "Referer:https://www.google.com/",
        "--geo-bypass",
        "--extractor-args", "youtube:player_client=android,web;ios:player_client=apple_tv",
        "-o", outputTemplate,
    ];

    if (YTDLP_REMOTE_COMPONENTS) {
        args.push("--remote-components", YTDLP_REMOTE_COMPONENTS);
    }

    // Use proxy if available
    if (process.env.PROXY_URL) {
        args.push("--proxy", process.env.PROXY_URL);
    }

    const cookies = resolveCookiesArgs();
    if (cookies.used) {
        args.push(...cookies.args);
    }

    appendJsRuntimes(args);

    // precision matching by duration (fixes music video vs album track mismatch)
    if (options.duration && options.duration > 0) {
        // We allow a 4-second variance (e.g., 253s can match 251-255s)
        const min = options.duration - 2;
        const max = options.duration + 2;
        args.push("--match-filter", `duration > ${min} & duration < ${max}`);
    }

    // Only pass --ffmpeg-location if explicitly configured
    if (FFMPEG_PATH) {
        args.push("--ffmpeg-location", FFMPEG_PATH);
    }

    // Format selection
    if (options.audioOnly) {
        args.push("-x"); // Extract audio
        if (options.format && options.format.toLowerCase() === "mp3") {
            args.push("--audio-format", "mp3", "--audio-quality", "0");
        } else if (options.format && options.format.toLowerCase() === "aac") {
            args.push("--audio-format", "aac");
        } else if (options.format && options.format.toLowerCase() === "flac") {
            args.push("--audio-format", "flac");
        } else {
            args.push("--audio-format", "mp3", "--audio-quality", "0");
        }
        // Thumbnail & metadata embedding is safe for audio containers
        args.push("--embed-thumbnail", "--embed-metadata");
    } else {
        // Video format selection
        const quality = options.quality || "best";
        const formatArg = buildFormatArg(quality);
        args.push("-f", formatArg, "--merge-output-format", "mp4");
        // NOTE: --embed-thumbnail and --embed-metadata are intentionally
        // omitted for video/mp4 — they trigger extra ffmpeg remux passes
        // that frequently corrupt the MP4 container, producing unplayable files.
    }

    args.push(url);

    console.log(`[linkever] yt-dlp download: ${formatYtdlpLogCmd(YTDLP, args)}`);

    return new Promise((resolve, reject) => {
        const proc = spawn(YTDLP, args, { timeout: 600_000 }); // 10 min timeout
        let lastFilename = "";
        let stderr = "";
        const lastPercentRef = { current: 0 };

        onProgress({
            status: "downloading",
            percent: 0,
            speed: "",
            eta: "",
            step: "Starting download...",
        });

        proc.stdout.on("data", (chunk: Buffer) => {
            const lines = chunk.toString().split("\n");
            for (const line of lines) {
                const progress = parseProgressLine(line.trim(), lastPercentRef);
                if (progress) {
                    onProgress(progress);
                    if (progress.filename) lastFilename = progress.filename;
                }
            }
        });

        proc.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
            const line = chunk.toString().trim();

            // Detect merge/convert phase - only increase percent, never decrease
            if (line.includes("Merging formats")) {
                lastPercentRef.current = Math.max(lastPercentRef.current, 90);
                onProgress({
                    status: "converting",
                    percent: lastPercentRef.current,
                    speed: "",
                    eta: "",
                    step: "Mixing audio and video like a pro... ⚡",
                });
            } else if (line.includes("Extracting audio")) {
                lastPercentRef.current = Math.max(lastPercentRef.current, 85);
                onProgress({
                    status: "converting",
                    percent: lastPercentRef.current,
                    speed: "",
                    eta: "",
                    step: "Pulling out the audio track...",
                });
            } else if (line.includes("Embedding thumbnail") || line.includes("Adding metadata")) {
                lastPercentRef.current = Math.max(lastPercentRef.current, 95);
                onProgress({
                    status: "tagging",
                    percent: lastPercentRef.current,
                    speed: "",
                    eta: "",
                    step: "Sprucing up the metadata... ✨",
                });
            }
        });

        proc.on("close", async (code) => {
            if (code !== 0) {
                console.error(`[linkever] yt-dlp failed (exit code ${code}):`, stderr);
                const kind = classifyYtdlpStderr(stderr);
                const errorMsg = parseYtdlpError(stderr);
                onProgress({
                    status: "error",
                    percent: 0,
                    speed: "",
                    eta: "",
                    step: errorMsg,
                });
                reject(Object.assign(new Error(errorMsg), { stderr, kind }));
                return;
            }

            // Find the output file in this job's directory
            try {
                const files = await fs.readdir(dir);
                // Filter out temp files that yt-dlp creates
                const realFiles = files.filter(
                    (f) => !f.startsWith(".") && !f.endsWith(".part") && !f.endsWith(".temp") && !f.endsWith(".ytdl")
                );

                const fileStats = await Promise.all(
                    realFiles.map(async (f) => {
                        const fullPath = path.join(dir, f);
                        const stat = await fs.stat(fullPath);
                        return { name: f, path: fullPath, mtime: stat.mtimeMs, size: stat.size };
                    })
                );
                // Sort by size descending (pick the largest real file)
                fileStats.sort((a, b) => b.size - a.size);

                const outputFile = fileStats[0];
                if (!outputFile) {
                    reject(new Error("Download completed but output file not found"));
                    return;
                }

                onProgress({
                    status: "done",
                    percent: 100,
                    speed: "",
                    eta: "",
                    step: "Download complete!",
                    filename: outputFile.name,
                    filesize: outputFile.size,
                });

                resolve({
                    filepath: outputFile.path,
                    filename: lastFilename || outputFile.name,
                    filesize: outputFile.size,
                });
            } catch (err) {
                reject(new Error(`Failed to locate output file: ${err}`));
            }
        });

        proc.on("error", (err) => {
            const isNoent = (err as NodeJS.ErrnoException).code === "ENOENT";
            const msg = isNoent
                ? `yt-dlp not found at "${YTDLP}". Please check YTDLP_PATH in .env or install yt-dlp.`
                : `yt-dlp execution failed: ${err.message}`;
            reject(new Error(msg));
        });
    });
}

function formatYtdlpLogCmd(bin: string, args: string[]): string {
    const redacted: string[] = [bin];
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        redacted.push(a);
        if (a === "--proxy" || a === "--cookies") {
            const next = args[i + 1];
            if (next) {
                redacted.push("[redacted]");
                i++;
            }
        }
    }
    return redacted.join(" ");
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseProgressLine(line: string, lastPercentRef: { current: number } = { current: 0 }): DownloadProgress | null {
    // Match: [download]  45.2% of  125.88MiB at  4.52MiB/s ETA 00:15
    const progressMatch = line.match(
        /\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)\s+ETA\s+(\S+)/
    );

    if (progressMatch) {
        const percent = parseFloat(progressMatch[1]);
        // Only update if percent is higher (prevents going backwards)
        if (percent > lastPercentRef.current) {
            lastPercentRef.current = percent;
        }
        return {
            status: "downloading",
            percent: lastPercentRef.current,
            speed: progressMatch[3],
            eta: progressMatch[4],
            step: `Snatching media from the internet... ${lastPercentRef.current}%`,
        };
    }

    // Match: [download] Destination: filename.ext
    const destMatch = line.match(/\[download\]\s+Destination:\s+(.+)/);
    if (destMatch) {
        const filename = path.basename(destMatch[1]);
        return {
            status: "downloading",
            percent: Math.max(lastPercentRef.current, 1),
            speed: "",
            eta: "",
            step: "Negotiating with the server...",
            filename,
        };
    }

    // Match: [download] 100% of 125.88MiB
    const doneMatch = line.match(/\[download\]\s+100%\s+of/);
    if (doneMatch) {
        lastPercentRef.current = Math.max(lastPercentRef.current, 85);
        return {
            status: "downloading",
            percent: lastPercentRef.current,
            speed: "",
            eta: "",
            step: "Got it! Now processing the file...",
        };
    }

    return null;
}

function parseYtdlpError(stderr: string): string {
    if (stderr.includes("Sign in to confirm youre not a bot") || stderr.includes("Sign in to confirm you're not a bot")) {
        return "YouTube blocked this server IP (bot check). Provide YouTube cookies or change proxy/IP and try again.";
    }
    if (isInvalidCookiesError(stderr)) {
        return "YouTube cookies are expired/invalid on the server. Update cookies or disable cookies and try again.";
    }
    if (stderr.includes("Private video") || stderr.includes("Sign in to confirm your age")) {
        return "This video is private or age-restricted — we can't access it.";
    }
    if (stderr.includes("This live event has not started") || stderr.includes("is_live")) {
        return "This URL points to a live stream — we can only download completed videos.";
    }
    if (stderr.includes("Video unavailable") || stderr.includes("not available")) {
        return "This video is unavailable. It may have been removed or is region-locked.";
    }
    if (stderr.includes("Unsupported URL") || stderr.includes("no suitable InfoExtractor")) {
        return "This URL is not supported. Please try a different link.";
    }
    if (stderr.includes("HTTP Error 429") || stderr.includes("Too Many Requests")) {
        return "Too many requests. Please wait a moment and try again.";
    }
    if (stderr.includes("DRM")) {
        return "This content uses DRM encryption and cannot be downloaded.";
    }
    return "Download failed. Please try again or try a different URL.";
}

function buildFormatArg(quality: string): string {
    const heightMatch = quality.match(/(\d+)p/);
    if (heightMatch) {
        const height = parseInt(heightMatch[1], 10);
        return `bestvideo[height<=${height}]+bestaudio/best`;
    }
    return "bestvideo+bestaudio/best";
}

function determineMediaType(data: YtdlpMetadata, platform: Platform): MediaType {
    const audioOnlyPlatforms: Platform[] = ["soundcloud", "bandcamp", "mixcloud"];
    if (audioOnlyPlatforms.includes(platform)) return "audio";

    // Check if yt-dlp only found audio formats
    if (data.formats?.every((f) => !f.height && f.abr)) return "audio";

    return "video";
}

// ─── Format Extraction ──────────────────────────────────────────────────────

function extractAvailableFormats(
    rawFormats: YtdlpRawFormat[] | undefined,
    mediaType: MediaType,
    duration: number
): FormatOption[] {
    if (!rawFormats || rawFormats.length === 0) return [];
    if (mediaType === "audio") return [];
    return extractVideoFormats(rawFormats, duration);
}

function extractVideoFormats(rawFormats: YtdlpRawFormat[], duration: number): FormatOption[] {
    const audioStreams = rawFormats.filter(f =>
        (!f.vcodec || f.vcodec === "none") && f.acodec && f.acodec !== "none"
    );
    const bestAudio = audioStreams.sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];
    const bestAudioSize = getFormatSize(bestAudio, duration);

    const videoStreams = rawFormats.filter(f =>
        f.height && f.height > 0 && f.vcodec && f.vcodec !== "none"
    );

    if (videoStreams.length === 0) return [];

    const byHeight = new Map<number, YtdlpRawFormat>();
    for (const fmt of videoStreams) {
        const h = fmt.height!;
        const existing = byHeight.get(h);
        if (!existing || (fmt.tbr || 0) > (existing.tbr || 0)) {
            byHeight.set(h, fmt);
        }
    }

    const heights = Array.from(byHeight.keys()).sort((a, b) => b - a);

    const LABELS: Record<number, string> = {
        4320: "8K Ultra HD",
        2160: "4K Ultra HD",
        1440: "2K QHD",
        1080: "Full HD",
        720: "HD",
        480: "Standard",
        360: "Low",
        240: "Very Low",
    };

    const formats: FormatOption[] = [];

    if (heights.length > 0) {
        const best = byHeight.get(heights[0])!;
        const isCombined = best.acodec && best.acodec !== "none";
        const videoSize = getFormatSize(best, duration);
        const totalSize = videoSize + (isCombined ? 0 : bestAudioSize);

        formats.push({
            id: "best-video",
            label: "Best Quality",
            quality: `Up to ${heights[0]}p`,
            format: "MP4",
            estimatedSize: totalSize > 0 ? formatSizeLabel(totalSize) : undefined,
            filesize: totalSize > 0 ? totalSize : undefined,
            isDefault: true,
        });
    }

    for (const h of heights.slice(1)) {
        const fmt = byHeight.get(h)!;
        const isCombined = fmt.acodec && fmt.acodec !== "none";
        const videoSize = getFormatSize(fmt, duration);
        const totalSize = videoSize + (isCombined ? 0 : bestAudioSize);
        const fpsStr = fmt.fps && fmt.fps > 30 ? `${fmt.fps}` : "";

        formats.push({
            id: `${h}p`,
            label: LABELS[h] || `${h}p`,
            quality: `${h}p${fpsStr}`,
            format: (fmt.ext || "mp4").toUpperCase(),
            estimatedSize: totalSize > 0 ? formatSizeLabel(totalSize) : undefined,
            filesize: totalSize > 0 ? totalSize : undefined,
        });
    }

    return formats;
}

function getFormatSize(fmt: YtdlpRawFormat | undefined, duration: number): number {
    if (!fmt) return 0;
    if (fmt.filesize && fmt.filesize > 0) return fmt.filesize;
    if (fmt.filesize_approx && fmt.filesize_approx > 0) return fmt.filesize_approx;
    if (fmt.tbr && duration > 0) return Math.round(fmt.tbr * 1000 / 8 * duration);
    return 0;
}

function formatSizeLabel(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export { DOWNLOAD_DIR, ensureDownloadDir };
