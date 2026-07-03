/* Plugin settings + the enforcement latch. */
import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    // -- timer ---------------------------------------------------------------
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
    lockSession: { type: OptionType.BOOLEAN, description: "Lock a work block once started (freezes settings; no skip/reset)", default: true },
    allowAbort: { type: OptionType.BOOLEAN, description: "Allow aborting a locked block (off = unabortable; reload Discord to override)", default: true },

    // -- what to hide --------------------------------------------------------
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

    // -- solo server ---------------------------------------------------------
    soloServerMode: { type: OptionType.BOOLEAN, description: "Hide every server except one chosen below", default: false },
    soloServerId: { type: OptionType.STRING, description: "The one server (guild) ID to keep visible", default: "" },
    keepHomeButton: { type: OptionType.BOOLEAN, description: "When solo-server is on, also keep the Home / DM button", default: false },

    // -- messages ------------------------------------------------------------
    onlyOwnMessages: { type: OptionType.BOOLEAN, description: "Show only your own messages in a channel (todo-list mode)", default: true },
    allowedUserIds: { type: OptionType.STRING, description: "Other user IDs whose messages stay visible (comma separated)", default: "1487524020277739674" },
    showOthersInChannels: { type: OptionType.STRING, description: "Channel IDs where EVERYONE's messages stay visible (todo-list mode off there; comma separated)", default: "" },
    blockChannelLinks: { type: OptionType.BOOLEAN, description: "Block opening other channels via links / mentions", default: true },

    // -- lock-outs -----------------------------------------------------------
    channelTimeLockout: { type: OptionType.NUMBER, description: "Lock the UI after this many minutes in one channel (0 = off)", default: 20 },
    msgRateCount: { type: OptionType.NUMBER, description: "Lock the UI after this many of your messages…", default: 5 },
    msgRateWindow: { type: OptionType.NUMBER, description: "…within this many minutes (0 = off)", default: 4 },
    lockoutMessage: { type: OptionType.STRING, description: "What the lock-out screen tells you", default: "Enough chat — get back to studying." },

    hideDuringBreak: { type: OptionType.BOOLEAN, description: "Keep hiding / blocking during breaks too", default: false },
    notify: { type: OptionType.BOOLEAN, description: "Notify when a phase ends", default: true }
});

/* ---------------------------------------------------------------------------
 * Enforcement latch
 * While a "committed" block is running (a locked session), the settings are
 * frozen: the plugin reads its behaviour from a snapshot taken at the start via
 * E(), and any change made in the Vencord panel is reverted within a second.
 * This closes every "flip the setting to escape" bypass — abort, navigation,
 * hides and lock-outs all read the snapshot, so nothing can be weakened mid-block.
 *
 * Honest limit: a client plugin cannot make itself undeletable, cannot lock or
 * hide its settings file on disk, and cannot stop you quitting Discord — those
 * are OS-level. Quitting (or reloading) Discord always ends the block. This latch
 * only hardens the running client, which is where every listed bypass happens.
 * ------------------------------------------------------------------------- */
const ENFORCE_KEYS = [
    "technique", "workDuration", "breakDuration", "longBreakDuration", "pomodorosUntilLongBreak",
    "flowmodoroRatio", "confirmSessionLength", "lockSession", "allowAbort", "alwaysOn",
    "hideChannels", "restrictChannels", "allowedChannelIds", "hideServers", "hideMembers",
    "hideBackForward", "hidePinned", "hideThreads", "hideDiscover", "hideServerFolders",
    "allowedFoldersInPomodoro", "soloServerMode", "soloServerId", "keepHomeButton",
    "onlyOwnMessages", "allowedUserIds", "showOthersInChannels", "blockChannelLinks",
    "channelTimeLockout", "msgRateCount", "msgRateWindow", "lockoutMessage", "hideDuringBreak", "notify"
];

export const committedRef = { current: false };
const enforcedRef = { current: null as Record<string, any> | null };

/** Read the enforced snapshot while committed, otherwise the live setting. */
export function E(): any { return enforcedRef.current || settings.store; }

function snapshot(): Record<string, any> {
    const o: Record<string, any> = {};
    for (const k of ENFORCE_KEYS) o[k] = (settings.store as any)[k];
    return o;
}

/** Revert any settings a user changed back to the committed snapshot. */
export function revertSettings() {
    const e = enforcedRef.current;
    if (!e) return;
    for (const k of ENFORCE_KEYS) {
        if ((settings.store as any)[k] !== e[k]) { try { (settings.store as any)[k] = e[k]; } catch { /* */ } }
    }
}

/** Freeze settings for the session — only if the user opted into locked sessions. */
export function beginCommit() {
    if (!settings.store.lockSession) return;
    enforcedRef.current = snapshot();
    committedRef.current = true;
}
export function endCommit() { committedRef.current = false; enforcedRef.current = null; }
