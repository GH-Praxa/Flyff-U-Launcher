import { currentLocale } from "../i18n";

type AnnouncementItem = {
    id: string;
    type: "bug" | "info" | "feature" | "warning";
    title: string;
    body: string;
    date?: string;
    /** Localized titles keyed by locale, e.g. title_de, title_fr */
    [key: string]: string | undefined;
};

const TYPE_META: Record<string, { icon: string; cssVar: string }> = {
    bug:     { icon: "🐛", cssVar: "annBug" },
    info:    { icon: "ℹ",  cssVar: "annInfo" },
    feature: { icon: "✨", cssVar: "annFeature" },
    warning: { icon: "⚠",  cssVar: "annWarning" },
};

/**
 * Minimal markdown-to-HTML renderer.
 * Input is first HTML-escaped, then safe inline tags are applied.
 * Supports: **bold**, *italic*, _italic_, `code`, [link](url), and newlines.
 */
function renderMarkdown(text: string): string {
    return text
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/_(.+?)_/g, "<em>$1</em>")
        .replace(/`(.+?)`/g, "<code>$1</code>")
        .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/\n/g, "<br>");
}

/**
 * Parse a YAML frontmatter block into a flat key→value map.
 * Only handles simple `key: value` pairs (no nested objects or arrays).
 */
function parseFrontmatter(yaml: string): Record<string, string> {
    const fields: Record<string, string> = {};
    for (const line of yaml.split("\n")) {
        const m = line.match(/^([\w-]+):\s*(.+)$/);
        if (m) fields[m[1].trim()] = m[2].trim();
    }
    return fields;
}

/**
 * Parse a markdown file containing multiple announcements separated by `---`.
 *
 * Format:
 * ```
 * ---
 * id: ann-1
 * type: info
 * title: Title here
 * date: 2026-01-01
 * title_de: Titel auf Deutsch
 * ---
 * Body in **markdown**.
 * ---
 * id: ann-2
 * ...
 * ```
 */
function parseAnnouncementsMd(text: string): AnnouncementItem[] {
    // Split on lines that contain only "---"
    const parts = text.split(/^---$/m).map((s) => s.trim());
    // parts[0] = empty (before first ---), parts[1] = first YAML, parts[2] = first body, ...
    const items: AnnouncementItem[] = [];
    for (let i = 1; i < parts.length - 1; i += 2) {
        const yaml = parts[i];
        const body = parts[i + 1] ?? "";
        const fields = parseFrontmatter(yaml);
        if (!fields.id || !fields.title) continue;
        const item: AnnouncementItem = {
            id: fields.id,
            type: (fields.type as AnnouncementItem["type"]) ?? "info",
            title: fields.title,
            body: body.trim(),
            date: fields.date,
        };
        // Copy any title_LANG fields for localization
        for (const [k, v] of Object.entries(fields)) {
            if (k.startsWith("title_")) item[k] = v;
        }
        items.push(item);
    }
    return items;
}

function localizedTitle(item: AnnouncementItem): string {
    const key = `title_${currentLocale}`;
    return (item[key] as string | undefined)?.trim() || item.title;
}

function renderAnnouncement(item: AnnouncementItem): HTMLElement {
    const meta = TYPE_META[item.type] ?? TYPE_META.info;
    const title = localizedTitle(item);

    const el = document.createElement("div");
    el.className = `announcementItem ${meta.cssVar}`;

    const icon = document.createElement("span");
    icon.className = "announcementIcon";
    icon.textContent = meta.icon;

    const content = document.createElement("div");
    content.className = "announcementContent";

    const titleEl = document.createElement("div");
    titleEl.className = "announcementTitle";
    titleEl.textContent = title;

    const bodyEl = document.createElement("div");
    bodyEl.className = "announcementBody";
    bodyEl.innerHTML = renderMarkdown(item.body);

    content.append(titleEl, bodyEl);

    if (item.date) {
        const dateEl = document.createElement("div");
        dateEl.className = "announcementDate";
        dateEl.textContent = item.date;
        content.append(dateEl);
    }

    el.append(icon, content);
    return el;
}

export interface AnnouncementsElements {
    announcementsSection: HTMLElement;
    announcementsList: HTMLElement;
}

export function createAnnouncementsUI(elements: AnnouncementsElements) {
    const { announcementsSection, announcementsList } = elements;

    async function loadAnnouncements() {
        try {
            const text = await window.api.fetchAnnouncements();
            const items = parseAnnouncementsMd(text as string);
            announcementsList.innerHTML = "";
            if (items.length === 0) {
                announcementsSection.style.display = "none";
                return;
            }
            announcementsSection.style.display = "";
            for (const item of items) {
                announcementsList.append(renderAnnouncement(item));
            }
        } catch (err) {
            console.warn("[announcements] load failed:", err);
            announcementsSection.style.display = "none";
        }
    }

    return { loadAnnouncements };
}
