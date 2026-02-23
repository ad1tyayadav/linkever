"use client";

import { useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Header } from "@/components/Header";
import { ProgressCard } from "@/components/ProgressCard";
import { DownloadResult } from "@/components/DownloadResult";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useProgress } from "@/hooks/useProgress";
import { useAppStore } from "@/lib/store";
import { triggerBrowserDownload } from "@/lib/utils";

export default function DownloadPage() {
    const params = useParams();
    const router = useRouter();
    const jobId = params.jobId as string;
    const { activeJob, addHistoryEntry, reset } = useAppStore();
    const autoDownloadTriggered = useRef(false);

    const { progress, isDone, doneData, error } = useProgress({
        jobId,
        onDone: (data) => {
            if (activeJob) {
                addHistoryEntry({
                    jobId,
                    url: activeJob.url,
                    platform: activeJob.platform,
                    title: activeJob.title,
                    type: activeJob.type,
                    status: "completed",
                    filename: data.filename,
                    size: data.size,
                    downloadedAt: new Date().toISOString(),
                });
            }
        },
        onError: () => {
            if (activeJob) {
                addHistoryEntry({
                    jobId,
                    url: activeJob.url,
                    platform: activeJob.platform,
                    title: activeJob.title,
                    type: activeJob.type,
                    status: "failed",
                    downloadedAt: new Date().toISOString(),
                });
            }
        },
    });

    // Auto-trigger file download when done
    useEffect(() => {
        if (isDone && doneData && !autoDownloadTriggered.current) {
            autoDownloadTriggered.current = true;
            triggerBrowserDownload(doneData.downloadUrl, doneData.filename);
        }
    }, [isDone, doneData]);

    const handleNewDownload = useCallback(() => {
        reset();
        router.push("/");
    }, [reset, router]);

    // Determine title: from store or from progress step
    const title = activeJob?.title || progress?.step || "Loading media...";

    return (
        <div className="flex min-h-screen flex-col">
            <Header />

            <main className="flex flex-1 flex-col items-center justify-center px-6 pt-24 pb-12">
                <div className="w-full max-w-3xl space-y-6">
                    {/* Back link */}
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        New download
                    </Link>

                    {/* Job info — always shown */}
                    <div className="text-center">
                        <h2 className="text-xl font-semibold line-clamp-1">{title}</h2>
                        <p className="text-sm text-[var(--muted)] mt-1">
                            Job: <span className="font-mono text-xs">{jobId}</span>
                        </p>
                    </div>

                    {/* Content */}
                    {isDone && doneData ? (
                        <DownloadResult data={doneData} onNewDownload={handleNewDownload} />
                    ) : (
                        <ProgressCard progress={progress} error={error} />
                    )}

                    {/* Fallback: no active job and no data at all */}
                    {!activeJob && !progress && !isDone && !error && (
                        <div className="text-center py-12">
                            <p className="text-[var(--muted)] mb-4">
                                No active download. Start a new one!
                            </p>
                            <Button onClick={handleNewDownload}>Go Home</Button>
                        </div>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}
