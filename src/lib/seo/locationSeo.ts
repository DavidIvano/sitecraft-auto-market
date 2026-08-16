const CITY_ALIASES = new Map<string, string>([
  ["ильзеде", "Ilsede"],
  ["ильседе", "Ilsede"],
]);

const titleCaseLocation = (value: string) => value.replace(/(^|[\s-])([\p{L}])/gu, (_match, separator, letter) => (
  `${separator}${letter.toLocaleUpperCase("de-DE")}`
));

export function getCanonicalSeoCity(value: unknown) {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const alias = CITY_ALIASES.get(clean.toLocaleLowerCase("ru-RU"));
  if (alias) return alias;
  if (clean === clean.toLocaleLowerCase("de-DE") || clean === clean.toLocaleUpperCase("de-DE")) {
    return titleCaseLocation(clean.toLocaleLowerCase("de-DE"));
  }
  return clean;
}
