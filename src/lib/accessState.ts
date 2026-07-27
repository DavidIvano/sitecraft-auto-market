export type AppAccessStateCode =
  | "ready"
  | "sign_in_required"
  | "role_required"
  | "module_disabled"
  | "temporarily_unavailable"
  | "rate_limited"
  | "not_found";

export type AppAccessState = {
  code: AppAccessStateCode;
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  retryable: boolean;
};

const STATES: Record<AppAccessStateCode, AppAccessState> = {
  ready: {
    code: "ready",
    title: "Доступ разрешён",
    message: "",
    retryable: false,
  },
  sign_in_required: {
    code: "sign_in_required",
    title: "Требуется вход",
    message: "Сессия истекла. Войдите снова.",
    actionLabel: "Войти",
    actionHref: "/login",
    retryable: false,
  },
  role_required: {
    code: "role_required",
    title: "Недостаточно прав",
    message: "Вход выполнен, но для этого раздела нужна роль администратора Deal Finder.",
    actionLabel: "Открыть кабинет",
    actionHref: "/dashboard",
    retryable: false,
  },
  module_disabled: {
    code: "module_disabled",
    title: "Модуль временно выключен",
    message: "Вход и права в порядке, но Deal Finder отключён в настройках текущей версии сайта.",
    actionLabel: "Открыть кабинет",
    actionHref: "/dashboard",
    retryable: false,
  },
  temporarily_unavailable: {
    code: "temporarily_unavailable",
    title: "Сервис временно недоступен",
    message: "Не удалось загрузить внутренние данные.",
    actionLabel: "Повторить",
    retryable: true,
  },
  rate_limited: {
    code: "rate_limited",
    title: "Слишком много запросов",
    message: "Вход сохранён. Подождите немного и повторите запрос.",
    actionLabel: "Повторить",
    retryable: true,
  },
  not_found: {
    code: "not_found",
    title: "Предложение не найдено",
    message: "Оно могло быть удалено источником или больше не принадлежит текущему профилю.",
    actionLabel: "Вернуться в ленту",
    actionHref: "/dashboard/deal-finder/",
    retryable: false,
  },
};

export function getAccessState(code: AppAccessStateCode): AppAccessState {
  return { ...STATES[code] };
}

export function resolveDealFinderAccess(input: {
  enabled: boolean;
  hasToken: boolean;
  hasUser: boolean;
  hasRole: boolean;
  authFailed?: boolean;
}): AppAccessState {
  if (!input.enabled) return getAccessState("module_disabled");
  if (!input.hasToken) return getAccessState("sign_in_required");
  if (input.authFailed && !input.hasUser) return getAccessState("temporarily_unavailable");
  if (!input.hasUser) return getAccessState("sign_in_required");
  if (!input.hasRole) return getAccessState("role_required");
  return getAccessState("ready");
}

export function getAccessStateForHttpError(status: number, code = ""): AppAccessState {
  const normalizedCode = code.trim().toLowerCase();

  if (normalizedCode.includes("module_disabled") || normalizedCode.includes("feature_disabled")) {
    return getAccessState("module_disabled");
  }
  if (status === 401) return getAccessState("sign_in_required");
  if (status === 403) return getAccessState("role_required");
  if (status === 404) return getAccessState("not_found");
  if (status === 429) return getAccessState("rate_limited");
  return getAccessState("temporarily_unavailable");
}
