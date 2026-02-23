import { Github } from "lucide-react";

export function Footer() {
    return (
        <footer className="py-12 px-6">
            <div className="mx-auto max-w-6xl">
                <div className="pt-8 border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <p className="text-[13px] font-medium text-[var(--muted)]">
                            &copy; {new Date().getFullYear()} LinkEver. Built for the web.
                        </p>
                    </div>

                    <div className="flex items-center gap-8">
                        <a
                            href="https://github.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] font-medium text-[var(--muted)] hover:text-black transition-colors flex items-center gap-2"
                        >
                            <Github className="h-4 w-4" />
                            GitHub
                        </a>
                        <a href="#" className="text-[13px] font-medium text-[var(--muted)] hover:text-black transition-colors">Privacy</a>
                        <a href="#" className="text-[13px] font-medium text-[var(--muted)] hover:text-black transition-colors">Terms</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
