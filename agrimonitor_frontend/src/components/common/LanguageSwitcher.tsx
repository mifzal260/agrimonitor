import { useTranslation } from "react-i18next";

import { languageStorageKey } from "../../i18n";

type Language = "ms" | "en";

const languages: Array<{ value: Language; label: string }> = [
  { value: "ms", label: "BM" },
  { value: "en", label: "EN" },
];

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const currentLanguage: Language = i18n.language === "en" ? "en" : "ms";

  async function changeLanguage(language: Language) {
    await i18n.changeLanguage(language);
    localStorage.setItem(languageStorageKey, language);
  }

  return (
    <div className="soft-glass-pill inline-flex rounded-full p-1" aria-label={t("header.languageChoice")}>
      {languages.map((language) => {
        const isActive = currentLanguage === language.value;
        return (
          <button
            key={language.value}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${isActive ? "bg-field-700 text-white shadow-sm" : "text-slate-700 hover:bg-white/80 hover:text-field-700"}`}
            type="button"
            onClick={() => void changeLanguage(language.value)}
            aria-pressed={isActive}
          >
            {language.label}
          </button>
        );
      })}
    </div>
  );
}


