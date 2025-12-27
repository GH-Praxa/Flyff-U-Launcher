import "./index.css";
import aibattGold from "./assets/icons/aibatt_gold.png";
import flyffuniverseIcon from "./assets/icons/flyffuniverse.png";
import flyffipediaIcon from "./assets/icons/flyffipedia.png";
import flyffulatorIcon from "./assets/icons/flyffulator.png";
import reskillIcon from "./assets/icons/reskill.png";
import acrobatIcon from "./assets/icons/classes/acrobat.png";
import arcanistIcon from "./assets/icons/classes/arcanist.png";
import assistIcon from "./assets/icons/classes/assist.png";
import billposterIcon from "./assets/icons/classes/billposter.png";
import bladeIcon from "./assets/icons/classes/blade.png";
import crackshooterIcon from "./assets/icons/classes/crackshooter.png";
import elementorIcon from "./assets/icons/classes/elementor.png";
import forcemasterIcon from "./assets/icons/classes/forcemaster.png";
import harlequinIcon from "./assets/icons/classes/harlequin.png";
import jesterIcon from "./assets/icons/classes/jester.png";
import knightIcon from "./assets/icons/classes/knight.png";
import magicianIcon from "./assets/icons/classes/magician.png";
import mentalistIcon from "./assets/icons/classes/mentalist.png";
import mercenaryIcon from "./assets/icons/classes/mercenary.png";
import psykeeperIcon from "./assets/icons/classes/psychikeeper.png";
import rangerIcon from "./assets/icons/classes/ranger.png";
import ringmasterIcon from "./assets/icons/classes/ringmaster.png";
import seraphIcon from "./assets/icons/classes/seraph.png";
import slayerIcon from "./assets/icons/classes/slayer.png";
import templarIcon from "./assets/icons/classes/templar.png";
import vagrantIcon from "./assets/icons/classes/vagrant.png";
import pkg from "../package.json";
import { DEFAULT_LOCALE, getTips, translate, type Locale, type TranslationKey } from "./i18n/translations";
import type { TabLayout } from "./shared/types";
const logErr = (err: unknown) => console.error("[renderer]", err);
const discordIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%237289da'/%3E%3Ccircle cx='11' cy='12' r='3' fill='%23fff'/%3E%3Ccircle cx='21' cy='12' r='3' fill='%23fff'/%3E%3Cpath d='M9 22 Q16 26 23 22' stroke='%23fff' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E";
const githubIcon = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="12" fill="#0d1117" />
    <path fill-rule="evenodd" clip-rule="evenodd" d="M12 0.3C5.37 0.3 0 5.67 0 12.3c0 5.29 3.44 9.78 8.21 11.37.6.1.82-.26.82-.58 0-.28-.01-1.05-.02-2.05-3.34.72-4.04-1.61-4.04-1.61-.55-1.37-1.34-1.73-1.34-1.73-1.1-.75.08-.74.08-.74 1.22.09 1.86 1.25 1.86 1.25 1.08 1.85 2.84 1.31 3.53 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.48-1.33-5.48-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.58 11.58 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.5 5.91.43.37.81 1.1.81 2.22 0 1.6-.02 2.89-.02 3.29 0 .32.22.69.83.57A12.03 12.03 0 0 0 24 12.3C24 5.67 18.63 0.3 12 0.3Z" fill="#fff"/>
  </svg>`)}`;
