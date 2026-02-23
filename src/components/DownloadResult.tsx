"use client";

import { CheckCircle2, Download, Clock, FileDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FILE_TTL_MINUTES } from "@/lib/constants";
import type { DoneEvent, MediaMetadata } from "@/types";

interface DownloadResultProps {
    data: DoneEvent;
    metadata?: MediaMetadata | null;
    onNewDownload?: () => void;
}

function downloadFile(url: string, filename: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 1000);
}

export function DownloadResult({ data, metadata, onNewDownload }: DownloadResultProps) {
    return (
        <div className="w-full max-w-xl mx-auto">
            <Card className="border-[var(--border)] overflow-hidden">
                <CardContent className="p-0">
                    {/* Media info section */}
                    <div className="flex items-start gap-3 p-4 pb-3">
                        {/* Thumbnail */}
                        {metadata?.thumbnail ? (
                            <div className="relative w-14 h-14 shrink-0 rounded-[var(--radius-sm)] overflow-hidden bg-[var(--surface)]">
                                <img
                                    src={metadata.thumbnail}
                                    alt=""
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)]">
                                <CheckCircle2 className="h-5 w-5 text-[var(--background)]" />
                            </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium leading-snug line-clamp-2 mb-1">
                                {metadata?.title || data.filename}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
                                {metadata?.author && metadata.author !== "Unknown" && (
                                    <span>{metadata.author}</span>
                                )}
                                <span className="flex items-center gap-1">
                                    <FileDown className="h-3 w-3" />
                                    {data.size}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 px-4 pb-4 pt-1">
                        <Button
                            size="sm"
                            className="gap-2 flex-1 bg-[var(--foreground)] text-[var(--background)] hover:bg-[var(--foreground)]/90"
                            onClick={() => downloadFile(data.downloadUrl, data.filename)}
                        >
                            <Download className="h-3.5 w-3.5" />
                            Download Again
                        </Button>

                        {onNewDownload && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 flex-1"
                                onClick={onNewDownload}
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                New Download
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
