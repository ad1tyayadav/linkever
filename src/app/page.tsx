"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Download, Video, Music, Image as ImageIcon, FileDown, AlertTriangle, Lightbulb } from "lucide-react";
import axios from "axios";

import { Header } from "@/components/Header";
import { UrlInput } from "@/components/UrlInput";
import { PlatformDetector } from "@/components/PlatformDetector";
import { MetadataPreview } from "@/components/MetadataPreview";
import { FormatSelector } from "@/components/FormatSelector";
import { PlatformMarquee } from "@/components/PlatformMarquee";
import { TrustBadges } from "@/components/TrustBadges";
import { ProgressCard } from "@/components/ProgressCard";
import { DownloadResult } from "@/components/DownloadResult";
import { Footer } from "@/components/Footer";
import { PlatformTyping } from "@/components/PlatformTyping";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, Github } from "lucide-react";
import { detectPlatform, isSpotifyUrl } from "@/lib/platforms";
import { useMetadata, useDownload } from "@/hooks/useDownload";
import { useProgress } from "@/hooks/useProgress";
import { triggerBrowserDownload } from "@/lib/utils";
import type { PlatformInfo, MediaMetadata, FormatOption, DoneEvent, MetadataResponse } from "@/types";

function getCtaLabel(type?: string, platformId?: string, isSpotify?: boolean): { icon: React.ReactNode; label: string; showIcon: boolean } {
    if (isSpotify) return { icon: <Music className="h-4 w-4" />, label: "Download Audio", showIcon: true };

    const knownPlatforms = ['youtube', 'instagram', 'tiktok', 'twitter', 'facebook', 'reddit', 'vimeo', 'soundcloud', 'pinterest', 'twitch', 'dailymotion', 'bandcamp', 'mixcloud'];
    const isKnownPlatform = platformId && knownPlatforms.includes(platformId);

    if (!isKnownPlatform) {
        return { icon: null, label: "Download", showIcon: false };
    }

    switch (type) {
        case "audio":
            return { icon: <Music className="h-4 w-4" />, label: "Download Audio", showIcon: true };
        case "image":
            return { icon: <ImageIcon className="h-4 w-4" />, label: "Download Image", showIcon: true };
        case "file":
            return { icon: <FileDown className="h-4 w-4" />, label: "Download File", showIcon: true };
        default:
            return { icon: <Video className="h-4 w-4" />, label: "Download Video", showIcon: true };
    }
}

function extractApiError(error: unknown): { message: string; suggestion?: string } {
    if (axios.isAxiosError(error) && error.response?.data) {
        const data = error.response.data as { message?: string; suggestion?: string };
        return {
            message: data.message || "Something went wrong. Please try again.",
            suggestion: data.suggestion,
        };
    }
    if (error instanceof Error) {
        return { message: error.message };
    }
    return { message: "Something went wrong. Please try again." };
}



