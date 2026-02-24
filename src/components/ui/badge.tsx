import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center gap-1.5 rounded-[var(--radius-full)] px-3 py-1 text-xs font-medium transition-colors",
    {
        variants: {
            variant: {
                default: "bg-[var(--primary)] text-[var(--primary-foreground)]",
                secondary: "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]",
                success: "bg-green-500/15 text-green-500 border border-green-500/20",
                error: "bg-[var(--destructive)]/15 text-[var(--destructive)] border border-[var(--destructive)]/20",
                spotify: "bg-[var(--color-spotify)]/15 text-[var(--color-spotify)] border border-[var(--color-spotify)]/20",
                outline: "border border-[var(--border)] text-[var(--foreground)]",
            },
        },
        defaultVariants: { variant: "default" },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
