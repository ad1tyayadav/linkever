import type { MediaMetadata, MediaType } from "@/types";
import { detectPlatform } from "@/lib/platforms";

// ─── OG Tag Scraper ─────────────────────────────────────────────────────────
// Fetches a web page, parses OpenGraph meta tags, and extracts the direct
// media URL (og:image / og:video).  This handles sites like Pinterest, blogs,
// and other platforms that embed media inside HTML but don't expose direct
// file links.

const BROWSER_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ─── Types ──────────────────────────────────────────────────────────────────

interface OgTags {
    "og:title"?: string;
    "og:description"?: string;
    "og:image"?: string;
    "og:image:width"?: string;
    "og:image:height"?: string;
    "og:video"?: string;
    "og:video:url"?: string;
    "og:video:secure_url"?: string;
    "og:video:type"?: string;
    "og:video:width"?: string;
    "og:video:height"?: string;
    "og:type"?: string;
    "og:site_name"?: string;
    "og:url"?: string;
    // Twitter cards (used by many sites as fallback)
    "twitter:image"?: string;
    "twitter:player"?: string;
    "twitter:title"?: string;
    [key: string]: string | undefined;
}

export interface OgScrapedMedia {
    /** Direct URL to the media file (image or video) */
    mediaUrl: string;
    /** Title extracted from OG tags */
    title: string;
    /** Media type: image, video, or audio */
    type: MediaType;
    /** Thumbnail URL (og:image) */
    thumbnail: string;
    /** The site name or hostname */
    siteName: string;
}

// ─── HTML → OG Tag Parser ───────────────────────────────────────────────────

function parseOgTags(html: string): OgTags {
    const tags: OgTags = {};

    // Match <meta property="og:..." content="..."> and <meta name="twitter:..." content="...">
    // Handles both property and name attributes, single and double quotes, any attribute order
    const patterns = [
        // property="og:xxx" content="yyy"
        /<meta[^>]+property=["']([^"']+)["'][^>]+content=["']([^"']*)["'][^>]*\/?>/gi,
        // content="yyy" property="og:xxx"
        /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']([^"']+)["'][^>]*\/?>/gi,
        // name="twitter:xxx" content="yyy"
        /<meta[^>]+name=["']([^"']+)["'][^>]+content=["']([^"']*)["'][^>]*\/?>/gi,
        // content="yyy" name="twitter:xxx"
        /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']([^"']+)["'][^>]*\/?>/gi,
    ];

    for (let i = 0; i < patterns.length; i++) {
        const regex = patterns[i];
        let match: RegExpExecArray | null;
        while ((match = regex.exec(html)) !== null) {
            if (i === 0 || i === 2) {
                // property/name first, content second
                const key = match[1].toLowerCase();
                const value = match[2];
                if ((key.startsWith("og:") || key.startsWith("twitter:")) && !tags[key]) {
                    tags[key] = decodeHtmlEntities(value);
                }
            } else {
                // content first, property/name second
                const value = match[1];
                const key = match[2].toLowerCase();
                if ((key.startsWith("og:") || key.startsWith("twitter:")) && !tags[key]) {
                    tags[key] = decodeHtmlEntities(value);
                }
            }
        }
    }

    return tags;
}

function decodeHtmlEntities(str: string): string {
    return str
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, "/");
}

// ─── Pinterest-specific: extract highest-res image ──────────────────────────

