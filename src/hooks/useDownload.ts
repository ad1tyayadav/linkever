"use client";

import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import type { DownloadRequest, DownloadResponse, MetadataResponse } from "@/types";

export function useDownload() {
    return useMutation({
        mutationFn: async (data: DownloadRequest): Promise<DownloadResponse> => {
            const res = await axios.post<DownloadResponse>("/api/download", data);
            return res.data;
        },
    });
}

export function useMetadata() {
    return useMutation({
        mutationFn: async (url: string): Promise<MetadataResponse> => {
            const res = await axios.get<MetadataResponse>("/api/metadata", {
                params: { url },
            });
            return res.data;
        },
    });
}
