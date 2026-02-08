import { NEWS_BASE_URL } from "../constants";
import { el, showToast, withTimeout } from "../dom-utils";
import { t, currentLocale } from "../i18n";
import { logErr } from "../../shared/logger";

type NewsItem = {

    title: string;
    url: string;
    excerpt?: string;
    image?: string;
    category?: string;
    date?: string;
    orderIdx?: number;

};

const MONTHS: Record<string, number> = {

    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,

};

function normalizeNewsText(input: string | null | undefined) {

    if (!input)
        return "";
    return input.replace(/\s+/g, " ").trim();

}

function absoluteNewsUrl(href: string | null): string | null {

    if (!href)
        return null;
    try {
        return new URL(href, NEWS_BASE_URL).toString();
    }
    catch {
        return null;
    }

}

function pad2(n: number) {

    return n.toString().padStart(2, "0");

}

function formatDate(parts: {

    year?: number;
    month?: number;
    day?: number;
    raw?: string;

}) {

    if (parts.year && parts.month && parts.day) {
        return `${pad2(parts.day)}.${pad2(parts.month)}.${parts.year}`;
    }
    if (parts.month && parts.day) {
        return `${pad2(parts.day)}.${pad2(parts.month)}`;
    }
    return parts.raw ?? null;

}

function formatDateFromIso(iso: string | null | undefined) {

    if (!iso)
        return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return null;
    return formatDate({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });

}

function parseDateFromText(text: string | null | undefined): string | null {

    if (!text)
        return null;
    const t = text;
    let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m)
        return formatDate({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) });
    m = t.match(/\b(\d{4})(\d{2})(\d{2})\b/);
    if (m)
        return formatDate({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) });
    m = t.match(/\b(\d{2})(\d{2})(\d{2})(?!\d)\b/);
    if (m) {
        const month = Number(m[1]);
        const day = Number(m[2]);
        const year = 2000 + Number(m[3]);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return formatDate({ year, month, day });
        }
    }
    m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (m) {
        const month = Number(m[1]);
        const day = Number(m[2]);
        const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return formatDate({ year, month, day });
        }
    }
    m = t.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s.-]*(\d{1,2})(?:,?\s*(\d{2,4}))?/i);
    if (m) {
        const month = MONTHS[m[1].toLowerCase()];
        const day = Number(m[2]);
        const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
        if (month) {
            return formatDate({ year, month, day });
        }
    }
    return null;

}

function extractDate(candidates: (string | null | undefined)[]) {

    for (const c of candidates) {
        const parsed = parseDateFromText(c);
        if (parsed)
            return parsed;
    }
    return null;

}

function renderNewsItem(item: NewsItem) {

    const link = document.createElement("a");
    link.className = "newsItem";
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    const thumb = el("div", "newsThumb");
    if (item.image) {
        const img = document.createElement("img");
        img.src = item.image;
        img.alt = item.title;
        thumb.append(img);
    }
    else {
        thumb.textContent = "NEWS";
    }
    const content = el("div", "newsContent");
    const title = el("div", "newsTitle", item.title);
    const metaText = item.date ? `${item.category ?? "News"} � ${item.date}` : item.category ?? "News";
    const meta = el("div", "newsMeta", metaText);
    content.append(meta, title);
    link.append(thumb, content);
    return link;

}

type NewsNavTarget = {

    path: string;
    category?: string;

};

function parseNews(html: string, fallbackCategory?: string, navTargets?: NewsNavTarget[]): NewsItem[] {

    const doc = new DOMParser().parseFromString(html, "text/html");
    const tabNames: Record<string, string> = {};
    doc.querySelectorAll("#news-tabs .nav-link").forEach((btn) => {
        const target = btn.getAttribute("data-bs-target");
        if (!target)
            return;
        const name = normalizeNewsText(btn.textContent) || "News";
        tabNames[target.replace("#", "")] = name;
        const href = btn.getAttribute("href");
        if (href && !href.startsWith("#")) {
            try {
                const url = new URL(href, NEWS_BASE_URL);
                if (url.hostname === "universe.flyff.com" && url.pathname.startsWith("/news")) {
                    const path = `${url.pathname}${url.search}`;
                    navTargets?.push({ path, category: name });
                }
            }
            catch (err) {
                logErr(err, "renderer");
            }
        }
    });
    const seen = new Set<string>();
    const items: NewsItem[] = [];
    const panes = Array.from(doc.querySelectorAll(".tab-content .tab-pane"));

    const addLinksFrom = (scope: ParentNode, category: string) => {

        const links = Array.from(scope.querySelectorAll(".card a, .list-group-item a, .news-card a, .newsCard a, a[href*='/news/']"));
        for (const link of links) {
            if ((link as HTMLElement).closest("#news-tabs"))
                continue;
            const href = absoluteNewsUrl(link.getAttribute("href"));
            const title = normalizeNewsText(link.querySelector("h5")?.textContent ?? link.textContent);
            if (!href || !title || title.length < 3)
                continue;
            if (seen.has(href))
                continue;
            seen.add(href);
            const excerpt = normalizeNewsText(link.querySelector("h6")?.textContent ?? "");
            const img = link.querySelector("img") as HTMLImageElement | null;
            const image = absoluteNewsUrl(img?.getAttribute("src") ?? null) ?? undefined;
            const altText = normalizeNewsText(img?.getAttribute("alt") ?? "");
            let slug = "";
            try {
                const url = new URL(href);
                slug = url.pathname.split("/").filter(Boolean).pop() ?? "";
            }
            catch (err) {
                logErr(err, "renderer");
            }
            const date = extractDate([altText, title, excerpt, link.textContent, slug]);
            items.push({
                title,
                url: href,
                excerpt: excerpt || undefined,
                image,
                category,
                date: date ?? undefined,
            });
        }
    };
    if (panes.length > 0) {
        for (const pane of panes) {
            const category = tabNames[pane.id] ?? fallbackCategory ?? "News";
            addLinksFrom(pane, category);
        }
    }
    else {
        addLinksFrom(doc.body, fallbackCategory ?? "News");
    }
    return items;

}

