"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="h-8 w-8"
        >
            {mounted ? (
                <>
                    {theme === "dark" ? (
                        <Sun className="h-4 w-4 text-[var(--muted-foreground)]" />
                    ) : (
                        <Moon className="h-4 w-4 text-[var(--muted-foreground)]" />
                    )}
                </>
            ) : (
                <div className="h-4 w-4" />
            )}
        </Button>
    );
}
