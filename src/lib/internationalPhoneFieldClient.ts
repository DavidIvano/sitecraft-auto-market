import type { CountryCode } from "libphonenumber-js/min";
import {
  composeInternationalPhone,
  sanitizeNationalPhoneDigits,
  splitInternationalPhone,
  validateInternationalPhone,
} from "./internationalPhone.ts";

type PhoneField = {
  root: HTMLElement;
  country: HTMLSelectElement;
  national: HTMLInputElement;
  canonical: HTMLInputElement;
};

function resolvePhoneField(scope: ParentNode, canonicalName: string): PhoneField | null {
  const canonical = scope.querySelector<HTMLInputElement>(`input[type="hidden"][name="${canonicalName}"]`);
  const root = canonical?.closest<HTMLElement>("[data-international-phone]");
  const country = root?.querySelector<HTMLSelectElement>("[data-phone-country]");
  const national = root?.querySelector<HTMLInputElement>("[data-phone-national]");
  return root && country && national && canonical ? { root, country, national, canonical } : null;
}

function syncPhoneField(field: PhoneField) {
  field.national.value = sanitizeNationalPhoneDigits(field.national.value);
  const result = validateInternationalPhone(field.country.value as CountryCode, field.national.value);
  field.canonical.value = result.e164 || composeInternationalPhone(field.country.value as CountryCode, field.national.value);
  field.national.setCustomValidity(result.message);
  field.root.dataset.phoneValid = String(result.valid);
  return result;
}

export function initializeInternationalPhoneFields(scope: ParentNode = document) {
  scope.querySelectorAll<HTMLElement>("[data-international-phone]").forEach((root) => {
    if (root.dataset.phoneBound === "true") return;
    const canonical = root.querySelector<HTMLInputElement>('input[type="hidden"][data-phone-canonical]');
    const country = root.querySelector<HTMLSelectElement>("[data-phone-country]");
    const national = root.querySelector<HTMLInputElement>("[data-phone-national]");
    if (!canonical || !country || !national) return;
    const field = { root, country, national, canonical };
    root.dataset.phoneBound = "true";
    national.addEventListener("input", () => syncPhoneField(field));
    country.addEventListener("change", () => syncPhoneField(field));
    syncPhoneField(field);
  });
}

export function setInternationalPhoneField(scope: ParentNode, canonicalName: string, value: unknown, fallbackCountry: CountryCode = "DE") {
  const field = resolvePhoneField(scope, canonicalName);
  if (!field) return;
  const split = splitInternationalPhone(value, fallbackCountry);
  field.country.value = split.country;
  field.national.value = split.nationalDigits;
  field.canonical.value = split.e164;
  syncPhoneField(field);
}

export function readInternationalPhoneField(scope: ParentNode, canonicalName: string) {
  const field = resolvePhoneField(scope, canonicalName);
  if (!field) return { valid: true, e164: "", message: "", national: null as HTMLInputElement | null };
  const result = syncPhoneField(field);
  return { ...result, national: field.national };
}

export function focusInternationalPhoneField(scope: ParentNode, canonicalName: string) {
  resolvePhoneField(scope, canonicalName)?.national.focus();
}