export default function HomePage() {
    const [platform, setPlatform] = useState<PlatformInfo | null>(null);
    const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
    const [formats, setFormats] = useState<FormatOption[]>([]);
    const [selectedFormat, setSelectedFormat] = useState<FormatOption | null>(null);
    const [url, setUrl] = useState("");
    const [formatSelectorDisabled, setFormatSelectorDisabled] = useState(true);

    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [jobTitle, setJobTitle] = useState<string>("");
    const autoDownloadTriggered = useRef(false);

    const metadataMutation = useMetadata();
    const downloadMutation = useDownload();

    const { progress, isDone, doneData, error: progressError } = useProgress({
        jobId: activeJobId,
    });

    useEffect(() => {
        if (isDone && doneData && !autoDownloadTriggered.current) {
            autoDownloadTriggered.current = true;
            triggerBrowserDownload(doneData.downloadUrl, doneData.filename);
        }
    }, [isDone, doneData]);

    const handleUrlSubmit = useCallback(
        (inputUrl: string) => {
            setUrl(inputUrl);
            const detected = detectPlatform(inputUrl);
            setPlatform(detected);
            setMetadata(null);
            setSelectedFormat(null);
            setFormatSelectorDisabled(true);
            setActiveJobId(null);
            setJobTitle("");
            autoDownloadTriggered.current = false;

            metadataMutation.mutate(inputUrl, {
                onSuccess: (data: MetadataResponse) => {
                    setMetadata(data);
                    setFormats(data.formats || []);

                    // Only show quality selector for YouTube and Spotify
                    const isYouTubeOrSpotify = detected.id === 'youtube' || isSpotifyUrl(inputUrl);
                    const hasFormats = data.formats && data.formats.length > 0;

                    if (isYouTubeOrSpotify && hasFormats) {
                        // Auto-select best quality for YouTube/Spotify
                        const defaultFormat = data.formats.find(f => f.isDefault) || data.formats[0];
                        setSelectedFormat(defaultFormat);
                        setFormatSelectorDisabled(false);
                    } else {
                        setSelectedFormat(null);
                        setFormatSelectorDisabled(true);
                    }
                },
            });
        },
        [metadataMutation]
    );

    const handleDownload = useCallback(() => {
        downloadMutation.mutate(
            {
                url,
                format: selectedFormat?.format,
                quality: selectedFormat?.quality,
                audioOnly: metadata?.type !== "file" && metadata?.type !== "image" && (isSpotifyUrl(url) || metadata?.type === "audio"),
            },
            {
                onSuccess: (data) => {
                    setActiveJobId(data.jobId);
                    setJobTitle(data.title || metadata?.title || "Downloading...");
                    autoDownloadTriggered.current = false;
                },
            }
        );
    }, [url, selectedFormat, metadata, downloadMutation]);

    const handleFormatSelect = useCallback((format: FormatOption) => {
        setSelectedFormat(format);
    }, []);

    // Removed handleStartDownload - Download button shows immediately now

    const handleNewDownload = useCallback(() => {
        setActiveJobId(null);
        setJobTitle("");
        setPlatform(null);
        setMetadata(null);
        setFormats([]);
        setSelectedFormat(null);
        setFormatSelectorDisabled(true);
        setUrl("");
        autoDownloadTriggered.current = false;
    }, []);

    const isSpotify = url ? isSpotifyUrl(url) : false;
    const cta = getCtaLabel(metadata?.type, platform?.id, isSpotify);
    const showFormat = !!metadata && !activeJobId;
    const showCta = !!metadata && !activeJobId;
    const isDownloading = !!activeJobId;

    const errorInfo = metadataMutation.isError ? extractApiError(metadataMutation.error) : null;

    return (
        <div className="flex min-h-screen flex-col">
            <Header />

            <main className="flex flex-1 flex-col items-center justify-center px-4 pt-32 pb-20 relative overflow-hidden">
                {/* Gradient Background */}
                <div className="absolute inset-0 -z-10 opacity-60" aria-hidden="true">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-500/20 via-transparent to-transparent" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-pink-500/15 via-transparent to-transparent" />
                </div>
                <div className="w-full max-w-2xl space-y-12">
                    {/* Hero Section */}
                    <div className="text-center space-y-8">
                        {/* Pill Badge */}
                        <div className="flex justify-center">
                            <div className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] border border-[var(--border)] hover:border-[var(--foreground)]/30 transition-colors cursor-default">
                                <span className="text-[13px]">Introducing LinkEver</span>
                            </div>
                        </div>

                        {/* Title & Subtitle */}
                        <div className="space-y-6">
                            <h1 className="text-5xl md:text-5xl font-bold tracking-tight text-[var(--foreground)] leading-[1.1]">
                                Paste link and download media from <PlatformTyping />
                            </h1>
                            <p className="text-lg text-[var(--muted-foreground)] max-w-xl mx-auto leading-relaxed">
                                LinkEver is the simplest way to save your favorite videos, music, and images from <span className="font-semibold text-[var(--foreground)]">YouTube</span>, <span className="font-semibold text-[var(--foreground)]">Spotify</span>, <span className="font-semibold text-[var(--foreground)]">Instagram</span>, <span className="font-semibold text-[var(--foreground)]">TikTok</span>, and <span className="font-semibold text-[var(--foreground)]">100+ platforms</span>. High quality, no limits, and completely free.
                            </p>
                        </div>


                    </div>

                    {/* URL Input */}
                    <UrlInput
                        onUrlSubmit={handleUrlSubmit}
                        isLoading={metadataMutation.isPending}
                        disabled={metadataMutation.isPending}
                    />

                    {/* Platform Detection */}
                    {platform && (
                        <div className="space-y-4">
                            <PlatformDetector platform={platform} url={url} />
                        </div>
                    )}

                    {/* Error Display */}
                    {errorInfo && !metadataMutation.isPending && (
                        <div className="w-full max-w-xl mx-auto">
                            <Card className="border-[var(--border)]">
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="h-4 w-4 text-[var(--foreground)] mt-0.5" />
                                        <div className="space-y-1 min-w-0">
                                            <p className="text-sm text-[var(--foreground)]">
                                                {errorInfo.message}
                                            </p>
                                            {errorInfo.suggestion && (
                                                <div className="flex items-start gap-2 text-xs text-[var(--muted)]">
                                                    <Lightbulb className="h-3 w-3 shrink-0 mt-0.5" />
                                                    <span>{errorInfo.suggestion}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Metadata Preview */}
                    <MetadataPreview
                        metadata={metadata}
                        isLoading={metadataMutation.isPending}
                    />

                    {/* Format Selector */}
                    {showFormat && metadata && (
                        <FormatSelector
                            formats={formats}
                            mediaType={metadata.type}
                            selectedId={selectedFormat?.id}
                            onSelect={handleFormatSelect}
                            disabled={formatSelectorDisabled}
                        />
                    )}

                    {/* Download Button - shows immediately after metadata loads */}
                    {showCta && (
                        <div className="flex justify-center">
                            <Button
                                size="lg"
                                onClick={handleDownload}
                                disabled={downloadMutation.isPending}
                                className="gap-2 bg-[var(--foreground)] text-[var(--background)] hover:bg-[var(--foreground)]/90 min-w-[180px]"
                            >
                                {downloadMutation.isPending ? (
                                    <Download className="h-4 w-4 animate-pulse" />
                                ) : cta.showIcon ? (
                                    cta.icon
                                ) : (
                                    <Download className="h-4 w-4" />
                                )}
                                {downloadMutation.isPending ? "Starting..." : cta.label}
                            </Button>
                        </div>
                    )}

                    {/* Download Progress */}
                    {isDownloading && (
                        <div className="space-y-4">
                            {isDone && doneData ? (
                                <DownloadResult data={doneData} metadata={metadata} onNewDownload={handleNewDownload} />
                            ) : (
                                <ProgressCard progress={progress} error={progressError} />
                            )}
                        </div>
                    )}

                    {/* Platform Marquee */}
                    {!platform && !isDownloading && (
                        <div className="bg-[var(--surface)] rounded-2xl">
                            <PlatformMarquee />
                        </div>
                    )}

                    {/* Trust Badges */}
                    {!isDownloading && <TrustBadges />}
                </div>
            </main>

            <Footer />
        </div>
    );
}
