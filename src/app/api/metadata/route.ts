import { NextRequest, NextResponse } from "next/server";
import { fetchMetadata } from "@/lib/ytdlp";
import { detectPlatform, isSpotifyUrl } from "@/lib/platforms";
import { resolveSpotifyUrl } from "@/lib/spotify";
import { fetchGenericMetadata } from "@/lib/genericDownloader";
import { fetchOgMetadata } from "@/lib/ogScraper";
import { VIDEO_FORMATS, AUDIO_FORMATS, FILE_FORMATS } from "@/lib/constants";
import type { MetadataResponse, MediaType, FormatOption, Platform } from "@/types";

function getErrorKind(err: unknown): string | undefined {
    if (!err || typeof err !== "object") return undefined;
    if (!("kind" in err)) return undefined;
    const kind = (err as Record<string, unknown>).kind;
    return typeof kind === "string" ? kind : undefined;
}

function getFormatsForType(type: MediaType): FormatOption[] {
    switch (type) {
        case "audio": return AUDIO_FORMATS;
        case "video": return VIDEO_FORMATS;
        case "file": return FILE_FORMATS;
        case "image": return FILE_FORMATS;
        default: return VIDEO_FORMATS;
    }
}

/**
 * Build a user-friendly error message based on the platform and URL pattern.
 */
function getPlatformError(platform: Platform, url: string): { message: string; suggestion: string } {
    switch (platform) {
        case "instagram": {
            const isStory = /\/stories\//.test(url);
            if (isStory) {
                return {
                    message: "Instagram Stories are private and expire after 24 hours. They can't be downloaded without authentication.",
                    suggestion: "Try an Instagram Reel or video post instead.",
                };
            }
            return {
                message: "Could not access this Instagram content. It may be private or require login.",
                suggestion: "Make sure the post is public, or try an Instagram Reel link.",
            };
        }
        case "twitter": {
            return {
                message: "This post doesn't seem to contain any downloadable media (video or image). We can only download posts that have media attached.",
                suggestion: "Try a tweet or X post that contains a video or image.",
            };
        }
        case "spotify":
            return {
                message: "Could not process this Spotify link.",
                suggestion: "Make sure the link is a valid Spotify track, album, or playlist URL.",
            };
        case "facebook":
            return {
                message: "Facebook content is often private or restricted. We couldn't find downloadable media.",
                suggestion: "Make sure the video is set to public visibility.",
            };
        case "reddit":
            return {
                message: "We couldn't fetch metadata for this Reddit post. It might be a text-only post or requires login.",
                suggestion: "Make sure the post contains an image or video.",
            };
        default: {
            if (url.includes("not found at")) {
                return {
                    message: "Server Configuration Error: A required binary (yt-dlp or python) is missing or misconfigured.",
                    suggestion: url,
                };
            }
            return {
                message: "We couldn't find any downloadable media at this URL. The content may be private, require login, or doesn't contain media.",
                suggestion: "Try a different URL, or use a direct link to a video, audio, or image file.",
            };
        }
    }
}

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get("url");

    if (!url) {
        return NextResponse.json(
            { error: "MISSING_URL", message: "URL parameter is required." },
            { status: 400 }
        );
    }

    try {
        // Handle Spotify URLs separately
        if (isSpotifyUrl(url)) {
            const spotifyData = await resolveSpotifyUrl(url);
            const type: MediaType = spotifyData.type === "track" ? "audio" : spotifyData.type;
            const platform = detectPlatform(url);

            const response: MetadataResponse = {
                title: spotifyData.title,
                author: spotifyData.author,
                thumbnail: spotifyData.thumbnail,
                duration: spotifyData.duration,
                platform: platform.id,
                type,
                originalUrl: url,
                trackCount: spotifyData.trackCount,
                formats: AUDIO_FORMATS,
            };

            return NextResponse.json(response);
        }

        // ── Triple Fallback: yt-dlp → OG scrape → generic HTTP ──────────

        const platform = detectPlatform(url);

        // 1. Try yt-dlp first (best for YouTube, Twitter, TikTok, etc.)
        try {
            const { availableFormats, ...metadata } = await fetchMetadata(url);
            const formats = availableFormats.length > 0
                ? availableFormats
                : metadata.type === "audio" ? AUDIO_FORMATS : VIDEO_FORMATS;
            return NextResponse.json({ ...metadata, formats } as MetadataResponse);
        } catch (ytdlpErr) {
            const ytdlpMsg = ytdlpErr instanceof Error ? ytdlpErr.message : "";
            const ytdlpKind = getErrorKind(ytdlpErr);
            console.log(`[linkever] yt-dlp metadata failed: ${ytdlpMsg.slice(0, 120)}`);

            // If it's a configuration error (binary not found), stop here and report it
            if (ytdlpMsg.includes("not found at")) {
                return NextResponse.json(
                    { error: "CONFIG_ERROR", message: ytdlpMsg, suggestion: "Please check your server environment variables." },
                    { status: 500 }
                );
            }

            // YouTube bot-check: other fallbacks won't work for YouTube anyway.
            if (platform.id === "youtube" && ytdlpKind === "BOT_CHECK") {
                return NextResponse.json(
                    {
                        error: "YOUTUBE_BOT_CHECK",
                        message: "YouTube blocked this server IP (bot check).",
                        suggestion: "Provide YouTube cookies (YTDLP_COOKIES_PATH or YTDLP_COOKIES_B64) or change PROXY_URL / server IP.",
                        platform: platform.id,
                    },
                    { status: 503 }
                );
            }

            // 2. Try OG tag scraping (works for Pinterest, blogs, etc.)
            try {
                const ogMetadata = await fetchOgMetadata(url);
                const formats = getFormatsForType(ogMetadata.type);
                return NextResponse.json({ ...ogMetadata, formats } as MetadataResponse);
            } catch (ogErr) {
                const ogMsg = ogErr instanceof Error ? ogErr.message : "";
                console.log(`[linkever] OG scrape failed: ${ogMsg.slice(0, 120)}`);

                // 3. Try generic HTTP head (works for direct file URLs)
                try {
                    const genericMetadata = await fetchGenericMetadata(url);
                    const formats = getFormatsForType(genericMetadata.type);
                    return NextResponse.json({ ...genericMetadata, formats } as MetadataResponse);
                } catch (genericErr) {
                    const genericMsg = genericErr instanceof Error ? genericErr.message : "";
                    console.log(`[linkever] Generic fetch failed: ${genericMsg.slice(0, 120)}`);

                    // All three methods failed — return platform-specific error
                    const errorInfo = getPlatformError(platform.id, url);
                    return NextResponse.json(
                        {
                            error: "METADATA_FAILED",
                            message: errorInfo.message,
                            suggestion: errorInfo.suggestion,
                            platform: platform.id,
                        },
                        { status: 422 }
                    );
                }
            }
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch metadata";
        return NextResponse.json(
            { error: "METADATA_FAILED", message },
            { status: 500 }
        );
    }
}
