import type {
  PublicSellerContact,
  SellerContactProfile,
  SellerContactSubmission,
} from "./types";
import { normalizeStrictInternationalPhone } from "./internationalPhone.ts";

export type ContactProfileInput = {
  first_name?: unknown;
  last_name?: unknown;
  display_name?: unknown;
  contact_phone?: unknown;
  contact_email?: unknown;
  show_phone?: unknown;
  show_email?: unknown;
  preferred_contact_method?: unknown;
};

export type NormalizedContactProfile = {
  first_name: string;
  last_name: string;
  display_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  show_phone: boolean;
  show_email: boolean;
  preferred_contact_method: "phone" | "email" | null;
};

export type ContactProfileIssue = {
  field: keyof NormalizedContactProfile | "";
  code: string;
  message: string;
};

export type ContactProfileNormalizationResult = {
  ok: boolean;
  value?: NormalizedContactProfile;
  issues: ContactProfileIssue[];
};

export type ContactProfileApiErrorOptions = {
  status: number;
  payload: unknown;
};

export type SellerContactValidation = {
  valid: boolean;
  message: string;
  field: keyof SellerContactSubmission | "";
  value: SellerContactSubmission;
};

const CONTROL_OR_MARKUP_PATTERN = /[\u0000-\u001f\u007f<>]/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_ERROR_MESSAGES: Record<string, { field: ContactProfileIssue["field"]; message: string }> = {
  PHONE_INVALID: { field: "contact_phone", message: "Введите корректный телефон." },
  INVALID_PHONE: { field: "contact_phone", message: "Введите корректный телефон." },
  PHONE_REQUIRED: { field: "contact_phone", message: "Введите телефон или отключите его показ." },
  EMAIL_INVALID: { field: "contact_email", message: "Введите корректный email." },
  INVALID_EMAIL: { field: "contact_email", message: "Введите корректный email." },
  EMAIL_REQUIRED: { field: "contact_email", message: "Введите email или отключите его показ." },
  DISPLAY_NAME_REQUIRED: { field: "display_name", message: "Укажите публичное имя продавца." },
  PREFERRED_CONTACT_UNAVAILABLE: { field: "preferred_contact_method", message: "Выбранный способ связи недоступен." },
  PREFERRED_PHONE_NOT_PUBLIC: { field: "preferred_contact_method", message: "Включите показ телефона или выберите другой способ связи." },
  PREFERRED_EMAIL_NOT_PUBLIC: { field: "preferred_contact_method", message: "Включите показ email или выберите другой способ связи." },
  INVALID_FIRST_NAME: { field: "first_name", message: "Проверьте имя." },
  INVALID_LAST_NAME: { field: "last_name", message: "Проверьте фамилию." },
};

export function normalizeContactPhone(value: unknown, defaultCountryCode = "49") {
  return normalizeStrictInternationalPhone(value, defaultCountryCode);
}

export function normalizeContactEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || email.length > 254 || /[\r\n\u0000-\u001f\u007f<>]/.test(email)) return "";
  return EMAIL_PATTERN.test(email) ? email : "";
}

function normalizeName(value: unknown, maxLength: number) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";
  if (normalized.length > maxLength || CONTROL_OR_MARKUP_PATTERN.test(normalized)) return null;
  return normalized;
}

export function normalizeContactProfile(
  input: ContactProfileInput,
  options: { requirePublicContact?: boolean } = {},
): ContactProfileNormalizationResult {
  const issues: ContactProfileIssue[] = [];
  const firstName = normalizeName(input.first_name, 80);
  const lastName = normalizeName(input.last_name, 80);
  const displayName = normalizeName(input.display_name, 120);
  const rawPhone = String(input.contact_phone ?? "").trim();
  const rawEmail = String(input.contact_email ?? "").trim();
  const contactPhone = rawPhone ? normalizeContactPhone(rawPhone) : null;
  const contactEmail = rawEmail ? normalizeContactEmail(rawEmail) : null;
  const showPhone = input.show_phone === true;
  const showEmail = input.show_email === true;
  const preferred = input.preferred_contact_method === "phone" || input.preferred_contact_method === "email"
    ? input.preferred_contact_method
    : null;

  if (firstName === null) issues.push({ field: "first_name", code: "INVALID_FIRST_NAME", message: "Проверьте имя." });
  if (lastName === null) issues.push({ field: "last_name", code: "INVALID_LAST_NAME", message: "Проверьте фамилию." });
  if (displayName === null) issues.push({ field: "display_name", code: "DISPLAY_NAME_INVALID", message: "Проверьте публичное имя." });
  if (rawPhone && !contactPhone) issues.push({ field: "contact_phone", code: "PHONE_INVALID", message: "Проверьте страну и количество цифр в номере телефона." });
  if (rawEmail && !contactEmail) issues.push({ field: "contact_email", code: "EMAIL_INVALID", message: "Проверьте правильность email." });
  if (showPhone && !contactPhone) issues.push({ field: "contact_phone", code: "PHONE_REQUIRED", message: "Введите корректный номер телефона." });
  if (showEmail && !contactEmail) issues.push({ field: "contact_email", code: "EMAIL_REQUIRED", message: "Введите корректный email." });
  if (preferred === "phone" && (!showPhone || !contactPhone)) issues.push({ field: "preferred_contact_method", code: "PREFERRED_CONTACT_UNAVAILABLE", message: "Для выбранного предпочтительного способа не заполнены данные." });
  if (preferred === "email" && (!showEmail || !contactEmail)) issues.push({ field: "preferred_contact_method", code: "PREFERRED_CONTACT_UNAVAILABLE", message: "Для выбранного предпочтительного способа не заполнены данные." });
  if (options.requirePublicContact && !((showPhone && contactPhone) || (showEmail && contactEmail))) {
    issues.push({ field: "", code: "PUBLIC_CONTACT_REQUIRED", message: "Добавьте телефон или email и разрешите его показ покупателям." });
  }

  const value: NormalizedContactProfile = {
    first_name: firstName || "",
    last_name: lastName || "",
    display_name: displayName || "",
    contact_phone: contactPhone,
    contact_email: contactEmail,
    show_phone: showPhone,
    show_email: showEmail,
    preferred_contact_method: preferred,
  };
  return { ok: issues.length === 0, value: issues.length === 0 ? value : undefined, issues };
}

