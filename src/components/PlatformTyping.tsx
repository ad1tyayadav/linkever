"use client";

import { useState, useEffect, useCallback } from "react";

interface PlatformData {
    name: string;
    color: string;
}

const PLATFORMS: PlatformData[] = [
    { name: "YouTube", color: "#FF0000" },
    { name: "Spotify", color: "#1DB954" },
    { name: "Instagram", color: "#E4405F" },
    { name: "Twitter", color: "#1DA1F2" },
    { name: "TikTok", color: "#ff0050" },
    { name: "Facebook", color: "#1877F2" },
    { name: "Reddit", color: "#FF4500" },
    { name: "Vimeo", color: "#1AB7EA" },
    {name: "Pinterest", color: "#E60023"},
    { name: "SoundCloud", color: "#FF5500" },
    {name : "100+ platforms", color: "#000000"}
];

export function PlatformTyping() {
    const [platformIndex, setPlatformIndex] = useState(0);
    const [displayText, setDisplayText] = useState("");
    const [isTyping, setIsTyping] = useState(true);

    const currentPlatform = PLATFORMS[platformIndex];

    useEffect(() => {
        const targetText = currentPlatform.name;

        if (isTyping) {
            if (displayText.length < targetText.length) {
                const timeout = setTimeout(() => {
                    setDisplayText(targetText.slice(0, displayText.length + 1));
                }, 120);
                return () => clearTimeout(timeout);
            } else {
                // Finished typing, wait before starting to delete
                const timeout = setTimeout(() => {
                    setIsTyping(false);
                }, 2000);
                return () => clearTimeout(timeout);
            }
        } else {
            if (displayText.length > 0) {
                const timeout = setTimeout(() => {
                    setDisplayText(displayText.slice(0, -1));
                }, 60);
                return () => clearTimeout(timeout);
            } else {
                // Finished deleting, move to next platform
                setPlatformIndex((prev) => (prev + 1) % PLATFORMS.length);
                setIsTyping(true);
            }
        }
    }, [displayText, isTyping, currentPlatform.name]);

    const getCursorColor = useCallback(() => {
        return currentPlatform.color;
    }, [currentPlatform.color]);

    return (
        <span
            className="inline-block relative"
            style={{ color: currentPlatform.color }}
        >
            {displayText}
            <span
                className="absolute -right-1 top-0 h-full w-[2px] animate-pulse"
                style={{ backgroundColor: getCursorColor(), boxShadow: `0 0 8px ${getCursorColor()}` }}
            />
        </span>
    );
}