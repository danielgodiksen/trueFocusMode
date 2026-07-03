/* Encrypted settings vault + the strict-session seal.
 *
 * The plugin's authoritative config lives HERE — AES-GCM encrypted inside
 * Vencord's DataStore (IndexedDB) — not in settings.json. On startup the vault
 * overwrites whatever is on disk with the sealed values, so editing
 * settings.json while Discord is closed does nothing: the edit is reverted
 * before the UI mounts. Changes made through the Discord UI (the Vencord
 * settings panel) while no locked block is running are re-sealed within a
 * second, which makes the in-client UI the one sanctioned way to change config.
 *
 * The session seal persists a strict-mode block across reloads and full
 * restarts: the block's frozen snapshot and wall-clock end time survive, and
 * the block resumes on the next launch until that end time has truly passed.
 *
 * Honest limit: a client plugin has no OS keychain, so the AES key must live
 * next to the ciphertext. This is tamper-resistance, not secrecy — defeating it
 * takes devtools/IndexedDB surgery or rebuilding Vencord without the plugin,
 * i.e. deliberate advanced tooling, never a casual settings.json edit. */
import * as DataStore from "@api/DataStore";

import { committedRef, ENFORCE_KEYS, settings } from "./settings";

const KEY_K = "tfm:vault:key";
const CONF_K = "tfm:vault:settings";
const SESS_K = "tfm:vault:session";

export interface SessionSeal {
    phase: "work" | "break";
    mode: "pomodoro" | "flowmodoro";
    endsAt: number;      // epoch ms the phase ends (0 for flowmodoro work, which counts up)
    startedAt: number;   // epoch ms work started (flowmodoro elapsed = now - startedAt)
    plannedLen: number;
    cycle: number;
    snapshot: Record<string, any>;   // the enforced settings snapshot to resume with
    savedAt: number;
}

let aesKey: CryptoKey | null = null;
let sealedConf: Record<string, any> | null = null;   // in-memory mirror of the sealed config
let pendingSession: SessionSeal | null = null;
let watcher: ReturnType<typeof setInterval> | null = null;
let writing = false;

const subtle = () => (globalThis.crypto && crypto.subtle) || null;

/** Bytes from DataStore (possibly a view on a shared/resizable buffer, per the
 *  newer TS lib types) → a plain ArrayBuffer WebCrypto accepts. */
function toAB(u: Uint8Array): ArrayBuffer {
    return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

async function getKey(): Promise<CryptoKey | null> {
    const s = subtle();
    if (!s) return null;
    if (aesKey) return aesKey;
    let raw = await DataStore.get(KEY_K) as Uint8Array | ArrayBuffer | undefined;
    if (raw instanceof ArrayBuffer) raw = new Uint8Array(raw);
    if (!(raw instanceof Uint8Array) || raw.byteLength !== 32) {
        raw = crypto.getRandomValues(new Uint8Array(32));
        await DataStore.set(KEY_K, raw);
    }
    aesKey = await s.importKey("raw", toAB(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
    return aesKey;
}

async function sealTo(storeKey: string, obj: any): Promise<void> {
    const k = await getKey();
    if (!k) return;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const pt = new TextEncoder().encode(JSON.stringify(obj));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, pt);
    await DataStore.set(storeKey, { iv, ct: new Uint8Array(ct) });
}

/** Decrypt a sealed blob; null if absent, tampered with, or corrupt (GCM auth fails). */
async function openFrom(storeKey: string): Promise<any | null> {
    const k = await getKey();
    if (!k) return null;
    const blob = await DataStore.get(storeKey) as { iv: Uint8Array; ct: Uint8Array; } | undefined;
    if (!blob?.iv || !blob?.ct) return null;
    try {
        const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toAB(blob.iv) }, k, toAB(blob.ct));
        return JSON.parse(new TextDecoder().decode(pt));
    } catch {
        return null;
    }
}

function confSnapshot(): Record<string, any> {
    const o: Record<string, any> = {};
    for (const k of ENFORCE_KEYS) o[k] = (settings.store as any)[k];
    return o;
}

/** Load the vault: restore sealed config over settings.json, pick up any
 *  persisted strict session, and start mirroring UI changes back into the seal.
 *  Call before mounting the UI. */
export async function initVault(): Promise<void> {
    if (!subtle()) {
        console.error("[trueFocusMode] WebCrypto unavailable — vault disabled, settings are not sealed.");
        return;
    }
    pendingSession = await openFrom(SESS_K);

    const conf = await openFrom(CONF_K);
    if (conf) {
        // The vault, not settings.json, is authoritative: revert any on-disk edit.
        for (const k of ENFORCE_KEYS) {
            if (k in conf && (settings.store as any)[k] !== conf[k]) {
                try { (settings.store as any)[k] = conf[k]; } catch { /* */ }
            }
        }
        sealedConf = conf;
    } else {
        // First run — or a tampered/corrupt blob. Adopt current settings and reseal.
        sealedConf = confSnapshot();
        await sealTo(CONF_K, sealedConf);
    }

    // Mirror sanctioned UI edits into the seal. During a committed block the
    // latch in settings.ts reverts changes instead, so nothing leaks in here.
    if (!watcher) {
        watcher = setInterval(() => {
            if (committedRef.current || writing || !sealedConf) return;
            const cur = confSnapshot();
            if (JSON.stringify(cur) !== JSON.stringify(sealedConf)) {
                writing = true;
                sealTo(CONF_K, cur)
                    .then(() => { sealedConf = cur; })
                    .catch(() => { /* */ })
                    .finally(() => { writing = false; });
            }
        }, 1000);
    }
}

export function stopVault() {
    if (watcher) { clearInterval(watcher); watcher = null; }
}

/** The strict session persisted from a previous launch, if any (one-shot read). */
export function takePendingSession(): SessionSeal | null {
    const p = pendingSession;
    pendingSession = null;
    return p;
}

export function sealSession(s: SessionSeal) {
    sealTo(SESS_K, s).catch(e => console.error("[trueFocusMode] session seal failed:", e));
}

export function clearSessionSeal() {
    pendingSession = null;
    DataStore.del(SESS_K).catch(() => { /* */ });
}
