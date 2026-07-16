import i18n from "../i18n";

export function currentLocale() {
  return i18n.language === "en" ? "en-MY" : "ms-MY";
}

export function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toCurrencyNumber(value: unknown, fallback = 0) {
  return toFiniteNumber(value) ?? fallback;
}

export function formatCurrency(value: string | number | null | undefined, options: { signed?: boolean; unavailable?: string } = {}) {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return options.unavailable ?? "—";

  const amount = parsed;
  const formatted = new Intl.NumberFormat(currentLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  if (options.signed && amount > 0) return `+RM ${formatted}`;
  if (amount < 0) return `-RM ${formatted}`;
  return `RM ${formatted}`;
}

export function formatPricePerUnit(value: string | number | null | undefined, unit?: string | null) {
  const formattedPrice = formatCurrency(value);
  if (formattedPrice === "—") return formattedPrice;
  const normalizedUnit = (unit ?? "").trim();
  return normalizedUnit ? `${formattedPrice} / ${normalizedUnit.replace(/^\/+\s*/, "")}` : formattedPrice;
}

export function formatPricePerKg(value: string | number) {
  return formatPricePerUnit(value, "kg");
}

export function formatDateShort(dateValue: string | null | undefined, unavailable: string | number = "—") {
  const date = parseDate(dateValue);
  if (!date) return String(unavailable);
  return new Intl.DateTimeFormat(currentLocale(), { day: "numeric", month: "short" }).format(date);
}

export function formatDateLong(dateValue: string | null | undefined, unavailable: string | number = "—") {
  const date = parseDate(dateValue);
  if (!date) return String(unavailable);
  return new Intl.DateTimeFormat(currentLocale(), { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat(currentLocale(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function parseDate(dateValue: string | null | undefined) {
  const normalizedValue = dateValue?.trim();
  if (!normalizedValue) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedValue);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    const isValidDateOnly = date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day);
    return isValidDateOnly ? date : null;
  }

  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? null : date;
}





