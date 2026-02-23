import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
    indicatorClassName?: string;
}

const Progress = React.forwardRef<
    React.ComponentRef<typeof ProgressPrimitive.Root>,
    ProgressProps
>(({ className, value, indicatorClassName, ...props }, ref) => (
    <ProgressPrimitive.Root
        ref={ref}
        className={cn(
            "relative h-2 w-full overflow-hidden rounded-[var(--radius-full)] bg-[var(--surface)]",
            className
        )}
        {...props}
    >
        <ProgressPrimitive.Indicator
            className={cn(
                "h-full rounded-[var(--radius-full)] bg-[var(--color-primary)] transition-all duration-500 ease-out",
                indicatorClassName
            )}
            style={{ width: `${value || 0}%` }}
        />
    </ProgressPrimitive.Root>
));
Progress.displayName = "Progress";

export { Progress };
