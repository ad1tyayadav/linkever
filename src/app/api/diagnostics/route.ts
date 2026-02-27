import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "child_process";
import fs from "fs";

function getConfiguredCmd(envKey: string, fallback: string): string {
    const raw = (process.env[envKey] || "").trim();
    return raw || fallback;
}

function runVersion(cmd: string, args: string[]): { ok: boolean; cmd: string; output?: string; error?: string } {
    try {
        const res = spawnSync(cmd, args, { encoding: "utf8" });
        if (res.error) {
            return { ok: false, cmd, error: res.error.message };
        }
        const out = `${res.stdout || ""}${res.stderr || ""}`.trim();
        const firstLine = out.split(/\r?\n/)[0] || "";
        return res.status === 0 ? { ok: true, cmd, output: firstLine } : { ok: false, cmd, output: firstLine };
    } catch (e) {
        return { ok: false, cmd, error: e instanceof Error ? e.message : String(e) };
    }
}

function redactProxy(proxyUrl: string): string {
    try {
        const u = new URL(proxyUrl);
        const auth = u.username || u.password ? "[redacted]@" : "";
        return `${u.protocol}//${auth}${u.host}`;
    } catch {
        return "[invalid]";
    }
}

export async function GET(req: NextRequest) {
    const expected = (process.env.DIAGNOSTICS_TOKEN || "").trim();
    const provided = (req.nextUrl.searchParams.get("token") || req.headers.get("x-diagnostics-token") || "").trim();

    // Hide this endpoint unless explicitly enabled with a token.
    if (!expected || !provided || provided !== expected) {
        return new NextResponse("Not Found", { status: 404 });
    }

    const pythonCmd = getConfiguredCmd("PYTHON_PATH", process.platform === "win32" ? "py" : "python3");
    const ytdlpCmd = getConfiguredCmd("YTDLP_PATH", "yt-dlp");
    const ffmpegCmd = getConfiguredCmd("FFMPEG_PATH", "ffmpeg");

    const proxyUrl = (process.env.PROXY_URL || "").trim();
    const proxyDisabled = (process.env.YTDLP_DISABLE_PROXY || "").trim().toLowerCase();
    const cookiesPath = (process.env.YTDLP_COOKIES_PATH || "").trim();
    const cookiesB64 = (process.env.YTDLP_COOKIES_B64 || "").trim();
    const cookiesDisabled = (process.env.YTDLP_DISABLE_COOKIES || "").trim().toLowerCase();

    return NextResponse.json({
        ok: true,
        platform: process.platform,
        binaries: {
            python: runVersion(pythonCmd, ["--version"]),
            ytdlp: runVersion(ytdlpCmd, ["--version"]),
            ffmpeg: runVersion(ffmpegCmd, ["-version"]),
        },
        ytdlp: {
            proxyConfigured: Boolean(proxyUrl),
            proxy: proxyUrl ? redactProxy(proxyUrl) : null,
            proxyDisabled: proxyDisabled === "1" || proxyDisabled === "true" || proxyDisabled === "yes",
            cookiesDisabled: cookiesDisabled === "1" || cookiesDisabled === "true" || cookiesDisabled === "yes",
            cookiesPathConfigured: Boolean(cookiesPath),
            cookiesPathExists: cookiesPath ? fs.existsSync(cookiesPath) : false,
            cookiesB64Configured: Boolean(cookiesB64),
        },
    });
}
