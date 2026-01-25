import type { TranslationKey } from "../i18n/translations";
import manifest from "./themes.json";

const themeStyles = import.meta.glob("./*.css", { eager: true });
const styleIds = Object.keys(themeStyles).map((file) =>
    file.replace(/^\.\//, "").replace(/\.css$/, "")
);
void Object.values(themeStyles);

const manifestThemes = manifest as ThemeDefinition[];
const addedThemeIds = new Set<string>(manifestThemes.map((theme) => theme.id));

const autoThemes: ThemeDefinition[] = styleIds
    .filter((id) => !addedThemeIds.has(id))
    .map((id) => ({ id, name: humanizeThemeId(id) }));

export type ThemeDefinition = {
    id: string;
    nameKey?: TranslationKey;
    descriptionKey?: TranslationKey;
    name?: string;
    description?: string;
    swatches?: string[];
    tabActive?: string;
};

export const THEMES: ThemeDefinition[] = [...manifestThemes, ...autoThemes];

function humanizeThemeId(id: string) {
    return id
        .split(/[-_]/)
        .map((segment) => segment.replace(/^\w/, (char) => char.toUpperCase()))
        .join(" ");
}
