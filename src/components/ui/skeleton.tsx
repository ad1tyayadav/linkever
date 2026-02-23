import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "rounded-[var(--radius-md)] bg-[var(--surface)] animate-pulse",
                className
            )}
            {...props}
        />
    );
}

export { Skeleton };
