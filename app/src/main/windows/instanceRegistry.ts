import type { BrowserWindow } from "electron";

export type InstanceEntry = { profileId: string; win: BrowserWindow };

export function createInstanceRegistry() {
    // Track all windows per profile so multiple instances stay registered
    const map = new Map<string, BrowserWindow[]>();

    const prune = (profileId: string): BrowserWindow[] | null => {
        const arr = map.get(profileId);
        if (!arr)
            return null;
        const alive = arr.filter((w) => !w.isDestroyed());
        if (alive.length === 0) {
            map.delete(profileId);
            return null;
        }
        map.set(profileId, alive);
        return alive;
    };

    function register(profileId: string, win: BrowserWindow) {
        const list = prune(profileId) ?? [];
        list.push(win);
        map.set(profileId, list);
        win.on("closed", () => {
            const survivors = prune(profileId)?.filter((w) => w !== win) ?? [];
            if (survivors.length > 0) {
                map.set(profileId, survivors);
            }
            else {
                map.delete(profileId);
            }
        });
    }

    function get(profileId: string): BrowserWindow | null {
        const alive = prune(profileId);
        if (!alive || alive.length === 0)
            return null;
        return alive[alive.length - 1]; // return most recently registered
    }

    function list(profileId: string): BrowserWindow[] {
        return [...(prune(profileId) ?? [])];
    }

    function all(): InstanceEntry[] {
        const entries: InstanceEntry[] = [];
        for (const [profileId] of map) {
            const windows = prune(profileId);
            if (!windows)
                continue;
            for (const win of windows) {
                entries.push({ profileId, win });
            }
        }
        return entries;
    }

    function getFirst(): { profileId: string; win: BrowserWindow } | null {
        for (const [profileId] of map) {
            const win = get(profileId);
            if (win) {
                return { profileId, win };
            }
        }
        return null;
    }

    function getAllLatest(): Map<string, BrowserWindow> {
        const result = new Map<string, BrowserWindow>();
        for (const [profileId] of map) {
            const win = get(profileId);
            if (win) {
                result.set(profileId, win);
            }
        }
        return result;
    }

    return { register, get, list, all, getFirst, getAllLatest };
}
