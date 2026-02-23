import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobManager";
import { getFilePath, getFileInfo, createFileStream } from "@/lib/storage";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    const { jobId } = await params;
    const job = getJob(jobId);

    if (!job) {
        return NextResponse.json(
            { error: "JOB_NOT_FOUND", message: "Download job not found or expired." },
            { status: 404 }
        );
    }

    if (job.status !== "done" || !job.filepath) {
        return NextResponse.json(
            { error: "NOT_READY", message: "Download is not complete yet." },
            { status: 409 }
        );
    }

    // Check file still exists and hasn't expired
    const validPath = await getFilePath(job.filepath);
    if (!validPath) {
        return NextResponse.json(
            { error: "FILE_EXPIRED", message: "This file has expired. Please start a new download." },
            { status: 410 }
        );
    }

    try {
        const info = await getFileInfo(validPath);
        const stream = createFileStream(validPath);

        return new Response(stream, {
            headers: {
                "Content-Type": info.mimeType,
                "Content-Disposition": `attachment; filename="${encodeURIComponent(info.filename)}"`,
                "Content-Length": String(info.size),
                "Cache-Control": "private, max-age=600",
            },
        });
    } catch {
        return NextResponse.json(
            { error: "FILE_READ_ERROR", message: "Could not read the downloaded file." },
            { status: 500 }
        );
    }
}