const GITHUB_REPO_URL = "https://github.com/Sparx94/Flyff-U-Launcher";
const GITHUB_PACKAGE_URL = "https://raw.githubusercontent.com/Sparx94/Flyff-U-Launcher/main/app/package.json";
const FLYFF_URL = "https://universe.flyff.com/play";
const NEWS_BASE_URL = "https://universe.flyff.com";
const STORAGE_LANG_KEY = "launcherLang";
const FLAG_ICONS: Record<string, string> = {
    en: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 36">
      <rect width="60" height="36" fill="#012169"/>
      <path d="M0 0 L60 36 M60 0 L0 36" stroke="#fff" stroke-width="6"/>
      <path d="M0 0 L60 36 M60 0 L0 36" stroke="#c8102e" stroke-width="3"/>
      <rect x="24" width="12" height="36" fill="#fff"/>
      <rect y="12" width="60" height="12" fill="#fff"/>
      <rect x="26" width="8" height="36" fill="#c8102e"/>
      <rect y="14" width="60" height="8" fill="#c8102e"/>
    </svg>`)}`,
    fr: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2">
      <rect width="1" height="2" fill="#0055a4"/>
      <rect x="1" width="1" height="2" fill="#fff"/>
      <rect x="2" width="1" height="2" fill="#ef4135"/>
    </svg>`)}`,
    de: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 3">
      <rect width="5" height="3" fill="#ffce00"/>
      <rect width="5" height="2" y="0" fill="#dd0000"/>
      <rect width="5" height="1" y="0" fill="#000"/>
    </svg>`)}`,
    pl: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 3">
      <rect width="5" height="3" fill="#e9e9e9"/>
      <rect width="5" height="1.5" y="1.5" fill="#d4213d"/>
    </svg>`)}`,
    ru: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2">
      <rect width="3" height="2" fill="#d52b1e"/>
      <rect width="3" height="1.333" fill="#0039a6" y="0.667"/>
      <rect width="3" height="0.667" fill="#fff"/>
    </svg>`)}`,
    tr: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2">
      <rect width="3" height="2" fill="#e30a17"/>
      <circle cx="1.1" cy="1" r="0.6" fill="#fff"/>
      <circle cx="1.25" cy="1" r="0.46" fill="#e30a17"/>
      <polygon points="1.7,1 2.4,0.65 2.4,1.35" fill="#fff"/>
    </svg>`)}`,
    cn: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20">
      <rect width="30" height="20" fill="#de2910"/>
      <polygon points="5,2 6,5 9,5 6.5,6.8 7.5,10 5,8.2 2.5,10 3.5,6.8 1,5 4,5" fill="#ffde00"/>
      <polygon points="10,2 11,2.5 10,3 10.2,4 9.4,3.3 8.6,4 8.8,3 8,2.5 9,2.5 9.2,1.5" fill="#ffde00"/>
      <polygon points="11.5,4 12.5,4.5 11.5,5 11.7,6 10.9,5.3 10.1,6 10.3,5 9.5,4.5 10.5,4.5 10.7,3.5" fill="#ffde00"/>
      <polygon points="11,7 12,7.5 11,8 11.2,9 10.4,8.3 9.6,9 9.8,8 9,7.5 10,7.5 10.2,6.5" fill="#ffde00"/>
      <polygon points="9,9 10,9.5 9,10 9.2,11 8.4,10.3 7.6,11 7.8,10 7,9.5 8,9.5 8.2,8.5" fill="#ffde00"/>
    </svg>`)}`,
    jp: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2">
      <rect width="3" height="2" fill="#fff"/>
      <circle cx="1.5" cy="1" r="0.55" fill="#bc002d"/>
    </svg>`)}`,
};
const JOB_ICONS: Record<string, string> = {
    Vagrant: vagrantIcon,
    Assist: assistIcon,
    Acrobat: acrobatIcon,
    Mercenary: mercenaryIcon,
    Magician: magicianIcon,
    Ringmaster: ringmasterIcon,
    Billposter: billposterIcon,
    Blade: bladeIcon,
    Knight: knightIcon,
    Ranger: rangerIcon,
    Jester: jesterIcon,
    Elementor: elementorIcon,
    Psykeeper: psykeeperIcon,
    Templar: templarIcon,
    Forcemaster: forcemasterIcon,
    Seraph: seraphIcon,
    Mentalist: mentalistIcon,
    Slayer: slayerIcon,
    Arcanist: arcanistIcon,
    Harlequin: harlequinIcon,
    Crackshooter: crackshooterIcon,
};
let updateCheckPromise: Promise<boolean> | null = null;
let cachedUpdateAvailable: boolean | null = null;
function normalizeVersionParts(input: string): number[] {
    return input.split(".").map((part) => {
        const numeric = Number.parseInt(part.replace(/[^0-9].*$/, ""), 10);
        return Number.isFinite(numeric) ? numeric : 0;
    });
}
function isRemoteVersionNewer(remote: string, local: string): boolean {
    const remoteParts = normalizeVersionParts(remote);
    const localParts = normalizeVersionParts(local);
    const len = Math.max(remoteParts.length, localParts.length);
    for (let i = 0; i < len; i += 1) {
        const r = remoteParts[i] ?? 0;
        const l = localParts[i] ?? 0;
        if (r > l)
            return true;
        if (r < l)
            return false;
    }
    return false;
}
async function loadRemoteLauncherVersion(): Promise<string | null> {
    try {
        const res = await fetch(GITHUB_PACKAGE_URL, { cache: "no-store" });
        if (!res.ok)
            return null;
        const payload: any = await res.json();
        return typeof payload?.version === "string" ? payload.version : null;
    }
    catch (err) {
        console.warn("launcher update check failed", err);
        return null;
    }
}
async function getUpdateAvailable(): Promise<boolean> {
    if (cachedUpdateAvailable !== null)
        return cachedUpdateAvailable;
    if (!updateCheckPromise) {
        updateCheckPromise = (async () => {
            const remote = await loadRemoteLauncherVersion();
            if (!remote)
                return false;
            return isRemoteVersionNewer(remote, pkg.version);
        })().then((available) => {
            cachedUpdateAvailable = available;
            return available;
        });
    }
    return updateCheckPromise;
}
function loadLocale(): Locale {
    try {
        const stored = localStorage.getItem(STORAGE_LANG_KEY) as Locale | null;
        if (stored)
            return stored;
    }
    catch (err) {
        logErr(err);
    }
    return DEFAULT_LOCALE;
}
let currentLocale: Locale = loadLocale();
document.documentElement.lang = currentLocale;
function setLocale(lang: Locale) {
    currentLocale = lang;
    document.documentElement.lang = lang;
    try {
        localStorage.setItem(STORAGE_LANG_KEY, lang);
    }
    catch (err) {
        logErr(err);
    }
}
function t(key: TranslationKey) {
    return translate(currentLocale, key);
}
let langMenuCloser: ((e: MouseEvent) => void) | null = null;
type Profile = {
    id: string;
    name: string;
    createdAt: string;
    job?: string;
    launchMode: "tabs" | "window";
    overlayTarget?: boolean;
    overlayIconKey?: string;
};
function qs() {
    const u = new URL(window.location.href);
    return u.searchParams;
}
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
    const e = document.createElement(tag);
    if (cls)
        e.className = cls;
    if (text !== undefined)
        e.textContent = text;
    return e;
}
function clear(root: HTMLElement) {
    root.innerHTML = "";
}
function jobIconSrc(job?: string | null): string | null {
    if (!job)
        return null;
    const key = job.trim();
    return JOB_ICONS[key] ?? null;
}
function createJobIcon(job?: string | null, className = "jobIcon"): HTMLImageElement | null {
    const src = jobIconSrc(job);
    if (!src)
        return null;
    const img = document.createElement("img");
    img.src = src;
    img.alt = job ?? "";
    img.className = className;
    return img;
}
function createJobBadge(job?: string | null): HTMLElement | null {
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
function decorateJobSelect(select: HTMLSelectElement) {
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
function loadLocalLayouts(): TabLayout[] {
    try {
        const raw = localStorage.getItem("tabLayoutsLocal");
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch (err) {
        logErr(err);
        return [];
    }
}
function saveLocalLayouts(layouts: TabLayout[]) {
    try {
        localStorage.setItem("tabLayoutsLocal", JSON.stringify(layouts));
    }
    catch (err) {
        logErr(err);
    }
}
function showToast(message: string, tone: "info" | "success" | "error" = "info", ttlMs = 3200) {
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
    setTimeout(() => toast.remove(), ttlMs);
}
function withTimeout<T>(p: Promise<T>, label: string, ms = 6000): Promise<T> {
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
async function fetchTabLayouts(): Promise<TabLayout[]> {
    try {
        return await window.api.tabLayoutsList();
    }
    catch (err) {
        logErr(err);
        const fallback = loadLocalLayouts();
        showToast(`Local layouts loaded (${fallback.length})`, "info");
        return fallback;
    }
}
function createWebview(profileId: string) {
    const wv = document.createElement("webview") as any;
    wv.className = "webview";
    wv.setAttribute("partition", `persist:${profileId}`);
    wv.setAttribute("src", "about:blank");
    wv.style.position = "absolute";
    wv.style.top = "0";
    wv.style.left = "0";
    wv.style.right = "0";
    wv.style.bottom = "0";
    wv.style.display = "block";
    return wv as HTMLElement;
}
function reorderIds(ids: string[], fromId: string, toId: string, after: boolean) {
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
async function renderLauncher(root: HTMLElement) {
    clear(root);
    root.className = "launcherRoot";
    const overlayDisabled = true;
    let overlayClearedOnce = false;
    if (langMenuCloser) {
        document.removeEventListener("click", langMenuCloser);
        langMenuCloser = null;
    }
    const header = el("div", "topbar");
    type JobOption = {
        value: string;
        label: string;
        disabled?: boolean;
    };
    const jobOptions: JobOption[] = [
        { value: "", label: t("job.choose") },
        { value: "Vagrant", label: "Vagrant" },
        { value: "__sep1", label: "--- 1. Job ---", disabled: true },
        { value: "Assist", label: "Assist" },
        { value: "Acrobat", label: "Acrobat" },
        { value: "Mercenary", label: "Mercenary" },
        { value: "Magician", label: "Magician" },
        { value: "__sep2", label: "--- 2. Job ---", disabled: true },
        { value: "Ringmaster", label: "Ringmaster" },
        { value: "Billposter", label: "Billposter" },
        { value: "Blade", label: "Blade" },
        { value: "Knight", label: "Knight" },
        { value: "Ranger", label: "Ranger" },
        { value: "Jester", label: "Jester" },
        { value: "Elementor", label: "Elementor" },
        { value: "Psykeeper", label: "Psykeeper" },
        { value: "__sep3", label: "--- 3. Job ---", disabled: true },
        { value: "Templar", label: "Templar" },
        { value: "Forcemaster", label: "Forcemaster" },
        { value: "Seraph", label: "Seraph" },
        { value: "Mentalist", label: "Mentalist" },
        { value: "Slayer", label: "Slayer" },
        { value: "Arcanist", label: "Arcanist" },
        { value: "Harlequin", label: "Harlequin" },
        { value: "Crackshooter", label: "Crackshooter" },
    ];
    const tips = getTips(currentLocale);
    function renderJobOptions(select: HTMLSelectElement, selectedValue: string | null = null) {
        select.innerHTML = "";
        for (const j of jobOptions) {
            const opt = document.createElement("option");
            opt.value = j.disabled ? "" : j.value;
            opt.textContent = j.label;
            if (j.disabled)
                opt.disabled = true;
            select.append(opt);
        }
        select.value = selectedValue ?? "";
        decorateJobSelect(select);
    }
    const btnFlyffuniverse = el("button", "btn primary") as HTMLButtonElement;
    btnFlyffuniverse.title = "Flyffuniverse öffnen";
    const flyffuniverseImg = document.createElement("img");
    flyffuniverseImg.src = flyffuniverseIcon;
    flyffuniverseImg.alt = "Flyffuniverse";
    flyffuniverseImg.style.width = "64x";
    flyffuniverseImg.style.height = "32px";
    btnFlyffuniverse.style.width = "128px";
    btnFlyffuniverse.style.height = "32px";
    btnFlyffuniverse.append(flyffuniverseImg);
    btnFlyffuniverse.addEventListener("click", () => {
        window.open("https://universe.flyff.com/", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768");
    });
    header.append(btnFlyffuniverse);
    const btnFlyffipedia = el("button", "btn primary") as HTMLButtonElement;
    btnFlyffipedia.title = "Flyffipedia öffnen";
    const flyffipediaImg = document.createElement("img");
    flyffipediaImg.src = flyffipediaIcon;
    flyffipediaImg.alt = "Flyffipedia";
    flyffipediaImg.style.width = "64x";
    flyffipediaImg.style.height = "32px";
    btnFlyffipedia.style.width = "128px";
    btnFlyffipedia.style.height = "32px";
    btnFlyffipedia.append(flyffipediaImg);
    btnFlyffipedia.addEventListener("click", () => {
        window.open("https://flyffipedia.com/home", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768");
    });
    header.append(btnFlyffipedia);
    const btnFlyffulator = el("button", "btn primary pink-text") as HTMLButtonElement;
    btnFlyffulator.title = "Flyffulator öffnen";
    const flyffulatorImg = document.createElement("img");
    flyffulatorImg.src = flyffulatorIcon;
    flyffulatorImg.alt = "Flyffulator";
    flyffulatorImg.style.width = "32px";
    flyffulatorImg.style.height = "32px";
    flyffulatorImg.style.marginRight = "0px";
    const btnText = document.createElement("span");
    btnText.textContent = "lyffulator";
    btnFlyffulator.style.display = "flex";
    btnFlyffulator.style.alignItems = "center";
    btnFlyffulator.style.justifyContent = "center";
    btnFlyffulator.style.padding = "8px 12px";
    btnFlyffulator.style.height = "40px";
    btnFlyffulator.append(flyffulatorImg, btnText);
    btnFlyffulator.addEventListener("click", () => {
        window.open("https://flyffulator.com/", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768");
    });
    header.append(btnFlyffulator);
    const btnSkillulator = el("button", "btn primary skillulator") as HTMLButtonElement;
    btnSkillulator.title = "Skillulator öffnen";
    const skillulatorImg = document.createElement("img");
    skillulatorImg.src = reskillIcon;
    skillulatorImg.alt = "Skillulator";
    skillulatorImg.style.width = "32px";
    skillulatorImg.style.height = "32px";
    skillulatorImg.style.marginRight = "0px";
    const btnSkillulatorText = document.createElement("span");
    btnSkillulatorText.textContent = "Skillulator";
    btnSkillulatorText.className = "skillulatorLabel";
    btnSkillulator.style.display = "flex";
    btnSkillulator.style.alignItems = "center";
    btnSkillulator.style.justifyContent = "center";
    btnSkillulator.style.padding = "8px 12px";
    btnSkillulator.style.height = "40px";
    btnSkillulator.append(skillulatorImg, btnSkillulatorText);
    btnSkillulator.addEventListener("click", () => {
        window.open("https://skillulator.lol/", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768");
    });
    header.append(btnSkillulator);
    const btnDiscord = el("button", "btn primary") as HTMLButtonElement;
    btnDiscord.title = "Discord-Server beitreten";
    btnDiscord.style.width = "38px";
    btnDiscord.style.height = "36px";
    const discordImg = document.createElement("img");
    discordImg.src = discordIcon;
    discordImg.alt = "Discord";
    discordImg.style.width = "20px";
    discordImg.style.height = "20px";
    btnDiscord.append(discordImg);
    btnDiscord.addEventListener("click", () => {
        window.open("https://discord.gg/vAPxWYHt", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=900,height=700");
    });
    header.append(btnDiscord);
    const btnGithub = el("button", "btn primary githubBtn") as HTMLButtonElement;
    btnGithub.title = "GitHub öffnen";
    const githubImg = document.createElement("img");
    githubImg.src = githubIcon;
    githubImg.alt = "GitHub";
    githubImg.style.width = "20px";
    githubImg.style.height = "20px";
    btnGithub.append(githubImg);
    btnGithub.addEventListener("click", () => {
        window.open(GITHUB_REPO_URL, "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1200,height=800");
    });
    const updateNotice = el("div", "updateNotice hidden", "Neue Version verfügbar");
    header.append(btnGithub, updateNotice);
    const versionLabel = el("div", "versionLabel", `v${pkg.version}`);
    const applyUpdateState = (available: boolean) => {
        btnGithub.classList.toggle("updateAvailable", available);
        updateNotice.classList.toggle("hidden", !available);
    };
    applyUpdateState(cachedUpdateAvailable ?? false);
    getUpdateAvailable()
        .then(applyUpdateState)
        .catch((err) => {
        console.warn("launcher update check failed", err);
        applyUpdateState(false);
    });
    const languages: {
        value: Locale;
        title: string;
        icon: string;
    }[] = [
        { value: "en", title: "English", icon: FLAG_ICONS.en },
        { value: "de", title: "Deutsch", icon: FLAG_ICONS.de },
        { value: "pl", title: "Polski", icon: FLAG_ICONS.pl },
        { value: "fr", title: "Français", icon: FLAG_ICONS.fr },
        { value: "ru", title: "Русский", icon: FLAG_ICONS.ru },
        { value: "tr", title: "Türkçe", icon: FLAG_ICONS.tr },
        { value: "cn", title: "中文", icon: FLAG_ICONS.cn },
        { value: "jp", title: "日本語", icon: FLAG_ICONS.jp },
    ];
    const langPicker = el("div", "langPicker");
    const langButton = document.createElement("button");
    langButton.className = "btn langButton";
    const langIcon = el("div", "langIcon");
    langButton.append(langIcon);
    const langMenu = el("div", "langMenu hidden");
    function syncLangButton() {
        const active = languages.find((l) => l.value === currentLocale) ?? languages[0];
        langButton.title = active.title;
        langIcon.style.backgroundImage = `url("${active.icon}")`;
    }
    for (const l of languages) {
        const btn = document.createElement("button");
        btn.className = "langMenuItem";
        btn.type = "button";
        btn.title = l.title;
        btn.style.backgroundImage = `url("${l.icon}")`;
        btn.onclick = () => {
            setLocale(l.value);
            syncLangButton();
            langMenu.classList.add("hidden");
            if (langMenuCloser) {
                document.removeEventListener("click", langMenuCloser);
                langMenuCloser = null;
            }
            renderLauncher(root);
        };
        langMenu.append(btn);
    }
    syncLangButton();
    langButton.addEventListener("click", (e) => {
        e.stopPropagation();
        langMenu.classList.toggle("hidden");
    });
    langMenuCloser = () => langMenu.classList.add("hidden");
    document.addEventListener("click", langMenuCloser);
    langPicker.append(langButton, langMenu);
    header.append(el("div", "title", ""), el("div", "spacer"), versionLabel, langPicker);
    const btnCreate = el("button", "btn primary", t("header.newProfile"));
    const filterBar = el("div", "filterBar");
    const searchInput = document.createElement("input");
    searchInput.className = "input searchInput";
    searchInput.placeholder = t("filter.searchPlaceholder");
    const jobSelect = document.createElement("select");
    jobSelect.className = "select filterSelect";
    renderJobOptions(jobSelect);
    const btnRefreshLayouts = el("button", "btn", t("layout.refresh"));
    filterBar.append(searchInput, jobSelect, btnCreate, btnRefreshLayouts);
    async function renderLayoutChips(target: HTMLElement) {
        const refreshFlag = localStorage.getItem("tabLayoutsRefresh");
        if (refreshFlag)
            localStorage.removeItem("tabLayoutsRefresh");
        const layouts = await fetchTabLayouts();
        const card = el("div", "card");
        const layoutBar = el("div", "layoutBar");
        const layoutList = el("div", "layoutList");
        layoutBar.append(layoutList);
        let profileNames = new Map<string, string>();
        try {
            const profiles = await window.api.profilesList();
            profileNames = new Map(profiles.map((p: Profile) => [p.id, p.name]));
        }
        catch (e) {
            console.warn("profilesList failed", e);
        }
        if (layouts.length === 0) {
            layoutList.append(el("div", "muted", t("layout.empty")));
        }
        else {
            for (const layout of layouts) {
                const chip = el("div", "layoutChip");
                const handle = el("span", "dragHandle", "=");
                const name = el("span", "layoutName", layout.name);
                const metaParts = [`${layout.tabs.length} Tabs`];
                if (layout.split)
                    metaParts.push("Split");
                const meta = el("span", "layoutMeta", metaParts.join(" | "));
                const actions = el("div", "layoutActions");
                const manageBtn = el("button", "btn", "⚙");
                manageBtn.title = "Manage";
                let menu: HTMLDivElement | null = null;
                let closeMenu: (() => void) | null = null;
                const buildMenu = () => {
                    if (menu)
                        return;
                    menu = el("div", "layoutMenu") as HTMLDivElement;
                    const menuTitle = el("div", "layoutMenuTitle", t("layout.title"));
                    const list = el("div", "layoutMenuList");
                    if (layout.tabs.length === 0) {
                        list.append(el("div", "muted", t("layout.empty")));
                    }
                    else {
                        for (const tabId of layout.tabs) {
                            const label = profileNames.get(tabId) ?? tabId;
                            list.append(el("div", "layoutMenuItem", label));
                        }
                    }
                    const delBtn = el("button", "btn danger", t("layout.delete"));
                    delBtn.onclick = async () => {
                        await window.api.tabLayoutsDelete(layout.id);
                        await renderLayoutChips(target);
                    };
                    const menuActions = el("div", "layoutMenuActions");
                    menuActions.append(delBtn);
                    menu.append(menuTitle, list, menuActions);
                    chip.append(menu);
                    const onDocClick = (e: MouseEvent) => {
                        if (!menu)
                            return;
                        const targetEl = e.target as Node;
                        if (targetEl === manageBtn || menu.contains(targetEl))
                            return;
                        closeMenu?.();
                    };
                    closeMenu = () => {
                        menu?.remove();
                        menu = null;
                        document.removeEventListener("click", onDocClick);
                    };
                    document.addEventListener("click", onDocClick);
                };
                manageBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (menu) {
                        closeMenu?.();
                    }
                    else {
                        buildMenu();
                    }
                };
                const openBtn = el("button", "btn primary", t("profile.play"));
                openBtn.onclick = async () => {
                    showToast(t("layout.apply"), "info");
                    try {
                        await window.api.tabLayoutsApply(layout.id);
                    }
                    catch (err) {
                        showToast(`${t("layout.saveError")}: ${err instanceof Error ? err.message : String(err)}`, "error", 5000);
                    }
                };
                actions.append(manageBtn, openBtn);
                chip.append(handle, name, meta, actions);
                layoutList.append(chip);
            }
        }
        card.append(layoutBar);
        target.append(card);
    }
    const body = el("div", "layout");
    const left = el("div", "panel left");
    const right = el("div", "panel right");
    const list = el("div", "list");
    const profilesContainer = el("div", "profilesContainer");
    list.append(profilesContainer);
    const createPanel = el("div", "manage hidden");
    const createGrid = el("div", "manageGrid");
    const tipsBanner = el("div", "tipsBanner");
    const tipsTitle = el("div", "tipsTitle", t("tips.title"));
    const tipsText = el("div", "tipsText", "");
    tipsBanner.append(tipsTitle, tipsText);
    const createName = document.createElement("input");
    createName.className = "input";
    createName.placeholder = t("create.namePlaceholder");
    createGrid.append(createName);
    const createActions = el("div", "manageActions");
    const btnAdd = el("button", "btn primary", t("create.add"));
    const btnCancel = el("button", "btn", t("create.cancel"));
    const btnDel = el("button", "btn danger", t("create.delete"));
    createActions.append(btnAdd, btnCancel);
    createPanel.append(createGrid, createActions);
    left.append(createPanel, list, tipsBanner);
    const newsHeader = el("div", "newsHeader");
    const newsTitle = el("div", "panelTitle", t("news.title"));
    newsHeader.append(newsTitle);
    const newsState = el("div", "newsState muted", t("news.loading"));
    const newsList = el("div", "newsList");
    right.append(newsHeader, newsState, newsList);
    root.append(header, filterBar, body);
    body.append(left, right);
    type NewsItem = {
        title: string;
        url: string;
        excerpt?: string;
        image?: string;
        category?: string;
        date?: string;
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
        const metaText = item.date ? `${item.category ?? "News"} · ${item.date}` : item.category ?? "News";
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
                    logErr(err);
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
                    logErr(err);
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
                    (item as any).orderIdx = combined.length;
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
                        (item as any).orderIdx = combined.length;
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
                const ia = (a as any).orderIdx ?? 0;
                const ib = (b as any).orderIdx ?? 0;
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
    async function reload() {
        profilesContainer.innerHTML = "";
        await renderLayoutChips(profilesContainer);
        if (overlayDisabled && !overlayClearedOnce) {
            try {
                await window.api.profilesSetOverlayTarget(null);
                overlayClearedOnce = true;
            }
            catch (e) {
                console.error("profilesSetOverlayTarget (disabled) failed:", e);
            }
        }
        let profiles: Profile[] = [];
        try {
            profiles = await window.api.profilesList();
        }
        catch (e) {
            console.error(e);
            profilesContainer.append(el("div", "muted", t("list.error")));
            return;
        }
        if (profiles.length === 0) {
            profilesContainer.append(el("div", "muted", t("list.empty")));
            return;
        }
        const searchTerm = searchInput.value.trim().toLowerCase();
        const jobFilter = jobSelect.value;
        const filteredProfiles = profiles.filter((p) => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm);
            const matchesJob = !jobFilter || (p.job ?? "") === jobFilter;
            return matchesSearch && matchesJob;
        });
        if (filteredProfiles.length === 0) {
            profilesContainer.append(el("div", "muted", t("list.noMatches")));
            return;
        }
        let draggingId: string | null = null;
        for (const p of filteredProfiles) {
            const card = el("div", "card");
            const row = el("div", "row");
            const leftInfo = el("div", "rowLeft");
            const dragHandle = el("span", "dragHandle", "≡");
            const name = el("div", "rowName", p.name);
            leftInfo.append(dragHandle);
            (dragHandle as any).draggable = true;
            dragHandle.addEventListener("dragstart", (e) => {
                draggingId = p.id;
                card.classList.add("dragging");
                e.dataTransfer?.setData("text/plain", p.id);
                e.dataTransfer!.effectAllowed = "move";
                e.dataTransfer?.setDragImage(row, 20, 20);
            });
            dragHandle.addEventListener("dragend", () => {
                draggingId = null;
                card.classList.remove("dragging", "dropBefore", "dropAfter");
            });
            const actions = el("div", "rowActions");
            const btnManage = el("button", "btn", "") as HTMLButtonElement;
            const manageIcon = document.createElement("span");
            manageIcon.textContent = "⚙";
            manageIcon.setAttribute("aria-hidden", "true");
            btnManage.title = "Verwalten";
            btnManage.setAttribute("aria-label", "Verwalten");
            btnManage.append(manageIcon);
            const btnPlay = el("button", "btn primary", t("profile.play"));
            const btnDel = el("button", "btn danger", t("profile.delete"));
            const btnTag = el("button", "btn", "") as HTMLButtonElement;
            btnTag.disabled = overlayDisabled;
            btnTag.title = overlayDisabled
                ? t("profile.overlay.disabled")
                : p.overlayTarget
                    ? t("profile.overlay.on")
                    : t("profile.overlay.off");
            if (!overlayDisabled && p.overlayTarget)
                btnTag.classList.add("primary");
            const img = document.createElement("img");
            img.src = aibattGold;
            img.alt = "Overlay";
            img.style.width = "18px";
            img.style.height = "18px";
            img.style.opacity = overlayDisabled ? "0.35" : p.overlayTarget ? "1" : "0.35";
            img.style.filter = overlayDisabled ? "grayscale(100%)" : p.overlayTarget ? "none" : "grayscale(100%)";
            btnTag.append(img);
            btnTag.style.width = "34px";
            btnTag.style.height = "34px";
            btnTag.style.display = "grid";
            btnTag.style.placeItems = "center";
            btnTag.style.padding = "0";
            btnTag.style.borderRadius = "10px";
            btnTag.onclick = async () => {
                if (overlayDisabled)
                    return;
                try {
                    if (p.overlayTarget) {
                        await window.api.profilesSetOverlayTarget(null);
                    }
                    else {
                        await window.api.profilesSetOverlayTarget(p.id, "aibatt-gold");
                    }
                    await reload();
                }
                catch (e) {
                    console.error("profilesSetOverlayTarget failed:", e);
                }
            };
            leftInfo.append(btnTag, name);
            const jobBadge = createJobBadge(p.job);
            if (jobBadge)
                leftInfo.append(jobBadge);
            leftInfo.append(el("span", "badge subtle", p.launchMode === "tabs" ? t("profile.mode.tabs") : t("profile.mode.window")));
            btnDel.onclick = async () => {
                await window.api.profilesDelete(p.id);
                await reload();
            };
            actions.append(btnManage, btnPlay);
            row.append(leftInfo, actions);
            const manage = el("div", "manage hidden");
            const nameInput = document.createElement("input");
            nameInput.className = "input";
            nameInput.value = p.name;
            const jobSelect = document.createElement("select");
            jobSelect.className = "select";
            renderJobOptions(jobSelect, p.job ?? "");
            const modeWrap = el("div", "modeWrap");
            const modeLabel = el("label", "checkbox");
            const modeCheck = document.createElement("input");
            modeCheck.type = "checkbox";
            modeCheck.checked = p.launchMode === "tabs";
            modeLabel.append(modeCheck, el("span", "", t("profile.mode.useTabs")));
            modeWrap.append(modeLabel);
            const currentMode = (): "tabs" | "window" => (modeCheck.checked ? "tabs" : "window");
            btnPlay.onclick = async () => {
                await window.api.profilesUpdate({
                    id: p.id,
                    launchMode: currentMode(),
                });
                if (currentMode() === "tabs") {
                    await window.api.openTab(p.id);
                }
                else {
                    await window.api.openWindow(p.id);
                }
            };
            const btnSave = el("button", "btn primary", t("profile.save"));
            const btnClone = el("button", "btn", t("profile.clone"));
            const btnClose = el("button", "btn", t("profile.close"));
            const clonePanel = el("div", "clonePanel hidden");
            const cloneInput = document.createElement("input");
            cloneInput.className = "input";
            cloneInput.placeholder = t("profile.clonePlaceholder");
            cloneInput.value = `${p.name} (${t("profile.copySuffix")})`;
            const cloneActions = el("div", "manageActions");
            const btnDoClone = el("button", "btn primary", t("profile.cloneConfirm"));
            const btnCloneCancel = el("button", "btn", t("profile.back"));
            cloneActions.append(btnDoClone, btnCloneCancel);
            clonePanel.append(cloneInput, cloneActions);
            btnSave.onclick = async () => {
                await window.api.profilesUpdate({
                    id: p.id,
                    name: nameInput.value.trim() || p.name,
                    job: jobSelect.value,
                    launchMode: modeCheck.checked ? "tabs" : "window",
                });
                await reload();
            };
            btnClone.onclick = () => {
                clonePanel.classList.toggle("hidden");
                cloneInput.focus();
                cloneInput.select();
            };
            btnCloneCancel.onclick = () => clonePanel.classList.add("hidden");
            btnDoClone.onclick = async () => {
                const newName = cloneInput.value.trim() || `${p.name} (Copy)`;
                await window.api.profilesClone(p.id, newName);
                clonePanel.classList.add("hidden");
                manage.classList.add("hidden");
                await reload();
            };
            btnClose.onclick = () => {
                clonePanel.classList.add("hidden");
                manage.classList.add("hidden");
            };
            const grid = el("div", "manageGrid");
            grid.append(nameInput, jobSelect, modeWrap);
            const actionBar = el("div", "manageActions");
            const actionSpacer = el("div", "spacer");
            actionBar.append(btnSave, btnClone, actionSpacer, btnDel, btnClose);
            manage.append(grid, actionBar, clonePanel);
            btnManage.onclick = () => manage.classList.toggle("hidden");
            card.addEventListener("dragover", (e) => {
                e.preventDefault();
                if (!draggingId || draggingId === p.id)
                    return;
                const rect = card.getBoundingClientRect();
                const after = e.clientY - rect.top > rect.height / 2;
                card.classList.toggle("dropAfter", after);
                card.classList.toggle("dropBefore", !after);
                e.dataTransfer!.dropEffect = "move";
            });
            card.addEventListener("dragleave", () => {
                card.classList.remove("dropBefore", "dropAfter");
            });
            card.addEventListener("drop", async (e) => {
                e.preventDefault();
                card.classList.remove("dropBefore", "dropAfter");
                const fromId = draggingId ?? e.dataTransfer?.getData("text/plain");
                const toId = p.id;
                if (!fromId || fromId === toId)
                    return;
                const rect = card.getBoundingClientRect();
                const after = e.clientY - rect.top > rect.height / 2;
                const orderedIds = reorderIds(profiles.map((x) => x.id), fromId, toId, after);
                await window.api.profilesReorder(orderedIds);
                await reload();
            });
            card.append(row, manage);
            profilesContainer.append(card);
        }
    }
    btnCreate.onclick = () => {
        createPanel.classList.toggle("hidden");
        createName.focus();
    };
    btnAdd.onclick = async () => {
        const name = createName.value.trim();
        if (!name)
            return;
        await window.api.profilesCreate(name);
        createName.value = "";
        createPanel.classList.add("hidden");
        await reload();
    };
    btnCancel.onclick = () => createPanel.classList.add("hidden");
    searchInput.addEventListener("input", () => {
        reload().catch(console.error);
    });
    jobSelect.addEventListener("change", () => {
        reload().catch(console.error);
    });
    btnRefreshLayouts.onclick = () => {
        reload().catch(console.error);
    };
    let tipIdx = 0;
    function showNextTip() {
        if (tips.length === 0)
            return;
        tipsText.textContent = tips[tipIdx];
        tipIdx = (tipIdx + 1) % tips.length;
    }
    showNextTip();
    setInterval(showNextTip, 6000);
    loadNews().catch(console.error);
    await reload();
}
async function renderSession(root: HTMLElement) {
    clear(root);
    root.className = "sessionRoot";
    const tabsBar = el("div", "tabs");
    const setLayoutStatus = (_text: string, _tone: "info" | "success" | "error" = "info") => { };
    const content = el("div", "content");
    root.append(tabsBar, content);
    type Tab = {
        profileId: string;
        title: string;
        tabBtn: HTMLButtonElement;
    };
    type SplitState = {
        leftId: string;
        rightId: string;
        ratio: number;
    };
    type CloseChoice = "tab" | "window" | "app" | "cancel";
    const defaultSplitRatio = 0.5;
    const minSplitRatio = 0.2;
    const maxSplitRatio = 0.8;
    const tabs: Tab[] = [];
    let activeId: string | null = null;
    let splitState: SplitState | null = null;
    let currentSplitRatio = defaultSplitRatio;
    let pendingSplitAnchor: string | null = null;
    let closePromptOpen = false;
    const TAB_HEIGHT_KEY = "sessionTabHeightPx";
    const tabHeightPresets = [28, 32, 36, 40, 44, 48, 52, 56, 60, 64];
    function loadTabHeight() {
        try {
            const raw = localStorage.getItem(TAB_HEIGHT_KEY);
            const num = raw ? Number(raw) : NaN;
            if (Number.isFinite(num))
                return num;
        }
        catch (err) {
            logErr(err);
        }
        return tabHeightPresets[1];
    }
    function persistTabHeight(px: number) {
        try {
            localStorage.setItem(TAB_HEIGHT_KEY, String(px));
        }
        catch (err) {
            logErr(err);
        }
    }
    function applyTabHeight(px: number) {
        const clamped = Math.max(28, Math.min(64, Math.round(px)));
        document.documentElement.style.setProperty("--session-tab-height", `${clamped}px`);
        persistTabHeight(clamped);
        return clamped;
    }
    let tabHeightPx = applyTabHeight(loadTabHeight());
    function clampSplitRatio(r: number) {
        const value = Number.isFinite(r) ? r : defaultSplitRatio;
        return Math.min(maxSplitRatio, Math.max(minSplitRatio, value));
    }
    const tabsSpacer = el("div", "spacer");
    const btnSplit = el("button", "tabBtn splitToggle", t("split.start")) as HTMLButtonElement;
    btnSplit.draggable = false;
    const splitControls = el("div", "splitControls") as HTMLDivElement;
    splitControls.style.display = "none";
    const splitSlider = document.createElement("input");
    splitSlider.type = "range";
    splitSlider.className = "splitSlider";
    splitSlider.min = String(Math.round(minSplitRatio * 100));
    splitSlider.max = String(Math.round(maxSplitRatio * 100));
    splitSlider.value = String(Math.round(defaultSplitRatio * 100));
    splitSlider.step = "1";
    splitSlider.title = "Fensteraufteilung anpassen";
    splitSlider.ariaLabel = "Fensteraufteilung anpassen";
    const splitSliderValue = el("span", "splitSliderValue", "50 / 50");
    splitControls.append(splitSlider, splitSliderValue);
    const btnTabHeight = el("button", "tabBtn iconBtn", `↕ ${tabHeightPx}px`) as HTMLButtonElement;
    btnTabHeight.title = `${t("tabHeight.label")}: ${tabHeightPx}px`;
    btnTabHeight.draggable = false;
    btnTabHeight.onclick = () => {
        const idx = tabHeightPresets.findIndex((v) => v === tabHeightPx);
        const nextIdx = (idx + 1) % tabHeightPresets.length;
        tabHeightPx = applyTabHeight(tabHeightPresets[nextIdx]);
        btnTabHeight.textContent = `↕ ${tabHeightPx}px`;
        btnTabHeight.title = `${t("tabHeight.label")}: ${tabHeightPx}px`;
        kickBounds();
    };
    const btnSaveLayout = el("button", "tabBtn iconBtn", "💾") as HTMLButtonElement;
    btnSaveLayout.title = t("layout.saveCurrent");
    btnSaveLayout.draggable = false;
    const btnLayouts = el("button", "tabBtn iconBtn", "📂") as HTMLButtonElement;
    btnLayouts.title = t("layout.pick");
    btnLayouts.draggable = false;
    const btnPlus = el("button", "tabBtn iconBtn plus", "+") as HTMLButtonElement;
    btnPlus.draggable = false;
    tabsBar.append(tabsSpacer, btnSplit, splitControls, btnTabHeight, btnSaveLayout, btnLayouts, btnPlus);
    function isOpen(profileId: string) {
        return tabs.some((t) => t.profileId === profileId);
    }
    function findTab(profileId: string): Tab | null {
        return tabs.find((t) => t.profileId === profileId) ?? null;
    }
    function updateSplitButton() {
        if (splitState) {
            const leftLabel = findTab(splitState.leftId)?.title ?? splitState.leftId;
            const rightLabel = findTab(splitState.rightId)?.title ?? splitState.rightId;
            btnSplit.textContent = t("split.stop");
            btnSplit.title = `${t("split.activePair")} ${leftLabel} <-> ${rightLabel}`;
            btnSplit.classList.add("active");
        }
        else {
            btnSplit.textContent = t("split.start");
            btnSplit.title = t("split.start");
            btnSplit.classList.remove("active");
        }
        syncSplitSlider();
    }
    function updateSplitGlyphs() {
        for (const t of tabs) {
            const glyph = t.tabBtn.querySelector('.tabGlyph') as HTMLElement | null;
            if (!glyph)
                continue;
            glyph.innerHTML = "";
            glyph.classList.remove("isLeft", "isRight");
            const side = splitState?.leftId === t.profileId
                ? "left"
                : splitState?.rightId === t.profileId
                    ? "right"
                    : null;
            if (!side) {
                glyph.style.display = "none";
                continue;
            }
            glyph.style.display = "inline-flex";
            glyph.classList.add(side === "left" ? "isLeft" : "isRight");
            glyph.textContent = side === "left" ? "L" : "R";
            if (side === "left") {
                glyph.style.background = "linear-gradient(120deg, rgba(46,204,113,0.85), rgba(46,204,113,0.55))";
            }
            else {
                glyph.style.background = "linear-gradient(120deg, rgba(44,107,255,0.85), rgba(44,107,255,0.55))";
            }
        }
    }
    function syncTabClasses() {
        for (const t of tabs) {
            const isLeft = splitState?.leftId === t.profileId;
            const isRight = splitState?.rightId === t.profileId;
            t.tabBtn.classList.toggle("active", t.profileId === activeId);
            t.tabBtn.classList.toggle("splitPartner", !!(isLeft || isRight));
            t.tabBtn.classList.toggle("splitLeft", !!isLeft);
            t.tabBtn.classList.toggle("splitRight", !!isRight);
        }
    }
    function syncSplitSlider() {
        if (!splitState) {
            splitControls.style.display = "none";
            splitSlider.disabled = true;
            return;
        }
        splitControls.style.display = "flex";
        splitSlider.disabled = false;
        const pct = Math.round(splitState.ratio * 100);
        const pctRight = Math.max(0, 100 - pct);
        splitSlider.value = String(pct);
        splitSliderValue.textContent = `${pct}% / ${pctRight}%`;
    }
    splitSlider.addEventListener("input", () => {
        if (!splitState)
            return;
        const pct = Number(splitSlider.value);
        if (!Number.isFinite(pct))
            return;
        const ratio = clampSplitRatio(pct / 100);
        if (Math.abs(ratio - splitState.ratio) < 0.001)
            return;
        currentSplitRatio = ratio;
        splitState = { ...splitState, ratio };
        syncSplitSlider();
        window.api.sessionTabsSetSplitRatio(ratio).catch(console.error);
        kickBounds();
    });
    function askLayoutName(defaultName: string): Promise<string | null> {
        return new Promise((resolve) => {
            window.api.sessionTabsSetVisible(false).catch(() => undefined);
            const overlay = el("div", "modalOverlay");
            const modal = el("div", "modal");
            const header = el("div", "modalHeader", t("layout.namePrompt"));
            const body = el("div", "modalBody");
            const input = document.createElement("input");
            input.className = "input";
            input.value = defaultName;
            input.placeholder = t("layout.namePrompt");
            const actions = el("div", "manageActions");
            const btnSave = el("button", "btn primary", t("profile.save"));
            const btnCancel = el("button", "btn", t("create.cancel"));
            actions.append(btnSave, btnCancel);
            body.append(input, actions);
            modal.append(header, body);
            overlay.append(modal);
            const cleanup = (val: string | null) => {
                overlay.remove();
                window.api.sessionTabsSetVisible(true).catch(() => undefined);
                resolve(val);
                pushBounds();
                kickBounds();
            };
            btnSave.onclick = () => cleanup(input.value.trim() || defaultName);
            btnCancel.onclick = () => cleanup(null);
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay)
                    cleanup(null);
            });
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter")
                    cleanup(input.value.trim() || defaultName);
                if (e.key === "Escape")
                    cleanup(null);
            });
            document.body.append(overlay);
            input.focus();
            input.select();
        });
    }
    async function saveCurrentLayout() {
        setLayoutStatus("Save clicked", "info");
        if (tabs.length === 0) {
            alert(t("layout.saveError"));
            setLayoutStatus(t("layout.saveError"), "error");
            return;
        }
        if (!window.api.tabLayoutsSave) {
            alert(`${t("layout.saveError")}: tabLayoutsSave not available`);
            setLayoutStatus("tabLayoutsSave not available", "error");
            return;
        }
        setLayoutStatus(`Tabs open: ${tabs.length}`, "info");
        const defaultName = `Layout ${new Date().toLocaleTimeString()}`;
        const name = await askLayoutName(defaultName);
        if (!name) {
            setLayoutStatus("Save cancelled", "info");
            return;
        }
        setLayoutStatus(`Tabs open: ${tabs.length} | Name len=${name.length}`, "info");
        const payload = {
            name,
            tabs: tabs.map((t) => t.profileId),
            split: splitState ? { ...splitState, ratio: splitState.ratio ?? currentSplitRatio } : null,
            activeId,
        };
        const statusMsg = `Saving layout: ${payload.tabs.length} tabs${payload.split ? " + split" : ""}`;
        setLayoutStatus(statusMsg, "info");
        showToast(statusMsg, "info", 2500);
        try {
            const before = await withTimeout(window.api.tabLayoutsList(), "tabLayoutsList before", 2000);
            const saved = await withTimeout(window.api.tabLayoutsSave(payload), "tabLayoutsSave", 3000);
            const after = saved ?? (await withTimeout(window.api.tabLayoutsList(), "tabLayoutsList after", 2000));
            const beforeCount = before?.length ?? 0;
            const afterCount = after?.length ?? 0;
            const delta = afterCount - beforeCount;
            const deltaMsg = `before=${beforeCount} after=${afterCount} delta=${delta}`;
            showToast(t("layout.saved"), "success");
            alert(`${t("layout.saved")} (${deltaMsg})`);
            setLayoutStatus(`${t("layout.saved")} (${deltaMsg})`, "success");
            localStorage.setItem("tabLayoutsRefresh", "1");
        }
        catch (err) {
            logErr(err);
            const msg = err instanceof Error
                ? `${err.name}: ${err.message}`
                : typeof err === "string"
                    ? err
                    : JSON.stringify(err ?? "unknown error");
            const full = `${t("layout.saveError")}: ${msg}`;
            showToast(full, "error", 6000);
            alert(full);
            setLayoutStatus(full, "error");
            try {
                const beforeLocal = loadLocalLayouts();
                const newLayout: TabLayout = {
                    id: Math.random().toString(36).slice(2, 10),
                    name: name || `Layout-${Date.now()}`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    tabs: [...payload.tabs],
                    split: payload.split,
                    activeId: payload.activeId,
                };
                const next = [...beforeLocal, newLayout];
                saveLocalLayouts(next);
                const msgLocal = `Locally saved (now ${next.length})`;
                showToast(msgLocal, "success");
                alert(msgLocal);
                setLayoutStatus(`${full} | ${msgLocal}`, "success");
            }
            catch (e2) {
                logErr(e2);
                setLayoutStatus(`${full} | local fallback failed`, "error");
            }
        }
    }
    async function applyLayout(layout: TabLayout) {
        await window.api.sessionTabsSetVisible(false);
        await window.api.sessionTabsReset();
        await clearSplit();
        const profiles = await window.api.profilesList();
        const existingIds = new Set((profiles ?? []).map((p: Profile) => p.id));
        const ordered = (layout.tabs ?? []).filter((id) => existingIds.has(id));
        if (ordered.length === 0)
            return;
        for (const t of tabs)
            t.tabBtn.remove();
        tabs.length = 0;
        if (layout.split?.ratio)
            currentSplitRatio = clampSplitRatio(layout.split.ratio);
        for (const id of ordered) {
            await openTab(id);
        }
        if (layout.split && existingIds.has(layout.split.leftId) && existingIds.has(layout.split.rightId)) {
            await applySplit({
                leftId: layout.split.leftId,
                rightId: layout.split.rightId,
                ratio: layout.split.ratio ?? currentSplitRatio,
            });
        }
        else {
            await clearSplit();
        }
        if (layout.activeId && existingIds.has(layout.activeId)) {
            await setActive(layout.activeId);
        }
        updateSplitButton();
        syncTabClasses();
        pushBounds();
        setTimeout(pushBounds, 120);
        setTimeout(pushBounds, 280);
        await window.api.sessionTabsSetVisible(true);
        pushBounds();
        kickBounds();
    }
    async function showLayoutPicker() {
        await window.api.sessionTabsSetVisible(false);
        const overlay = el("div", "modalOverlay");
        const modal = el("div", "modal");
        const header = el("div", "modalHeader", t("layout.pick"));
        const body = el("div", "modalBody");
        const list = el("div", "pickerList");
        modal.append(header, body);
        body.append(list);
        overlay.append(modal);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape")
                close().catch(console.error);
        };
        const close = async () => {
            overlay.remove();
            document.removeEventListener("keydown", onKey);
            await window.api.sessionTabsSetVisible(true);
            kickBounds();
        };
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay)
                close().catch(console.error);
        });
        document.addEventListener("keydown", onKey);
        document.body.append(overlay);
        const layouts = await fetchTabLayouts();
        if (layouts.length === 0) {
            list.append(el("div", "pickerEmpty", t("layout.empty")));
            return;
        }
        for (const layout of layouts) {
            const metaParts = [`${layout.tabs.length} Tabs`];
            if (layout.split)
                metaParts.push("Split");
            const item = el("button", "pickerItem", `${layout.name} (${metaParts.join(" • ")})`) as HTMLButtonElement;
            item.onclick = async () => {
                await applyLayout(layout);
                await close();
            };
            list.append(item);
        }
    }
    function pushBounds() {
        const y = Math.round(tabsBar.getBoundingClientRect().height);
        const width = Math.round(window.innerWidth);
        const height = Math.max(1, Math.round(window.innerHeight - y));
        window.api.sessionTabsSetBounds({ x: 0, y, width, height });
    }
    function forceBounds() {
        pushBounds();
        window.api.sessionTabsSetVisible(true);
    }
    let raf = 0;
    function kickBounds() {
        if (raf)
            return;
        raf = requestAnimationFrame(() => {
            raf = 0;
            pushBounds();
        });
    }
    window.addEventListener("resize", kickBounds);
    new ResizeObserver(kickBounds).observe(tabsBar);
    async function applySplit(next: SplitState | null) {
        if (next) {
            currentSplitRatio = clampSplitRatio(next.ratio ?? currentSplitRatio);
            splitState = { leftId: next.leftId, rightId: next.rightId, ratio: currentSplitRatio };
            activeId = next.leftId;
        }
        else {
            splitState = null;
        }
        updateSplitButton();
        syncTabClasses();
        await window.api.sessionTabsSetSplit(splitState ? { primary: splitState.leftId, secondary: splitState.rightId, ratio: splitState.ratio } : null);
        if (splitState) {
            await window.api.sessionTabsSwitch(splitState.leftId);
        }
        else if (activeId) {
            await window.api.sessionTabsSwitch(activeId);
        }
        kickBounds();
    }
    async function clearSplit() {
        if (!splitState)
            return;
        await applySplit(null);
    }
    async function setActive(profileId: string, side: "left" | "right" = "left") {
        if (splitState) {
            let nextLeft = splitState.leftId;
            let nextRight = splitState.rightId;
            if (side === "left") {
                if (profileId === nextRight) {
                    nextRight = nextLeft;
                }
                nextLeft = profileId;
            }
            else {
                if (profileId === nextLeft) {
                    nextLeft = nextRight;
                }
                nextRight = profileId;
            }
            splitState = { leftId: nextLeft, rightId: nextRight, ratio: splitState.ratio };
            activeId = profileId;
            updateSplitButton();
            syncTabClasses();
            updateSplitGlyphs();
            await window.api.sessionTabsSetSplit({
                primary: splitState.leftId,
                secondary: splitState.rightId,
                ratio: splitState.ratio,
            });
            await window.api.sessionTabsSwitch(profileId);
            kickBounds();
            return;
        }
        activeId = profileId;
        syncTabClasses();
        updateSplitGlyphs();
        await window.api.sessionTabsSwitch(profileId);
        kickBounds();
    }
    function renderTabsOrder() {
        for (const t of tabs) {
            tabsBar.insertBefore(t.tabBtn, tabsSpacer);
        }
    }
    function moveTab(fromId: string, toId: string, after: boolean) {
        const fromIdx = tabs.findIndex((t) => t.profileId === fromId);
        const toIdx = tabs.findIndex((t) => t.profileId === toId);
        if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx)
            return;
        const [item] = tabs.splice(fromIdx, 1);
        let insertIdx = toIdx;
        if (fromIdx < toIdx)
            insertIdx -= 1;
        if (after)
            insertIdx += 1;
        tabs.splice(insertIdx, 0, item);
        renderTabsOrder();
    }
    let draggingId: string | null = null;
    function attachDnd(tabBtn: HTMLButtonElement, profileId: string) {
        tabBtn.draggable = true;
        tabBtn.addEventListener("dragstart", (e) => {
            draggingId = profileId;
            tabBtn.classList.add("dragging");
            e.dataTransfer?.setData("text/plain", profileId);
            e.dataTransfer!.effectAllowed = "move";
        });
        tabBtn.addEventListener("dragend", () => {
            draggingId = null;
            tabBtn.classList.remove("dragging", "dropBefore", "dropAfter");
            for (const t of tabs)
                t.tabBtn.classList.remove("dropBefore", "dropAfter");
        });
        tabBtn.addEventListener("dragover", (e) => {
            e.preventDefault();
            const fromId = draggingId ?? e.dataTransfer?.getData("text/plain");
            if (!fromId || fromId === profileId)
                return;
            const rect = tabBtn.getBoundingClientRect();
            const after = e.clientX - rect.left > rect.width / 2;
            tabBtn.classList.toggle("dropAfter", after);
            tabBtn.classList.toggle("dropBefore", !after);
            e.dataTransfer!.dropEffect = "move";
        });
        tabBtn.addEventListener("dragleave", () => {
            tabBtn.classList.remove("dropBefore", "dropAfter");
        });
        tabBtn.addEventListener("drop", (e) => {
            e.preventDefault();
            const fromId = draggingId ?? e.dataTransfer?.getData("text/plain");
            if (!fromId || fromId === profileId)
                return;
            const rect = tabBtn.getBoundingClientRect();
            const after = e.clientX - rect.left > rect.width / 2;
            tabBtn.classList.remove("dropBefore", "dropAfter");
            moveTab(fromId, profileId, after);
        });
    }
    async function promptCloseChoice(targetProfileId: string | null): Promise<CloseChoice> {
        await window.api.sessionTabsSetVisible(false).catch(() => undefined);
        const targetLabel = targetProfileId ? findTab(targetProfileId)?.title ?? targetProfileId : null;
        return await new Promise<CloseChoice>((resolve) => {
            const overlay = el("div", "modalOverlay");
            const modal = el("div", "modal");
            const header = el("div", "modalHeader", t("close.title"));
            const body = el("div", "modalBody");
            const prompt = el("div", "modalHint", t("close.prompt"));
            const targetHint = targetLabel ? el("div", "modalHint", `${t("close.target")} ${targetLabel}`) : null;
            const actions = el("div", "manageActions");
            const btnTab = el("button", "btn primary", t("close.optionTab")) as HTMLButtonElement;
            const btnWindow = el("button", "btn", t("close.optionWindow")) as HTMLButtonElement;
            const btnApp = el("button", "btn danger", t("close.optionApp")) as HTMLButtonElement;
            const btnCancel = el("button", "btn", t("close.optionCancel")) as HTMLButtonElement;
            let done = false;
            const finish = (choice: CloseChoice) => {
                if (done)
                    return;
                done = true;
                overlay.remove();
                window.removeEventListener("keydown", onKey);
                resolve(choice);
            };
            const onKey = (e: KeyboardEvent) => {
                if (e.key === "Escape")
                    finish("cancel");
            };
            window.addEventListener("keydown", onKey);
            btnTab.disabled = !targetProfileId;
            btnTab.onclick = () => finish("tab");
            btnWindow.onclick = () => finish("window");
            btnApp.onclick = () => finish("app");
            btnCancel.onclick = () => finish("cancel");
            actions.append(btnTab, btnWindow, btnApp, btnCancel);
            body.append(prompt);
            if (targetHint)
                body.append(targetHint);
            body.append(actions);
            modal.append(header, body);
            overlay.append(modal);
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay)
                    finish("cancel");
            });
            document.body.append(overlay);
            (btnTab.disabled ? btnWindow : btnTab).focus();
        });
    }
    async function closeTab(profileId: string) {
        pendingSplitAnchor = pendingSplitAnchor === profileId ? null : pendingSplitAnchor;
        const wasSplit = splitState && (splitState.leftId === profileId || splitState.rightId === profileId);
        const survivorId = wasSplit ? (splitState.leftId === profileId ? splitState.rightId : splitState.leftId) : null;
        await window.api.sessionTabsClose(profileId);
        const idx = tabs.findIndex((t) => t.profileId === profileId);
        if (idx >= 0) {
            const [removed] = tabs.splice(idx, 1);
            removed.tabBtn.remove();
        }
        else {
            const existing = findTab(profileId);
            existing?.tabBtn.remove();
        }
        if (wasSplit)
            await clearSplit();
        const next = (survivorId && isOpen(survivorId) ? findTab(survivorId) : null) ??
            tabs[idx] ??
            tabs[idx - 1] ??
            null;
        activeId = null;
        if (next)
            await setActive(next.profileId);
        renderTabsOrder();
        updateSplitButton();
        syncTabClasses();
        updateSplitGlyphs();
    }
    async function handleCloseChoice(profileId?: string | null) {
        if (closePromptOpen)
            return;
        closePromptOpen = true;
        const targetId = profileId ?? activeId ?? tabs[0]?.profileId ?? null;
        let restoreTabs = true;
        try {
            const choice = await promptCloseChoice(targetId);
            restoreTabs = choice === "tab" || choice === "cancel" || !targetId;
            if (choice === "tab") {
                if (targetId)
                    await closeTab(targetId);
            }
            else if (choice === "window") {
                restoreTabs = false;
                await window.api.sessionWindowClose();
            }
            else if (choice === "app") {
                restoreTabs = false;
                await window.api.appQuit();
            }
        }
        catch (err) {
            logErr(err);
            restoreTabs = true;
        }
        finally {
            closePromptOpen = false;
        }
        if (restoreTabs) {
            window.api.sessionTabsSetVisible(true).catch(() => undefined);
            kickBounds();
        }
    }
    async function openTab(profileId: string) {
        const existing = tabs.find((t) => t.profileId === profileId);
        if (existing) {
            if (pendingSplitAnchor && pendingSplitAnchor !== profileId && isOpen(pendingSplitAnchor)) {
                const anchor = pendingSplitAnchor;
                pendingSplitAnchor = null;
                await applySplit({ leftId: anchor, rightId: profileId, ratio: currentSplitRatio });
                return;
            }
            pendingSplitAnchor = null;
            return setActive(profileId);
        }
        const profiles: Profile[] = await window.api.profilesList();
        const p = profiles.find((x) => x.id === profileId);
        const title = p?.name ?? profileId;
        const tabBtn = document.createElement("button");
        tabBtn.className = "tabBtn sessionTab";
        tabBtn.dataset.title = title;
        const splitGlyph = el("span", "tabGlyph", "");
        (splitGlyph as HTMLElement).style.display = "none";
        const jobIcon = createJobIcon(p?.job, "tabJobIcon");
        const label = el("span", "tabLabel", title);
        if (p?.job?.trim())
            tabBtn.title = p.job;
        const closeBtn = el("span", "tabClose", "×");
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            handleCloseChoice(profileId).catch(console.error);
        };
        tabBtn.append(splitGlyph);
        if (jobIcon)
            tabBtn.append(jobIcon);
        tabBtn.append(label, closeBtn);
        tabBtn.onclick = () => setActive(profileId, "left");
        tabBtn.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            setActive(profileId, "right").catch(console.error);
        });
        attachDnd(tabBtn, profileId);
        const tab: Tab = { profileId, title, tabBtn };
        tabs.push(tab);
        renderTabsOrder();
        await window.api.sessionTabsOpen(profileId);
        if (pendingSplitAnchor && pendingSplitAnchor !== profileId && isOpen(pendingSplitAnchor)) {
            const anchor = pendingSplitAnchor;
            pendingSplitAnchor = null;
            await applySplit({ leftId: anchor, rightId: profileId, ratio: currentSplitRatio });
            return;
        }
        pendingSplitAnchor = null;
        await setActive(profileId);
    }
    async function showPicker() {
        await window.api.sessionTabsSetVisible(false);
        const overlay = el("div", "modalOverlay");
        const modal = el("div", "modal");
        const header = el("div", "modalHeader", t("picker.title"));
        const body = el("div", "modalBody");
        const list = el("div", "pickerList");
        modal.append(header, body);
        body.append(list);
        overlay.append(modal);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape")
                close().catch(console.error);
        };
        const close = async () => {
            overlay.remove();
            window.removeEventListener("keydown", onKey);
            await window.api.sessionTabsSetVisible(true);
            kickBounds();
        };
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay)
                close().catch(console.error);
        });
        window.addEventListener("keydown", onKey);
        document.body.append(overlay);
        const profiles: Profile[] = await window.api.profilesList();
        const candidates = profiles.filter((p) => p.launchMode === "tabs" && !isOpen(p.id));
        if (candidates.length === 0) {
            list.append(el("div", "pickerEmpty", t("picker.empty")));
            return;
        }
        for (const p of candidates) {
            const item = el("button", "pickerItem", p.name) as HTMLButtonElement;
            item.onclick = async () => {
                await openTab(p.id);
                await close();
            };
            list.append(item);
        }
    }
    async function showSplitPicker(anchorId: string) {
        await window.api.sessionTabsSetVisible(false);
        const overlay = el("div", "modalOverlay");
        const modal = el("div", "modal");
        const header = el("div", "modalHeader", t("split.title"));
        const body = el("div", "modalBody");
        const hint = el("div", "modalHint", t("split.subtitle"));
        const list = el("div", "pickerList");
        modal.append(header, body);
        body.append(hint, list);
        overlay.append(modal);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape")
                close().catch(console.error);
        };
        const close = async (keepAnchor = false) => {
            overlay.remove();
            window.removeEventListener("keydown", onKey);
            await window.api.sessionTabsSetVisible(true);
            if (!keepAnchor)
                pendingSplitAnchor = null;
            kickBounds();
        };
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay)
                close().catch(console.error);
        });
        window.addEventListener("keydown", onKey);
        document.body.append(overlay);
        const openTabs = tabs.filter((t) => t.profileId !== anchorId);
        if (openTabs.length === 0) {
            list.append(el("div", "pickerEmpty", t("split.noOpenTabs")));
        }
        else {
            for (const t of openTabs) {
                const item = el("button", "pickerItem", t.title) as HTMLButtonElement;
                item.onclick = async () => {
                    await applySplit({ leftId: anchorId, rightId: t.profileId, ratio: currentSplitRatio });
                    await close();
                };
                list.append(item);
            }
        }
        const addBtn = el("button", "pickerItem secondary", t("split.openOther")) as HTMLButtonElement;
        addBtn.onclick = async () => {
            await close(true);
            pendingSplitAnchor = anchorId;
            await showPicker();
            pendingSplitAnchor = null;
        };
        body.append(addBtn);
    }
    btnSplit.onclick = () => {
        if (splitState) {
            clearSplit().catch(console.error);
            return;
        }
        const anchor = activeId ?? tabs[0]?.profileId ?? null;
        if (!anchor) {
            showPicker().catch(console.error);
            return;
        }
        showSplitPicker(anchor).catch(console.error);
    };
    btnSaveLayout.onclick = () => {
        showToast(t("layout.saveStart"), "info", 1800);
        saveCurrentLayout().catch((err) => {
            logErr(err);
            showToast(`${t("layout.saveError")}: ${err instanceof Error ? err.message : String(err)}`, "error", 5000);
        });
    };
    btnLayouts.onclick = () => showLayoutPicker().catch(console.error);
    btnPlus.onclick = () => showPicker().catch(console.error);
    window.api.onOpenTab((profileId: string) => {
        openTab(profileId).catch(console.error);
    });
    window.api.onSessionActiveChanged((profileId: string | null) => {
        if (profileId && !isOpen(profileId))
            return;
        activeId = profileId;
        syncTabClasses();
    });
    window.api.onSessionWindowCloseRequested(() => {
        handleCloseChoice(activeId).catch(console.error);
    });
    window.api.onApplyLayout((layout: TabLayout) => {
        applyLayout(layout).catch(console.error);
    });
    const initialLayoutId = qs().get("layoutId");
    const initial = qs().get("openProfileId");
    if (initialLayoutId) {
        window.api
            .tabLayoutsGet(initialLayoutId)
            .then((layout) => layout && applyLayout(layout))
            .catch(console.error);
    }
    else if (initial) {
        openTab(initial).catch(console.error);
    }
    updateSplitButton();
    syncTabClasses();
    kickBounds();
}
async function renderInstance(root: HTMLElement, profileId: string) {
    clear(root);
    root.className = "instanceRoot";
    const wv = createWebview(profileId) as any;
    wv.setAttribute("src", FLYFF_URL);
    root.append(wv);
}
async function main() {
    const root = document.getElementById("app")!;
    const view = qs().get("view") ?? "launcher";
    if (view === "launcher")
        return renderLauncher(root);
    if (view === "session")
        return renderSession(root);
    if (view === "instance") {
        const profileId = qs().get("profileId") ?? "";
        return renderInstance(root, profileId);
    }
    return renderLauncher(root);
}
main().catch(console.error);
