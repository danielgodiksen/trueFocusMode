# trueFocusMode

A Vencord **userplugin** that turns Discord into a focus environment while a Pomodoro/Flowmodoro timer runs, plus an in-client popup for your **Cortical Load** app. It scales from a soft nudge to a hard commitment device: an ordinary block just hides distractions, while a **strict** block survives reloads and restarts, can't be aborted, and refuses to let the plugin be disabled until it ends (see [TRUE STRICT MODE](#true-strict-mode-survives-reload--restart)). Configure everything in **Settings → Plugins → trueFocusMode**.

## Install (userplugins need Vencord built from source)

```bash
git clone https://github.com/Vendicated/Vencord
cd Vencord && pnpm i
mkdir -p src/userplugins/trueFocusMode
# copy the ENTIRE trueFocusMode folder (all .ts / .tsx files) into that folder
pnpm build && pnpm inject
```
Then **Ctrl/Cmd+R**, enable **trueFocusMode** in Settings → Plugins. A draggable `⌖ Focus / ◇ Cortical / ⚙` bar appears at the top.

The plugin is split across several files — copy **all** of them:
`index.tsx` (UI + wiring), `settings.ts` (settings + the lock latch), `vault.ts` (encrypted config + strict-session persistence), `environment.ts` (DOM hiding, message filter, nav block), `cortical.ts` + `corticalApp.ts` + `corticalLoadAsset.ts` (the Cortical Load popup), `state.ts`, `discord.ts`, `util.ts`, `ui.tsx`.

## Cortical Load (fixed — no more "didn't start")

Your client enforces a strict CSP, so **any** script that arrives as page content — inline, `blob:`, or `srcdoc` — is blocked. That's why the embedded app wouldn't start.

The app's logic is now **compiled into the plugin bundle** (`corticalApp.ts`) and run as an ordinary function call, which is never gated by the page CSP the way a script tag is. It executes against an isolated same-origin `about:blank` iframe (so its own `body{}` / `.card` styles stay off Discord), and its `window.storage` is wired straight to Vencord's **DataStore** (IndexedDB) under the `cortical:` prefix. So it runs fully inside Discord and stores its own data in the plugin — no URL, no file, persists across restarts. Export/Import inside the app still works as a backup.

If you ever replace `cortical-load_2.html` with a newer version, regenerate `corticalApp.ts` (the `<script>` body, wrapped in `export function runCorticalApp(window, document){ … }`) and `corticalLoadAsset.ts` (base64 of the head + the body-minus-script).

## Other fixes from your report

- **Todo-list mode no longer glitches.** Foreign messages are hidden with `visibility:hidden` (their height is kept), so Discord's scroller no longer keeps loading history to "fill" the view. Trade-off: hidden messages leave blank gaps rather than collapsing — that's the price of a stable, non-flickering list. Each message is tagged once, so scanning stays cheap.
- **Unabortable blocks.** New setting **Allow aborting a locked block**. Off = the work block can't be aborted from the panel. Reloading Discord (Ctrl/Cmd+R) resets the timer as an escape hatch — *unless* **strictMode** is on, which closes even that on purpose (see [TRUE STRICT MODE](#true-strict-mode-survives-reload--restart)).
- **Back/forward is actually blocked now** (my old aria-label guess was wrong). While focusing it neutralises `history.back/forward/go`, blocks the mouse side-buttons (buttons 3/4) and **Alt+←/→**. The on-screen buttons are also hidden via CSS if the label guess matches — but even if it doesn't, the navigation itself does nothing.
- **Folders are matched by NAME now.** `allowedFoldersInPomodoro` takes folder names (comma separated) revealed during Pomodoro work blocks — see VERIFY note.

## New

- **Always-on lockdown.** Turn on **Keep hiding / blocking ON at all times** and the whole hiding regime (servers, channels, members, folders, back/forward, link-blocking, only-own-messages, solo-server, channel restriction) applies continuously — no session required. The timer-driven **lock-outs** (channel-time / message-rate "go study" screen) still only fire during a real session, so always-on won't nag you while you're just restricting your view.
- **Only specific channels.** Turn on **Show ONLY specific channels** and put channel IDs in **allowedChannelIds** (right-click a channel → Copy Channel ID). Every other channel in the sidebar is hidden. Pair it with **Hide the whole server list** or **solo-server** to lock yourself down to a handful of channels. (Leave *Hide the channel sidebar* off when using this — that one hides the sidebar entirely.)
- **One-tap settings.** A ⚙ button on the launcher bar and in both the Focus and Cortical headers jumps straight to Vencord's Plugins page, so you're not digging through menus to change a value.
- **Per-channel message visibility.** Todo-list mode (only-your-messages) now has an exception list: **showOthersInChannels** takes channel IDs where *everyone's* messages stay visible, while every other channel still hides others. So one channel can be a normal conversation while the rest stay filtered.
- **Pause & Break that can't be used to escape.**
  - **Pause** freezes the clock but keeps the block on — you can't browse Discord while paused, and paused time doesn't count down, so it can only lengthen the block, never shorten it. Available even when the block is locked.
  - **Break** (Pomodoro work) lets you rest, but the clock keeps running to the block's original end, so Discord stays blocked until the time you committed to has actually passed — no bypassing the block faster. Available even when locked. ("Take break" in Flowmodoro is unchanged — you earn a proportional break by working.)

## Locked sessions & tamper-resistance

When **Lock a work block once started** is on, starting a block "commits" it. For the whole committed session — work **and** breaks — the plugin:

