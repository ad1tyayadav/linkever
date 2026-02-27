import type { SpotifyTrack, SpotifyCollection } from "@/types";
import axios from "axios";
import { URL } from "url";

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

type SpotifyApiTrack = {
    name?: string;
    duration_ms?: number;
    artists?: { name?: string }[];
    album?: { images?: { url?: string; height?: number; width?: number }[]; name?: string };
};

let cachedSpotifyToken: { token: string; expiresAtMs: number } | null = null;

function hasSpotifyApiCredentials(): boolean {
    const id = (process.env.SPOTIFY_CLIENT_ID || "").trim();
    const secret = (process.env.SPOTIFY_CLIENT_SECRET || "").trim();
    return Boolean(id && secret);
}

async function getSpotifyAccessToken(): Promise<string> {
    const cached = cachedSpotifyToken;
    const now = Date.now();
    if (cached && cached.expiresAtMs - 30_000 > now) return cached.token;

    const clientId = (process.env.SPOTIFY_CLIENT_ID || "").trim();
    const clientSecret = (process.env.SPOTIFY_CLIENT_SECRET || "").trim();
    if (!clientId || !clientSecret) {
        throw new Error("Spotify API credentials are not configured (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET).");
    }

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const resp = await axios.post(
        "https://accounts.spotify.com/api/token",
        new URLSearchParams({ grant_type: "client_credentials" }),
        {
            headers: {
                Authorization: `Basic ${basic}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout: 15_000,
            proxy: process.env.PROXY_URL ? parseProxyUrl(process.env.PROXY_URL) : false,
            validateStatus: () => true,
        }
    );

    if (resp.status !== 200 || !resp.data?.access_token) {
        throw new Error(`Spotify token request failed (status ${resp.status}).`);
    }

    const token = String(resp.data.access_token);
    const expiresIn = Number(resp.data.expires_in || 3600);
    cachedSpotifyToken = { token, expiresAtMs: now + Math.max(60, expiresIn) * 1000 };
    return token;
}

async function fetchSpotifyTrackViaApi(spotifyUrl: string): Promise<SpotifyPageMetadata> {
    const info = parseSpotifyUrl(spotifyUrl);
    if (!info) throw new Error("Invalid Spotify URL");
    if (info.type !== "track") throw new Error(`Spotify ${info.type} is not supported. Please use a track URL.`);

    const token = await getSpotifyAccessToken();
    const resp = await axios.get(`https://api.spotify.com/v1/tracks/${info.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15_000,
        proxy: process.env.PROXY_URL ? parseProxyUrl(process.env.PROXY_URL) : false,
        validateStatus: () => true,
    });

    if (resp.status !== 200) {
        throw new Error(`Spotify API track request failed (status ${resp.status}).`);
    }

    const track = resp.data as SpotifyApiTrack;
    const title = track?.name || "Unknown";
    const artist = (track?.artists || []).map((a) => a.name).filter(Boolean).join(", ") || "Unknown";
    const duration = Math.round(Number(track?.duration_ms || 0) / 1000);
    const album = track?.album?.name || "";

    const images = track?.album?.images || [];
    const largest = images.reduce<{ url?: string; height?: number; width?: number } | null>(
        (best, img) => {
            const bestScore = (best?.height || 0) * (best?.width || 0);
            const imgScore = (img?.height || 0) * (img?.width || 0);
            return !best || imgScore > bestScore ? img : best;
        },
        null
    );
    const artwork = largest?.url || null;

    return { title, artist, album, artwork, duration, spotifyUrl };
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
        const response = await axios.get(embedUrl, {
            headers,
            timeout: 30000,
            proxy: process.env.PROXY_URL ? parseProxyUrl(process.env.PROXY_URL) : false,
            validateStatus: () => true,
        });

        if (response.status !== 200) {
            console.log(`[linkever] Spotify embed fetch failed with status: ${response.status}`);
            throw new Error(`Spotify embed fetch failed: ${response.status}`);
        }
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
        const oembedResp = await axios.get(oembedUrl, {
            timeout: 20000,
            proxy: process.env.PROXY_URL ? parseProxyUrl(process.env.PROXY_URL) : false,
            validateStatus: () => true,
        });

        if (oembedResp.status !== 200) return { title: "Spotify Track", artist: "Unknown", album: "", artwork: null, duration: 0, spotifyUrl };

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

export async function resolveSpotifyLink(url: string): Promise<string> {
    if (/spotify\.link/i.test(url)) {
        const response = await axios.head(url, {
            maxRedirects: 5,
            timeout: 10000,
            proxy: process.env.PROXY_URL ? parseProxyUrl(process.env.PROXY_URL) : false,
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

    // Scrape the Spotify page for metadata (no API creds). If blocked in production, fallback to Spotify Web API.
    let metadata: SpotifyPageMetadata;
    try {
        metadata = await scrapeSpotifyMetadata(resolvedUrl);
    } catch (err) {
        const hasProxy = Boolean((process.env.PROXY_URL || "").trim());
        const canUseApi = hasSpotifyApiCredentials();
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`[linkever] Spotify scrape failed: ${msg.slice(0, 160)}`);

        if (canUseApi) {
            metadata = await fetchSpotifyTrackViaApi(resolvedUrl);
        } else {
            const suggestion = hasProxy
                ? "Spotify page scrape failed from this server. If this keeps happening, set SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET for API fallback."
                : "Spotify page scrape may be blocked from this server IP. Set PROXY_URL or set SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET for API fallback.";
            throw new Error(`${msg}. ${suggestion}`);
        }
    }

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

function parseProxyUrl(proxyUrl: string) {
    try {
        const parsed = new URL(proxyUrl);
        return {
            protocol: parsed.protocol.replace(":", ""),
            host: parsed.hostname,
            port: parseInt(parsed.port),
            auth: {
                username: decodeURIComponent(parsed.username),
                password: decodeURIComponent(parsed.password),
            },
        };
    } catch {
        return false;
    }
}
