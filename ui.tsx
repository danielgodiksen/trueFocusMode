/* Small pure buttons, hoisted out of the panel so they aren't rebuilt each render. */
import { React } from "@webpack/common";

import { ACCENT, RED, SURFACE, TXT } from "./util";

export function Btn({ onClick, children, accent, danger }: any) {
    return (
        <button onClick={onClick} style={{
            flex: 1, padding: "6px 4px", border: "none", borderRadius: 6, cursor: "pointer",
            fontSize: 12, fontWeight: 600, color: accent || danger ? "#fff" : TXT,
            background: danger ? RED : accent ? ACCENT : SURFACE
        }}>{children}</button>
    );
}

export function LaunchBtn({ onClick, on, children }: any) {
    return (
        <button onClick={onClick} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", border: "none",
            borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
            color: on ? "#fff" : TXT, background: on ? ACCENT : SURFACE
        }}>{children}</button>
    );
}
