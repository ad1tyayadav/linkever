import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
    {
        variants: {
            variant: {
                default:
                    "bg-[var(--foreground)] text-[var(--background)] hover:bg-[var(--foreground)]/90",
                destructive:
                    "bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:opacity-90",
                outline:
                    "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--surface)] hover:border-[var(--foreground)]/30",
                secondary:
                    "bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
                ghost:
                    "text-[var(--foreground)] hover:bg-[var(--surface)]",
                link:
                    "text-[var(--foreground)] underline-offset-4 hover:underline p-0 h-auto",
            },
            size: {
                sm: "h-8 px-3 text-xs",
                default: "h-10 px-4 text-sm",
                lg: "h-11 px-6 text-sm",
                icon: "h-9 w-9",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

export { Button, buttonVariants };
