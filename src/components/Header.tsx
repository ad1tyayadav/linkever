"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)]">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--foreground)]">
                        <Download className="h-3.5 w-3.5 text-[var(--background)]" />
                    </div>
                    <span className="text-lg font-bold tracking-tight text-[var(--foreground)]">
                        LinkEver
                    </span>
                </Link>

                {/* Nav */}
                <nav className="flex items-center gap-4">
                    <ThemeToggle />
                </nav>
            </div>
        </header>
    );
}
