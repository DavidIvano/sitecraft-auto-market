export const installPasswordToggles = (root: ParentNode = document) => {
  root.querySelectorAll<HTMLButtonElement>("[data-password-toggle]").forEach((toggle) => {
    if (toggle.dataset.passwordToggleInstalled === "true") return;
    toggle.dataset.passwordToggleInstalled = "true";
    toggle.setAttribute("aria-pressed", "false");

    toggle.addEventListener("click", () => {
      const input = toggle.closest(".password-field")?.querySelector<HTMLInputElement>("input");
      if (!input) return;

      const willShow = input.type === "password";
      input.type = willShow ? "text" : "password";
      toggle.textContent = willShow ? "Скрыть" : "Показать";
      toggle.setAttribute("aria-label", willShow ? "Скрыть пароль" : "Показать пароль");
      toggle.setAttribute("aria-pressed", String(willShow));
    });
  });
};

export const setAuthButtonBusy = (button: HTMLButtonElement | null, busy: boolean, busyLabel: string) => {
  if (!button) return;

  if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent?.trim() || "Продолжить";
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  button.textContent = busy ? busyLabel : button.dataset.defaultLabel;
};
