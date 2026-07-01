# trueFocusMode

A Vencord **userplugin** that turns Discord into a focus environment while a Pomodoro/Flowmodoro timer runs, plus an in-client popup for your **Cortical Load** app. Configure everything in **Settings → Plugins → trueFocusMode**.

## Install (userplugins need Vencord built from source)

```bash
git clone https://github.com/Vendicated/Vencord
cd Vencord && pnpm i
mkdir -p src/userplugins/trueFocusMode
# copy index.tsx and corticalLoadAsset.ts into that folder
pnpm build && pnpm inject
```
Then **Ctrl/Cmd+R**, enable **trueFocusMode** in Settings → Plugins. A draggable `⌖ Focus / ◇ Cortical` bar appears at the top.

Folder must contain: `index.tsx`, `corticalApp.ts`, and `corticalLoadAsset.ts`.

## Cortical Load (fixed — no more "didn't start")

Your client enforces a strict CSP, so **any** script that arrives as page content — inline, `blob:`, or `srcdoc` — is blocked. That's why the embedded app wouldn't start.

The app's logic is now **compiled into the plugin bundle** (`corticalApp.ts`) and run as an ordinary function call, which is never gated by the page CSP the way a script tag is. It executes against an isolated same-origin `about:blank` iframe (so its own `body{}` / `.card` styles stay off Discord), and its `window.storage` is wired straight to Vencord's **DataStore** (IndexedDB) under the `cortical:` prefix. So it runs fully inside Discord and stores its own data in the plugin — no URL, no file, persists across restarts. Export/Import inside the app still works as a backup.

If you ever replace `cortical-load_2.html` with a newer version, regenerate `corticalApp.ts` (the `<script>` body, wrapped in `export function runCorticalApp(window, document){ … }`) and `corticalLoadAsset.ts` (base64 of the head + the body-minus-script).

## Other fixes from your report

- **Todo-list mode no longer glitches.** Foreign messages are hidden with `visibility:hidden` (their height is kept), so Discord's scroller no longer keeps loading history to "fill" the view. Trade-off: hidden messages leave blank gaps rather than collapsing — that's the price of a stable, non-flickering list. Each message is tagged once, so scanning stays cheap.
- **Unabortable blocks.** New setting **Allow aborting a locked block**. Off = the work block can't be aborted from the panel. Reloading Discord (Ctrl/Cmd+R) always resets the timer, so you're never truly trapped.
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

## Finding IDs

Enable **Developer Mode** (Settings → Advanced), then right-click → **Copy Server ID** (`soloServerId`) / **Copy User ID** (`allowedUserIds`; lionbot `1487524020277739674` is pre-filled).

## Selectors to VERIFY (Discord ships hashed classes)

If something doesn't hide, right-click it → **Inspect**, then update the rule in `index.tsx`:
- **Solo server** — assumes guild items are `[data-list-item-id="guildsnav___<id>"]` (`buildDynamicCss`).
- **Only specific channels** — assumes channel items are `[data-list-item-id="channels___<id>"]` (`buildDynamicCss`).
- **Folders (hide all)** — assumes the folder wrapper class contains `folder_` (`STATIC_CSS`).
- **Folders during Pomodoro** — reveals a folder whose accessible name (`aria-label`) contains the text you type. Folder naming in the DOM is the least reliable part; if it doesn't work, Inspect the folder and adjust the `[aria-label*=...]` match in `buildDynamicCss`.
- **Discover** — assumes `aria-label="Explore Discoverable Servers"`.
- **Back/forward CSS hide** — `aria-label` guess; the JS behaviour-block is the real safeguard.

Reliable: channel sidebar, server list, member list + button, Pinned, Threads, and the fiber-based own-messages filter.

## Notes

- Everything (hiding, link-blocking, message filter, lock-outs, history block) applies **only during an active session** — and during breaks only if *Hide during break* is on. Otherwise Discord is untouched.
- The own-messages filter reads each message's author from its React fiber, so it handles default-avatar users and the allow-list without fragile source patches; if a future Discord refactor changes the prop shape it simply shows everything.
