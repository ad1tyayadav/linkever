import { Github, Twitter, Linkedin } from "lucide-react";

export function Footer() {
    return (
        <footer className="py-12 px-6">
            <div className="mx-auto max-w-6xl">
                <div className="pt-8 border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <p className="text-[13px] font-medium text-[var(--muted-foreground)]">
                            &copy; {new Date().getFullYear()} LinkEver. Built for the web.
                        </p>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* GitHub */}
                        <a
                            href="https://github.com/ad1tyayadav"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
                        >
                            <Github className="h-4 w-4" />
                            GitHub
                        </a>
                        {/* X (Twitter) */}
                        <a
                            href="https://x.com/_its_Adi"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
                        >
                            <Twitter className="h-4 w-4" />
                            X
                        </a>
                        {/* LinkedIn */}
                        <a
                            href="https://linkedin.com/in/aditya-yadav-39b20529a/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
                        >
                            <Linkedin className="h-4 w-4" />
                            LinkedIn
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
