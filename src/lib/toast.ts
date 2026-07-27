let timer: number | undefined;

export function showToast(message: string, tone: "success" | "error" = "success") {
  let region = document.querySelector<HTMLElement>("[data-app-toast]");
  if (!region) {
    region = document.createElement("div");
    region.dataset.appToast = "";
    region.className = "app-toast";
    region.setAttribute("role", tone === "error" ? "alert" : "status");
    region.setAttribute("aria-live", tone === "error" ? "assertive" : "polite");
    document.body.append(region);
  }
  region.dataset.tone = tone;
  region.textContent = message;
  region.hidden = false;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => { if (region) region.hidden = true; }, 3200);
}
