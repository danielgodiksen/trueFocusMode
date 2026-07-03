/*
 * trueFocusMode — a Vencord userplugin
 * ------------------------------------------------------------------
 * A Pomodoro / Flowmodoro focus regime for Discord. While a session is active
 * (or always, with "always-on") it can hide channels, servers, members, folders,
 * discover, pinned and threads; block back/forward navigation and channel links;
 * keep only one server or only chosen channels; show only your own messages
 * (todo-list mode, with per-user and per-channel exceptions); lock you out after
 * too long in a channel or a burst of messages; and run the Cortical Load app in
 * an in-client popup.
 *
 * A locked block is a commitment device: once started, settings are frozen and the
 * usual escapes (flip a setting, skip, reset) are gated. See settings.ts for the
 * enforcement latch and its honest limits (a client plugin can't survive quitting
 * Discord or on-disk edits).
 *
 * Structure:  settings.ts (settings + latch) · environment.ts (DOM hiding, filter,
 * history) · cortical.ts (popup) · state.ts (shared refs) · util.ts · ui.tsx.
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { showNotification } from "@api/Notifications";
import definePlugin from "@utils/types";
import { FluxDispatcher, React, UserStore } from "@webpack/common";

import { populateCortical } from "./cortical";
import { currentChannelId, ReactDOM } from "./discord";
import { applyMsgFilter, injectStyle, patchHistory, removeStyle, setBodyClasses, stopMessageFilter } from "./environment";
import { beginCommit, committedRef, E, endCommit, revertSettings, settings } from "./settings";
import { api, channelRef, msgTimesRef, openSettings, regimeActiveRef, sessionActiveRef } from "./state";
import { Btn, LaunchBtn } from "./ui";
import {
    ACCENT, fmt, GREEN, HEADER, MUTED, mins, Mode, PANEL, Phase, TXT, useDrag
} from "./util";

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
    const es = E();   // enforced snapshot while a locked block runs, else live settings

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
        if (!E().notify) return;
        try { showNotification({ title, body }); } catch { /* */ }
    }

    const sessionActive = st.running && (st.phase === "work" || (st.phase === "break" && es.hideDuringBreak));
    const regimeActive = es.alwaysOn || sessionActive;

    // Regime is applied whenever this key changes. Reads go through `es` so a
    // locked block can't be weakened by toggling settings mid-block.
    const cssKey = [
        regimeActive, sessionActive, st.phase, st.mode, es.alwaysOn,
        es.hideChannels, es.restrictChannels, es.allowedChannelIds, es.hideServers, es.hideMembers,
        es.hideBackForward, es.hidePinned, es.hideThreads, es.hideDiscover, es.hideServerFolders,
        es.soloServerMode, es.soloServerId, es.keepHomeButton, es.allowedFoldersInPomodoro,
        es.onlyOwnMessages, es.allowedUserIds, es.showOthersInChannels
    ].join("|");

    React.useEffect(() => {
        injectStyle();
        setBodyClasses(regimeActive, st.phase, st.mode);
        regimeActiveRef.current = regimeActive;
        sessionActiveRef.current = sessionActive;
        patchHistory(regimeActive && es.hideBackForward);
        applyMsgFilter(regimeActive);
        if (regimeActive) channelRef.current = { id: currentChannelId(), ts: Date.now() };
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
                if (ifr && populateCortical(ifr)) { clPopulated.current = true; setClReady(true); return; }
            } catch (e) {
                console.error("[trueFocusMode] Cortical Load failed:", e);
                setClFailed(true);
                return;
            }
            if (tries > 0) setTimeout(() => attempt(tries - 1), 60);   // wait for the iframe doc
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
        else s.elapsed = 0;
        channelRef.current = { id: currentChannelId(), ts: Date.now() };
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
        if (committedRef.current) revertSettings();   // keep frozen settings frozen
        const s = stateRef.current;
        if (sessionActiveRef.current && !s.paused && E().channelTimeLockout > 0 && channelRef.current.id) {
            if (Date.now() - channelRef.current.ts > E().channelTimeLockout * 60000) triggerLock("time");
        }
        if (!s.running || s.phase === "idle" || s.paused) return;   // paused: block holds, clock frozen
        if (s.phase === "work" && s.mode === "flowmodoro") { s.elapsed += 1; rerender(); return; }
        s.remaining -= 1;   // "rest" does NOT stop this — the block runs to the original end
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
        channelRef.current = { id: currentChannelId(), ts: Date.now() };
        msgTimesRef.current = [];
    }

    // ---- controls ----------------------------------------------------------
    function requestStart() {
        const s = stateRef.current;
        if (s.phase !== "idle") { s.paused = false; rerender(); return; }   // resume
        if (settings.store.confirmSessionLength) {
            setConfirmLen(s.mode === "pomodoro" ? (settings.store.workDuration || 25) : 0);
            setConfirming(true);
        } else { s.plannedLen = settings.store.workDuration || 25; beginCommit(); startWork(); }
    }
    function confirmStart() {
        const s = stateRef.current;
        if (s.mode === "pomodoro") s.plannedLen = Math.max(1, confirmLen);
        setConfirming(false);
        beginCommit();
        startWork();
    }
    // Pause freezes the clock but keeps the block on; Rest keeps the clock running
    // to the original end (a break that can't unblock you early).
    function togglePause() { const s = stateRef.current; if (s.phase === "idle") return; s.paused = !s.paused; rerender(); }
    function toggleRest() { const s = stateRef.current; if (s.phase !== "work") return; s.resting = !s.resting; s.paused = false; rerender(); }

    function onReset() {
        if (committedRef.current && !E().allowAbort) return;   // unabortable within the client
        const s = stateRef.current;
        s.phase = "idle"; s.running = false; s.paused = false; s.resting = false;
        s.elapsed = 0; s.cycle = 0; s.isBreakLong = false;
        s.total = mins(settings.store.workDuration) || 1500; s.remaining = s.total;
        abortArmed.current = false;
        endCommit();
        rerender();
    }
    function onSkip() {
        const s = stateRef.current;
        const flow = s.mode === "flowmodoro";
        if (committedRef.current && s.phase === "work" && !flow) return;   // no skipping a locked block to break
        if (s.phase === "work") startBreak();
        else if (s.phase === "break") finishBreak();
        else requestStart();
    }
    function onAbort() {
        if (!E().allowAbort) return;
        if (!abortArmed.current) {
            abortArmed.current = true; setArm(x => x + 1);
            setTimeout(() => { abortArmed.current = false; setArm(x => x + 1); }, 3000);
            return;
        }
        onReset();
    }
    function setMode(m: Mode) {
        if (committedRef.current) return;   // can't switch technique mid-locked-session
        const s = stateRef.current;
        if (s.mode === m) return;
        s.mode = m; settings.store.technique = m;
        s.phase = "idle"; s.running = false; s.paused = false; s.resting = false; s.elapsed = 0;
        s.total = mins(settings.store.workDuration) || 1500; s.remaining = s.total;
        rerender();
    }

    // ---- flux subscriptions + interval + slash-command api -----------------
    React.useEffect(() => {
        const onChannelSelect = (e: any) => {
            channelRef.current = { id: e?.channelId ?? currentChannelId(), ts: Date.now() };
            applyMsgFilter(regimeActiveRef.current);
        };
        const onMessageCreate = (e: any) => {
            if (!sessionActiveRef.current) return;
            const win = E().msgRateWindow, cnt = E().msgRateCount;
            if (win <= 0 || cnt <= 0) return;
            const my = (UserStore as any).getCurrentUser?.()?.id;
            if (!my || String(e?.message?.author?.id) !== String(my)) return;
            const now = Date.now(), w = win * 60000;
            const key = String(e?.message?.nonce ?? e?.message?.id ?? now);
            const arr = msgTimesRef.current.filter(x => now - x.t < w);
            if (key && arr.some(x => x.key === key)) { msgTimesRef.current = arr; return; }   // drop dup echo
            arr.push({ t: now, key });
            msgTimesRef.current = arr;
            if (arr.length >= cnt) triggerLock("messages");
        };
        try { (FluxDispatcher as any).subscribe("CHANNEL_SELECT", onChannelSelect); } catch { /* */ }
        try { (FluxDispatcher as any).subscribe("MESSAGE_CREATE", onMessageCreate); } catch { /* */ }

        const onClick = (e: MouseEvent) => {
            if (!regimeActiveRef.current || !E().blockChannelLinks) return;
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
            if (regimeActiveRef.current && E().hideBackForward && (e.button === 3 || e.button === 4)) {
                e.preventDefault(); e.stopPropagation();
            }
        };
        const onKeyNav = (e: KeyboardEvent) => {
            if (regimeActiveRef.current && E().hideBackForward && e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
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
    const locked = es.lockSession && st.running && st.phase === "work";
    const canReset = !committedRef.current || es.allowAbort;

    return (
        <>
            {/* ---------- top launcher ---------- */}
            <div onPointerDown={onLauncherDown} style={{
                position: "fixed", left: launcherPos.x, top: launcherPos.y, zIndex: 5200,
                display: "flex", gap: 6, padding: 5, borderRadius: 9, cursor: "grab",
                background: HEADER, boxShadow: "0 4px 16px rgba(0,0,0,.35)"
            }}>
                <LaunchBtn on={focusOpen} onClick={() => setFocusOpen(v => !v)}>⌖ Focus{st.running ? (st.paused ? " · paused" : ` · ${fmt(display)}`) : (es.alwaysOn ? " · on" : "")}</LaunchBtn>
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
                                <Btn accent={st.paused} onClick={togglePause}>{st.paused ? "Resume" : "Pause"}</Btn>

                                {st.phase === "work" && !isFlowWork && (
                                    <Btn onClick={toggleRest}>{st.resting ? "Back to work" : "Break"}</Btn>
                                )}
                                {isFlowWork && <Btn accent onClick={onSkip}>Take break</Btn>}
                                {st.phase === "break" && <Btn onClick={onSkip}>Skip break</Btn>}

                                {!locked && st.phase === "work" && !isFlowWork && <Btn onClick={onSkip}>Skip</Btn>}
                                {!locked && canReset && <Btn onClick={onReset}>Reset</Btn>}
                                {locked && es.allowAbort && <Btn danger onClick={onAbort}>{abortArmed.current ? "Tap again" : "Abort"}</Btn>}
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
                                    <div style={{ fontSize: 11, color: MUTED }}>Length locks once you start{es.allowAbort ? "" : " and can't be aborted"}.</div>
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
                        <iframe ref={iframeRef} title="Cortical Load" style={{ width: "100%", height: "100%", border: "none", background: "#0E141B" }} />
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
                    <div style={{ fontSize: 22, fontWeight: 800, maxWidth: 460 }}>{es.lockoutMessage}</div>
                    <div style={{ fontSize: 13, color: MUTED }}>
                        {lockReason === "time"
                            ? `You've had a channel open for over ${es.channelTimeLockout} minutes.`
                            : `That's ${es.msgRateCount}+ messages in under ${es.msgRateWindow} minutes.`}
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
        stopMessageFilter();
        endCommit();
        unmount();
        removeStyle();
        regimeActiveRef.current = false;
        sessionActiveRef.current = false;
    }
});
