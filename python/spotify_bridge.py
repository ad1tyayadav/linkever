#!/usr/bin/env python3
"""
Spotify Bridge - Downloads Spotify tracks via YouTube Music
No Spotify API credentials needed - uses page scraping + ytmusicapi

Usage: python spotify_bridge.py <spotify_url> <output_dir>
"""

import sys
import json
import subprocess
import re
import os
from typing import Optional, Dict, Any

# Install dependencies check
try:
    from ytmusicapi import YTMusic
except ImportError:
    print(json.dumps({"status": "error", "message": "ytmusicapi not installed. Run: pip install ytmusicapi"}), flush=True)
    sys.exit(1)

try:
    from mutagen.mp3 import MP3
    from mutagen.id3 import ID3, TIT2, TPE1, TALB, APIC
except ImportError:
    print(json.dumps({"status": "error", "message": "mutagen not installed. Run: pip install mutagen"}), flush=True)
    sys.exit(1)

try:
    import requests
except ImportError:
    print(json.dumps({"status": "error", "message": "requests not installed. Run: pip install requests"}), flush=True)
    sys.exit(1)


def emit_progress(step: str, percent: float = 0, **kwargs):
    """Emit a JSON progress line to stdout"""
    data = {"step": step, "percent": percent, **kwargs}
    print(json.dumps(data), flush=True)


def extract_track_id(spotify_url: str) -> Optional[str]:
    """Extract track ID from a Spotify URL"""
    match = re.search(r'open\.spotify\.com/(?:intl-[a-z-]+/)?track/([a-zA-Z0-9]+)', spotify_url)
    return match.group(1) if match else None


