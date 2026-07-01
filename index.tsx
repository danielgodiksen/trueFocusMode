/*
 * trueFocusMode — a Vencord userplugin
 * ------------------------------------------------------------------
 * Focus regime for Discord. While a session is active it can:
 *   - run a Pomodoro (fixed) or Flowmodoro (count-up, proportional break) timer
 *   - confirm + LOCK the session length up front (optionally unabortable)
 *   - hide channels / servers / member list / folders / discover / pinned / threads
 *   - block the back & forward navigation (history + mouse side-buttons + Alt+Arrows)
 *   - show only YOUR messages in a channel (todo-list mode) with a per-user allow-list
 *   - block navigation through channel links / mentions
 *   - keep only ONE chosen server, or only ungrouped servers
 *   - lock you out ("go study") after N minutes in a channel or a burst of messages
 *   - run the Cortical Load app in an in-client popup, persisted in the plugin's own store
 *
 * Configure everything in Vencord -> Settings -> Plugins -> trueFocusMode.
 *
 * Cortical Load runs its compiled logic (corticalApp.ts) inside an isolated
 * same-origin iframe — a normal function call, never gated by the page CSP the
 * way an inline / blob / srcdoc script is. It persists via window.storage -> DataStore.
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import * as DataStore from "@api/DataStore";
import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { FluxDispatcher, React, SettingsRouter, UserStore } from "@webpack/common";

import { runCorticalApp } from "./corticalApp";
import { CL_BODY_B64, CL_HEAD_B64 } from "./corticalLoadAsset";

const ReactDOM = findByPropsLazy("createRoot");
const SelectedChannelStore = findStoreLazy("SelectedChannelStore");
const CL_PREFIX = "cortical:";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
const settings = definePluginSettings({
    technique: {
        type: OptionType.SELECT,
        description: "Focus technique",
        options: [
            { label: "Pomodoro (fixed work / break)", value: "pomodoro", default: true },
            { label: "Flowmodoro (work freely, break = work ÷ ratio)", value: "flowmodoro" }
        ]
    },
    workDuration: { type: OptionType.NUMBER, description: "Pomodoro: work length (minutes)", default: 25 },
    breakDuration: { type: OptionType.NUMBER, description: "Pomodoro: short break (minutes)", default: 5 },
    longBreakDuration: { type: OptionType.NUMBER, description: "Pomodoro: long break (minutes)", default: 15 },
    pomodorosUntilLongBreak: { type: OptionType.NUMBER, description: "Pomodoro: sessions before a long break (0 = never)", default: 4 },
    flowmodoroRatio: { type: OptionType.NUMBER, description: "Flowmodoro: break = work ÷ ratio", default: 5 },
    confirmSessionLength: { type: OptionType.BOOLEAN, description: "Confirm the session length before starting", default: true },
    lockSession: { type: OptionType.BOOLEAN, description: "Lock controls while a work block runs (no skip / reset)", default: true },
    allowAbort: { type: OptionType.BOOLEAN, description: "Allow aborting a locked block (off = unabortable; reload Discord to override)", default: true },

    alwaysOn: { type: OptionType.BOOLEAN, description: "Keep hiding / blocking ON at all times, even with no session running", default: false },

    hideChannels: { type: OptionType.BOOLEAN, description: "Hide the channel sidebar (covers server channels too)", default: true },
    restrictChannels: { type: OptionType.BOOLEAN, description: "Show ONLY specific channels in the sidebar (hide all others)", default: false },
    allowedChannelIds: { type: OptionType.STRING, description: "Channel IDs to keep visible when restricting (comma separated)", default: "" },
    hideServers: { type: OptionType.BOOLEAN, description: "Hide the whole server list", default: false },
    hideMembers: { type: OptionType.BOOLEAN, description: "Hide the member list (+ its toolbar button)", default: true },
    hideBackForward: { type: OptionType.BOOLEAN, description: "Block back & forward navigation (history + mouse buttons + Alt+Arrows)", default: true },
    hidePinned: { type: OptionType.BOOLEAN, description: "Hide the Pinned Messages button", default: true },
    hideThreads: { type: OptionType.BOOLEAN, description: "Hide the Threads button", default: true },
    hideDiscover: { type: OptionType.BOOLEAN, description: "Hide the Discover / Explore button", default: true },
    hideServerFolders: { type: OptionType.BOOLEAN, description: "Hide all server folders (keep only ungrouped servers)", default: false },
    allowedFoldersInPomodoro: { type: OptionType.STRING, description: "Folder NAMES to still show during a Pomodoro block (comma separated) [VERIFY]", default: "" },

    soloServerMode: { type: OptionType.BOOLEAN, description: "Hide every server except one chosen below", default: false },
    soloServerId: { type: OptionType.STRING, description: "The one server (guild) ID to keep visible", default: "" },
    keepHomeButton: { type: OptionType.BOOLEAN, description: "When solo-server is on, also keep the Home / DM button", default: false },

    onlyOwnMessages: { type: OptionType.BOOLEAN, description: "Show only your own messages in a channel (todo-list mode)", default: true },
    allowedUserIds: { type: OptionType.STRING, description: "Other user IDs whose messages stay visible (comma separated)", default: "1487524020277739674" },
    showOthersInChannels: { type: OptionType.STRING, description: "Channel IDs where EVERYONE's messages stay visible (todo-list mode off there; comma separated)", default: "" },
    blockChannelLinks: { type: OptionType.BOOLEAN, description: "Block opening other channels via links / mentions", default: true },

    channelTimeLockout: { type: OptionType.NUMBER, description: "Lock the UI after this many minutes in one channel (0 = off)", default: 20 },
    msgRateCount: { type: OptionType.NUMBER, description: "Lock the UI after this many of your messages…", default: 5 },
    msgRateWindow: { type: OptionType.NUMBER, description: "…within this many minutes (0 = off)", default: 4 },
    lockoutMessage: { type: OptionType.STRING, description: "What the lock-out screen tells you", default: "Enough chat — get back to studying." },

    hideDuringBreak: { type: OptionType.BOOLEAN, description: "Keep hiding / blocking during breaks too", default: false },
    notify: { type: OptionType.BOOLEAN, description: "Notify when a phase ends", default: true }
});

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------
const STYLE_ID = "tfm-style";

const STATIC_CSS = `
.tfm-focus.tfm-hide-channels [class*="sidebar_"] { display: none !important; }
.tfm-focus.tfm-hide-servers  [class*="guilds_"]  { display: none !important; }
.tfm-focus.tfm-hide-members  [class*="membersWrap_"],
.tfm-focus.tfm-hide-members  aside[class*="members_"] { display: none !important; }
.tfm-focus.tfm-hide-folders  [class*="folder_"] { display: none !important; }

.tfm-focus.tfm-hide-members  button[aria-label="Members"],
.tfm-focus.tfm-hide-members  button[aria-label="Show Member List"],
.tfm-focus.tfm-hide-members  button[aria-label="Hide Member List"] { display: none !important; }
.tfm-focus.tfm-hide-pinned   button[aria-label="Pinned Messages"] { display: none !important; }
.tfm-focus.tfm-hide-threads  button[aria-label="Threads"] { display: none !important; }
.tfm-focus.tfm-hide-discover [aria-label="Explore Discoverable Servers"],
.tfm-focus.tfm-hide-discover [aria-label="Discover"] { display: none !important; }

/* back / forward buttons — behaviour is blocked in JS regardless; this only hides them. VERIFY the labels. */
.tfm-focus.tfm-hide-backfwd  button[aria-label="Back"],
.tfm-focus.tfm-hide-backfwd  button[aria-label="Forward"] { display: none !important; }

