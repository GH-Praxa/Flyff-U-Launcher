/**
 * IPC handlers for the Premium Shopping List tool.
 * Provides item search (from item_parameter.json), icon loading, and persistent price storage.
 */
import * as path from "path";
import * as fs from "fs";
import { app } from "electron";
import { SafeHandle, IpcEvent, ValidationError } from "../common";

/** Lightweight index entry kept in memory after first load. */
interface ItemIndexEntry {
    id: number;
    name: Record<string, string>;
    icon: string;
    premium: boolean;
    category: string;
}

/** Search result returned to renderer. */
interface SearchResult extends ItemIndexEntry {
    savedPrice: number | null;
}

let itemIndex: ItemIndexEntry[] | null = null;

function getItemParameterPath(): string {
    return path.join(app.getPath("userData"), "user", "cache", "item", "item_parameter.json");
}

function getIconsDir(): string {
    return path.join(app.getPath("userData"), "user", "cache", "item", "icons");
}

function getPricesPath(): string {
    return path.join(app.getPath("userData"), "user", "shopping", "item-prices.json");
}

/** Load the item index lazily on first search call. */
function ensureIndex(): ItemIndexEntry[] {
    if (itemIndex) return itemIndex;

    const filePath = getItemParameterPath();
    if (!fs.existsSync(filePath)) {
        itemIndex = [];
        return itemIndex;
    }

    try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);

        // Support both array and object formats
        const items: unknown[] = Array.isArray(parsed)
            ? parsed
            : typeof parsed === "object" && parsed !== null
                ? Object.values(parsed)
                : [];

        itemIndex = items
            .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
            .map((item) => ({
                id: Number(item.id) || 0,
                name: (typeof item.name === "object" && item.name !== null ? item.name : {}) as Record<string, string>,
                icon: typeof item.icon === "string" ? item.icon : "",
                premium: item.premium === true,
                category: typeof item.category === "string" ? item.category : "",
            }));
    } catch {
        itemIndex = [];
    }

    return itemIndex;
}

/** Load saved prices map. */
function loadPrices(): Record<string, number> {
    const p = getPricesPath();
    if (!fs.existsSync(p)) return {};
    try {
        const raw = fs.readFileSync(p, "utf-8");
        const parsed = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
            return parsed as Record<string, number>;
        }
    } catch { /* ignore */ }
    return {};
}

/** Save prices map atomically. */
function savePrices(prices: Record<string, number>): void {
    const p = getPricesPath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const tmp = p + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(prices, null, 2), "utf-8");
    fs.renameSync(tmp, p);
}

export function registerShoppingListHandlers(safeHandle: SafeHandle): void {
    // Search items by name
    safeHandle("shoppingList:search", async (_e: IpcEvent, query: unknown, locale: unknown) => {
        if (typeof query !== "string" || query.length < 1) {
            throw new ValidationError("query must be a non-empty string");
        }
        if (typeof locale !== "string") {
            throw new ValidationError("locale must be a string");
        }

        const index = ensureIndex();
        const prices = loadPrices();
        const q = query.toLowerCase();
        const results: SearchResult[] = [];

        for (const item of index) {
            if (results.length >= 20) break;

            // Search in the requested locale, fall back to "en"
            const localName = item.name[locale] || item.name["en"] || "";
            if (!localName) continue;

            if (localName.toLowerCase().includes(q)) {
                results.push({
                    ...item,
                    savedPrice: prices[String(item.id)] ?? null,
                });
            }
        }

        return results;
    });

    // Load an item icon as base64 data URL
    safeHandle("shoppingList:icon", async (_e: IpcEvent, iconFilename: unknown) => {
        if (typeof iconFilename !== "string" || !iconFilename) {
            throw new ValidationError("iconFilename must be a non-empty string");
        }

        // Path traversal protection
        const safe = path.basename(iconFilename);
        const iconPath = path.join(getIconsDir(), safe);

        if (!fs.existsSync(iconPath)) return null;

        try {
            const buf = fs.readFileSync(iconPath);
            return `data:image/png;base64,${buf.toString("base64")}`;
        } catch {
            return null;
        }
    });

    // Save an FCoin price for an item
    safeHandle("shoppingList:savePrice", async (_e: IpcEvent, itemId: unknown, price: unknown) => {
        if (typeof itemId !== "number" && typeof itemId !== "string") {
            throw new ValidationError("itemId must be a number or string");
        }
        if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
            throw new ValidationError("price must be a non-negative finite number");
        }

        const prices = loadPrices();
        prices[String(itemId)] = price;
        savePrices(prices);
    });
}
