import type { BrowserWindow } from "electron";
import type { SessionTabsManager } from "../sessionTabs/manager";
import type { TabWindow, TabWindowMetadata } from "../../shared/schemas";

export type SessionWindowEntry = {
    id: string;
    name: string | undefined;
    createdAt: string;
    window: BrowserWindow;
    tabsManager: SessionTabsManager;
    initialProfileId: string | undefined;
};

export function createSessionRegistry() {
    const map = new Map<string, SessionWindowEntry>();
    let nextId = 1;

    const prune = (): void => {
        for (const [id, entry] of map) {
            if (entry.window.isDestroyed()) {
                map.delete(id);
            }
        }
    };

    function generateId(): string {
        const id = `session-${nextId}`;
        nextId++;
        return id;
    }

    function register(
        window: BrowserWindow,
        tabsManager: SessionTabsManager,
        opts?: { name?: string; initialProfileId?: string }
    ): string {
        prune();
        const id = generateId();
        const entry: SessionWindowEntry = {
            id,
            name: opts?.name,
            createdAt: new Date().toISOString(),
            window,
            tabsManager,
            initialProfileId: opts?.initialProfileId,
        };
        map.set(id, entry);

        window.on("closed", () => {
            map.delete(id);
        });

        return id;
    }

    function get(id: string): SessionWindowEntry | null {
        prune();
        return map.get(id) ?? null;
    }

    function getWindow(id: string): BrowserWindow | null {
        const entry = get(id);
        return entry?.window ?? null;
    }

    function getTabsManager(id: string): SessionTabsManager | null {
        const entry = get(id);
        return entry?.tabsManager ?? null;
    }

    function list(): SessionWindowEntry[] {
        prune();
        return Array.from(map.values());
    }

    function listMetadata(): TabWindowMetadata[] {
        prune();
        return Array.from(map.values()).map((entry) => {
            const loadedProfiles = entry.tabsManager.getLoadedProfileIds?.() ?? [];
            let title: string | undefined;
            try {
                if (!entry.window.isDestroyed()) {
                    title = entry.window.getTitle();
                }
            } catch {
                /* ignore title fetch errors */
            }
            return {
                id: entry.id,
                name: entry.name,
                createdAt: entry.createdAt,
                tabCount: loadedProfiles.length,
                isOpen: !entry.window.isDestroyed(),
                title,
            };
        });
    }

    function rename(id: string, newName: string): boolean {
        const entry = get(id);
        if (!entry) return false;
        entry.name = newName;
        return true;
    }

    function close(id: string): boolean {
        const entry = get(id);
        if (!entry) return false;
        if (!entry.window.isDestroyed()) {
            try {
                (entry.window as any).__allowCloseWithoutPrompt?.();
            } catch {
                /* ignore */
            }
            entry.window.close();
        }
        map.delete(id);
        return true;
    }

    function getFirst(): SessionWindowEntry | null {
        prune();
        const entries = Array.from(map.values());
        return entries[0] ?? null;
    }

    function has(id: string): boolean {
        prune();
        return map.has(id);
    }

    function setInitialProfileId(id: string, profileId: string): boolean {
        const entry = get(id);
        if (!entry) return false;
        entry.initialProfileId = profileId;
        return true;
    }

    function getInitialProfileId(id: string): string | undefined {
        const entry = get(id);
        return entry?.initialProfileId;
    }

    function updateWindowTitle(id: string, profileName: string, layoutTypes: string[]): boolean {
        const entry = get(id);
        if (!entry || entry.window.isDestroyed()) return false;

        // Format: "ProfileName - LayoutType1 - LayoutType2 - ..."
        const title = [profileName, ...layoutTypes].join(" - ");
        try {
            entry.window.setTitle(title);
            return true;
        } catch (err) {
            console.error("Failed to set window title:", err);
            return false;
        }
    }

    return {
        register,
        get,
        getWindow,
        getTabsManager,
        list,
        listMetadata,
        rename,
        close,
        getFirst,
        has,
        setInitialProfileId,
        getInitialProfileId,
        updateWindowTitle,
    };
}

export type SessionRegistry = ReturnType<typeof createSessionRegistry>;
