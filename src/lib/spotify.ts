import type { SpotifyTrack, SpotifyCollection } from "@/types";
import axios from "axios";

// ─── URL Parsing ────────────────────────────────────────────────────────────

interface SpotifyUrlInfo {
    type: "track" | "album" | "playlist";
    id: string;
}

export function parseSpotifyUrl(url: string): SpotifyUrlInfo | null {
    // Match: open.spotify.com/track/ID, /album/ID, /playlist/ID
    // Also handles intl prefixes: open.spotify.com/intl-en/track/ID
    // Also: spotify:track:ID
    const webMatch = url.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist)\/([a-zA-Z0-9]+)/);
    if (webMatch) {
        return { type: webMatch[1] as SpotifyUrlInfo["type"], id: webMatch[2] };
    }

    const uriMatch = url.match(/spotify:(track|album|playlist):([a-zA-Z0-9]+)/);
    if (uriMatch) {
        return { type: uriMatch[1] as SpotifyUrlInfo["type"], id: uriMatch[2] };
    }

    return null;
}

// ─── Page Scraping (no API credentials needed) ─────────────────────────────

interface SpotifyPageMetadata {
    title: string;
    artist: string;
    album: string;
    artwork: string | null;
    duration: number;
    spotifyUrl: string;
}

/**
 * Scrape Spotify embed page for metadata - no API key needed.
 * The embed page (open.spotify.com/embed/track/ID) returns server-rendered HTML
 * with a __NEXT_DATA__ JSON blob containing complete track metadata.
 */
export async function scrapeSpotifyMetadata(spotifyUrl: string): Promise<SpotifyPageMetadata> {
    const info = parseSpotifyUrl(spotifyUrl);
    if (!info) throw new Error("Invalid Spotify URL");

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    // Strategy 1: Fetch the embed page which has __NEXT_DATA__ with full metadata
    try {
        const embedUrl = `https://open.spotify.com/embed/track/${info.id}`;
        const response = await axios.get(embedUrl, { headers, timeout: 15000 });
        const html: string = response.data;

        const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json">([^<]+)<\/script>/);
        if (nextDataMatch) {
            const nextData = JSON.parse(nextDataMatch[1]);
            const entity = nextData?.props?.pageProps?.state?.data?.entity;

            if (entity?.name) {
                const title = entity.name || entity.title || "Unknown";
                const artists: { name: string }[] = entity.artists || [];
                const artist = artists.map((a) => a.name).join(", ") || "Unknown";
                const durationMs: number = entity.duration || 0;
                const duration = Math.round(durationMs / 1000);

                const images: { url: string; maxHeight: number }[] = entity.visualIdentity?.image || [];
                const largestImage = images.reduce<{ url: string; maxHeight: number } | null>(
                    (best, img) => (!best || img.maxHeight > best.maxHeight ? img : best),
                    null
                );
                const artwork = largestImage?.url || null;

                console.log(`[linkever] Scraped Spotify embed: "${artist}" - "${title}" (duration: ${duration}s)`);

                return { title, artist, album: "", artwork, duration, spotifyUrl };
            }
        }
    } catch (embedErr) {
        console.log(`[linkever] Embed page scrape failed, trying oEmbed fallback...`, embedErr instanceof Error ? embedErr.message : embedErr);
    }

    // Strategy 2: oEmbed API fallback (always works, but no artist info)
    try {
        const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`;
        const oembedResp = await axios.get(oembedUrl, { timeout: 10000 });
        const oembed = oembedResp.data as { title?: string; thumbnail_url?: string };

        const title = oembed.title || "Unknown";
        const artwork = oembed.thumbnail_url || null;

        console.log(`[linkever] Scraped Spotify oEmbed: "${title}"`);

        return { title, artist: "Unknown", album: "", artwork, duration: 0, spotifyUrl };
    } catch {
        console.log(`[linkever] oEmbed fallback also failed`);
    }

    return { title: "Spotify Track", artist: "Unknown", album: "", artwork: null, duration: 0, spotifyUrl };
}

// ─── High-Level API ─────────────────────────────────────────────────────────

async function resolveSpotifyLink(url: string): Promise<string> {
    if (/spotify\.link/i.test(url)) {
        const response = await axios.head(url, {
            maxRedirects: 5,
            timeout: 10000,
        });
        return response.request.res.responseUrl || url;
    }
    return url;
}

// ─── Main Resolver ──────────────────────────────────────────────────────────

export async function resolveSpotifyUrl(url: string) {
    const resolvedUrl = await resolveSpotifyLink(url);
    const info = parseSpotifyUrl(resolvedUrl);

    if (!info) {
        throw new Error("Invalid Spotify URL. Please use a link like: open.spotify.com/track/...");
    }

    // Only track is supported via scraping for now
    if (info.type !== "track") {
        throw new Error(`Spotify ${info.type} scraping is not yet supported. Please use a track URL.`);
    }

    // Scrape the Spotify page for metadata
    const metadata = await scrapeSpotifyMetadata(resolvedUrl);

    const track: SpotifyTrack = {
        id: info.id,
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        albumArt: metadata.artwork || "",
        duration: Math.round(metadata.duration),
        trackNumber: 1,
    };

    return {
        type: "track" as const,
        title: `${metadata.artist} — ${metadata.title}`,
        author: metadata.artist,
        thumbnail: metadata.artwork || "",
        duration: Math.round(metadata.duration),
        trackCount: 1,
        searchQuery: `ytsearch1:${metadata.artist} - ${metadata.title}`,
        tracks: [track],
    };
}

/**
 * Build a YouTube search query from a Spotify track.
 * Uses format: "Artist - Title" for better matching
 */
export function buildYouTubeSearchQuery(track: SpotifyTrack): string {
    const query = `${track.artist} - ${track.title}`;
    return `ytsearch1:${query}`;
}

/**
 * Check if Spotify credentials are configured (not needed anymore)
 */
export function isSpotifyConfigured(): boolean {
    // No longer required - we use page scraping
    return true;
}
