"use client";

import { motion } from "framer-motion";
import { Trash2, ExternalLink, CheckCircle2, XCircle } from "lucide-react";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { getPlatformInfo } from "@/lib/platforms";

export default function HistoryPage() {
    const { history, clearHistory } = useAppStore();

    return (
        <div className="flex min-h-screen flex-col">
            <Header />

            <main className="flex-1 px-6 pt-24 pb-12">
                <div className="mx-auto max-w-3xl space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <motion.h1
                            className="text-2xl font-bold"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            Download History
                        </motion.h1>

                        {history.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearHistory}
                                className="text-[var(--muted)] hover:text-[var(--destructive)]"
                            >
                                <Trash2 className="h-4 w-4 mr-1.5" />
                                Clear
                            </Button>
                        )}
                    </div>

                    {/* Empty state */}
                    {history.length === 0 && (
                        <motion.div
                            className="text-center py-16"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            <p className="text-[var(--muted)] text-lg">No downloads yet</p>
                            <p className="text-sm text-[var(--muted)] mt-1">
                                Your download history will appear here
                            </p>
                        </motion.div>
                    )}

                    {/* History list */}
                    <motion.div
                        className="space-y-3"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        {history.map((entry, i) => {
                            const platformInfo = getPlatformInfo(entry.platform);
                            const date = new Date(entry.downloadedAt);

                            return (
                                <motion.div
                                    key={entry.jobId}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                >
                                    <Card>
                                        <CardContent className="flex items-center gap-4 p-4">
                                            {/* Platform dot */}
                                            <span
                                                className="h-3 w-3 shrink-0 rounded-full"
                                                style={{ backgroundColor: platformInfo.color }}
                                            />

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium line-clamp-1">{entry.title}</p>
                                                <p className="text-xs text-[var(--muted)] mt-0.5">
                                                    {platformInfo.name} · {date.toLocaleDateString()}{" "}
                                                    {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                    {entry.size && ` · ${entry.size}`}
                                                </p>
                                            </div>

                                            {/* Status */}
                                            <Badge
                                                variant={entry.status === "completed" ? "success" : "error"}
                                                className="shrink-0"
                                            >
                                                {entry.status === "completed" ? (
                                                    <CheckCircle2 className="h-3 w-3" />
                                                ) : (
                                                    <XCircle className="h-3 w-3" />
                                                )}
                                                {entry.status === "completed" ? "Done" : "Failed"}
                                            </Badge>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
