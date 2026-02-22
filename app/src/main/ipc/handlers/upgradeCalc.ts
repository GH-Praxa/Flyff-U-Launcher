/**
 * IPC handlers for the Upgrade Cost Calculator tool.
 * Provides persistent settings storage for prices and owned materials.
 */
import * as path from "path";
import * as fs from "fs";
import { app } from "electron";
import { SafeHandle, IpcEvent } from "../common";

export interface UpgradeCalcSettings {
    prices: {
        mineral: number;
        eron: number;
        sProtect: number;
        sProtectLow: number;
        dice4: number;
        dice6: number;
        dice12: number;
    };
    owned: {
        mineral: boolean;
        eron: boolean;
        sProtect: boolean;
        sProtectLow: boolean;
        dice4: boolean;
        dice6: boolean;
        dice12: boolean;
    };
    diceType: "dice4_6" | "dice12";
    systemMode: "compare" | "sProtect" | "sProtectLow";
}

const DEFAULT_SETTINGS: UpgradeCalcSettings = {
    prices: {
        mineral: 1000,
        eron: 1000,
        sProtect: 18000000,
        sProtectLow: 10000000,
        dice4: 500000,
        dice6: 500000,
        dice12: 1000000,
    },
    owned: {
        mineral: false,
        eron: false,
        sProtect: false,
        sProtectLow: false,
        dice4: false,
        dice6: false,
        dice12: false,
    },
    diceType: "dice4_6",
    systemMode: "compare",
};

function getSettingsPath(): string {
    return path.join(app.getPath("userData"), "user", "tools", "upgrades", "upgrade_cost_calc.json");
}

function loadSettings(): UpgradeCalcSettings {
    const p = getSettingsPath();
    if (!fs.existsSync(p)) {
        return { ...DEFAULT_SETTINGS };
    }
    try {
        const raw = fs.readFileSync(p, "utf-8");
        const parsed = JSON.parse(raw);
        return {
            prices: { ...DEFAULT_SETTINGS.prices, ...parsed.prices },
            owned: { ...DEFAULT_SETTINGS.owned, ...parsed.owned },
            diceType: parsed.diceType || DEFAULT_SETTINGS.diceType,
            systemMode: parsed.systemMode || DEFAULT_SETTINGS.systemMode,
        };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings(settings: UpgradeCalcSettings): void {
    const p = getSettingsPath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const tmp = p + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(settings, null, 2), "utf-8");
    fs.renameSync(tmp, p);
}

export function registerUpgradeCalcHandlers(safeHandle: SafeHandle): void {
    safeHandle("upgradeCalc:loadSettings", async () => {
        return loadSettings();
    });

    safeHandle("upgradeCalc:saveSettings", async (_e: IpcEvent, settings: unknown) => {
        if (typeof settings !== "object" || settings === null) {
            return false;
        }
        const s = settings as Partial<UpgradeCalcSettings>;
        const merged: UpgradeCalcSettings = {
            prices: { ...DEFAULT_SETTINGS.prices, ...s.prices },
            owned: { ...DEFAULT_SETTINGS.owned, ...s.owned },
            diceType: s.diceType || DEFAULT_SETTINGS.diceType,
            systemMode: s.systemMode || DEFAULT_SETTINGS.systemMode,
        };
        saveSettings(merged);
        return true;
    });
}
