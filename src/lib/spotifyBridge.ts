import { spawn } from "child_process";
import path from "path";
import os from "os";
import fs from "fs/promises";
import fsSync from "fs";
import type { DownloadProgress, ProgressCallback } from "@/lib/ytdlp";

const PYTHON_CMD = resolvePythonCmd();
const DOWNLOAD_DIR = path.join(os.tmpdir(), "linkever-downloads");

interface SpotifyMetadata {
    title: string;
    artist: string;
    album: string;
    artwork: string | null;
    duration: number;
    spotify_url: string;
}

interface BridgeProgress {
    step: string;
    percent: number;
    status?: string;
    message?: string;
    filepath?: string;
}

async function ensureDir(dir: string): Promise<string> {
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

export async function spotifyBridgeDownload(
    spotifyUrl: string,
    onProgress: ProgressCallback,
    jobId?: string
): Promise<{ filepath: string; filename: string; filesize: number }> {
    const baseDir = await ensureDir(DOWNLOAD_DIR);
    const dir = path.join(baseDir, jobId || `spotify_${Date.now()}`);
    await fs.mkdir(dir, { recursive: true });

    const scriptPath = path.join(process.cwd(), "python", "spotify_bridge.py");

    const args = [scriptPath, spotifyUrl, dir];

    console.log(`[linkever] Spotify bridge: ${PYTHON_CMD} ${args.join(" ")}`);

    onProgress({
        status: "downloading",
        percent: 0,
        speed: "",
        eta: "",
        step: "Initializing Spotify download...",
    });

    return new Promise((resolve, reject) => {
        // Hard timeout to prevent hangs - 10 minutes for download
        const killTimer = setTimeout(() => {
            try { proc.kill("SIGTERM"); } catch { /* ignore */ }
        }, 600_000);

        const proc = spawn(PYTHON_CMD, args, {
            cwd: dir,
        });

        let stderr = "";

        proc.stdout.on("data", (chunk: Buffer) => {
            const text = chunk.toString();
            const lines = text.trim().split("\n");

            for (const line of lines) {
                if (!line.trim()) continue;

                try {
                    const data: BridgeProgress = JSON.parse(line);

                    let status: DownloadProgress["status"] = "downloading";
                    if (data.status === "error") status = "error";
                    if (data.status === "complete") status = "done";

                    const step = data.step || "Processing...";
                    const percent = Math.min(100, Math.max(0, data.percent || 0));

                    onProgress({
                        status,
                        percent,
                        speed: "",
                        eta: "",
                        step,
                    });

                    if (status === "done" || data.filepath) {
                        // Will handle in close
                    }
                } catch {
                    // Not JSON, ignore
                }
            }
        });

        proc.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
        });

        proc.on("close", async (code) => {
            clearTimeout(killTimer);
            if (code !== 0) {
                const sanitized = redactSensitive(stderr);
                console.error(`[linkever] Spotify bridge failed (exit code ${code}):`, sanitized);
                const errorMsg = parseBridgeError(sanitized);
                onProgress({
                    status: "error",
                    percent: 0,
                    speed: "",
                    eta: "",
                    step: errorMsg,
                });
                reject(new Error(errorMsg));
                return;
            }

            // Find the output file
            try {
                const files = await fs.readdir(dir);
                const audioFiles = files.filter((f) => {
                    const ext = path.extname(f).toLowerCase();
                    return [".mp3", ".m4a", ".flac", ".ogg", ".wav"].includes(ext);
                });

                if (audioFiles.length === 0) {
                    reject(new Error("Bridge completed but no audio file was produced."));
                    return;
                }

                const fileStats = await Promise.all(
                    audioFiles.map(async (f) => {
                        const fullPath = path.join(dir, f);
                        const stat = await fs.stat(fullPath);
                        return { name: f, path: fullPath, size: stat.size };
                    })
                );

                // Pick the largest file
                fileStats.sort((a, b) => b.size - a.size);
                const outputFile = fileStats[0];

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
                    filename: outputFile.name,
                    filesize: outputFile.size,
                });
            } catch (err) {
                reject(new Error(`Failed to locate output file: ${err}`));
            }
        });

        proc.on("error", (err) => {
            const isNoent = (err as any).code === "ENOENT";
            const msg = isNoent
                ? `Python not found at "${PYTHON_CMD}". Please check PYTHON_PATH in .env or install Python.`
                : `Failed to start Python bridge: ${err.message}`;
            reject(new Error(msg));
        });
    });
}

function resolvePythonCmd(): string {
    const configured = process.env.PYTHON_PATH?.trim();
    if (configured) {
        // If an absolute path is set, ensure it exists. Otherwise let PATH resolve it.
        if (path.isAbsolute(configured)) {
            if (fsSync.existsSync(configured)) {
                return configured;
            }
        } else {
            return configured;
        }
    }

    if (process.platform === "win32") {
        // Prefer the Python launcher on Windows
        return "py";
    }

    return "python3";
}

function parseBridgeError(output: string): string {
    if (output.toLowerCase().includes("cookies are no longer valid")) {
        return "YouTube cookies are expired/invalid on the server. Update cookies or set YTDLP_DISABLE_COOKIES=1.";
    }
    if (output.includes("Sign in to confirm youre not a bot") || output.includes("Sign in to confirm you're not a bot")) {
        return "YouTube blocked the server/proxy (bot check). Try a different proxy/IP or provide fresh YouTube cookies.";
    }
    if (output.includes("ytmusicapi not installed")) {
        return "ytmusicapi not installed. Run: pip install ytmusicapi";
    }
    if (output.includes("mutagen not installed")) {
        return "mutagen not installed. Run: pip install mutagen";
    }
    if (output.includes("requests not installed")) {
        return "requests not installed. Run: pip install requests";
    }
    if (output.includes("No results found") || output.includes("No matches")) {
        return "Could not find this track on YouTube Music.";
    }
    if (output.includes("ffmpeg")) {
        return "FFmpeg is required. Please install FFmpeg and try again.";
    }
    if (output.includes("403") || output.includes("Forbidden") || output.includes("blocked") || output.includes("429")) {
        return "Access denied by platform. The server's IP might be blocked.";
    }
    if (output.includes("Sign in to confirm your age")) {
        return "Content is age-restricted and cannot be downloaded by the server.";
    }
    return output.slice(0, 150) || "Failed to download from Spotify. Please try again.";
}

function redactSensitive(text: string): string {
    // Redact credentials in proxy URLs and similar: http(s)://user:pass@host -> http(s)://[redacted]@host
    return text.replace(/(https?:\/\/)([^@\s]+)@/g, "$1[redacted]@");
}

export async function isSpotifyBridgeAvailable(): Promise<boolean> {
    const scriptPath = path.join(process.cwd(), "python", "spotify_bridge.py");

    try {
        await fs.access(scriptPath);
        return true;
    } catch {
        return false;
    }
}
