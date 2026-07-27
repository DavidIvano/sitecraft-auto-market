export type ActionButtonVariant = "primary" | "success" | "warning" | "danger" | "neutral" | "ai";
type ActionKind = "source" | "save" | "viewed" | "hide" | "restore" | "compare" | "detail" | "ai";

type ActionOptions = {
  label: string;
  icon: string;
  variant: ActionButtonVariant;
  kind: ActionKind;
  action?: string;
  href?: string;
  pressed?: boolean;
  disabled?: boolean;
  external?: boolean;
  compareId?: number | string;
};

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character] || character));

export function renderDealFinderAction(options: ActionOptions) {
  const body = `<i data-lucide="${escapeHtml(options.icon)}" aria-hidden="true"></i><span>${escapeHtml(options.label)}</span>`;
  const className = `deal-action is-${options.variant} is-${options.kind}`;
  if (options.href) return `<a class="${className}" href="${escapeHtml(options.href)}"${options.external ? ' target="_blank" rel="noopener noreferrer nofollow"' : ""}>${body}</a>`;
  return `<button class="${className}" type="button"${options.action ? ` data-deal-action="${escapeHtml(options.action)}"` : ""}${options.compareId !== undefined ? ` data-deal-compare="${escapeHtml(options.compareId)}"` : ""}${options.pressed === undefined ? "" : ` aria-pressed="${options.pressed}"`}${options.disabled ? " disabled" : ""}>${body}</button>`;
}