def get_spotify_metadata(spotify_url: str) -> Dict[str, Any]:
    """Get Spotify metadata by scraping the embed page's __NEXT_DATA__ JSON.
    The embed page (open.spotify.com/embed/track/ID) is server-rendered and
    contains complete metadata without needing API credentials.
    Falls back to oEmbed API if embed page fails."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }

    track_id = extract_track_id(spotify_url)
    if not track_id:
        raise ValueError(f"Could not extract track ID from URL: {spotify_url}")

    # Prepare proxies for requests
    proxy_url = os.environ.get("PROXY_URL")
    proxies = {"http": proxy_url, "https": proxy_url} if proxy_url else None

    # Strategy 1: Embed page with __NEXT_DATA__
    try:
        embed_url = f"https://open.spotify.com/embed/track/{track_id}"
        resp = requests.get(embed_url, headers=headers, timeout=30, proxies=proxies)
        resp.raise_for_status()
        html = resp.text

        next_data_match = re.search(r'<script\s+id="__NEXT_DATA__"\s+type="application/json">([^<]+)</script>', html)
        if next_data_match:
            next_data = json.loads(next_data_match.group(1))
            entity = next_data.get("props", {}).get("pageProps", {}).get("state", {}).get("data", {}).get("entity", {})

            if entity.get("name"):
                title = entity.get("name") or entity.get("title") or "Unknown"
                artists = entity.get("artists", [])
                artist = ", ".join(a["name"] for a in artists if a.get("name")) or "Unknown"
                duration_ms = entity.get("duration", 0)
                duration = round(duration_ms / 1000)

                images = entity.get("visualIdentity", {}).get("image", [])
                artwork = None
                if images:
                    largest = max(images, key=lambda img: img.get("maxHeight", 0))
                    artwork = largest.get("url")

                return {
                    "title": title,
                    "artist": artist,
                    "album": "",
                    "artwork": artwork,
                    "duration": duration,
                    "spotify_url": spotify_url
                }
    except Exception as e:
        print(f"Embed page scrape failed: {e}", file=sys.stderr)

    # Strategy 2: oEmbed API fallback (always works, but no artist)
    try:
        oembed_url = f"https://open.spotify.com/oembed?url={spotify_url}"
        resp = requests.get(oembed_url, timeout=20, proxies=proxies)
        resp.raise_for_status()
        data = resp.json()
        title = data.get("title", "Unknown")
        artwork = data.get("thumbnail_url")

        return {
            "title": title,
            "artist": "Unknown",
            "album": "",
            "artwork": artwork,
            "duration": 0,
            "spotify_url": spotify_url
        }
    except Exception as e:
        print(f"oEmbed fallback also failed: {e}", file=sys.stderr)

    raise RuntimeError("Could not fetch metadata from Spotify. Please try again.")


def find_youtube_music_url(artist: str, title: str, duration_sec: Optional[int] = None) -> tuple[str, str]:
    """Search YouTube Music for best match using ytmusicapi"""
    try:
        ytmusic = YTMusic()
        
        # Search with artist + title for better accuracy
        query = f"{artist} {title}"
        results = ytmusic.search(query, filter="songs", limit=5)
        
        if not results:
            # Fallback to simpler search
            query = f"{title} {artist}"
            results = ytmusic.search(query, filter="songs", limit=5)
        
        if not results:
            # Last resort: title only
            results = ytmusic.search(title, filter="songs", limit=5)
        
        # Try to match by duration if we have it
        if duration_sec and results:
            for r in results:
                if r.get('duration_seconds'):
                    if abs(r['duration_seconds'] - duration_sec) <= 8:
                        video_id = r['videoId']
                        # Use www.youtube.com instead of music.youtube.com (sometimes less restricted)
                        return f"https://www.youtube.com/watch?v={video_id}", "high"
        
        # Take first result if no duration match or no duration available
        if results:
            video_id = results[0]['videoId']
            confidence = "medium" if duration_sec else "low"
            return f"https://www.youtube.com/watch?v={video_id}", confidence
        
        # Fallback to regular YouTube search
        return f"ytsearch1:{artist} - {title}", "low"
        
    except Exception as e:
        print(f"ytmusicapi error: {e}", file=sys.stderr)
        # Fallback to yt-dlp search
        return f"ytsearch1:{artist} - {title}", "low"


def download_audio(yt_url: str, output_path: str) -> int:
    """Download from YouTube Music using yt-dlp"""
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Check for deno installation
    deno_path = None
    for p in ["/usr/local/bin/deno", "/root/.deno/bin/deno", "/app/bin/deno"]:
        if os.path.exists(p):
            deno_path = p
            break
    
    # Try to find yt-dlp with full path
    yt_dlp_path = "yt-dlp"
    if os.path.exists("/usr/local/bin/yt-dlp"):
        yt_dlp_path = "/usr/local/bin/yt-dlp"
    elif os.path.exists("/app/yt-dlp"):
        yt_dlp_path = "/app/yt-dlp"
    
    remote_components = os.environ.get("YTDLP_REMOTE_COMPONENTS", "ejs:github")

    cmd = [
        yt_dlp_path,
        yt_url,
        "--no-playlist",
        "--format", "bestaudio/best",
        "--extract-audio",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "--embed-thumbnail",
        "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "--add-header", "Accept-Language:en-US,en;q=0.9",
        "--add-header", "Referer:https://www.google.com/",
        "--no-check-certificates",
        "--geo-bypass",
        "--socket-timeout", "30",
        # Improved player clients for better bypass
        "--extractor-args", "youtube:player_client=android,web;ios:player_client=apple_tv",
        "--js-runtimes", "nodejs,deno",
        "--remote-components", remote_components,
        "--no-check-certificates",
        "--retries", "5",
        "--fragment-retries", "10",
        "--newline",
        "--progress",
        "--output", output_path
    ]
    
    # Use cookies if available in the app root
    cookies_path = "/app/cookies.txt"
    if os.path.exists(cookies_path):
        cmd.extend(["--cookies", cookies_path])
    elif os.path.exists("cookies.txt"):
        cmd.extend(["--cookies", "cookies.txt"])
    
    # Use proxy if available (REQUIRED for Render/deployed servers)
    proxy_url = os.environ.get("PROXY_URL")
    if proxy_url:
        cmd.extend(["--proxy", proxy_url])
        print(f"Using proxy: {proxy_url}", file=sys.stderr)
    
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    for line in process.stdout:
        # Emit all lines to stderr so Node.js can see them in case of failure
        print(line.strip(), file=sys.stderr)
        
        # Parse progress from yt-dlp output
        if "[download]" in line and "%" in line:
            match = re.search(r'(\d+\.?\d*)%', line)
            if match:
                percent = float(match.group(1))
                emit_progress("Downloading audio...", percent)
        
        # Check for destination file
        if "Destination:" in line:
            emit_progress("Download complete, converting...", 95)
    
    process.wait()
    return process.returncode


def tag_with_spotify_metadata(filepath: str, metadata: Dict[str, Any]):
    """Overwrite ID3 tags with correct Spotify metadata"""
    try:
        audio = MP3(filepath, ID3=ID3)
        
        if audio.tags is None:
            audio.add_tags()
        
        # Set standard ID3 tags
        audio.tags['TIT2'] = TIT2(encoding=3, text=metadata['title'])
        audio.tags['TPE1'] = TPE1(encoding=3, text=metadata['artist'])
        
        if metadata.get('album'):
            audio.tags['TALB'] = TALB(encoding=3, text=metadata['album'])
        
        # Embed album art from Spotify
        if metadata.get('artwork'):
            try:
                # Use proxy for artwork too
                proxy_url = os.environ.get("PROXY_URL")
                proxies = {"http": proxy_url, "https": proxy_url} if proxy_url else None
                
                artwork_data = requests.get(metadata['artwork'], timeout=10, proxies=proxies).content
                audio.tags['APIC'] = APIC(
                    encoding=3,
                    mime='image/jpeg',
                    type=3,
                    desc='Cover',
                    data=artwork_data
                )
            except Exception as e:
                print(f"Warning: Could not download artwork: {e}", file=sys.stderr)
        
        audio.save()
        print(f"Tagged: {filepath}", file=sys.stderr)
        
    except Exception as e:
        print(f"Tagging warning: {e}", file=sys.stderr)


def main():
    if len(sys.argv) != 3:
        print(json.dumps({
            "status": "error",
            "message": "Usage: python spotify_bridge.py <spotify_url> <output_dir>"
        }), flush=True)
        sys.exit(1)
    
    spotify_url = sys.argv[1]
    output_dir = sys.argv[2]
    
    # Step 1: Fetch track info from Spotify
    emit_progress("Fetching track info...", 0)
    try:
        metadata = get_spotify_metadata(spotify_url)
    except Exception as e:
        emit_progress("Error fetching metadata", 0, status="error", message=str(e))
        sys.exit(1)
    
    emit_progress(f"Found: {metadata['artist']} - {metadata['title']}", 5)
    
    # Step 2: Search YouTube Music
    emit_progress("Searching YouTube Music...", 10)
    yt_url, confidence = find_youtube_music_url(
        metadata['artist'],
        metadata['title'],
        metadata.get('duration')
    )
    
    emit_progress(f"Found on YouTube Music (confidence: {confidence})", 15)
    
    # Step 3: Prepare output path
    # Sanitize filename
    safe_artist = re.sub(r'[<>:"/\\|?*]', '', metadata['artist'])
    safe_title = re.sub(r'[<>:"/\\|?*]', '', metadata['title'])
    filename = f"{safe_artist} - {safe_title}.%(ext)s"
    output_path = os.path.join(output_dir, filename)
    
    # Step 4: Download audio
    emit_progress("Downloading audio...", 20)
    exit_code = download_audio(yt_url, output_path)
    
    if exit_code != 0:
        emit_progress("Download failed", 0, status="error", message="yt-dlp failed")
        sys.exit(1)
    
    # Step 5: Find the actual downloaded file and tag it
    emit_progress("Embedding metadata...", 95)
    
    # Find the downloaded file (yt-dlp creates the file with actual extension)
    base_path = os.path.join(output_dir, f"{safe_artist} - {safe_title}")
    downloaded_file = None
    for ext in ['.mp3', '.m4a', '.flac', '.ogg', '.wav']:
        potential = base_path + ext
        if os.path.exists(potential):
            downloaded_file = potential
            break
    
    if downloaded_file:
        tag_with_spotify_metadata(downloaded_file, metadata)
        emit_progress("Done!", 100, status="complete", filepath=downloaded_file)
    else:
        # Try to find any new file in the output directory
        try:
            files = [f for f in os.listdir(output_dir) if f.startswith(safe_artist)]
            if files:
                downloaded_file = os.path.join(output_dir, files[0])
                tag_with_spotify_metadata(downloaded_file, metadata)
                emit_progress("Done!", 100, status="complete", filepath=downloaded_file)
            else:
                emit_progress("Done! (file tagging skipped - file not found)", 100, status="complete")
        except Exception as e:
            emit_progress(f"Done! (tagging skipped: {e})", 100, status="complete")


if __name__ == "__main__":
    main()
