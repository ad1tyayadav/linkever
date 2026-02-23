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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, Github } from "lucide-react";
import { detectPlatform, isSpotifyUrl } from "@/lib/platforms";
import { useMetadata, useDownload } from "@/hooks/useDownload";
import { useProgress } from "@/hooks/useProgress";
import { useAppStore } from "@/lib/store";
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
    const { addHistoryEntry } = useAppStore();

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
        onDone: (data: DoneEvent) => {
            addHistoryEntry({
                jobId: activeJobId!,
                url,
                platform: platform?.id || "unknown",
                title: jobTitle || metadata?.title || "Download",
                type: metadata?.type || "video",
                status: "completed",
                filename: data.filename,
                size: data.size,
                downloadedAt: new Date().toISOString(),
            });
        },
        onError: () => {
            addHistoryEntry({
                jobId: activeJobId!,
                url,
                platform: platform?.id || "unknown",
                title: jobTitle || metadata?.title || "Download",
                type: metadata?.type || "video",
                status: "failed",
                downloadedAt: new Date().toISOString(),
            });
        },
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
                    setSelectedFormat(null);
                    setFormatSelectorDisabled(true);
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

    const handleStartDownload = useCallback(() => {
        setFormatSelectorDisabled(false);
    }, []);

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

            <main className="flex flex-1 flex-col items-center justify-center px-4 pt-32 pb-20">
                <div className="w-full max-w-2xl space-y-12">
                    {/* Hero Section */}
                    <div className="text-center space-y-8">
                        {/* Pill Badge */}
                        <div className="flex justify-center">
                            <div className="flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 bg-white text-[13px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors cursor-default">
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-linear-to-tr from-pink-500 via-purple-500 to-blue-500 p-0.5">
                                    <span className="w-full h-full rounded-full bg-white flex items-center justify-center text-[10px]">✨</span>
                                </span>
                                <span>Introducing LinkEver</span>
                                <ChevronRight className="h-3 w-3 text-[var(--muted)]" />
                            </div>
                        </div>

                        {/* Title & Subtitle */}
                        <div className="space-y-6">
                            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-black leading-[1.1]">
                                Download media<br />
                                from anywhere in <span className="italic font-normal">record</span> time
                            </h1>
                            <p className="text-lg text-[var(--muted)] max-w-xl mx-auto leading-relaxed">
                                LinkEver is the simplest way to save your favorite videos, music, and images from <span className="font-semibold text-[var(--foreground)]">YouTube</span>, <span className="font-semibold text-[var(--foreground)]">Spotify</span>, <span className="font-semibold text-[var(--foreground)]">Instagram</span>, <span className="font-semibold text-[var(--foreground)]">TikTok</span>, and <span className="font-semibold text-[var(--foreground)]">100+ platforms</span>. High quality, no limits, and completely free.
                            </p>
                        </div>

                        {/* Hero CTAs */}
                        {!metadata && !isDownloading && (
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <Button
                                    className="h-12 px-8 rounded-xl bg-black text-white hover:bg-black/90 text-base font-medium shadow-xl shadow-black/10 transition-all hover:-translate-y-0.5"
                                    onClick={() => document.querySelector('input')?.focus()}
                                >
                                    Start Downloading
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-12 px-8 rounded-xl border-[var(--border)] bg-white text-black hover:bg-[var(--surface-hover)] text-base font-medium transition-all"
                                    onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                                >
                                    Supported Platforms
                                    <ChevronRight className="h-4 w-4 ml-1 opacity-50" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* URL Input */}
                    <UrlInput
                        onUrlSubmit={handleUrlSubmit}
                        isLoading={metadataMutation.isPending}
                        disabled={isDownloading}
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

                    {/* CTA Button */}
                    {showCta && (
                        <div className="flex flex-col gap-3">
                            {!formatSelectorDisabled ? (
                                <div className="flex justify-center gap-2">
                                    <Button
                                        size="lg"
                                        onClick={handleDownload}
                                        disabled={downloadMutation.isPending}
                                        className="gap-2 bg-[var(--foreground)] text-[var(--background)] hover:bg-[var(--foreground)]/90"
                                    >
                                        {downloadMutation.isPending ? (
                                            <Download className="h-4 w-4" />
                                        ) : cta.showIcon ? (
                                            cta.icon
                                        ) : null}
                                        {downloadMutation.isPending ? "Starting..." : cta.label}
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex justify-center">
                                    <Button
                                        size="lg"
                                        onClick={handleStartDownload}
                                        className="bg-[var(--foreground)] text-[var(--background)] hover:bg-[var(--foreground)]/90"
                                    >
                                        Continue
                                    </Button>
                                </div>
                            )}
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
                    {!platform && !isDownloading && <PlatformMarquee />}

                    {/* Trust Badges */}
                    {!isDownloading && <TrustBadges />}
                </div>
            </main>

            <Footer />
        </div>
    );
}
