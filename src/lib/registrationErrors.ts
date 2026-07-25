export type RegistrationErrorCode = "EMAIL_ALREADY_REGISTERED" | "ACCOUNT_LINK_REQUIRED";

const REGISTRATION_ERROR_MESSAGES: Record<RegistrationErrorCode, string> = {
  EMAIL_ALREADY_REGISTERED: "Этот email уже зарегистрирован. Войдите в существующий аккаунт.",
  ACCOUNT_LINK_REQUIRED:
    "Этот email уже связан с Google. Войдите через Google. Добавление пароля будет доступно через настройки аккаунта.",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function getRegistrationErrorCode(payload: unknown): RegistrationErrorCode | null {
  const record = asRecord(payload);
  const nested = asRecord(record?.payload);
  const code = record?.code ?? nested?.code;

  return code === "EMAIL_ALREADY_REGISTERED" || code === "ACCOUNT_LINK_REQUIRED" ? code : null;
}

export function getRegistrationErrorMessage(payload: unknown) {
  const code = getRegistrationErrorCode(payload);
  return code ? REGISTRATION_ERROR_MESSAGES[code] : null;
}
