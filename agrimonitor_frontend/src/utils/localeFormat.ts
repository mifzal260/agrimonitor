import i18n from "../i18n";

export function currentLocale() {
  return i18n.language === "en" ? "en-MY" : "ms-MY";
}

export function formatCurrency(value: string | number, options: { signed?: boolean } = {}) {
  const amount = Number(value) || 0;
  const formatted = new Intl.NumberFormat(currentLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  if (options.signed && amount > 0) return `+RM ${formatted}`;
  if (amount < 0) return `-RM ${formatted}`;
  return `RM ${formatted}`;
}

export function formatPricePerKg(value: string | number) {
  return `${formatCurrency(value)} / kg`;
}

export function formatDateShort(dateValue: string) {
  if (!dateValue) return "";
  const date = parseDate(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return new Intl.DateTimeFormat(currentLocale(), { day: "numeric", month: "short" }).format(date);
}

export function formatDateLong(dateValue: string) {
  if (!dateValue) return "";
  const date = parseDate(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return new Intl.DateTimeFormat(currentLocale(), { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat(currentLocale(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function parseDate(dateValue: string) {
  return new Date(dateValue.includes("T") ? dateValue : `${dateValue}T00:00:00`);
}
