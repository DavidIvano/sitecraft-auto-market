const publicViewNumber = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

const compactPublicViewNumber = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const normalizePublicViewCount = (value: unknown): number => {
  if (value === null || value === undefined || value === "") return 0;

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) return 0;

  return Math.floor(numericValue);
};

const getPublicViewWord = (count: number): "просмотр" | "просмотра" | "просмотров" => {
  const lastTwoDigits = count % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "просмотров";

  const lastDigit = count % 10;
  if (lastDigit === 1) return "просмотр";
  if (lastDigit >= 2 && lastDigit <= 4) return "просмотра";
  return "просмотров";
};

export const formatPublicViewCount = (value: unknown): string => {
  const count = normalizePublicViewCount(value);
  return `${publicViewNumber.format(count)} ${getPublicViewWord(count)}`;
};

export const formatCompactPublicViewCount = (value: unknown): string =>
  compactPublicViewNumber.format(normalizePublicViewCount(value));

export const shouldShowPublicViewCount = (value: unknown): boolean =>
  normalizePublicViewCount(value) >= 5;
