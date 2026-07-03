/* Cortical Load runs its compiled logic (corticalApp.ts) as a normal function
 * call — never gated by the page CSP the way an inline / blob / srcdoc script is
 * — against an isolated same-origin iframe, and persists via window.storage,
 * which we bridge straight to Vencord's DataStore under the "cortical:" prefix. */
import * as DataStore from "@api/DataStore";

import { runCorticalApp } from "./corticalApp";
import { CL_BODY_B64, CL_HEAD_B64 } from "./corticalLoadAsset";
import { b64ToUtf8 } from "./util";

const CL_PREFIX = "cortical:";

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

/** Populate an iframe with the app's markup + styles, then boot its logic. */
export function populateCortical(iframe: HTMLIFrameElement): boolean {
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
