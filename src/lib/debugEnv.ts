import { execSync } from "child_process";

const BINARIES = [
    { name: "Python", cmd: process.env.PYTHON_PATH || "python3", args: "--version" },
    { name: "yt-dlp", cmd: process.env.YTDLP_PATH || "yt-dlp", args: "--version" },
    { name: "FFmpeg", cmd: process.env.FFMPEG_PATH || "ffmpeg", args: "-version" },
];

console.log("=== LinkEver Environment Debug ===");
BINARIES.forEach(bin => {
    try {
        const output = execSync(`${bin.cmd} ${bin.args}`, { stdio: "pipe" });
        console.log(`✅ ${bin.name}: Found at "${bin.cmd}"`);
        console.log(`   Output: ${output.toString().split("\n")[0]}`);
    } catch (err: any) {
        console.log(`❌ ${bin.name}: Not found at "${bin.cmd}"`);
        console.log(`   Error: ${err.message}`);
    }
});
console.log("==================================");
