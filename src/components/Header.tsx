"use client";

import Link from "next/link";
import { Download, Github, Heart } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { DonationModal } from "./DonationModal";

export function Header() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)]">
            <div className="mx-auto flex h-14 sm:h-16 max-w-6xl items-center justify-between px-3 sm:px-6">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-1.5 sm:gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--foreground)]">
                        <Download className="h-3.5 w-3.5 text-[var(--background)]" />
                    </div>
                    <span className="text-base sm:text-lg font-bold tracking-tight text-[var(--foreground)]">
                        LinkEver
                    </span>
                </Link>

                {/* Nav */}
                <nav className="flex items-center gap-2">
                    <DonationModal>
                        <Button variant="ghost" size="sm" className="flex gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                            <span>Don't Click!</span>
                        </Button>
                    </DonationModal>

                    <Button variant="ghost" size="sm" asChild className="flex gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                        <a
                            href="https://github.com/ad1tyayadav/linkever"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Github className="h-4 w-4" />
                            <span className="hidden sm:inline">Give a star</span>
                        </a>
                    </Button>
                    <ThemeToggle />
                </nav>
            </div>
        </header>
    );
}
