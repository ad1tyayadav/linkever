import { NextRequest, NextResponse } from "next/server";
import { generateJobId } from "@/lib/utils";
import { resolveSpotifyUrl, buildYouTubeSearchQuery } from "@/lib/spotify";
import { download } from "@/lib/ytdlp";
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
        const { url } = body;

        if (!url || (!url.includes("spotify.com") && !url.includes("spotify.link"))) {
            return NextResponse.json(
                { error: "INVALID_URL", message: "A valid Spotify URL is required." },
                { status: 422 }
            );
        }

        // Rate limiting
        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
        const rateCheck = checkRateLimit(ip);
        if (!rateCheck.allowed) {
            return NextResponse.json(
                { error: "RATE_LIMITED", message: "Rate limit reached." },
                { status: 429 }
            );
        }

        const jobId = generateJobId();

        // Resolve Spotify metadata
        const spotifyData = await resolveSpotifyUrl(url);

        // Create job
        createJob(jobId, url, "spotify", "audio", spotifyData.title, ip);
        recordRequest(ip);

        // Start download in background
        const searchQuery = buildYouTubeSearchQuery(spotifyData.tracks[0]);
        startSpotifyDownload(jobId, searchQuery, spotifyData.title);

        return NextResponse.json(
            {
                jobId,
                platform: "spotify",
                type: "audio" as const,
                title: spotifyData.title,
                trackCount: spotifyData.trackCount,
                progressUrl: `/api/progress/${jobId}`,
            },
            { status: 202 }
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : "Spotify Bridge error";
        return NextResponse.json(
            { error: "SPOTIFY_ERROR", message },
            { status: 500 }
        );
    }
}

async function startSpotifyDownload(jobId: string, searchQuery: string, title: string) {
    try {
        const result = await download(
            searchQuery,
            { audioOnly: true, format: "mp3", embedMetadata: true },
            (progress) => {
                updateJobProgress(jobId, progress);
                notifySubscribers(jobId, { ...progress, step: progress.step || `Downloading: ${title}` });
            }
        );

        completeJob(jobId, result.filepath, result.filename, result.filesize);
        notifySubscribers(jobId, {
            status: "done",
            downloadUrl: `/api/file/${jobId}`,
            filename: result.filename,
            size: formatSize(result.filesize),
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Download failed";
        failJob(jobId, message);
        notifySubscribers(jobId, {
            status: "error",
            error: "DOWNLOAD_FAILED",
            message,
            suggestion: "Try a different Spotify track.",
        });
    }
}

function formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
