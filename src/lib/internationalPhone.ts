import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min";

const PRIORITY_COUNTRIES: CountryCode[] = [
  "DE", "UA", "RU", "TR", "AT", "CH", "PL", "FR", "NL", "BE", "IT", "ES", "GB", "US", "CA",
];

function countryFlag(code: CountryCode) {
  return String.fromCodePoint(...code.split("").map((letter) => 127397 + letter.charCodeAt(0)));
}

export const PHONE_COUNTRIES = getCountries()
  .map((code) => ({
    code,
    callingCode: getCountryCallingCode(code),
    label: `${countryFlag(code)} ${code} +${getCountryCallingCode(code)}`,
  }))
  .sort((left, right) => {
    const leftPriority = PRIORITY_COUNTRIES.indexOf(left.code);
    const rightPriority = PRIORITY_COUNTRIES.indexOf(right.code);
    if (leftPriority >= 0 || rightPriority >= 0) {
      if (leftPriority < 0) return 1;
      if (rightPriority < 0) return -1;
      return leftPriority - rightPriority;
    }
    return left.code.localeCompare(right.code);
  });

export function sanitizeNationalPhoneDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export function splitInternationalPhone(value: unknown, fallbackCountry: CountryCode = "DE") {
  const raw = String(value ?? "").trim();
  const normalizedRaw = raw.startsWith("00") ? `+${raw.slice(2)}` : raw;
  const parsed = normalizedRaw ? parsePhoneNumberFromString(normalizedRaw) : undefined;
  const country = parsed?.country || fallbackCountry;
  return {
    country,
    nationalDigits: parsed?.nationalNumber || sanitizeNationalPhoneDigits(raw),
    e164: parsed?.number || "",
    valid: Boolean(parsed?.isValid()),
  };
}

export function composeInternationalPhone(country: CountryCode, nationalValue: unknown) {
  const nationalDigits = sanitizeNationalPhoneDigits(nationalValue);
  if (!nationalDigits) return "";
  const parsed = parsePhoneNumberFromString(nationalDigits, country);
  return parsed?.number || `+${getCountryCallingCode(country)}${nationalDigits.replace(/^0+/, "")}`;
}

export function validateInternationalPhone(country: CountryCode, nationalValue: unknown) {
  const nationalDigits = sanitizeNationalPhoneDigits(nationalValue);
  if (!nationalDigits) return { valid: true, e164: "", message: "" };
  const parsed = parsePhoneNumberFromString(nationalDigits, country);
  const e164DigitCount = parsed?.number.replace(/\D/g, "").length || Number.POSITIVE_INFINITY;
  if (!parsed?.isPossible() || !parsed.isValid() || parsed.country !== country || e164DigitCount > 15) {
    return {
      valid: false,
      e164: composeInternationalPhone(country, nationalDigits),
      message: `Номер для ${country} содержит неправильное количество цифр или не соответствует телефонному стандарту.`,
    };
  }
  return { valid: true, e164: parsed.number, message: "" };
}

function countryForCallingCode(callingCode: string): CountryCode {
  return PHONE_COUNTRIES.find((item) => item.callingCode === callingCode)?.code || "DE";
}

export function normalizeStrictInternationalPhone(value: unknown, defaultCallingCode = "49") {
  const raw = String(value ?? "").trim();
  if (!raw || /[A-Za-zА-Яа-яЁё<>\u0000-\u001f\u007f]/u.test(raw)) return "";
  const compact = raw.replace(/[\s()./-]/g, "");
  const fallbackCountry = countryForCallingCode(String(defaultCallingCode).replace(/\D/g, ""));
  const candidate = compact.startsWith("00")
    ? `+${compact.slice(2)}`
    : compact.startsWith("+")
      ? compact
      : compact;
  if (!candidate.startsWith("+") && !candidate.startsWith("0")) return "";
  const parsed = parsePhoneNumberFromString(candidate, fallbackCountry);
  const e164DigitCount = parsed?.number.replace(/\D/g, "").length || Number.POSITIVE_INFINITY;
  return parsed?.isPossible() && parsed.isValid() && e164DigitCount <= 15 ? parsed.number : "";
}
