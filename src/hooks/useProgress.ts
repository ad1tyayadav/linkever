"use client";

import { useEffect, useRef, useState } from "react";
import type { ProgressEvent, DoneEvent, ErrorEvent, SSEEvent } from "@/types";

interface UseProgressOptions {
    jobId: string | null;
    onDone?: (data: DoneEvent) => void;
    onError?: (data: ErrorEvent) => void;
}

export function useProgress({ jobId, onDone, onError }: UseProgressOptions) {
    const [progress, setProgress] = useState<ProgressEvent | null>(null);
    const [isDone, setIsDone] = useState(false);
    const [doneData, setDoneData] = useState<DoneEvent | null>(null);
    const [error, setError] = useState<ErrorEvent | null>(null);

    // Track terminal state to prevent reconnection
    const terminalRef = useRef(false);
    const sourceRef = useRef<EventSource | null>(null);
    const onDoneRef = useRef(onDone);
    const onErrorRef = useRef(onError);

    // Keep callback refs up to date without triggering re-effects
    onDoneRef.current = onDone;
    onErrorRef.current = onError;

    useEffect(() => {
        if (!jobId) {
            setProgress(null);
            setIsDone(false);
            setDoneData(null);
            setError(null);
            terminalRef.current = false;
            return;
        }

        setProgress(null);
        setIsDone(false);
        setDoneData(null);
        setError(null);

        // Reset terminal flag on new jobId
        terminalRef.current = false;

        const url = `/api/progress/${jobId}`;
        const source = new EventSource(url);
        sourceRef.current = source;

        source.onmessage = (event) => {
            if (terminalRef.current) return;

            try {
                const data: SSEEvent = JSON.parse(event.data);

                if (data.status === "done") {
                    terminalRef.current = true;
                    const done = data as DoneEvent;
                    setDoneData(done);
                    setIsDone(true);
                    onDoneRef.current?.(done);
                    source.close();
                    sourceRef.current = null;
                } else if (data.status === "error") {
                    terminalRef.current = true;
                    const err = data as ErrorEvent;
                    setError(err);
                    onErrorRef.current?.(err);
                    source.close();
                    sourceRef.current = null;
                } else {
                    setProgress(data as ProgressEvent);
                }
            } catch {
                // Ignore malformed messages
            }
        };

        // Prevent auto-reconnect: close immediately on error
        source.onerror = () => {
            source.close();
            sourceRef.current = null;

            // If we haven't received a terminal event, treat connection loss as error
            if (!terminalRef.current) {
                terminalRef.current = true;
                setError({
                    status: "error",
                    error: "CONNECTION_LOST",
                    message: "Connection to server lost.",
                    suggestion: "Please try again.",
                });
            }
        };

        return () => {
            source.close();
            sourceRef.current = null;
        };
    }, [jobId]); // Only depend on jobId — callbacks use refs

    const disconnect = () => {
        terminalRef.current = true;
        sourceRef.current?.close();
        sourceRef.current = null;
    };

    return { progress, isDone, doneData, error, disconnect };
}
