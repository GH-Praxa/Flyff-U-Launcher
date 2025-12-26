import { app } from "electron";
import fs from "fs/promises";
import path from "path";

export type TabLayoutSplit = { leftId: string; rightId: string; ratio?: number };

export type TabLayout = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  tabs: string[];
  split?: TabLayoutSplit | null;
  activeId?: string | null;
};

export type TabLayoutInput = {
  id?: string;
  name: string;
  tabs: string[];
  split?: TabLayoutSplit | null;
  activeId?: string | null;
};

function layoutsPath() {
  return path.join(app.getPath("userData"), "tabLayouts.json");
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function clampRatio(r: any) {
  const n = Number(r);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(0.8, Math.max(0.2, n));
}

function normalizeSplit(v: any): TabLayoutSplit | null {
  if (!v || typeof v !== "object") return null;
  if (!v.leftId || !v.rightId || typeof v.leftId !== "string" || typeof v.rightId !== "string") return null;
  const ratio = clampRatio(v.ratio);
  return { leftId: v.leftId, rightId: v.rightId, ratio: ratio ?? undefined };
}

function normalizeLayout(v: any): TabLayout | null {
  if (!v || typeof v !== "object") return null;
  const tabs = Array.isArray(v.tabs) ? v.tabs.map((t) => String(t)).filter(Boolean) : [];
  if (tabs.length === 0) return null;

  const createdAt = typeof v.createdAt === "string" ? v.createdAt : new Date().toISOString();
  const updatedAt = typeof v.updatedAt === "string" ? v.updatedAt : createdAt;

  return {
    id: String(v.id ?? newId()),
    name: String(v.name ?? "Layout"),
    createdAt,
    updatedAt,
    tabs,
    split: normalizeSplit(v.split),
    activeId: typeof v.activeId === "string" ? v.activeId : null,
  };
}

async function readLayouts(): Promise<TabLayout[]> {
  try {
    const raw = await fs.readFile(layoutsPath(), "utf-8");
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [];
    return arr.map(normalizeLayout).filter(Boolean) as TabLayout[];
  } catch {
    return [];
  }
}

async function writeLayouts(ls: TabLayout[]) {
  await fs.writeFile(layoutsPath(), JSON.stringify(ls, null, 2), "utf-8");
}

export function createTabLayoutsStore() {
  return {
    async list(): Promise<TabLayout[]> {
      return await readLayouts();
    },

    async get(layoutId: string): Promise<TabLayout | null> {
      const all = await readLayouts();
      return all.find((l) => l.id === layoutId) ?? null;
    },

    async save(input: TabLayoutInput): Promise<TabLayout[]> {
      const normalized = normalizeLayout(input);
      if (!normalized) throw new Error("invalid layout");

      const all = await readLayouts();
      const now = new Date().toISOString();

      let next: TabLayout[];
      const existing = input.id ? all.find((l) => l.id === input.id) : null;
      if (existing) {
        next = all.map((l) => (l.id === existing.id ? { ...normalized, createdAt: existing.createdAt, updatedAt: now } : l));
      } else {
        next = [...all, { ...normalized, id: newId(), createdAt: now, updatedAt: now }];
      }

      await writeLayouts(next);
      return next;
    },

    async delete(layoutId: string): Promise<TabLayout[]> {
      const all = await readLayouts();
      const next = all.filter((l) => l.id !== layoutId);
      await writeLayouts(next);
      return next;
    },
  };
}