/* todo-list mode: keep layout height (visibility, not display) so Discord's
   scroller doesn't keep loading history to "fill" the viewport — that was the glitch. */
.tfm-msgfilter .tfm-foreign { visibility: hidden !important; pointer-events: none !important; }
`;

function parseIds(s: string): string[] {
    return (s || "").split(/[\s,]+/).map(x => x.replace(/[^0-9]/g, "")).filter(Boolean);
}
function parseNames(s: string): string[] {
    return (s || "").split(",").map(x => x.trim()).filter(Boolean);
}
function cssEsc(s: string): string { return s.replace(/["\\]/g, "\\$&"); }

function buildDynamicCss(): string {
    const s = settings.store;
    let css = "";
    const solo = (s.soloServerId || "").replace(/[^0-9]/g, "");
    if (s.soloServerMode && solo) {
        css += `.tfm-focus.tfm-solo [data-list-item-id^="guildsnav___"]{display:none!important}`;
        css += `.tfm-focus.tfm-solo [data-list-item-id="guildsnav___${solo}"]{display:flex!important}`;
        if (s.keepHomeButton)
            css += `.tfm-focus.tfm-solo [data-list-item-id="guildsnav___home"]{display:flex!important}`;
    }
    for (const name of parseNames(s.allowedFoldersInPomodoro)) {
        const n = cssEsc(name);
        // best-effort: reveal a folder whose accessible name contains the text
        css += `.tfm-focus.tfm-pomodoro.tfm-hide-folders [class*="folder_"][aria-label*="${n}"]{display:flex!important}`;
        css += `.tfm-focus.tfm-pomodoro.tfm-hide-folders [class*="folder_"] [aria-label*="${n}"]{visibility:visible!important}`;
    }
    if (s.restrictChannels) {
        css += `.tfm-focus.tfm-restrict-chan [data-list-item-id^="channels___"]{display:none!important}`;
        for (const id of parseIds(s.allowedChannelIds))
            css += `.tfm-focus.tfm-restrict-chan [data-list-item-id="channels___${id}"]{display:flex!important}`;
    }
    return css;
}

function injectStyle() {
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
        el = document.createElement("style");
        el.id = STYLE_ID;
        document.head.appendChild(el);
    }
    el.textContent = STATIC_CSS + buildDynamicCss();
}
function removeStyle() { document.getElementById(STYLE_ID)?.remove(); }

function setBodyClasses(active: boolean, phase: string, mode: string) {
    const s = settings.store;
    const c = document.body.classList;
    const solo = (s.soloServerId || "").replace(/[^0-9]/g, "");
    c.toggle("tfm-focus", active);
    c.toggle("tfm-hide-channels", active && s.hideChannels);
    c.toggle("tfm-restrict-chan", active && s.restrictChannels);
    c.toggle("tfm-hide-servers", active && s.hideServers);
    c.toggle("tfm-hide-members", active && s.hideMembers);
    c.toggle("tfm-hide-backfwd", active && s.hideBackForward);
    c.toggle("tfm-hide-pinned", active && s.hidePinned);
    c.toggle("tfm-hide-threads", active && s.hideThreads);
    c.toggle("tfm-hide-discover", active && s.hideDiscover);
    c.toggle("tfm-hide-folders", active && s.hideServerFolders);
    c.toggle("tfm-solo", active && s.soloServerMode && !!solo);
    c.toggle("tfm-pomodoro", active && mode === "pomodoro" && phase === "work");
    c.toggle("tfm-msgfilter", active && s.onlyOwnMessages);
}

// Message filter is per-channel: it turns OFF in the channels listed in
// showOthersInChannels (the visible message list is always the current channel).
function applyMsgFilter(regimeActive: boolean) {
    const s = settings.store;
    const cur = String((SelectedChannelStore as any).getChannelId?.() ?? "");
    const bypass = cur !== "" && parseIds(s.showOthersInChannels).includes(cur);
    const on = regimeActive && s.onlyOwnMessages && !bypass;
    document.body.classList.toggle("tfm-msgfilter", on);
    if (on) startMsgObserver(); else stopMsgObserver();
}

// ---------------------------------------------------------------------------
// Back / forward blocking (selector-independent)
// ---------------------------------------------------------------------------
let histPatched = false;
let origBack: any, origFwd: any, origGo: any;
function patchHistory(on: boolean) {
    const h = window.history as any;
    if (on && !histPatched) {
        origBack = h.back; origFwd = h.forward; origGo = h.go;
        h.back = function () { }; h.forward = function () { };
        h.go = function (n: number) { if (n) return; return origGo.call(h, n); };
        histPatched = true;
    } else if (!on && histPatched) {
        h.back = origBack; h.forward = origFwd; h.go = origGo;
        histPatched = false;
    }
}

// ---------------------------------------------------------------------------
// Own-messages-only: tag foreign message <li>s via their React fiber
// ---------------------------------------------------------------------------
let msgObserver: MutationObserver | null = null;
let scanQueued = false;

function fiberAuthorId(el: any): string | null {
    try {
        const key = Object.keys(el).find(k => k.startsWith("__reactFiber$"));
        let n = key ? el[key] : null;
        let depth = 0;
        while (n && depth < 80) {
            const m = n.memoizedProps && n.memoizedProps.message;
            if (m && m.author && m.author.id) return String(m.author.id);
            n = n.return;
            depth++;
        }
    } catch { /* ignore */ }
    return null;
}

function scanMessages() {
    const my = (UserStore as any).getCurrentUser?.()?.id;
    const allow = new Set(parseIds(settings.store.allowedUserIds));
    if (my) allow.add(String(my));
    // only touch messages we haven't tagged yet -> cheap, no re-walking on every mutation
    document.querySelectorAll('li[id^="chat-messages-"]:not([data-tfm-done])').forEach(li => {
        const id = fiberAuthorId(li);
        (li as HTMLElement).setAttribute("data-tfm-done", "1");
        if (id) {
            (li as HTMLElement).setAttribute("data-tfm-author", id);
            li.classList.toggle("tfm-foreign", !allow.has(id));
        }
    });
}
function rescanAll() {
    document.querySelectorAll("li[data-tfm-done]").forEach(el => el.removeAttribute("data-tfm-done"));
    scanMessages();
}
function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    setTimeout(() => { scanQueued = false; scanMessages(); }, 200);
}
function startMsgObserver() {
    if (!msgObserver) {
        msgObserver = new MutationObserver(queueScan);
        msgObserver.observe(document.body, { childList: true, subtree: true });
    }
    rescanAll();
}
function stopMsgObserver() {
    msgObserver?.disconnect();
    msgObserver = null;
    document.querySelectorAll(".tfm-foreign").forEach(el => el.classList.remove("tfm-foreign"));
    document.querySelectorAll("li[data-tfm-done]").forEach(el => el.removeAttribute("data-tfm-done"));
}

// ---------------------------------------------------------------------------
// Cortical Load
// The app's script is compiled into the bundle (corticalApp.ts) and executed as
// a normal function call, so it is never gated by the page CSP the way an inline
// / blob / srcdoc <script> is. It runs against an isolated same-origin iframe
// (own document + styles) and persists through window.storage -> DataStore.
// ---------------------------------------------------------------------------
function b64ToUtf8(b64: string): string {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
}

function makeCorticalStorage() {
    return {
        get: async (k: string) => {
            const v = await DataStore.get(CL_PREFIX + k);
            return v === undefined ? null : { key: k, value: v };
        },
        set: async (k: string, v: any) => { await DataStore.set(CL_PREFIX + k, v); return { key: k, value: v }; },
        delete: async (k: string) => { await DataStore.del(CL_PREFIX + k); return { key: k, deleted: true }; },
        list: async (pre?: string) => {
            const keys = await DataStore.keys();
            const full = CL_PREFIX + (pre || "");
            return { keys: (keys as any[]).filter(k => typeof k === "string" && k.indexOf(full) === 0).map((k: string) => k.slice(CL_PREFIX.length)) };
        }
    };
}

// Populate an iframe with the app's markup + styles, then boot its logic in-realm.
function populateCortical(iframe: HTMLIFrameElement): boolean {
    const win: any = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc) return false;
    doc.open();
    doc.write("<!doctype html><html><head></head><body></body></html>");
    doc.close();
    doc.head.innerHTML = b64ToUtf8(CL_HEAD_B64);
    doc.body.innerHTML = b64ToUtf8(CL_BODY_B64);
    win.storage = makeCorticalStorage();
    runCorticalApp(win, doc);   // defines everything and calls boot()
    return true;
}

// ---------------------------------------------------------------------------
// Slash-command controller + shared refs
// ---------------------------------------------------------------------------
const api: Record<string, (() => void) | undefined> = {};
const regimeActiveRef = { current: false };   // hiding / blocking (includes always-on)
const sessionActiveRef = { current: false };  // a real timer session (drives lock-outs only)
const channelRef = { current: { id: null as string | null, ts: Date.now() } };
const msgTimesRef = { current: [] as { t: number; key: string; }[] };

function openSettings() {
    try {
        if ((SettingsRouter as any)?.open) { (SettingsRouter as any).open("VencordPlugins"); return; }
    } catch { /* */ }
    try { showNotification({ title: "trueFocusMode", body: "Open Settings → Plugins → trueFocusMode" }); } catch { /* */ }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type Phase = "idle" | "work" | "break";
type Mode = "pomodoro" | "flowmodoro";

function fmt(total: number) {
    total = Math.max(0, Math.floor(total));
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    const p = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}
const mins = (v: number) => Math.round(Math.max(0, v) * 60);
const ACCENT = "var(--brand-500, var(--brand-experiment, #5865f2))";
const GREEN = "var(--green-360, var(--status-positive, #23a55a))";
const RED = "var(--red-400, var(--status-danger, #f23f43))";
const PANEL = "var(--background-secondary, #2b2d31)";
const HEADER = "var(--background-tertiary, #1e1f22)";
const TXT = "var(--text-normal, #dbdee1)";
const MUTED = "var(--text-muted, #949ba4)";

function useDrag(initial: { x: number; y: number; }) {
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

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------
interface TimerState {
    mode: Mode; phase: Phase; running: boolean; paused: boolean; resting: boolean;
    remaining: number; total: number; elapsed: number;
    cycle: number; isBreakLong: boolean; plannedLen: number;
}

function App() {
    const stateRef = React.useRef<TimerState>({
        mode: settings.store.technique as Mode,
        phase: "idle", running: false, paused: false, resting: false,
        remaining: mins(settings.store.workDuration) || 1500,
        total: mins(settings.store.workDuration) || 1500,
        elapsed: 0, cycle: 0, isBreakLong: false,
        plannedLen: settings.store.workDuration || 25
    });
    const [, force] = React.useReducer((x: number) => x + 1, 0);
    const rerender = () => force();
    const st = stateRef.current;

    const [focusOpen, setFocusOpen] = React.useState(true);
    const [corticalOpen, setCorticalOpen] = React.useState(false);
    const corticalEver = React.useRef(false);
    if (corticalOpen) corticalEver.current = true;
    const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
    const clPopulated = React.useRef(false);
    const [clReady, setClReady] = React.useState(false);
    const [clFailed, setClFailed] = React.useState(false);

    const [confirming, setConfirming] = React.useState(false);
    const [confirmLen, setConfirmLen] = React.useState(settings.store.workDuration || 25);
    const abortArmed = React.useRef(false);
    const [, setArm] = React.useState(0);

    const [lockedOut, setLockedOut] = React.useState(false);
    const [lockReason, setLockReason] = React.useState("");

    const [launcherPos, onLauncherDown] = useDrag({ x: Math.round(window.innerWidth / 2 - 96), y: 10 });
    const [focusPos, onFocusDown] = useDrag({ x: Math.max(20, window.innerWidth - 268), y: 60 });
    const [corticalPos, onCorticalDown] = useDrag({ x: Math.max(20, window.innerWidth - 470), y: 60 });

    function notify(title: string, body: string) {
        if (!settings.store.notify) return;
        try { showNotification({ title, body }); } catch { /* */ }
    }

    const sessionActive = st.running && (st.phase === "work" || (st.phase === "break" && settings.store.hideDuringBreak));
    const regimeActive = settings.store.alwaysOn || sessionActive;

    const cssKey = [
        regimeActive, sessionActive, st.phase, st.mode, settings.store.alwaysOn,
        settings.store.hideChannels, settings.store.restrictChannels, settings.store.allowedChannelIds,
        settings.store.hideServers, settings.store.hideMembers,
        settings.store.hideBackForward, settings.store.hidePinned, settings.store.hideThreads,
        settings.store.hideDiscover, settings.store.hideServerFolders, settings.store.soloServerMode,
        settings.store.soloServerId, settings.store.keepHomeButton, settings.store.allowedFoldersInPomodoro,
        settings.store.onlyOwnMessages, settings.store.allowedUserIds, settings.store.showOthersInChannels
    ].join("|");

    React.useEffect(() => {
        injectStyle();
        setBodyClasses(regimeActive, st.phase, st.mode);
        regimeActiveRef.current = regimeActive;
        sessionActiveRef.current = sessionActive;
        patchHistory(regimeActive && settings.store.hideBackForward);
        applyMsgFilter(regimeActive);
        if (regimeActive) channelRef.current = { id: (SelectedChannelStore as any).getChannelId?.() ?? null, ts: Date.now() };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cssKey]);

    // Boot Cortical Load into its iframe once, the first time it is opened.
    React.useEffect(() => {
        if (!corticalOpen || clPopulated.current) return;
        let cancelled = false;
        const attempt = (tries: number) => {
            if (cancelled) return;
            const ifr = iframeRef.current;
            try {
                if (ifr && populateCortical(ifr)) {
                    clPopulated.current = true;
                    setClReady(true);
                    return;
                }
            } catch (e) {
                console.error("[trueFocusMode] Cortical Load failed:", e);
                setClFailed(true);
                return;
            }
            if (tries > 0) setTimeout(() => attempt(tries - 1), 60); // wait for iframe doc
            else setClFailed(true);
        };
        attempt(20);
        return () => { cancelled = true; };
    }, [corticalOpen]);

    // ---- timer transitions -------------------------------------------------
    function startWork() {
        const s = stateRef.current;
        s.phase = "work"; s.running = true; s.paused = false; s.resting = false;
        if (s.mode === "pomodoro") { s.total = mins(s.plannedLen) || 1500; s.remaining = s.total; }
        else { s.elapsed = 0; }
        channelRef.current = { id: (SelectedChannelStore as any).getChannelId?.() ?? null, ts: Date.now() };
        msgTimesRef.current = [];
        rerender();
    }
    function startBreak() {
        const s = stateRef.current;
        let secs: number, long = false;
        if (s.mode === "pomodoro") {
            const n = s.cycle + 1, cap = settings.store.pomodorosUntilLongBreak;
            long = cap > 0 && n % cap === 0;
            secs = mins(long ? settings.store.longBreakDuration : settings.store.breakDuration) || 300;
        } else {
            const ratio = settings.store.flowmodoroRatio > 0 ? settings.store.flowmodoroRatio : 5;
            secs = Math.max(60, Math.floor(s.elapsed / ratio));
        }
        s.cycle += 1; s.phase = "break"; s.isBreakLong = long; s.paused = false; s.resting = false;
        s.total = secs; s.remaining = secs; s.running = true;
        rerender();
        notify("Break time", s.mode === "flowmodoro"
            ? `Worked ${fmt(s.elapsed)} → ${fmt(secs)} break.`
            : `Time for a ${long ? "long " : ""}break (${fmt(secs)}).`);
    }
    function finishBreak() { notify("Back to focus", "Break over — next block starting."); startWork(); }

    function tick() {
        const s = stateRef.current;
        if (sessionActiveRef.current && !s.paused && settings.store.channelTimeLockout > 0 && channelRef.current.id) {
            if (Date.now() - channelRef.current.ts > settings.store.channelTimeLockout * 60000) triggerLock("time");
        }
        if (!s.running || s.phase === "idle" || s.paused) return;   // paused: block holds, clock frozen
        if (s.phase === "work" && s.mode === "flowmodoro") { s.elapsed += 1; rerender(); return; }
        s.remaining -= 1;   // "rest" does NOT stop this — block runs to the original end
        if (s.remaining <= 0) { s.phase === "work" ? startBreak() : finishBreak(); }
        else rerender();
    }

    function triggerLock(reason: string) {
        if (lockedOut) return;
        setLockReason(reason);
        setLockedOut(true);
    }
    function dismissLock() {
        setLockedOut(false);
        channelRef.current = { id: (SelectedChannelStore as any).getChannelId?.() ?? null, ts: Date.now() };
        msgTimesRef.current = [];
    }

    // ---- controls ----------------------------------------------------------
    function requestStart() {
        const s = stateRef.current;
        if (s.phase !== "idle") { s.paused = false; rerender(); return; }
        if (settings.store.confirmSessionLength) {
            setConfirmLen(s.mode === "pomodoro" ? (settings.store.workDuration || 25) : 0);
            setConfirming(true);
        } else { s.plannedLen = settings.store.workDuration || 25; startWork(); }
    }
    function confirmStart() {
        const s = stateRef.current;
        if (s.mode === "pomodoro") s.plannedLen = Math.max(1, confirmLen);
        setConfirming(false);
        startWork();
    }
    // Pause: freeze the clock but KEEP the block on (can't browse). Rest: keep the
    // clock running to the original end (a break that doesn't unblock you early).
    function togglePause() { const s = stateRef.current; if (s.phase === "idle") return; s.paused = !s.paused; rerender(); }
    function toggleRest() { const s = stateRef.current; if (s.phase !== "work") return; s.resting = !s.resting; s.paused = false; rerender(); }
    function onReset() {
        const s = stateRef.current;
        s.phase = "idle"; s.running = false; s.paused = false; s.resting = false; s.elapsed = 0; s.cycle = 0; s.isBreakLong = false;
        s.total = mins(settings.store.workDuration) || 1500; s.remaining = s.total;
        abortArmed.current = false;
        rerender();
    }
    function onSkip() {
        const s = stateRef.current;
        if (s.phase === "work") startBreak();
        else if (s.phase === "break") finishBreak();
        else requestStart();
    }
    function onAbort() {
        if (!abortArmed.current) {
            abortArmed.current = true; setArm(x => x + 1);
            setTimeout(() => { abortArmed.current = false; setArm(x => x + 1); }, 3000);
            return;
        }
        onReset();
    }
    function setMode(m: Mode) {
        const s = stateRef.current;
        if (s.mode === m) return;
        s.mode = m; settings.store.technique = m;
        s.phase = "idle"; s.running = false; s.paused = false; s.resting = false; s.elapsed = 0;
        s.total = mins(settings.store.workDuration) || 1500; s.remaining = s.total;
        rerender();
    }

    // ---- effects: flux, interval, listeners, cortical bridge ---------------
    React.useEffect(() => {
        const onChannelSelect = (e: any) => {
            channelRef.current = { id: e?.channelId ?? (SelectedChannelStore as any).getChannelId?.() ?? null, ts: Date.now() };
            applyMsgFilter(regimeActiveRef.current);
        };
        const onMessageCreate = (e: any) => {
            if (!sessionActiveRef.current) return;
            if (settings.store.msgRateWindow <= 0 || settings.store.msgRateCount <= 0) return;
            const my = (UserStore as any).getCurrentUser?.()?.id;
            if (!my || String(e?.message?.author?.id) !== String(my)) return;
            const now = Date.now(), win = settings.store.msgRateWindow * 60000;
            const key = String(e?.message?.nonce ?? e?.message?.id ?? now);
            const arr = msgTimesRef.current.filter(x => now - x.t < win);
            if (key && arr.some(x => x.key === key)) { msgTimesRef.current = arr; return; }
            arr.push({ t: now, key });
            msgTimesRef.current = arr;
            if (arr.length >= settings.store.msgRateCount) triggerLock("messages");
        };
        try { (FluxDispatcher as any).subscribe("CHANNEL_SELECT", onChannelSelect); } catch { /* */ }
        try { (FluxDispatcher as any).subscribe("MESSAGE_CREATE", onMessageCreate); } catch { /* */ }

        const onClick = (e: MouseEvent) => {
            if (!regimeActiveRef.current || !settings.store.blockChannelLinks) return;
            const t = e.target as HTMLElement;
            if (!t || !t.closest) return;
            const anchor = t.closest('a[href*="/channels/"]');
            const mention = t.closest('[class*="mention"]') as HTMLElement | null;
            const isChannelMention = mention && (mention.textContent || "").trim().startsWith("#");
            if (anchor || isChannelMention) {
                e.preventDefault(); e.stopPropagation();
                notify("Navigation locked", "Channel links are blocked during a focus block.");
            }
        };
        const onMouseNav = (e: MouseEvent) => {
            if (regimeActiveRef.current && settings.store.hideBackForward && (e.button === 3 || e.button === 4)) {
                e.preventDefault(); e.stopPropagation();
            }
        };
        const onKeyNav = (e: KeyboardEvent) => {
            if (regimeActiveRef.current && settings.store.hideBackForward && e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
                e.preventDefault(); e.stopPropagation();
            }
        };
        document.addEventListener("click", onClick, true);
        document.addEventListener("mousedown", onMouseNav, true);
        document.addEventListener("mouseup", onMouseNav, true);
        document.addEventListener("auxclick", onMouseNav, true);
        document.addEventListener("keydown", onKeyNav, true);

        const id = setInterval(tick, 1000);

        api.start = requestStart;
        api.pause = togglePause;
        api.stop = onReset;
        api.skip = onSkip;
        api.panel = () => setFocusOpen(v => !v);
        api.cortical = () => setCorticalOpen(v => !v);
        api.pomodoro = () => setMode("pomodoro");
        api.flowmodoro = () => setMode("flowmodoro");

        return () => {
            try { (FluxDispatcher as any).unsubscribe("CHANNEL_SELECT", onChannelSelect); } catch { /* */ }
            try { (FluxDispatcher as any).unsubscribe("MESSAGE_CREATE", onMessageCreate); } catch { /* */ }
            document.removeEventListener("click", onClick, true);
            document.removeEventListener("mousedown", onMouseNav, true);
            document.removeEventListener("mouseup", onMouseNav, true);
            document.removeEventListener("auxclick", onMouseNav, true);
            document.removeEventListener("keydown", onKeyNav, true);
            clearInterval(id);
            for (const k of Object.keys(api)) delete api[k];
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---- derived display ---------------------------------------------------
    const isFlowWork = st.phase === "work" && st.mode === "flowmodoro";
    const display = st.phase === "idle"
        ? (st.mode === "flowmodoro" ? 0 : mins(st.plannedLen) || 1500)
        : isFlowWork ? st.elapsed : Math.max(0, st.remaining);
    const phaseLabel = st.phase === "idle" ? "Ready"
        : st.paused ? "Paused"
            : st.phase === "work" ? (st.resting ? "Resting" : "Focus")
                : (st.isBreakLong ? "Long break" : "Break");
    const barColor = st.phase === "break" ? GREEN : ACCENT;
    const progress = (!isFlowWork && st.phase !== "idle" && st.total > 0)
        ? Math.min(1, Math.max(0, 1 - st.remaining / st.total)) : (isFlowWork ? 1 : 0);
    const ratio = settings.store.flowmodoroRatio > 0 ? settings.store.flowmodoroRatio : 5;
    const locked = settings.store.lockSession && st.running && st.phase === "work";

    const Btn = ({ onClick, children, accent, danger }: any) => (
        <button onClick={onClick} style={{
            flex: 1, padding: "6px 4px", border: "none", borderRadius: 6, cursor: "pointer",
            fontSize: 12, fontWeight: 600, color: accent || danger ? "#fff" : TXT,
            background: danger ? RED : accent ? ACCENT : "var(--background-modifier-selected, #404249)"
        }}>{children}</button>
    );
    const LaunchBtn = ({ onClick, on, children }: any) => (
        <button onClick={onClick} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", border: "none",
            borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
            color: on ? "#fff" : TXT, background: on ? ACCENT : "var(--background-modifier-selected, #404249)"
        }}>{children}</button>
    );

    return (
        <>
            {/* ---------- top launcher ---------- */}
            <div onPointerDown={onLauncherDown} style={{
                position: "fixed", left: launcherPos.x, top: launcherPos.y, zIndex: 5200,
                display: "flex", gap: 6, padding: 5, borderRadius: 9, cursor: "grab",
                background: HEADER, boxShadow: "0 4px 16px rgba(0,0,0,.35)"
            }}>
                <LaunchBtn on={focusOpen} onClick={() => setFocusOpen(v => !v)}>⌖ Focus{st.running ? `${st.paused ? " · paused" : ` · ${fmt(display)}`}` : (settings.store.alwaysOn ? " · on" : "")}</LaunchBtn>
                <LaunchBtn on={corticalOpen} onClick={() => setCorticalOpen(v => !v)}>◇ Cortical</LaunchBtn>
                <LaunchBtn on={false} onClick={openSettings}>⚙</LaunchBtn>
            </div>

            {/* ---------- focus timer panel ---------- */}
            {focusOpen && (
                <div style={{
                    position: "fixed", left: focusPos.x, top: focusPos.y, zIndex: 5100, width: 232,
                    borderRadius: 10, overflow: "hidden", background: PANEL, color: TXT,
                    boxShadow: "0 8px 24px rgba(0,0,0,.4)", fontFamily: "var(--font-primary, sans-serif)", userSelect: "none"
                }}>
                    <div onPointerDown={onFocusDown} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "6px 10px", cursor: "grab", background: HEADER
                    }}>
                        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: .3 }}>⌖ trueFocusMode</span>
                        <span style={{ display: "flex", gap: 12 }}>
                            <span title="Plugin settings" onClick={openSettings} style={{ cursor: "pointer", color: MUTED, fontSize: 13 }}>⚙</span>
                            <span onClick={() => setFocusOpen(false)} style={{ cursor: "pointer", color: MUTED, fontSize: 14 }}>✕</span>
                        </span>
                    </div>

                    <div style={{ padding: "10px 12px 12px" }}>
                        <div style={{ display: "flex", gap: 4, padding: 3, marginBottom: 10, borderRadius: 7, background: HEADER, opacity: st.running ? .5 : 1, pointerEvents: st.running ? "none" : "auto" }}>
                            {(["pomodoro", "flowmodoro"] as Mode[]).map(m => (
                                <button key={m} onClick={() => setMode(m)} style={{
                                    flex: 1, padding: "4px 0", border: "none", borderRadius: 5, cursor: "pointer",
                                    fontSize: 11, fontWeight: 700, color: st.mode === m ? "#fff" : MUTED,
                                    background: st.mode === m ? ACCENT : "transparent"
                                }}>{m === "pomodoro" ? "Pomodoro" : "Flowmodoro"}</button>
                            ))}
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6, color: st.phase === "break" ? GREEN : ACCENT }}>{phaseLabel}{locked ? " · locked" : ""}</span>
                            <span style={{ fontSize: 11, color: MUTED }}>sessions: {st.cycle}</span>
                        </div>

                        <div style={{ fontSize: 40, fontWeight: 800, fontVariantNumeric: "tabular-nums", textAlign: "center", margin: "2px 0 8px", color: "var(--header-primary, #f2f3f5)" }}>{fmt(display)}</div>

                        <div style={{ height: 5, borderRadius: 3, marginBottom: 4, overflow: "hidden", background: HEADER }}>
                            <div style={{ height: "100%", width: `${Math.round(progress * 100)}%`, background: barColor, transition: "width .25s linear" }} />
                        </div>

                        <div style={{ fontSize: 10.5, color: MUTED, minHeight: 14, marginBottom: 10 }}>
                            {st.paused
                                ? "paused — clock frozen, Discord stays blocked"
                                : st.phase === "work" && st.resting
                                    ? `resting — blocked until the timer ends (${fmt(st.remaining)})`
                                    : isFlowWork
                                        ? `break ≈ ${fmt(Math.max(60, Math.floor(st.elapsed / ratio)))} (work ÷ ${ratio})`
                                        : st.phase === "idle"
                                            ? (st.mode === "pomodoro" ? `${st.plannedLen}m work · ${settings.store.breakDuration}m break` : `count up, then break = work ÷ ${ratio}`)
                                            : `${fmt(st.remaining)} left`}
                        </div>

                        {st.phase === "idle" ? (
                            <div style={{ display: "flex", gap: 6 }}>
                                <Btn accent onClick={requestStart}>Start</Btn>
                            </div>
                        ) : (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {/* Pause keeps the block on; safe to allow even when locked */}
                                <Btn accent={st.paused} onClick={togglePause}>{st.paused ? "Resume" : "Pause"}</Btn>

                                {/* Work: "Break" rests you but the clock keeps running to the original end */}
                                {st.phase === "work" && !isFlowWork && (
                                    <Btn onClick={toggleRest}>{st.resting ? "Back to work" : "Break"}</Btn>
                                )}
                                {isFlowWork && <Btn accent onClick={onSkip}>Take break</Btn>}

                                {/* Break -> work is not a bypass (more hidden), so allow it */}
                                {st.phase === "break" && <Btn onClick={onSkip}>Skip break</Btn>}

                                {/* Skip work->break and Reset only when not locked */}
                                {!locked && st.phase === "work" && !isFlowWork && <Btn onClick={onSkip}>Skip</Btn>}
                                {!locked && <Btn onClick={onReset}>Reset</Btn>}
                                {locked && settings.store.allowAbort && <Btn danger onClick={onAbort}>{abortArmed.current ? "Tap again" : "Abort"}</Btn>}
                            </div>
                        )}
                    </div>

                    {confirming && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.78)", display: "flex", flexDirection: "column", justifyContent: "center", padding: 16, gap: 10 }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>Confirm this block</div>
                            {st.mode === "pomodoro" ? (
                                <>
                                    <div style={{ fontSize: 28, fontWeight: 800, textAlign: "center" }}>{confirmLen}<small style={{ fontSize: 13 }}>m</small></div>
                                    <input type="range" min={5} max={120} step={5} value={confirmLen} onChange={(e: any) => setConfirmLen(parseInt(e.target.value, 10))} style={{ width: "100%" }} />
                                    <div style={{ fontSize: 11, color: MUTED }}>Length locks once you start{settings.store.allowAbort ? "" : " and can't be aborted"}.</div>
                                </>
                            ) : (
                                <div style={{ fontSize: 11.5, color: MUTED }}>Flowmodoro counts up; you commit to focusing until you choose to break.</div>
                            )}
                            <div style={{ display: "flex", gap: 6 }}>
                                <Btn onClick={() => setConfirming(false)}>Cancel</Btn>
                                <Btn accent onClick={confirmStart}>Start & lock</Btn>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ---------- cortical load popup ---------- */}
            {corticalEver.current && (
                <div style={{
                    position: "fixed", left: corticalPos.x, top: corticalPos.y, zIndex: 5100,
                    width: 440, height: 560, display: corticalOpen ? "flex" : "none", flexDirection: "column",
                    borderRadius: 10, overflow: "hidden", background: PANEL,
                    boxShadow: "0 10px 30px rgba(0,0,0,.5)", border: "1px solid var(--background-tertiary,#1e1f22)"
                }}>
                    <div onPointerDown={onCorticalDown} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "6px 10px", cursor: "grab", background: HEADER, color: TXT, flex: "0 0 auto"
                    }}>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>◇ Cortical Load{clReady || clFailed ? "" : " · loading…"}</span>
                        <span style={{ display: "flex", gap: 12 }}>
                            <span title="Plugin settings" onClick={openSettings} style={{ cursor: "pointer", color: MUTED, fontSize: 13 }}>⚙</span>
                            <span style={{ cursor: "pointer", color: MUTED, fontSize: 14 }} onClick={() => setCorticalOpen(false)}>✕</span>
                        </span>
                    </div>
                    <div style={{ position: "relative", flex: 1 }}>
                        <iframe
                            ref={iframeRef}
                            title="Cortical Load"
                            style={{ width: "100%", height: "100%", border: "none", background: "#0E141B" }}
                        />
                        {clFailed && (
                            <div style={{ position: "absolute", inset: 0, background: "rgba(14,20,27,.96)", color: "#E7EEF4", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontWeight: 700 }}>Cortical Load didn't start</div>
                                <div style={{ color: "#90A2B2" }}>Something threw while booting the app — check the console (Ctrl+Shift+I) for a "[trueFocusMode]" error. Your saved data is untouched in the plugin store.</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ---------- lock-out overlay ---------- */}
            {lockedOut && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 6000, background: "rgba(8,12,16,.94)",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    gap: 18, color: "#E7EEF4", fontFamily: "var(--font-primary, sans-serif)", textAlign: "center", padding: 24
                }}>
                    <div style={{ fontSize: 46 }}>⌖</div>
                    <div style={{ fontSize: 22, fontWeight: 800, maxWidth: 460 }}>{settings.store.lockoutMessage}</div>
                    <div style={{ fontSize: 13, color: MUTED }}>
                        {lockReason === "time"
                            ? `You've had a channel open for over ${settings.store.channelTimeLockout} minutes.`
                            : `That's ${settings.store.msgRateCount}+ messages in under ${settings.store.msgRateWindow} minutes.`}
                    </div>
                    <button onClick={dismissLock} style={{
                        padding: "11px 22px", border: "none", borderRadius: 8, cursor: "pointer",
                        fontSize: 14, fontWeight: 700, color: "#08110d", background: GREEN
                    }}>Back to studying →</button>
                </div>
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// Mount / unmount
// ---------------------------------------------------------------------------
let root: any = null;
let container: HTMLElement | null = null;

