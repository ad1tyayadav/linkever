import { z } from "zod";

export const downloadRequestSchema = z.object({
    url: z
        .string()
        .url("Please enter a valid URL")
        .min(1, "URL is required"),
    format: z.string().optional(),
    quality: z.string().optional(),
    audioOnly: z.boolean().optional().default(false),
    embedMetadata: z.boolean().optional().default(true),
    subtitles: z.boolean().optional().default(false),
});

export const urlSchema = z
    .string()
    .url("Please enter a valid URL")
    .min(1, "URL is required");

export type DownloadRequestInput = z.infer<typeof downloadRequestSchema>;
