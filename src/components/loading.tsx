import React, { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import logo from "@/assets/images/logo.png"

/** Tiny classnames helper */
function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ")
}

type SpinnerSize = "sm" | "md" | "lg" | "xl" | number

function sizeToPx(size: SpinnerSize): number {
    if (typeof size === "number") return size
    switch (size) {
        case "sm":
            return 18
        case "md":
            return 24
        case "lg":
            return 32
        case "xl":
            return 40
        default:
            return 24
    }
}

export type SpinnerProps = {
    size?: SpinnerSize
    className?: string
    label?: string
}

/** Low-level animated spinner */
export function Spinner({ size = "md", className, label = "Loading…" }: SpinnerProps) {
    const px = sizeToPx(size)
    return (
        <span
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label={label}
            className="inline-flex items-center justify-center"
        >
            <Loader2
                className={cx("animate-spin text-white/90", className)}
                style={{ width: px, height: px }}
                aria-hidden="true"
            />
            <span className="sr-only">{label}</span>
        </span>
    )
}

export type LoadingProps = {
    label?: string
    fullscreen?: boolean
    backdrop?: boolean
    delayMs?: number
    size?: SpinnerSize
    showLogo?: boolean
    logoSrc?: string
    className?: string
    labelClassName?: string
    children?: React.ReactNode
}

/**
 * High-level Loading component.
 * - Inline by default
 * - Fullscreen overlay when `fullscreen` is true
 * - Optional backdrop
 * - Optional delay (avoid flicker for very fast operations)
 */
export default function Loading({
    label = "Loading…",
    fullscreen = false,
    backdrop = true,
    delayMs = 0,
    size = "lg",
    showLogo = false,
    logoSrc,
    className,
    labelClassName,
    children,
}: LoadingProps) {
    const [visible, setVisible] = useState(delayMs === 0)

    useEffect(() => {
        if (delayMs === 0) return
        const t = setTimeout(() => setVisible(true), delayMs)
        return () => clearTimeout(t)
    }, [delayMs])

    const Wrapper = useMemo(
        () =>
            ({ children: inner }: { children: React.ReactNode }) =>
                fullscreen ? (
                    <div
                        className={cx(
                            "fixed inset-0 z-100 grid place-items-center p-6",
                            // Backdrop ensures the spinner is visible even on a white page
                            backdrop ? "bg-slate-950/70 backdrop-blur-sm" : "bg-slate-900",
                            className
                        )}
                    >
                        {inner}
                    </div>
                ) : (
                    <div className={cx("flex flex-col items-center justify-center gap-3", className)}>
                        {inner}
                    </div>
                ),
        [fullscreen, backdrop, className]
    )

    if (!visible) return null

    return (
        <Wrapper>
            <div className="flex flex-col items-center justify-center text-center">
                {showLogo && (
                    <img
                        src={logoSrc ?? logo}
                        alt="App logo"
                        className="mb-3 h-10 w-10 rounded-md object-contain select-none pointer-events-none"
                        draggable={false}
                    />
                )}
                <Spinner size={size} />
                {label && (
                    <p className={cx("mt-2 text-sm text-white/80", labelClassName)}>
                        {label}
                    </p>
                )}
                {children ? <div className="mt-2 text-xs text-white/60">{children}</div> : null}
            </div>
        </Wrapper>
    )
}

/** Convenience alias: full-screen blocking loader with backdrop + logo */
export function PageLoadingOverlay(
    props: Omit<LoadingProps, "fullscreen" | "backdrop" | "showLogo">
) {
    return <Loading fullscreen backdrop showLogo {...props} />
}
