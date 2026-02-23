import { formatBytes } from "@/lib/utils";
import type { DownloadProgress } from "@/lib/ytdlp";
import type { Platform, MediaType, JobStatus } from "@/types";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Job {
    id: string;
    url: string;
    platform: Platform;
    type: MediaType;
    title: string;
    status: JobStatus;
    progress: DownloadProgress | null;
    filepath: string | null;
    filename: string | null;
    filesize: number | null;
    error: string | null;
    createdAt: number;
    updatedAt: number;
    ip: string;
}

type Subscriber = (data: string) => void;

// ─── Global Singleton Store ─────────────────────────────────────────────────
// In Next.js dev mode, modules can be re-evaluated on hot reload.
// Using globalThis ensures the store persists across re-evaluations.

interface LinkEverStore {
    jobs: Map<string, Job>;
    ipRequests: Map<string, number[]>;
    subscribers: Map<string, Set<Subscriber>>;
    cleanupStarted: boolean;
}

const GLOBAL_KEY = "__linkever_store__" as const;

function getStore(): LinkEverStore {
    const g = globalThis as unknown as Record<string, LinkEverStore>;
    if (!g[GLOBAL_KEY]) {
        g[GLOBAL_KEY] = {
            jobs: new Map(),
            ipRequests: new Map(),
            subscribers: new Map(),
            cleanupStarted: false,
        };
    }
    return g[GLOBAL_KEY];
}

const MAX_JOBS_PER_HOUR = parseInt(process.env.MAX_JOBS_PER_HOUR || "15", 10);
const FILE_TTL_MS = parseInt(process.env.FILE_TTL_MINUTES || "10", 10) * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60_000;

// ─── Job CRUD ───────────────────────────────────────────────────────────────

export function createJob(
    id: string,
    url: string,
    platform: Platform,
    type: MediaType,
    title: string,
    ip: string
): Job {
    const store = getStore();
    const now = Date.now();
    const job: Job = {
        id,
        url,
        platform,
        type,
        title,
        status: "queued",
        progress: null,
        filepath: null,
        filename: null,
        filesize: null,
        error: null,
        createdAt: now,
        updatedAt: now,
        ip,
    };
    store.jobs.set(id, job);
    return job;
}

export function getJob(id: string): Job | undefined {
    return getStore().jobs.get(id);
}

export function updateJobProgress(id: string, progress: DownloadProgress) {
    const job = getStore().jobs.get(id);
    if (!job) return;

    job.progress = progress;
    job.status = progress.status === "done" ? "done" : progress.status;
    job.updatedAt = Date.now();

    if (progress.filename) job.filename = progress.filename;
    if (progress.filesize) job.filesize = progress.filesize;
}

export function completeJob(id: string, filepath: string, filename: string, filesize: number) {
    const job = getStore().jobs.get(id);
    if (!job) return;

    job.status = "done";
    job.filepath = filepath;
    job.filename = filename;
    job.filesize = filesize;
    job.updatedAt = Date.now();
    job.progress = {
        status: "done",
        percent: 100,
        speed: "",
        eta: "",
        step: "Complete!",
        filename,
        filesize,
    };
}

export function failJob(id: string, error: string) {
    const job = getStore().jobs.get(id);
    if (!job) return;

    job.status = "error";
    job.error = error;
    job.updatedAt = Date.now();
    // Also set progress so SSE subscribers get the error
    job.progress = {
        status: "error",
        percent: 0,
        speed: "",
        eta: "",
        step: error,
    };
}

// ─── Rate Limiting ──────────────────────────────────────────────────────────

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
    const store = getStore();
    const now = Date.now();
    const hourAgo = now - 3_600_000;

    const timestamps = (store.ipRequests.get(ip) || []).filter((t) => t > hourAgo);
    store.ipRequests.set(ip, timestamps);

    const remaining = MAX_JOBS_PER_HOUR - timestamps.length;
    return { allowed: remaining > 0, remaining: Math.max(0, remaining) };
}

export function recordRequest(ip: string) {
    const store = getStore();
    const timestamps = store.ipRequests.get(ip) || [];
    timestamps.push(Date.now());
    store.ipRequests.set(ip, timestamps);
}

// ─── Subscribers (for SSE) ──────────────────────────────────────────────────

export function subscribe(jobId: string, callback: Subscriber): () => void {
    const store = getStore();
    if (!store.subscribers.has(jobId)) {
        store.subscribers.set(jobId, new Set());
    }
    store.subscribers.get(jobId)!.add(callback);

    // Send current state immediately (including error/done)
    const job = store.jobs.get(jobId);
    if (job) {
        if (job.status === "done" && job.filepath) {
            callback(JSON.stringify({
                status: "done",
                downloadUrl: `/api/file/${jobId}`,
                filename: job.filename || "download",
                size: job.filesize ? formatBytes(job.filesize) : "Unknown",
            }));
        } else if (job.status === "error") {
            callback(JSON.stringify({
                status: "error",
                error: "DOWNLOAD_FAILED",
                message: job.error || "Download failed",
                suggestion: "Try a different URL or check if the content is publicly accessible.",
            }));
        } else if (job.progress) {
            callback(JSON.stringify(job.progress));
        }
    }

    // Return unsubscribe function
    return () => {
        store.subscribers.get(jobId)?.delete(callback);
        if (store.subscribers.get(jobId)?.size === 0) {
            store.subscribers.delete(jobId);
        }
    };
}

export function notifySubscribers(jobId: string, data: object) {
    const subs = getStore().subscribers.get(jobId);
    if (!subs) return;

    const payload = JSON.stringify(data);
    for (const cb of subs) {
        try {
            cb(payload);
        } catch {
            subs.delete(cb);
        }
    }
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

async function cleanup() {
    const store = getStore();
    const now = Date.now();
    const { unlink } = await import("fs/promises");

    for (const [id, job] of store.jobs) {
        if (now - job.createdAt > FILE_TTL_MS) {
            if (job.filepath) {
                try { await unlink(job.filepath); } catch { /* already deleted */ }
            }
            store.jobs.delete(id);
            store.subscribers.delete(id);
        }
    }

    const hourAgo = now - 3_600_000;
    for (const [ip, timestamps] of store.ipRequests) {
        const fresh = timestamps.filter((t) => t > hourAgo);
        if (fresh.length === 0) {
            store.ipRequests.delete(ip);
        } else {
            store.ipRequests.set(ip, fresh);
        }
    }
}

// Start cleanup interval once
const store = getStore();
if (!store.cleanupStarted) {
    store.cleanupStarted = true;
    setInterval(cleanup, CLEANUP_INTERVAL_MS);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getJobSummary(job: Job) {
    return {
        jobId: job.id,
        status: job.status,
        title: job.title,
        platform: job.platform,
        type: job.type,
        filename: job.filename,
        filesize: job.filesize ? formatBytes(job.filesize) : null,
        error: job.error,
    };
}
