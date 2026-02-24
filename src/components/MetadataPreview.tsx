"use client";

import { Clock, User, ListMusic, Image as ImageIcon, FileDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration, formatBytes } from "@/lib/utils";
import type { MediaMetadata } from "@/types";

interface MetadataPreviewProps {
    metadata: MediaMetadata | null;
    isLoading?: boolean;
}

export function MetadataPreview({ metadata, isLoading }: MetadataPreviewProps) {
    if (isLoading) return <MetadataSkeleton />;
    if (!metadata) return null;

    return (
        <div className="w-full max-w-xl mx-auto">
            <Card className="overflow-hidden border-[var(--border)]">
                <CardContent className="p-0">
                    <div className="flex">
                        {/* Thumbnail */}
                        <div className="relative w-28 sm:w-32 shrink-0 aspect-video bg-[var(--surface)] overflow-hidden">
                            {metadata.thumbnail ? (
                                <img
                                    src={metadata.thumbnail}
                                    alt={metadata.title}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                    <ImageIcon className="h-6 w-6 text-[var(--muted-foreground)]" />
                                </div>
                            )}

                            {/* Duration badge */}
                            {metadata.duration > 0 && (
                                <div className="absolute bottom-1 right-1 rounded bg-[var(--foreground)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--background)]">
                                    {formatDuration(metadata.duration)}
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex flex-col justify-center gap-1.5 p-3 min-w-0 flex-1">
                            <h3 className="text-sm font-medium leading-snug line-clamp-2">
                                {metadata.title}
                            </h3>

                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted-foreground)]">
                                {metadata.author && (
                                    <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {metadata.author}
                                    </span>
                                )}
                                {metadata.duration > 0 && (
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatDuration(metadata.duration)}
                                    </span>
                                )}
                                {metadata.fileSize && metadata.fileSize > 0 && (
                                    <span className="flex items-center gap-1">
                                        <FileDown className="h-3 w-3" />
                                        {formatBytes(metadata.fileSize)}
                                    </span>
                                )}
                                {metadata.trackCount && metadata.trackCount > 1 && (
                                    <span className="flex items-center gap-1">
                                        <ListMusic className="h-3 w-3" />
                                        {metadata.trackCount} tracks
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function MetadataSkeleton() {
    return (
        <div className="w-full max-w-xl mx-auto">
            <Card className="overflow-hidden border-[var(--border)]">
                <CardContent className="p-0">
                    <div className="flex">
                        <Skeleton className="w-28 sm:w-32 shrink-0 aspect-video rounded-none" />
                        <div className="flex flex-col justify-center gap-2 p-3 flex-1">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
