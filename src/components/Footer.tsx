import { Github, X, Linkedin, Heart } from "lucide-react";
import { FaGithub, FaLinkedinIn, FaXTwitter } from "react-icons/fa6";
import { DonationModal } from "./DonationModal";

export function Footer() {
    return (
        <footer className="py-8 sm:py-12 px-4 sm:px-6">
            <div className="mx-auto max-w-6xl">
                <div className="pt-6 sm:pt-8 border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
                    <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
                        <p className="text-[13px] font-medium text-[var(--muted-foreground)]">
                            &copy; {new Date().getFullYear()} LinkEver. Built for the web.
                        </p>
                        <DonationModal>
                            <button className="text-[13px] font-medium text-pink-500 hover:text-pink-600 transition-colors flex items-center gap-2 cursor-pointer">
                                <Heart className="h-4 w-4 fill-current" />
                                Support
                            </button>
                        </DonationModal>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-6">
                        {/* GitHub */}
                        <a
                            href="https://github.com/ad1tyayadav"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
                        >
                            <FaGithub className="h-4 w-4" />
                        </a>
                        {/* X (Twitter) */}
                        <a
                            href="https://x.com/_its_Adi"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
                        >
                            <FaXTwitter className="h-4 w-4" />
                        </a>
                        {/* LinkedIn */}
                        <a
                            href="https://linkedin.com/in/aditya-yadav-39b20529a/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
                        >
                            <FaLinkedinIn className="h-4 w-4" />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
