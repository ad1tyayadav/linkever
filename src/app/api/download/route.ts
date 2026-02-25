import { NextRequest, NextResponse } from "next/server";
import { generateJobId } from "@/lib/utils";
import { detectPlatform, isSpotifyUrl } from "@/lib/platforms";
import { downloadRequestSchema } from "@/lib/validators";
import { download, type DownloadProgress } from "@/lib/ytdlp";
import { genericDownload } from "@/lib/genericDownloader";
import { scrapeOgMedia } from "@/lib/ogScraper";
import { resolveSpotifyLink, resolveSpotifyUrl } from "@/lib/spotify";
import { spotifyBridgeDownload } from "@/lib/spotifyBridge";
import {
    createJob,
    completeJob,
    failJob,
    updateJobProgress,
    notifySubscribers,
    checkRateLimit,
    recordRequest,
} from "@/lib/jobManager";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = downloadRequestSchema.safeParse(body);

        if (!parsed.success) {
            console.error("[linkever] Download validation failed:", JSON.stringify(parsed.error.issues), "Body:", JSON.stringify(body));
            return NextResponse.json(
                { error: "VALIDATION", message: parsed.error.issues[0]?.message || "Invalid request" },
                { status: 422 }
            );
        }

        const { url, format, quality, audioOnly } = parsed.data;

        // Rate limiting
        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
        const rateCheck = checkRateLimit(ip);
        if (!rateCheck.allowed) {
            return NextResponse.json(
                { error: "RATE_LIMITED", message: `Rate limit reached. You have ${rateCheck.remaining} downloads remaining this hour.` },
                { status: 429 }
            );
        }

        const platform = detectPlatform(url);
        const jobId = generateJobId();
        let jobTitle = "Loading media...";

        // Handle Spotify URLs — use the new Spotify bridge (page scrape + YouTube Music)
        if (isSpotifyUrl(url)) {
            // Resolve Spotify URL first to get the title
            let resolvedSpotifyUrl = url;
            try {
                resolvedSpotifyUrl = await resolveSpotifyLink(url);
                const spotifyData = await resolveSpotifyUrl(resolvedSpotifyUrl);
                jobTitle = spotifyData.title;
            } catch {
                jobTitle = "Spotify Track";
            }

            const job = createJob(jobId, url, "spotify", "audio", jobTitle, ip);
            recordRequest(ip);

            // Start Spotify bridge download
            startSpotifyDownload(jobId, resolvedSpotifyUrl);

            return NextResponse.json(
                {
                    jobId,
                    platform: "spotify",
                    type: "audio",
                    title: jobTitle,
                    progressUrl: `/api/progress/${jobId}`,
                },
                { status: 202 }
            );
        }

        // Non-Spotify URLs — use the existing triple fallback
        const job = createJob(jobId, url, platform.id, audioOnly ? "audio" : "video", jobTitle, ip);
        recordRequest(ip);

        startDownload(jobId, url, url, {
            format,
            quality,
            audioOnly,
        });

        return NextResponse.json(
            {
                jobId,
                platform: platform.id,
                type: audioOnly ? "audio" : "video",
                title: jobTitle,
                progressUrl: `/api/progress/${jobId}`,
            },
            { status: 202 }
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong";
        return NextResponse.json(
            { error: "INTERNAL", message },
            { status: 500 }
        );
    }
}

// ─── Spotify Download (via Python bridge — page scrape + YouTube Music) ─────

async function startSpotifyDownload(
    jobId: string,
    spotifyUrl: string
) {
    const progressCallback = (progress: DownloadProgress) => {
        if (progress.status === "done" || progress.status === "error") return;
        updateJobProgress(jobId, progress);
        notifySubscribers(jobId, progress);
    };

    try {
        console.log(`[linkever] Starting Spotify bridge for job ${jobId}: ${spotifyUrl}`);
        const result = await spotifyBridgeDownload(
            spotifyUrl,
            progressCallback,
            jobId
        );
        handleSuccess(jobId, result);
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Spotify download failed";
        console.error(`[linkever] Spotify bridge failed for job ${jobId}: ${errorMsg}`);
        failJob(jobId, errorMsg);
        const suggestion = buildSpotifySuggestion(errorMsg);
        notifySubscribers(jobId, {
            status: "error",
            error: "SPOTIFY_DOWNLOAD_FAILED",
            message: errorMsg,
            suggestion,
        });
    }
}