function extractPinterestImage(html: string): string | null {
    // Pinterest often embeds high-res images in a JSON blob inside a <script> tag
    // Pattern: "orig":{"url":"https://i.pinimg.com/originals/..."}
    const origMatch = html.match(/"orig"\s*:\s*\{\s*"url"\s*:\s*"([^"]+)"/);
    if (origMatch) return origMatch[1];

    // Fallback: look for pinimg.com URLs with /originals/ path
    const pinimgMatch = html.match(/https:\/\/i\.pinimg\.com\/originals\/[^"'\s]+/);
    if (pinimgMatch) return pinimgMatch[0];

    // Fallback: highest-res pinimg URL (736x, 564x, 474x, 236x)
    for (const size of ["736x", "564x", "474x", "236x"]) {
        const sizeMatch = html.match(new RegExp(`https://i\\.pinimg\\.com/${size}/[^"'\\s]+`));
        if (sizeMatch) return sizeMatch[0];
    }

    return null;
}

// ─── Instagram oEmbed fallback (no auth needed) ─────────────────────────────

async function fetchInstagramOembed(url: string): Promise<OgScrapedMedia | null> {
    try {
        const oembedUrl = `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=`;
        // Try the public (non-authenticated) oEmbed endpoint first
        const publicUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`;
        const response = await fetch(publicUrl, {
            headers: { "User-Agent": BROWSER_UA },
            signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) return null;

        const data = await response.json() as {
            title?: string;
            author_name?: string;
            thumbnail_url?: string;
            thumbnail_width?: number;
            thumbnail_height?: number;
        };

        if (!data.thumbnail_url) return null;

        return {
            mediaUrl: data.thumbnail_url,
            title: data.title || data.author_name || "Instagram Post",
            type: "image" as MediaType,
            thumbnail: data.thumbnail_url,
            siteName: "Instagram",
        };
    } catch {
        return null;
    }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Scrape a URL for OpenGraph metadata.
 * Returns null if no usable media (og:image or og:video) is found.
 */
export async function scrapeOgMedia(url: string): Promise<OgScrapedMedia | null> {
    const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
        headers: { "User-Agent": BROWSER_UA },
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Could not access this URL.`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
        // Not an HTML page, nothing to scrape
        return null;
    }

    const html = await response.text();
    const og = parseOgTags(html);

    // Skip Spotify pages — they expose 30-second preview audio via og:audio
    // which is not useful. Spotify should be handled by the dedicated Spotify bridge.
    if (og["og:site_name"]?.toLowerCase() === "spotify" ||
        /open\.spotify\.com|spotify\.link/i.test(url)) {
        throw new Error("Spotify links should be handled by the Spotify bridge, not OG scraper.");
    }

    // Determine if the page is Pinterest
    const isPinterest = /pinterest\.com|pin\.it/i.test(url) ||
        og["og:site_name"]?.toLowerCase() === "pinterest";

    // ── Extract media URL ────────────────────────────────────────────────

    let mediaUrl: string | null = null;
    let type: MediaType = "image";

    // 1. Check for video first
    const videoUrl = og["og:video:secure_url"] || og["og:video:url"] || og["og:video"];
    if (videoUrl && !videoUrl.includes("flash") && !videoUrl.endsWith(".swf")) {
        mediaUrl = videoUrl;
        type = "video";
    }

    // 2. Check for image
    if (!mediaUrl) {
        if (isPinterest) {
            // Use Pinterest-specific extraction for highest-res image
            mediaUrl = extractPinterestImage(html) || og["og:image"] || og["twitter:image"] || null;
        } else {
            mediaUrl = og["og:image"] || og["twitter:image"] || null;
        }
        type = "image";
    }

    if (!mediaUrl) {
        // Instagram oEmbed fallback for posts that require login
        const isInstagram = /instagram\.com|instagr\.am/i.test(url);
        if (isInstagram) {
            const igOembed = await fetchInstagramOembed(url);
            if (igOembed) return igOembed;
        }
        return null; // No media found
    }

    // Make relative URLs absolute
    if (mediaUrl.startsWith("//")) {
        mediaUrl = "https:" + mediaUrl;
    } else if (mediaUrl.startsWith("/")) {
        try {
            const baseUrl = new URL(url);
            mediaUrl = baseUrl.origin + mediaUrl;
        } catch {
            // ignore
        }
    }

    // ── Build result ────────────────────────────────────────────────────
    let hostname = "Website";
    try {
        hostname = new URL(url).hostname.replace(/^www\./, "");
    } catch {
        // ignore
    }

    const title = og["og:title"] || og["twitter:title"] || extractHtmlTitle(html) || hostname;
    const siteName = og["og:site_name"] || hostname;

    return {
        mediaUrl,
        title: sanitizeTitle(title),
        type,
        thumbnail: og["og:image"] || "",
        siteName,
    };
}

/**
 * Build MediaMetadata from OG-scraped data for the metadata route.
 */
export async function fetchOgMetadata(url: string): Promise<MediaMetadata> {
    const scraped = await scrapeOgMedia(url);

    if (!scraped) {
        throw new Error("No downloadable media found on this page.");
    }

    const platform = detectPlatform(url);

    return {
        title: scraped.title,
        author: scraped.siteName,
        thumbnail: scraped.thumbnail,
        duration: 0,
        platform: platform.id,
        type: scraped.type,
        originalUrl: url,
    };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractHtmlTitle(html: string): string | null {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? decodeHtmlEntities(match[1].trim()) : null;
}

function sanitizeTitle(title: string): string {
    return title
        .replace(/[\n\r\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);
}
