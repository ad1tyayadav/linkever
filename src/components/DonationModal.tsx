"use client";
import Image from "next/image";
import { Heart, ExternalLink } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DonationModalProps {
    children: React.ReactNode;
}

export function DonationModal({ children }: DonationModalProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-md border-[var(--border)] bg-[var(--background)] px-4 sm:px-6 max-h-[90vh] overflow-y-auto">
                {/* <DialogHeader className="pt-2">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                        Support LinkEver
                    </DialogTitle>
                    <DialogDescription className="text-[var(--muted-foreground)]">
                        If you find this tool helpful, consider supporting its development. Every bit helps keep it free and ad-less!
                    </DialogDescription>
                </DialogHeader> */}

                <div className="flex flex-col gap-6 py-4">

                    {/* Meme Section */}
                    <div className="relative h-[30vh] w-full rounded-xl overflow-hidden bg-[var(--surface)] border border-[var(--border)]">
                        <Image
                            src="https://c.tenor.com/veWr-LPya_gAAAAC/tenor.gif"
                            alt="Funny donation meme"
                            fill
                            sizes="(max-width: 640px) 100vw, 448px"
                            className="object-cover"
                        />
                    </div>

                    {/* QR Code Section */}
                    <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-[var(--surface)]">
                        <div className="relative w-full max-w-[180px] sm:max-w-[200px] aspect-square bg-white rounded-lg overflow-hidden">
                            <Image
                                src="/qr.png"
                                alt="Google Pay QR Code"
                                fill
                                sizes="(max-width: 640px) 180px, 200px"
                                className="object-contain"
                                priority
                            />
                        </div>
                        {/* <p className="text-sm font-medium text-[var(--foreground)] text-center">Scan to pay with Google Pay</p> */}
                    </div>

                    {/* PayPal Button */}
                    <Button asChild className="w-full bg-[#0070ba] hover:bg-[#005ea6] text-white border-none h-12 text-base font-semibold">
                        <a
                            href="https://paypal.me/adity4yadav"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2"
                        >
                            Donate via PayPal
                            <ExternalLink className="h-4 w-4" />
                        </a>
                    </Button>
                </div>

                <div className="text-center pb-2">
                    <p className="text-[11px] text-[var(--muted-foreground)]">
                        Thank you for being awesome! ❤️
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
