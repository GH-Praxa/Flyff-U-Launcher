import type { TabLayout } from "../shared/schemas";
import { JOB_ICONS, FLYFF_URL } from "./constants";
import { t } from "./i18n";
import { toastBaseTtlMs } from "./settings";

// ── Profile Type ─────────────────────────────────────────────────────

export type Profile = {

    id: string;

    name: string;

    createdAt: string;

    job?: string;

    launchMode: "tabs" | "window";

    overlayTarget?: boolean;

    overlaySupportTarget?: boolean;

    overlayIconKey?: string;

    overlaySupportIconKey?: string;

};

// ── Query String ─────────────────────────────────────────────────────

export function qs() {

    const u = new URL(window.location.href);

    return u.searchParams;

}

// ── Element Factory ──────────────────────────────────────────────────

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {

    const e = document.createElement(tag);

    if (cls)

        e.className = cls;

    if (text !== undefined)

        e.textContent = text;

    return e;

}

export function clear(root: HTMLElement) {

    root.innerHTML = "";

}

// ── Job Icons ────────────────────────────────────────────────────────

export function jobIconSrc(job?: string | null): string | null {

    if (!job)

        return null;

    const key = job.trim();

    return JOB_ICONS[key] ?? null;

}

export function createJobIcon(job?: string | null, className = "jobIcon"): HTMLImageElement | null {

    const src = jobIconSrc(job);

    if (!src)

        return null;

    const img = document.createElement("img");

    img.src = src;

    img.alt = job ?? "";

    img.className = className;

    return img;

}

export function createJobBadge(job?: string | null): HTMLElement | null {

    const label = job?.trim();

    if (!label)

        return null;

    const badge = el("span", "badge jobBadge");

    const icon = createJobIcon(label, "jobBadgeIcon");

    if (icon)

        badge.append(icon);

    const text = document.createElement("span");

    text.textContent = label;

    badge.append(text);

    return badge;

}

export function decorateJobSelect(select: HTMLSelectElement) {

    select.classList.add("jobSelect");

    const syncSelectedIcon = () => {

        const icon = jobIconSrc(select.value);

        if (icon) {

            select.style.backgroundImage = `url("${icon}")`;

            select.classList.remove("noIcon");

        }

        else {

            select.style.backgroundImage = "";

            select.classList.add("noIcon");

        }

    };

    select.querySelectorAll("option").forEach((opt) => {

        const icon = jobIconSrc(opt.value);

        if (icon && !opt.disabled && !opt.value.startsWith("__")) {

            opt.style.backgroundImage = `url("${icon}")`;

            opt.style.backgroundRepeat = "no-repeat";

            opt.style.backgroundPosition = "8px center";

            opt.style.backgroundSize = "18px 18px";

            opt.style.paddingLeft = "32px";

            opt.classList.add("hasIcon");

        }

        else {

            opt.style.backgroundImage = "";

            opt.style.paddingLeft = "";

            opt.classList.remove("hasIcon");

        }

    });

    syncSelectedIcon();

    select.addEventListener("change", syncSelectedIcon);

}

// ── Toast ────────────────────────────────────────────────────────────

export function showToast(message: string, tone: "info" | "success" | "error" = "info", ttlMs?: number | string | null) {

    let container = document.querySelector(".toastContainer") as HTMLElement | null;

    if (!container) {

        container = document.createElement("div");

        container.className = "toastContainer";

        document.body.append(container);

    }

    const toast = document.createElement("div");

    toast.className = `toast ${tone}`;

    toast.textContent = message;

    container.append(toast);

    const ttlNum = Number(ttlMs);

    const ttl = Number.isFinite(ttlNum) ? ttlNum : toastBaseTtlMs;

    setTimeout(() => toast.remove(), Math.max(300, ttl));

}

// ── Misc Utilities ───────────────────────────────────────────────────

export function withTimeout<T>(p: Promise<T>, label: string, ms = 6000): Promise<T> {

    return new Promise<T>((resolve, reject) => {

        const timer = setTimeout(() => reject(new Error(`timeout: ${label}`)), ms);

        p.then((v) => {

            clearTimeout(timer);

            resolve(v);

        }, (err) => {

            clearTimeout(timer);

            reject(err);

        });

    });

}

export async function fetchTabLayouts(): Promise<TabLayout[]> {

    try {

        return await window.api.tabLayoutsList();

    }

    catch (err) {

        console.error("[layouts] list failed:", err);

        showToast(t("layout.refresh"), "error", 3000);

        return [];

    }

}

export function createWebview(profileId: string): HTMLElement {

    const wv = document.createElement("webview") as HTMLElement;

    wv.className = "webview";

    wv.setAttribute("partition", `persist:${profileId}`);

    wv.setAttribute("src", "about:blank");

    wv.style.position = "absolute";

    wv.style.top = "0";

    wv.style.left = "0";

    wv.style.right = "0";

    wv.style.bottom = "0";

    wv.style.display = "block";

    return wv;

}

export function reorderIds(ids: string[], fromId: string, toId: string, after: boolean) {

    const arr = [...ids];

    const from = arr.indexOf(fromId);

    let to = arr.indexOf(toId);

    if (from < 0 || to < 0)

        return arr;

    if (from === to)

        return arr;

    arr.splice(from, 1);

    if (from < to)

        to--;

    if (after)

        to++;

    arr.splice(to, 0, fromId);

    return arr;

}
