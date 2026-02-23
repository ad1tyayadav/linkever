"use client";

import Link from "next/link";
import { Download, History } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-[var(--border)]">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black">
                        <Download className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-lg font-bold tracking-tight text-black">
                        LinkEver
                    </span>
                </Link>

                {/* Nav */}
                <nav className="flex items-center gap-4">
                    <Link
                        href="/history"
                        className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-[var(--muted)] hover:text-black hover:bg-[var(--surface-hover)] transition-all"
                    >
                        <History className="h-4 w-4" />
                        <span className="hidden sm:inline">History</span>
                    </Link>
                    <div className="h-4 w-[1px] bg-[var(--border)] mx-1" />
                    <ThemeToggle />
                </nav>
            </div>
        </header>
    );
}
