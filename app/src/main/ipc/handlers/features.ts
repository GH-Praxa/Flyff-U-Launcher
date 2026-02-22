/**
 * IPC handlers for feature flags.
 * Note: questlog:refresh moved to plugin system
 */
import { SafeHandle } from "../common";
import type { FeatureStore } from "../../features/store";

export type { FeatureStore };

export function registerFeatureHandlers(
    safeHandle: SafeHandle,
    opts: {
        features: FeatureStore;
    },
    _logErr: (msg: unknown) => void
): void {
    safeHandle("features:get", async () => {
        return await opts.features.get();
    });

    safeHandle("features:patch", async (_e, patch: unknown) => {
        return await opts.features.patch((patch && typeof patch === "object" ? patch : {}) as Record<string, unknown>);
    });
}
