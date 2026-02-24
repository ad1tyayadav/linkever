"use client";

import { Shield, UserX, Infinity } from "lucide-react";

const BADGES = [
    { icon: Shield, label: "No ads" },
    { icon: UserX, label: "No signup" },
    { icon: Infinity, label: "No limits" },
] as const;

export function TrustBadges() {
    return (
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-[13px] font-medium text-[var(--muted-foreground)]">
            {BADGES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 group cursor-default">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface-hover)] group-hover:bg-[var(--foreground)]/5 transition-colors">
                        <Icon className="h-3 w-3 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors" />
                    </div>
                    <span className="group-hover:text-[var(--foreground)] transition-colors">{label}</span>
                </div>
            ))}
        </div>
    );
}