function parseArticleDate(html: string): string | null {

    const doc = new DOMParser().parseFromString(html, "text/html");
    const ogPublished = formatDateFromIso(doc.querySelector('meta[property="og:article:published_time"]')?.getAttribute("content") ?? undefined);
    if (ogPublished)
        return ogPublished;
    const pMuted = normalizeNewsText(doc.querySelector("p.text-muted")?.textContent ?? "");
    const postedOn = normalizeNewsText(doc.querySelector("p.d-md-inline-block")?.textContent ?? "");
    return extractDate([pMuted, postedOn]) ?? null;

}

function dateStringToNumber(input?: string): number {

    if (!input)
        return 0;
    const parsed = Date.parse(input);
    if (!Number.isNaN(parsed))
        return parsed;
    const m = input.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (m) {
        const day = Number(m[1]);
        const month = Number(m[2]);
        const year = Number(m[3]);
        if (day && month && year) {
            return Date.UTC(year, month - 1, day);
        }
    }
    return 0;

}

async function enrichNewsDates(items: NewsItem[]) {

    for (const item of items) {
        try {
            const articleHtml = await window.api.fetchNewsArticle(item.url);
            const date = parseArticleDate(articleHtml);
            if (date)
                item.date = date;
        }
        catch (err) {
            console.warn("[news] article fetch failed:", err);
        }
    }

}

export interface NewsElements {
    newsState: HTMLElement;
    newsList: HTMLElement;
}

export function createNewsUI(elements: NewsElements) {
    const { newsState, newsList } = elements;

    function showNewsState(text: string) {

        newsState.textContent = text;
        newsState.style.display = "block";
    }

    function hideNewsState() {

        newsState.style.display = "none";
    }

    const NEWS_FEED_PAGES: {
        path: string;
        category?: string;
    }[] = [
        { path: "/news", category: "Updates" },
        { path: "/news?category=events", category: "Events" },
        { path: "/news?category=event", category: "Events" },
        { path: "/news?category=item-shop-news", category: "Item Shop News" },
        { path: "/news?category=item-shop", category: "Item Shop News" },
    ];
        async function loadNews() {
        showNewsState(t("news.loading"));
        newsList.innerHTML = "";
        try {
            const combined: NewsItem[] = [];
            const seen = new Set<string>();
            const navTargets: NewsNavTarget[] = [];
            try {
                const baseHtml = await window.api.fetchNewsPage("/news");
                const baseItems = parseNews(baseHtml, "Updates", navTargets);
                for (const item of baseItems) {
                    if (seen.has(item.url))
                        continue;
                    seen.add(item.url);
                    item.orderIdx = combined.length;
                    combined.push(item);
                }
            }
            catch (err) {
                console.warn("[news] fetch base page failed", err);
            }
            const queuedPaths = new Map<string, string | undefined>();
            for (const page of NEWS_FEED_PAGES) {
                queuedPaths.set(page.path, page.category);
            }
            for (const target of navTargets) {
                queuedPaths.set(target.path, target.category ?? queuedPaths.get(target.path));
            }
            for (const [path, category] of queuedPaths.entries()) {
                if (path === "/news")
                    continue;
                try {
                    const html = await window.api.fetchNewsPage(path);
                    const items = parseNews(html, category);
                    for (const item of items) {
                        if (seen.has(item.url))
                            continue;
                        seen.add(item.url);
                        if (!item.category)
                            item.category = category;
                        item.orderIdx = combined.length;
                        combined.push(item);
                    }
                }
                catch (err) {
                    console.warn("[news] fetch page failed", path, err);
                }
            }
            if (combined.length === 0) {
                showNewsState(t("news.none"));
                return;
            }
            const categoryBuckets = new Map<string, NewsItem[]>();
            for (const item of combined) {
                const cat = item.category ?? "News";
                if (!categoryBuckets.has(cat))
                    categoryBuckets.set(cat, []);
                categoryBuckets.get(cat)?.push(item);
            }
            const toEnrich: NewsItem[] = [];
            const preferCategories = ["Updates", "Events", "Item Shop News", "News"];
            for (const cat of preferCategories) {
                const bucket = categoryBuckets.get(cat);
                if (!bucket)
                    continue;
                toEnrich.push(...bucket.slice(0, 8));
            }
            if (toEnrich.length < 24) {
                for (const item of combined) {
                    if (toEnrich.includes(item))
                        continue;
                    toEnrich.push(item);
                    if (toEnrich.length >= 24)
                        break;
                }
            }
            await enrichNewsDates(toEnrich);
            const sortedCombined = combined
                .slice()
                .sort((a, b) => {
                const da = dateStringToNumber(a.date);
                const db = dateStringToNumber(b.date);
                if (db !== da)
                    return db - da;
                const ia = a.orderIdx ?? 0;
                const ib = b.orderIdx ?? 0;
                return ia - ib;
            });
            const subset = sortedCombined.slice(0, 12);
            hideNewsState();
            for (const item of subset) {
                newsList.append(renderNewsItem(item));
            }
        }
        catch (err) {
            console.error("[news] load failed:", err);
            const msg = err instanceof Error && err.message ? ` (${err.message})` : "";
            showNewsState(`${t("news.error")}${msg ? ` ${msg}` : ""}`);
        }
    }
    return { loadNews, showNewsState, hideNewsState };
}
