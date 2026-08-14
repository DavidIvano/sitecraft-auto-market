export function getFriendlyErrorMessage(error: unknown, fallback = "Что-то пошло не так. Попробуйте ещё раз.") {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error ?? "");
  const value = raw.toLowerCase();

  if (!raw || raw === "{}") {
    return fallback;
  }

  if (value.includes("email_already_registered") || value.includes("account_link_required")) {
    return "Такая запись уже существует. Проверьте данные или войдите в существующий аккаунт.";
  }

  if (value.includes("this draft is no longer editable")) {
    return "Предыдущий черновик уже закрыт. Обновите страницу и повторите отправку — будет создан новый черновик.";
  }

  if (value.includes("duplicate") || value.includes("already exists") || value.includes("unique constraint") || value.includes("idempotency")) {
    return "Повторный запрос уже был обработан. Данные объявления сохранены — повторите действие.";
  }

  if (value.includes("invalid login") || value.includes("invalid credentials") || value.includes("wrong password") || value.includes("incorrect password")) {
    return "Неверный email или пароль.";
  }

  if (value.includes("unauthorized") || value.includes("accessdenied") || value.includes("401") || value.includes("different object type")) {
    return "Сессия входа устарела. Войдите в кабинет ещё раз.";
  }

  if (value.includes("forbidden") || value.includes("access denied") || value.includes("403")) {
    return "Вход выполнен, но для этого действия недостаточно прав.";
  }

  if (value.includes("module_disabled") || value.includes("feature_disabled") || value.includes("module disabled")) {
    return "Функция временно выключена в настройках сайта.";
  }

  if (value.includes("auth_state_mismatch")) {
    return "Вход сохранён, но сервис временно отклонил запрос. Попробуйте ещё раз.";
  }

  if (value.includes("missing param") || value.includes("input_error") || value.includes("required")) {
    return "Заполните обязательные поля и попробуйте снова.";
  }

  if (value.includes("password")) {
    return "Пароль должен быть не короче 8 символов и содержать буквы и цифры.";
  }

  if (value.includes("email")) {
    return "Проверьте правильность email.";
  }

  if (value.includes("not found") || value.includes("404")) {
    return "Нужная запись не найдена.";
  }

  if (value.includes("upload") || value.includes("r2") || value.includes("bucket") || value.includes("route missing")) {
    return "Не удалось загрузить фото. Попробуйте ещё раз чуть позже.";
  }

  if (value.includes("ai-кредит") || value.includes("ai credit") || value.includes("credit") || value.includes("paymentrequired")) {
    return "Недостаточно AI-кредитов. Пополните баланс и попробуйте снова.";
  }

  if (value.includes("limit") || value.includes("rate") || value.includes("too many") || value.includes("429")) {
    return "Лимит генераций временно исчерпан. Попробуйте позже.";
  }

  if (value.includes("openai") || value.includes("ai") || value.includes("model")) {
    return "Не удалось создать AI-черновик. Попробуйте другие фото или повторите позже.";
  }

  if (value.includes("failed to fetch") || value.includes("network") || value.includes("cors") || value.includes("endpoint") || value.includes("xano") || value.includes("api")) {
    return "Сервер временно недоступен. Попробуйте ещё раз чуть позже.";
  }

  if (value.includes("image") || value.includes("photo")) {
    return "Не удалось обработать фото. Попробуйте выбрать другое изображение.";
  }

  if (value.includes("google")) {
    return "Не удалось войти через Google. Попробуйте ещё раз.";
  }

  return /^[\x00-\x7F]*$/.test(raw) ? fallback : raw;
}
