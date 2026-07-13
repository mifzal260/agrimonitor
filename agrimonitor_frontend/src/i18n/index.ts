import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import ms from "./locales/ms.json";

const languageStorageKey = "agrimonitor_lang";
const supportedLanguages = ["ms", "en"] as const;
type SupportedLanguage = (typeof supportedLanguages)[number];

function isSupportedLanguage(language: string | null): language is SupportedLanguage {
  return supportedLanguages.includes(language as SupportedLanguage);
}

const savedLanguage = localStorage.getItem(languageStorageKey);
const initialLanguage = isSupportedLanguage(savedLanguage) ? savedLanguage : "ms";

void i18n.use(initReactI18next).init({
  resources: {
    ms: { translation: ms },
    en: { translation: en },
  },
  lng: initialLanguage,
  fallbackLng: "ms",
  interpolation: {
    escapeValue: false,
  },
});

export { languageStorageKey, supportedLanguages };
export default i18n;
