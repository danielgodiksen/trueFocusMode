/* Lazily-resolved Discord internals, in one place so they aren't re-found per module. */
import { findByPropsLazy, findStoreLazy } from "@webpack";

export const ReactDOM = findByPropsLazy("createRoot");
export const SelectedChannelStore = findStoreLazy("SelectedChannelStore");

export function currentChannelId(): string | null {
    return (SelectedChannelStore as any).getChannelId?.() ?? null;
}
