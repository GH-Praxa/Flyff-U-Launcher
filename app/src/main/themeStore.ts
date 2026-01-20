import { app } from "electron";
import path from "path";
import { generateId } from "../shared/utils";
import { createFileStore } from "../shared/fileStore";

export type ThemeColors = {
  bg: string;
  panel: string;
  panel2: string;
  stroke: string;
  text: string;
  muted: string;
  blue: string;
  blue2: string;
  danger: string;
  green: string;
  accent: string;
  tabActive: string;
};

export type StoredTheme = {
  id: string;
  name: string;
  colors: ThemeColors;
  createdAt: string;
  updatedAt: string;
};

const COLOR_KEYS: (keyof ThemeColors)[] = [
  "bg",
  "panel",
  "panel2",
  "stroke",
  "text",
  "muted",
  "blue",
  "blue2",
  "danger",
  "green",
  "accent",
  "tabActive",
];

function normalizeColor(v: unknown, fallback: string) {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
}

function normalizeTheme(v: unknown): StoredTheme | null {
  if (!v || typeof v !== "object") return null;
  const obj = v as Record<string, unknown>;
  const nowIso = new Date().toISOString();
  const colors: ThemeColors = {
    bg: "#0f1014",
    panel: "#181a21",
    panel2: "#121318",
    stroke: "#3f4046",
    text: "#fae6bc",
    muted: "#d8c489",
    blue: "#f3c65d",
    blue2: "#ffde8b",
    danger: "#ff9b4c",
    green: "#9fcf7a",
    accent: "#f7ba48",
    tabActive: "#9fcf7a",
  };
  const colorsObj = (obj.colors && typeof obj.colors === "object" ? obj.colors : {}) as Record<string, unknown>;
  for (const k of COLOR_KEYS) {
    colors[k] = normalizeColor(colorsObj[k], colors[k]);
  }
  const createdAt = typeof obj.createdAt === "string" ? obj.createdAt : nowIso;
  const updatedAt = typeof obj.updatedAt === "string" ? obj.updatedAt : nowIso;
  return {
    id: typeof obj.id === "string" && obj.id ? obj.id : generateId(),
    name: typeof obj.name === "string" && obj.name ? obj.name : "Custom Theme",
    colors,
    createdAt,
    updatedAt,
  };
}

const themeStore = createFileStore<StoredTheme>({
  getPath: () => path.join(app.getPath("userData"), "themes.json"),
  normalize: normalizeTheme,
});

export function createThemeStore() {
  return {
    async list(): Promise<StoredTheme[]> {
      return themeStore.read();
    },
    async save(input: Partial<StoredTheme>): Promise<StoredTheme[]> {
      const normalized = normalizeTheme(input);
      if (!normalized) throw new Error("invalid theme");
      const now = new Date().toISOString();
      return themeStore.update((all) => {
        const existing = normalized.id && all.find((t) => t.id === normalized.id);
        if (existing) {
          return all.map((t) =>
            t.id === normalized.id ? { ...normalized, createdAt: t.createdAt, updatedAt: now } : t
          );
        }
        return [...all, { ...normalized, id: generateId(), createdAt: now, updatedAt: now }];
      });
    },
    async delete(themeId: string): Promise<StoredTheme[]> {
      return themeStore.update((all) => all.filter((t) => t.id !== themeId));
    },
  };
}
