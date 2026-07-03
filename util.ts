/* Shared, dependency-light helpers used across the plugin. */
import { React } from "@webpack/common";

export type Phase = "idle" | "work" | "break";
export type Mode = "pomodoro" | "flowmodoro";

// --- formatting / maths -----------------------------------------------------
export function fmt(total: number): string {
    total = Math.max(0, Math.floor(total));
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    const p = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}
export const mins = (v: number) => Math.round(Math.max(0, v) * 60);

// --- parsing ----------------------------------------------------------------
export function parseIds(s: string): string[] {
    return (s || "").split(/[\s,]+/).map(x => x.replace(/[^0-9]/g, "")).filter(Boolean);
}
export function parseNames(s: string): string[] {
    return (s || "").split(",").map(x => x.trim()).filter(Boolean);
}
export function cssEsc(s: string): string { return s.replace(/["\\]/g, "\\$&"); }

export function b64ToUtf8(b64: string): string {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
}

// --- theme tokens -----------------------------------------------------------
export const ACCENT = "var(--brand-500, var(--brand-experiment, #5865f2))";
export const GREEN = "var(--green-360, var(--status-positive, #23a55a))";
export const RED = "var(--red-400, var(--status-danger, #f23f43))";
export const PANEL = "var(--background-secondary, #2b2d31)";
export const HEADER = "var(--background-tertiary, #1e1f22)";
export const TXT = "var(--text-normal, #dbdee1)";
export const MUTED = "var(--text-muted, #949ba4)";
export const SURFACE = "var(--background-modifier-selected, #404249)";

// --- draggable floating window ---------------------------------------------
export function useDrag(initial: { x: number; y: number; }) {
    const ref = React.useRef(initial);
    const [pos, setPos] = React.useState(initial);
    const onDown = (e: React.PointerEvent) => {
        const sx = e.clientX, sy = e.clientY, o = { ...ref.current };
        const mv = (ev: PointerEvent) => {
            const nx = Math.min(window.innerWidth - 40, Math.max(0, o.x + ev.clientX - sx));
            const ny = Math.min(window.innerHeight - 20, Math.max(0, o.y + ev.clientY - sy));
            ref.current = { x: nx, y: ny };
            setPos({ x: nx, y: ny });
        };
        const up = () => {
            window.removeEventListener("pointermove", mv);
            window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", mv);
        window.addEventListener("pointerup", up);
    };
    return [pos, onDown] as const;
}
