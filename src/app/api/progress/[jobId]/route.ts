import { NextRequest } from "next/server";
import { getJob, subscribe } from "@/lib/jobManager";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    const { jobId } = await params;
    const job = getJob(jobId);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            const send = (data: string) => {
                try {
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                } catch {
                    // Controller closed
                }
            };

            // If job already completed or errored, send the final state immediately
            if (job?.status === "done" && job.filepath) {
                send(JSON.stringify({
                    status: "done",
                    downloadUrl: `/api/file/${jobId}`,
                    filename: job.filename || "download",
                    size: job.filesize ? formatSize(job.filesize) : "Unknown",
                }));
                controller.close();
                return;
            }

            if (job?.status === "error") {
                send(JSON.stringify({
                    status: "error",
                    error: "DOWNLOAD_FAILED",
                    message: job.error || "Download failed",
                    suggestion: "Try a different URL or check if the content is publicly accessible.",
                }));
                controller.close();
                return;
            }

            // Subscribe to real-time updates from the job manager
            const unsubscribe = subscribe(jobId, (data) => {
                send(data);

                // Close stream on terminal states
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.status === "done" || parsed.status === "error") {
                        setTimeout(() => {
                            try {
                                controller.close();
                            } catch {
                                // Already closed
                            }
                        }, 100);
                        unsubscribe();
                    }
                } catch {
                    // Ignore parse errors
                }
            });

            // If no job exists, send an error after a brief wait
            if (!job) {
                setTimeout(() => {
                    send(JSON.stringify({
                        status: "error",
                        error: "JOB_NOT_FOUND",
                        message: "Download job not found. It may have expired.",
                        suggestion: "Please start a new download.",
                    }));
                    try { controller.close(); } catch { /* noop */ }
                    unsubscribe();
                }, 500);
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}

function formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
