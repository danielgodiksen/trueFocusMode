/* Module-level runtime state shared between the component, the flux handlers,
 * and the slash command. Kept out of the component so listeners and the plugin
 * lifecycle can read it without prop-drilling. */
import { showNotification } from "@api/Notifications";
import { SettingsRouter } from "@webpack/common";

// Slash-command controller — populated by the component while mounted.
export const api: Record<string, (() => void) | undefined> = {};

export const regimeActiveRef = { current: false };   // hiding / blocking (includes always-on)
export const sessionActiveRef = { current: false };  // a real timer session (drives lock-outs)
export const channelRef = { current: { id: null as string | null, ts: Date.now() } };
export const msgTimesRef = { current: [] as { t: number; key: string; }[] };

/** Jump straight to the Vencord Plugins settings page. */
export function openSettings() {
    try {
        if ((SettingsRouter as any)?.open) { (SettingsRouter as any).open("VencordPlugins"); return; }
    } catch { /* */ }
    try { showNotification({ title: "trueFocusMode", body: "Open Settings → Plugins → trueFocusMode" }); } catch { /* */ }
}
