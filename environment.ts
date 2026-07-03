/* Everything that reaches into Discord's DOM to apply the focus regime:
 * CSS-based hiding, the todo-list message filter, and the back/forward block.
 * All reads go through E() so a committed (locked) session can't be weakened. */
import { UserStore } from "@webpack/common";

import { currentChannelId } from "./discord";
import { E } from "./settings";
import { cssEsc, parseIds, parseNames } from "./util";

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

// --- CSS injection ----------------------------------------------------------
function buildDynamicCss(): string {
    const s = E();
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

export function injectStyle() {
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
        el = document.createElement("style");
        el.id = STYLE_ID;
        document.head.appendChild(el);
    }
    el.textContent = STATIC_CSS + buildDynamicCss();
}
export function removeStyle() { document.getElementById(STYLE_ID)?.remove(); }

export function setBodyClasses(active: boolean, phase: string, mode: string) {
    const s = E();
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

// --- todo-list message filter ----------------------------------------------
// The visible message list is always the current channel, so the filter is
// toggled per-channel: OFF in the channels listed in showOthersInChannels.
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
    const allow = new Set(parseIds(E().allowedUserIds));
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

export function applyMsgFilter(regimeActive: boolean) {
    const s = E();
    const cur = String(currentChannelId() ?? "");
    const bypass = cur !== "" && parseIds(s.showOthersInChannels).includes(cur);
    const on = regimeActive && s.onlyOwnMessages && !bypass;
    document.body.classList.toggle("tfm-msgfilter", on);
    if (on) startMsgObserver(); else stopMsgObserver();
}
export function stopMessageFilter() { stopMsgObserver(); }

// --- back / forward blocking (selector-independent) -------------------------
let histPatched = false;
let origBack: any, origFwd: any, origGo: any;
export function patchHistory(on: boolean) {
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
