"use client";

import { Loader2, Download, Zap, Tag, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PROGRESS_STEPS } from "@/lib/constants";
import type { ProgressEvent, ErrorEvent } from "@/types";

interface ProgressCardProps {
    progress: ProgressEvent | null;
    error?: ErrorEvent | null;
}

const STEP_ICONS: Record<string, React.ReactNode> = {
    queued: <Loader2 className="h-4 w-4 animate-spin" />,
    downloading: <Download className="h-4 w-4" />,
    converting: <Zap className="h-4 w-4" />,
    tagging: <Tag className="h-4 w-4" />,
    error: <AlertCircle className="h-4 w-4" />,
};

export function ProgressCard({ progress, error }: ProgressCardProps) {
    if (error) {
        return (
            <div className="w-full max-w-xl mx-auto">
                <Card className="border-[var(--border)]">
                    <CardContent className="flex items-start gap-3 p-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-[var(--background)]">
                            <AlertCircle className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-[var(--foreground)]">{error.message}</p>
                            {error.suggestion && (
                                <p className="mt-1 text-xs text-[var(--muted-foreground)]">{error.suggestion}</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!progress) return null;

    return (
        <div className="w-full max-w-xl mx-auto">
            <Card className="border-[var(--border)]">
                <CardContent className="p-4">
                    {/* Status row */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-[var(--background)]">
                                {STEP_ICONS[progress.status] || STEP_ICONS.downloading}
                            </div>
                            <div>
                                <p className="text-sm font-medium">
                                    {progress.step || PROGRESS_STEPS[progress.status]}
                                </p>
                            </div>
                        </div>

                        <div className="text-xs text-[var(--muted-foreground)] font-mono">
                            {progress.speed && <p>{progress.speed}</p>}
                        </div>
                    </div>

                    {/* Progress bar */}
                    <Progress value={progress.percent} className="h-1.5" />

                    {/* Percent */}
                    <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-[var(--muted-foreground)] font-mono">{Math.round(progress.percent)}%</p>
                        {progress.totalTracks && progress.totalTracks > 1 && (
                            <p className="text-xs text-[var(--muted-foreground)]">
                                Track {progress.currentTrack} of {progress.totalTracks}
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
