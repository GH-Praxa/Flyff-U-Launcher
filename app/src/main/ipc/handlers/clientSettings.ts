import { assertValid } from "../common";
import type { SafeHandle } from "../common";
import type { ClientSettingsStore } from "../../clientSettings/store";
import type { ClientSettings, ClientSettingsPatch } from "../../../shared/schemas";
import { ClientSettingsPatchSchema } from "../../../shared/schemas";

export type ClientSettingsHandlerOptions = {
    clientSettings: ClientSettingsStore;
    onChange?: (settings: ClientSettings) => void;
};

export function registerClientSettingsHandlers(
    safeHandle: SafeHandle,
    opts: ClientSettingsHandlerOptions
): void {
    safeHandle("clientSettings:get", () => opts.clientSettings.get());
    safeHandle("clientSettings:patch", async (_e, patch: unknown) => {
        assertValid(ClientSettingsPatchSchema, patch, "client settings patch");
        const next = await opts.clientSettings.patch(patch as ClientSettingsPatch);
        try {
            opts.onChange?.(next);
        } catch {
            // ignore callback errors
        }
        return next;
    });
}