function mount() {
    if (container) return;
    container = document.createElement("div");
    container.id = "tfm-root";
    document.body.appendChild(container);
    root = (ReactDOM as any).createRoot(container);
    root.render(<App />);
}
function unmount() {
    try { root?.unmount(); } catch { /* */ }
    root = null;
    container?.remove();
    container = null;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------
export default definePlugin({
    name: "trueFocusMode",
    description: "Pomodoro/Flowmodoro focus regime: hide channels, show only your messages, lock-outs, and the Cortical Load popup.",
    authors: [{ name: "Daniel", id: 0n }],
    settings,

    commands: [
        {
            name: "focus",
            description: "Control trueFocusMode",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "action",
                    description: "What to do (default: toggle the focus panel)",
                    type: ApplicationCommandOptionType.STRING,
                    required: false,
                    choices: [
                        { name: "start", value: "start", label: "start" },
                        { name: "pause", value: "pause", label: "pause" },
                        { name: "stop", value: "stop", label: "stop / reset" },
                        { name: "skip", value: "skip", label: "skip phase" },
                        { name: "cortical", value: "cortical", label: "toggle Cortical Load" },
                        { name: "pomodoro", value: "pomodoro", label: "switch to Pomodoro" },
                        { name: "flowmodoro", value: "flowmodoro", label: "switch to Flowmodoro" }
                    ]
                }
            ],
            execute(args, ctx) {
                const action = (findOption(args, "action", "panel") as string) || "panel";
                const fn = api[action];
                if (fn) fn();
                sendBotMessage(ctx.channel.id, { content: fn ? `🎯 trueFocusMode → **${action}**` : `Unknown action: ${action}` });
            }
        }
    ],

    start() { injectStyle(); mount(); },
    stop() {
        setBodyClasses(false, "idle", "pomodoro");
        patchHistory(false);
        stopMsgObserver();
        unmount();
        removeStyle();
        regimeActiveRef.current = false;
        sessionActiveRef.current = false;
    }
});