// ─── Background Download (Triple Fallback — non-Spotify) ─────────────────────

async function startDownload(
    jobId: string,
    url: string,
    originalUrl: string,
    options: { format?: string; quality?: string; audioOnly?: boolean }
) {
    const progressCallback = (progress: DownloadProgress) => {
        if (progress.status === "done" || progress.status === "error") return;
        updateJobProgress(jobId, progress);
        notifySubscribers(jobId, progress);
    };

    // 1. Try yt-dlp first (YouTube, Twitter, TikTok, etc.)
    try {
        const result = await download(url, options, progressCallback, jobId);
        handleSuccess(jobId, result);
        return;
    } catch (ytdlpErr) {
        const ytdlpMsg = ytdlpErr instanceof Error ? ytdlpErr.message : "";
        console.log(`[linkever] yt-dlp failed for job ${jobId}: ${ytdlpMsg.slice(0, 120)}`);
    }

    // 2. Try OG scraping → get direct media URL → download via generic
    try {
        console.log(`[linkever] Trying OG scrape for job ${jobId}`);
        progressCallback({
            status: "downloading",
            percent: 0,
            speed: "",
            eta: "",
            step: "Scanning page for media...",
        });

        const scraped = await scrapeOgMedia(originalUrl);
        if (scraped && scraped.mediaUrl) {
            console.log(`[linkever] OG scrape found ${scraped.type}: ${scraped.mediaUrl.slice(0, 80)}`);
            const result = await genericDownload(scraped.mediaUrl, progressCallback, jobId);
            handleSuccess(jobId, result);
            return;
        }
        console.log(`[linkever] OG scrape found no media for job ${jobId}`);
    } catch (ogErr) {
        const ogMsg = ogErr instanceof Error ? ogErr.message : "";
        console.log(`[linkever] OG scrape/download failed for job ${jobId}: ${ogMsg.slice(0, 120)}`);
    }

    // 3. Try generic HTTP download as last resort (direct file URLs)
    try {
        console.log(`[linkever] Trying generic download for job ${jobId}`);
        const result = await genericDownload(url, progressCallback, jobId);
        handleSuccess(jobId, result);
        return;
    } catch (genericErr) {
        const genericMsg = genericErr instanceof Error ? genericErr.message : "Download failed";
        console.log(`[linkever] Generic download also failed for job ${jobId}: ${genericMsg.slice(0, 120)}`);
    }

    // All three failed
    const errorMsg = "Could not download media from this URL. The content may be private, region-locked, or not directly downloadable.";
    console.error(`[linkever] All download methods failed for job ${jobId}`);
    failJob(jobId, errorMsg);
    notifySubscribers(jobId, {
        status: "error",
        error: "DOWNLOAD_FAILED",
        message: errorMsg,
        suggestion: "Try a different URL or paste a direct link to the media file.",
    });
}

function handleSuccess(
    jobId: string,
    result: { filepath: string; filename: string; filesize: number }
) {
    completeJob(jobId, result.filepath, result.filename, result.filesize);
    notifySubscribers(jobId, {
        status: "done",
        downloadUrl: `/api/file/${jobId}`,
        filename: result.filename,
        size: formatFileSize(result.filesize),
    });
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function buildSpotifySuggestion(errorMsg: string): string {
    const msg = errorMsg.toLowerCase();
    if (msg.includes("python not found") || msg.includes("python")) {
        return "Python is required for the Spotify bridge. Install Python and run: pip install -r python/requirements.txt";
    }
    if (msg.includes("ffmpeg")) {
        return "FFmpeg is required. Install FFmpeg and ensure it is on PATH or set FFMPEG_PATH.";
    }
    if (msg.includes("signature solving failed") || msg.includes("requested format is not available") || msg.includes("n challenge") || msg.includes("ejs")) {
        return "yt-dlp couldn't solve YouTube challenges. Set YTDLP_REMOTE_COMPONENTS=ejs:github and ensure yt-dlp is up to date.";
    }
    if (msg.includes("403") || msg.includes("forbidden") || msg.includes("429") || msg.includes("blocked")) {
        return "The proxy or server IP is blocked. Try a different proxy or region.";
    }
    return "Please try again or use a different track URL.";
}