export function isSameContactProfile(left: ContactProfileInput, right: ContactProfileInput) {
  const a = normalizeContactProfile(left).value;
  const b = normalizeContactProfile(right).value;
  return Boolean(a && b && JSON.stringify(a) === JSON.stringify(b));
}

function readApiErrorValue(payload: unknown, key: "code" | "field" | "message") {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  const nested = record.payload && typeof record.payload === "object" ? record.payload as Record<string, unknown> : null;
  return String(record[key] ?? nested?.[key] ?? "").trim();
}

export class ContactProfileApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field: string;
  readonly retryable: boolean;
  readonly payload: unknown;

  constructor({ status, payload }: ContactProfileApiErrorOptions) {
    const rawCode = readApiErrorValue(payload, "code");
    const rawMessage = readApiErrorValue(payload, "message") || (typeof payload === "string" ? payload : "");
    const knownCode = CONTACT_ERROR_MESSAGES[rawCode]
      ? rawCode
      : Object.keys(CONTACT_ERROR_MESSAGES).find((code) => rawMessage.includes(code)) || rawCode || "VALIDATION_ERROR";
    const known = CONTACT_ERROR_MESSAGES[knownCode];
    const message = known?.message
      || (status === 401 ? "Сессия завершена. Войдите снова."
        : status === 403 ? "Недостаточно прав для изменения контактов."
          : status === 409 ? "Контакты были изменены в другой вкладке. Обновите страницу."
            : status === 429 ? "Слишком много попыток. Повторите позже."
              : status >= 500 ? "Сервис контактов временно недоступен. Повторите попытку."
                : rawMessage || "Не удалось сохранить контакты. Проверьте данные.");
    super(message);
    this.name = "ContactProfileApiError";
    this.status = status;
    this.code = knownCode;
    this.field = readApiErrorValue(payload, "field") || known?.field || "";
    this.retryable = status === 408 || status === 425 || status === 429 || status >= 500;
    this.payload = payload;
  }
}

export async function readContactProfileApiResponse(response: Response): Promise<SellerContactProfile> {
  const contentType = response.headers.get("content-type") || "";
  let payload: unknown;
  if (contentType.includes("application/json")) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  } else {
    payload = await response.text();
  }
  if (!response.ok) throw new ContactProfileApiError({ status: response.status, payload });
  if (!payload || typeof payload !== "object") {
    throw new ContactProfileApiError({ status: response.status, payload: "Сервис контактов вернул некорректный ответ." });
  }
  return payload as SellerContactProfile;
}

export function normalizeSellerContactProfile(input: ContactProfileInput): SellerContactSubmission {
  const normalized = normalizeContactProfile(input).value;

  return {
    display_name: normalized?.display_name || String(input.display_name ?? "").trim(),
    contact_phone: normalized?.contact_phone || "",
    contact_email: normalized?.contact_email || "",
    show_phone: normalized?.show_phone ?? input.show_phone === true,
    show_email: normalized?.show_email ?? input.show_email === true,
    preferred_contact_method: normalized?.preferred_contact_method || null,
  };
}

export function validateSellerContactProfile(
  input: ContactProfileInput,
  options: { requirePublicContact?: boolean } = {},
): SellerContactValidation {
  const result = normalizeContactProfile(input, options);
  const value = normalizeSellerContactProfile(input);
  const issue = result.issues[0];
  return issue
    ? { valid: false, message: issue.message, field: issue.field as keyof SellerContactSubmission | "", value }
    : { valid: true, message: "", field: "", value };
}

export function validateContactProfile(input: ContactProfileInput) {
  return validateSellerContactProfile(input).message;
}

export function hasPublicSellerContact(input: ContactProfileInput) {
  const normalized = normalizeSellerContactProfile(input);
  return Boolean(
    (normalized.show_phone && normalized.contact_phone)
    || (normalized.show_email && normalized.contact_email),
  );
}

export function getSellerDisplayName(
  profile: ContactProfileInput,
  legacySellerName = "",
) {
  const displayName = String(profile.display_name ?? "").trim();
  const fullName = [profile.first_name, profile.last_name]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return displayName || fullName || legacySellerName.trim() || "Продавец автомобиля";
}

export function buildPublicSellerContact(input: ContactProfileInput): PublicSellerContact | null {
  const normalized = normalizeSellerContactProfile(input);
  const contact: PublicSellerContact = {};

  if (normalized.show_phone && normalized.contact_phone) {
    contact.phone = normalized.contact_phone;
    contact.phone_href = `tel:${normalized.contact_phone}`;
  }
  if (normalized.show_email && normalized.contact_email) {
    contact.email = normalized.contact_email;
    contact.email_href = `mailto:${normalized.contact_email}`;
  }
  if (!contact.phone && !contact.email) return null;

  contact.preferred_method = normalized.preferred_contact_method;
  return contact;
}
