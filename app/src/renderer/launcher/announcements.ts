import { currentLocale } from "../i18n";

type AnnouncementTranslations = {
    [locale: string]: { title?: string; body?: string };
};

type AnnouncementItem = {
    id: string;
    type: "bug" | "info" | "feature" | "warning";
    title: string;
    body: string;
    date?: string;
    translations?: AnnouncementTranslations;
};

type AnnouncementsPayload = {
    version: number;
    items: AnnouncementItem[];
};

const TYPE_META: Record<string, { icon: string; cssVar: string }> = {
    bug:     { icon: "🐛", cssVar: "annBug" },
    info:    { icon: "ℹ",  cssVar: "annInfo" },
    feature: { icon: "✨", cssVar: "annFeature" },
    warning: { icon: "⚠",  cssVar: "annWarning" },
};

function parseAnnouncements(json: string): AnnouncementItem[] {
    const data = JSON.parse(json) as AnnouncementsPayload;
    if (!Array.isArray(data?.items)) return [];
    return data.items.filter(
        (i) => i && typeof i.id === "string" && typeof i.title === "string" && typeof i.body === "string",
    );
}

function localizedText(item: AnnouncementItem): { title: string; body: string } {
    const tr = item.translations?.[currentLocale];
    return {
        title: tr?.title?.trim() || item.title,
        body:  tr?.body?.trim()  || item.body,
    };
}

function renderAnnouncement(item: AnnouncementItem): HTMLElement {
    const meta = TYPE_META[item.type] ?? TYPE_META.info;
    const { title, body } = localizedText(item);

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
    bodyEl.textContent = body;

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
            const json = await window.api.fetchAnnouncements();
            const items = parseAnnouncements(json as string);
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
