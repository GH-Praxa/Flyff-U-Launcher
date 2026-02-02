import { DEFAULT_LOCALE, translate, type Locale, type TranslationKey } from "../i18n/translations";

export let currentLocale: Locale = DEFAULT_LOCALE;

document.documentElement.lang = currentLocale;

export function applyLocale(lang: Locale) {

    currentLocale = lang;

    document.documentElement.lang = lang;

}

export function setLocale(lang: Locale) {

    applyLocale(lang);

    // Persist locale in client settings (userData) so it survives updates

    if (window.api?.clientSettingsPatch) {

        void window.api.clientSettingsPatch({ locale: lang });

    }

}

export function t(key: TranslationKey) {

    return translate(currentLocale, key);

}
