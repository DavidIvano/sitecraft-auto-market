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

  if (value.includes("duplicate") || value.includes("already exists")) {
    return "Такая запись уже существует. Проверьте данные или войдите в существующий аккаунт.";
  }

  if (value.includes("invalid login") || value.includes("invalid credentials") || value.includes("wrong password") || value.includes("incorrect password")) {
    return "Неверный email или пароль.";
  }

  if (value.includes("unauthorized") || value.includes("accessdenied") || value.includes("401") || value.includes("different object type")) {
    return "Сессия входа устарела. Войдите в кабинет ещё раз.";
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
