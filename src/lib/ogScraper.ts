import { detectPlatform } from "@/lib/platforms";
import axios from "axios";
import { URL } from "url";

// ─── OG Tag Scraper ─────────────────────────────────────────────────────────
// Fetches a web page, parses OpenGraph meta tags, and extracts the direct
// media URL (og:image / og:video).  This handles sites like Pinterest, blogs,
// and other platforms that embed media inside HTML but don't expose direct
// file links.

const BROWSER_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BOT_UA = "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)";

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
        // Also handle meta tags without trailing slash and with different quote styles
        /<meta property=["']([^"']+)["'][^>]*content=["']([^"']*)["']/gi,
        /<meta name=["']([^"']+)["'][^>]*content=["']([^"']*)["']/gi,
    ];

    for (let i = 0; i < patterns.length; i++) {
        const regex = patterns[i];
        let match: RegExpExecArray | null;
        while ((match = regex.exec(html)) !== null) {
            // Determine which group is the key and which is the value
            // For patterns 0,1 (property): group 1 is key, group 2 is value
            // For patterns 2,3 (name): group 1 is key, group 2 is value
            // For patterns 4,5 (simpler): group 1 is key, group 2 is value
            let key: string, value: string;

            if (i <= 3) {
                if (i === 0 || i === 2) {
                    key = match[1].toLowerCase();
                    value = match[2];
                } else {
                    value = match[1];
                    key = match[2].toLowerCase();
                }
            } else {
                key = match[1].toLowerCase();
                value = match[2];
            }

            if ((key.startsWith("og:") || key.startsWith("twitter:")) && !tags[key]) {
                tags[key] = decodeHtmlEntities(value);
            }
        }
    }

    // Additional fallback: try to find og:image with a more general regex
    if (!tags["og:image"]) {
        const imgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        if (imgMatch) {
            tags["og:image"] = decodeHtmlEntities(imgMatch[1]);
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

// Instagram sharedData JSON extraction (no auth needed) ───────────────────
// Instagram embeds the post data in a JSON blob in the HTML that we can parse

interface InstagramSharedData {
    entry_data?: {
        PostPage?: Array<{
            graphql?: {
                shortcode_media?: {
                    display_url?: string;
                    display_resources?: Array<{
                        src: string;
                        config_width: number;
                        config_height: number;
                    }>;
                    edge_sidecar_to_children?: {
                        edges?: Array<{
                            node: {
                                display_url: string;
                                display_resources?: Array<{
                                    src: string;
                                    config_width: number;
                                    config_height: number;
                                }>;
                            };
                        }>;
                    };
                    title?: string;
                    edge_media_to_caption?: {
                        edges?: Array<{
                            node: { text: string };
                        }>;
                    };
                    owner?: {
                        username?: string;
                    };
                };
            };
        }>;
    };
}

function parseInstagramFromHtml(html: string): OgScrapedMedia | null {
    // 1. Modern approach: Try to extract window.__additionalDataLoaded
    const additionalDataMatch = html.match(/window\.__additionalDataLoaded\s*\(\s*['"]feed['"]\s*,\s*({.+?})\s*\);/);
    if (additionalDataMatch) {
        try {
            const data = JSON.parse(additionalDataMatch[1]);
            return parseInstagramSharedData(data);
        } catch {
            // fallback
        }
    }

    // 2. Legacy approach: Try to extract window._sharedData
    const sharedDataMatch = html.match(/window\._sharedData\s*=\s*({.+?});/);
    if (sharedDataMatch) {
        try {
            const sharedData: InstagramSharedData = JSON.parse(sharedDataMatch[1]);
            return parseInstagramSharedData(sharedData);
        } catch {
            // fallback
        }
    }

    return null;
}

function parseInstagramSharedData(data: InstagramSharedData): OgScrapedMedia | null {
    const postPage = data.entry_data?.PostPage?.[0];
    if (!postPage?.graphql?.shortcode_media) return null;

    const media = postPage.graphql.shortcode_media;

    // Get the highest resolution image
    let mediaUrl: string | undefined;
    let thumbnail: string = "";

    // Check for carousel (multiple images/videos)
    if (media.edge_sidecar_to_children?.edges?.length) {
        const firstItem = media.edge_sidecar_to_children.edges[0]?.node;
        if (firstItem?.display_resources) {
            const best = getHighestRes(firstItem.display_resources);
            mediaUrl = best?.src;
            thumbnail = best?.src || firstItem.display_url || "";
        } else {
            mediaUrl = firstItem?.display_url;
            thumbnail = firstItem?.display_url || "";
        }
    } else {
        if (media.display_resources) {
            const best = getHighestRes(media.display_resources);
            mediaUrl = best?.src;
            thumbnail = best?.src || media.display_url || "";
        } else {
            mediaUrl = media.display_url;
            thumbnail = media.display_url || "";
        }
    }

    if (!mediaUrl) return null;

    const caption = media.edge_media_to_caption?.edges?.[0]?.node?.text || "";
    const title = caption.slice(0, 100) || `Instagram post by @${media.owner?.username || "user"}`;

    return {
        mediaUrl,
        title,
        type: "image",
        thumbnail,
        siteName: "Instagram",
    };
}

function getHighestRes(resources: Array<{ src: string; config_width: number; config_height: number }>): { src: string; config_width: number; config_height: number } | undefined {
    if (!resources?.length) return undefined;
    return resources.slice().sort((a, b) => b.config_width - a.config_width)[0];
}

// ─── Reddit-specific: extract image from embedded JSON ──────────────────────

interface RedditGalleryItem {
    media_id?: string;
    id?: string;
}

interface RedditImageSource {
    url: string;
    width: number;
    height: number;
}

interface RedditMediaMetadata {
    p?: RedditImageSource[];
    s?: RedditImageSource;
    status?: string;
}

interface RedditGalleryData {
    metadata?: {
        items?: RedditGalleryItem[];
    };
}

interface RedditPostData {
    children?: Array<{
        data?: {
            url?: string;
            preview?: {
                images?: Array<{
                    source?: { url: string; width: number; height: number };
                    resolutions?: Array<{ url: string; width: number; height: number }>;
                    id?: string;
                }>;
            };
            media_metadata?: Record<string, RedditGalleryData>;
            is_video?: boolean;
            secure_media?: {
                reddit_video?: { fallback_url?: string };
            };
            gallery_data?: RedditGalleryData;
            title?: string;
            author?: string;
        };
    }>;
}

function parseRedditFromHtml(html: string): OgScrapedMedia | null {
    // Reddit embeds post data in window.__additionalDataLoaded or similar JSON
    // Try to extract the JSON data from the HTML

    // Method 1: Look for window.__additionalDataLoaded calls
    const additionalDataMatch = html.match(/window\.__additionalDataLoaded\s*\(\s*['"]posts['"]\s*,\s*({.+?})\s*\);/);
    if (additionalDataMatch) {
        try {
            const data = JSON.parse(additionalDataMatch[1]);
            const result = extractRedditMedia(data);
            if (result) return result;
        } catch {
            // fallback
        }
    }

    // Method 2: Look for window.__r reddit_json data
    const redditJsonMatch = html.match(/window\.__r\s*\s*=\s*({.+?});/);
    if (redditJsonMatch) {
        try {
            const data = JSON.parse(redditJsonMatch[1]);
            const result = extractRedditMedia(data);
            if (result) return result;
        } catch {
            // fallback
        }
    }

    // Method 3: Look for JSON in script tag with reddit data
    const scriptMatch = html.match(/<script[^>]*>\s*window\.__reddit\s*=\s*({.+?});/);
    if (scriptMatch) {
        try {
            const data = JSON.parse(scriptMatch[1]);
            const result = extractRedditMedia(data);
            if (result) return result;
        } catch {
            // fallback
        }
    }

    // Method 4: Look for data-post JSON in script tags
    const dataPostMatch = html.match(/data-post='(\{.+?\})'/);
    if (dataPostMatch) {
        try {
            const data = JSON.parse(dataPostMatch[1]);
            const result = extractRedditMedia(data);
            if (result) return result;
        } catch {
            // fallback
        }
    }

    // Method 5: Try to find any JSON that looks like reddit post data with preview images
    const jsonPreviewMatch = html.match(/"preview"\s*:\s*\{"images"\s*:\s*\[\s*\{"source"\s*:\s*\{"url"\s*:\s*"([^"]+)"/);
    if (jsonPreviewMatch) {
        let mediaUrl = decodeHtmlEntities(jsonPreviewMatch[1]);
        // Convert preview URL to full resolution (remove preview.redd.it and use i.redd.it)
        mediaUrl = mediaUrl.replace(/preview\.redd\.it/i, 'i.redd.it');
        return {
            mediaUrl,
            title: "Reddit Post",
            type: "image",
            thumbnail: mediaUrl,
            siteName: "Reddit",
        };
    }

    return null;
}

function extractRedditMedia(data: unknown): OgScrapedMedia | null {
    // Handle different Reddit data structures
    let postData: RedditPostData | undefined;

    if (data && typeof data === 'object') {
        // Try to find the post data in various locations
        const d = data as Record<string, unknown>;
        if (Array.isArray(d.children)) {
            postData = data as RedditPostData;
        } else if (d.data) {
            postData = d.data as RedditPostData;
        }
    }

    if (!postData?.children?.[0]?.data) return null;

    const post = postData.children[0].data;

    // Check for video first
    if (post.is_video && post.secure_media?.reddit_video?.fallback_url) {
        return {
            mediaUrl: post.secure_media.reddit_video.fallback_url,
            title: post.title || "Reddit Video",
            type: "video",
            thumbnail: "",
            siteName: "Reddit",
        };
    }

    // Check for gallery (multiple images)
    if (post.gallery_data?.metadata?.items?.length) {
        const items = post.gallery_data.metadata.items;
        const firstItem = items[0];
        const mediaId = firstItem.media_id || firstItem.id;

        if (mediaId && post.media_metadata?.[mediaId]) {
            const mediaItem = post.media_metadata[mediaId] as RedditMediaMetadata | undefined;
            // Get highest resolution from p (preview) or s (source)
            const source = mediaItem?.p?.slice(-1)?.[0] || mediaItem?.s;
            if (source?.url) {
                let mediaUrl = source.url;
                mediaUrl = mediaUrl.replace(/preview\.redd\.it/i, 'i.redd.it');
                return {
                    mediaUrl,
                    title: post.title || "Reddit Gallery",
                    type: "image",
                    thumbnail: mediaUrl,
                    siteName: "Reddit",
                };
            }
        }
    }

    // Check for single image in preview
    if (post.preview?.images?.[0]) {
        const img = post.preview.images[0];

        // Try to get the highest resolution from resolutions array
        if (img.resolutions?.length) {
            const bestRes = img.resolutions.slice().sort((a, b) => b.width - a.width)[0];
            if (bestRes?.url) {
                let mediaUrl = decodeHtmlEntities(bestRes.url);
                mediaUrl = mediaUrl.replace(/preview\.redd\.it/i, 'i.redd.it');
                return {
                    mediaUrl,
                    title: post.title || "Reddit Post",
                    type: "image",
                    thumbnail: mediaUrl,
                    siteName: "Reddit",
                };
            }
        }

        // Fallback to source
        if (img.source?.url) {
            let mediaUrl = decodeHtmlEntities(img.source.url);
            mediaUrl = mediaUrl.replace(/preview\.redd\.it/i, 'i.redd.it');
            return {
                mediaUrl,
                title: post.title || "Reddit Post",
                type: "image",
                thumbnail: mediaUrl,
                siteName: "Reddit",
            };
        }
    }

    // Direct URL fallback - if the post URL is directly an image
    if (post.url && (post.url.includes('i.redd.it') || post.url.includes('preview.redd.it'))) {
        let mediaUrl = post.url;
        mediaUrl = mediaUrl.replace(/preview\.redd\.it/i, 'i.redd.it');
        return {
            mediaUrl,
            title: post.title || "Reddit Image",
            type: "image",
            thumbnail: mediaUrl,
            siteName: "Reddit",
        };
    }

    return null;
}

// Instagram oEmbed fallback ───────────────────────────────────────────────

async function fetchInstagramOembed(url: string): Promise<OgScrapedMedia | null> {
    try {
        // Extract shortcode from URL (e.g., DG_CukIyEFD from /p/DG_CukIyEFD/)
        // Instagram oEmbed works better with just the shortcode
        const shortcodeMatch = url.match(/instagram\.com\/(?:p|reel|tv)\/?([A-Za-z0-9_-]+)/i);

        let oembedUrl: string;
        if (shortcodeMatch) {
            // Use just the shortcode for oEmbed
            oembedUrl = `https://api.instagram.com/oembed/?url=https://www.instagram.com/${shortcodeMatch[1]}/`;
        } else {
            oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`;
        }

        const response = await axios.get(oembedUrl, {
            headers: { "User-Agent": BROWSER_UA },
            timeout: 10_000,
            proxy: process.env.PROXY_URL ? parseProxyUrl(process.env.PROXY_URL) : false,
        });

        const data = response.data as {
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
    const isInstagram = /instagram\.com|instagr\.am/i.test(url);
    const isTwitter = /twitter\.com|x\.com/i.test(url);
    const isReddit = /reddit\.com|v\.redd\.it/i.test(url);
    const ua = (isInstagram || isTwitter || isReddit) ? BOT_UA : BROWSER_UA;

    const response = await axios.get(url, {
        headers: { "User-Agent": ua },
        timeout: 15_000,
        maxRedirects: 5,
        proxy: process.env.PROXY_URL ? parseProxyUrl(process.env.PROXY_URL) : false,
    });

    const contentType = response.headers["content-type"] || "";
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
            mediaUrl = extractPinterestImage(html) || og["og:image"] || og["twitter:image"] || og["twitter:image:src"] || null;
        } else {
            mediaUrl = og["og:image"] || og["twitter:image"] || og["twitter:image:src"] || null;
        }
        type = "image";
    }

    if (!mediaUrl) {
        // Instagram-specific extraction: try multiple approaches
        const isInstagram = /instagram\.com|instagr\.am/i.test(url);
        if (isInstagram) {
            // Try oEmbed first - this is a public API that works without auth
            const igOembed = await fetchInstagramOembed(url);
            if (igOembed) return igOembed;

            // Try sharedData extraction as fallback (gives highest quality image)
            // This may not work on newer Instagram pages that use ServerJS
            const igSharedData = parseInstagramFromHtml(html);
            if (igSharedData) return igSharedData;
        }

        // Reddit-specific extraction: try to get actual image from embedded JSON
        const isReddit = /reddit\.com/i.test(url);
        if (isReddit) {
            const redditMedia = parseRedditFromHtml(html);
            if (redditMedia) return redditMedia;
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