- **Freezes every setting.** It reads its behaviour from a snapshot taken at start, and reverts any change you make in the Vencord panel within a second. So you can't flip *allow abort*, *hide back/forward*, a hide toggle, or a lock-out threshold mid-block to weaken it. This fixes the two bypasses you hit: enabling abort mid-unabortable-session, and disabling the navigation option to unlock it — both are now ignored until the block ends.
- **Gates every exit.** Skip-to-break, Reset, and the `/focus stop` / `/focus skip` slash actions are blocked during a locked work block; the sanctioned exits are **Abort** (only if you left *allow abort* on when you started) and — new — **Reset during a break**, which ends the committed session between blocks. That break-time exit exists so a strict session can always end *somewhere* now that reloading no longer resets it.

## TRUE STRICT MODE (survives reload & restart)

Turn on **strictMode** and a locked block becomes a real commitment:

- **Reloading or quitting Discord no longer ends the block.** The block's frozen settings snapshot and its wall-clock end time are sealed (encrypted) into the plugin's IndexedDB store and re-sealed every 15 seconds. On the next launch the block **resumes where the clock left off** — the commitment is to a wall-clock end time, so a Ctrl+R, a full restart, or a "quit and come back" all land you back inside the same block until that time has truly passed. If the block finished while Discord was closed, you just get a "block complete" note.
- **Strict blocks can never be aborted.** *allow abort* is forced off in the snapshot; the Abort and Reset buttons don't exist during a strict work block. Pause and Break still work (they can only lengthen the block, never shorten it).
- **The plugin can't be disabled mid-block.** Toggling trueFocusMode off in Settings → Plugins during a strict work block fails: the plugin refuses to stop, Vencord reports the failure, and it stays enabled — so "disable, then reload" is not an escape either. Once the work block ends (break time), disabling works normally.

## Encrypted config (settings live in the vault, not settings.json)

The plugin's authoritative config is an **AES-256-GCM encrypted copy** of every protected setting, stored in Vencord's DataStore (IndexedDB) under `tfm:vault:*`. What that buys you:

- **Editing `settings.json` on disk does nothing.** At startup — before the UI mounts — the vault decrypts its sealed copy and overwrites whatever is on disk. An edit made while Discord was closed is reverted before it ever takes effect. (GCM is authenticated, so a tampered blob simply fails to decrypt rather than feeding you attacker-chosen values.)
- **The Discord UI is the only sanctioned way to change config.** Changes you make in the Vencord panel while *no locked block is running* are re-sealed into the vault within a second, and survive normally. During a locked block the freeze latch reverts them, as before.

**Honest limits (please read):** a Vencord plugin is JavaScript running *inside* Discord, so this is **tamper-resistance, not real secrecy** — the AES key necessarily lives in the same IndexedDB (a client plugin has no OS keychain). What's changed is *what it takes* to escape. Casual escapes (reload, quit, edit settings.json, flip a toggle) are all closed now. What remains requires deliberate, advanced tooling: devtools/IndexedDB surgery (delete the `tfm:vault:*` keys), changing the OS clock, or removing the plugin from Vencord's source and rebuilding. If you want a block even those can't touch, pair this with an OS-level tool like Cold Turkey / LeechBlock.

## Finding IDs

Enable **Developer Mode** (Settings → Advanced), then right-click → **Copy Server ID** (`soloServerId`) / **Copy Channel ID** (`allowedChannelIds`, `showOthersInChannels`) / **Copy User ID** (`allowedUserIds`; lionbot `1487524020277739674` is pre-filled).

## Selectors to VERIFY (Discord ships hashed classes)

If something doesn't hide, right-click it → **Inspect**, then update the rule in `environment.ts`:
- **Solo server** — assumes guild items are `[data-list-item-id="guildsnav___<id>"]` (`buildDynamicCss`).
- **Only specific channels** — assumes channel items are `[data-list-item-id="channels___<id>"]` (`buildDynamicCss`).
- **Folders (hide all)** — assumes the folder wrapper class contains `folder_` (`STATIC_CSS`).
- **Folders during Pomodoro** — reveals a folder whose accessible name (`aria-label`) contains the text you type. Folder naming in the DOM is the least reliable part; if it doesn't work, Inspect the folder and adjust the `[aria-label*=...]` match in `buildDynamicCss`.
- **Discover** — assumes `aria-label="Explore Discoverable Servers"`.
- **Back/forward CSS hide** — `aria-label` guess; the JS behaviour-block is the real safeguard.

Reliable: channel sidebar, server list, member list + button, Pinned, Threads, and the fiber-based own-messages filter.

## File layout

`index.tsx` UI + timer state machine + plugin entry · `settings.ts` settings + enforcement latch · `vault.ts` encrypted config vault + strict-session seal · `environment.ts` DOM hiding, message filter, history block · `cortical.ts` + `corticalApp.ts` + `corticalLoadAsset.ts` the popup · `state.ts` shared refs + settings shortcut · `discord.ts` webpack lookups · `util.ts` helpers/tokens · `ui.tsx` buttons.

## Notes

- Hiding, link-blocking, the message filter, the history block and the navigation block apply during an active session (and during breaks only if *Hide during break* is on), **or continuously** if *always-on* is set. Otherwise Discord is untouched. The "go study" lock-outs only fire during a real session.
- The own-messages filter reads each message's author from its React fiber, so it handles default-avatar users and the allow-list without fragile source patches; if a future Discord refactor changes the prop shape it simply shows everything.
