import { currentLocale } from "../i18n";

/**
 * Minimal markdown-to-HTML renderer for announcements.
 * Supports: ### headings, - lists, **bold**, *italic*, `code`, [link](url), --- as <hr>.
 */
function renderMarkdown(text: string): string {
    const lines = text.split("\n");
    const out: string[] = [];
    let inList = false;

    for (const raw of lines) {
        const line = raw
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // empty line
        if (line.trim() === "") {
            if (inList) { out.push("</ul>"); inList = false; }
            continue;
        }

        // heading
        const hMatch = line.match(/^(#{1,4})\s+(.+)$/);
        if (hMatch) {
            if (inList) { out.push("</ul>"); inList = false; }
            const level = hMatch[1].length;
            out.push(`<h${level} class="annH">${inline(hMatch[2])}</h${level}>`);
            continue;
        }

        // list item
        const liMatch = line.match(/^[-*]\s+(.+)$/);
        if (liMatch) {
            if (!inList) { out.push("<ul>"); inList = true; }
            out.push(`<li>${inline(liMatch[1])}</li>`);
            continue;
        }

        // paragraph
        if (inList) { out.push("</ul>"); inList = false; }
        out.push(`<p>${inline(line)}</p>`);
    }
    if (inList) out.push("</ul>");
    return out.join("\n");
}

/** Inline markdown: bold, italic, code, links */
function inline(text: string): string {
    return text
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/_(.+?)_/g, "<em>$1</em>")
        .replace(/`(.+?)`/g, "<code>$1</code>")
        .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

/**
 * Split announcements.md by `---` into language blocks.
 * First block = DE (default), second block = EN, etc.
 * Returns the block matching the current locale, falling back to EN, then DE.
 */
function pickLocaleBlock(text: string): string {
    const blocks = text.split(/^---$/m).map(s => s.trim()).filter(Boolean);
    if (blocks.length === 0) return "";
    if (blocks.length === 1) return blocks[0];

    const locale = currentLocale;
    // Block 0 = DE, Block 1 = EN
    if (locale === "de") return blocks[0];
    // For all non-DE locales, prefer EN block if available
    return blocks[1] ?? blocks[0];
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
            const block = pickLocaleBlock(text as string);
            if (!block) {
                announcementsSection.style.display = "none";
                return;
            }
            announcementsSection.style.display = "";
            announcementsList.innerHTML = renderMarkdown(block);
        } catch (err) {
            console.warn("[announcements] load failed:", err);
            announcementsSection.style.display = "none";
        }
    }

    return { loadAnnouncements };
}
