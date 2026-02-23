import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center gap-1.5 rounded-[var(--radius-full)] px-3 py-1 text-xs font-medium transition-colors",
    {
        variants: {
            variant: {
                default: "bg-[var(--color-primary)] text-white",
                secondary: "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]",
                success: "bg-[var(--color-success)]/15 text-[var(--color-success)] border border-[var(--color-success)]/20",
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
