type Env = {
  PUBLIC_XANO_API_URL?: string;
  PUBLIC_SITE_URL?: string;
};

type PagesContext = {
  env: Env;
  params: {
    id?: string;
  };
};

const SITE_NAME = "SiteCraft Auto Market";
const DEFAULT_SITE_URL = "https://automarket.sitecraft.agency";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderDraftPage(draftId: string, env: Env) {
  const siteUrl = env.PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  const apiUrl = env.PUBLIC_XANO_API_URL || "";
  const canonicalUrl = new URL(`/dashboard/drafts/${draftId}`, siteUrl).toString();

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    <link rel="icon" type="image/png" href="/favicon.png">
    <title>AI-черновик #${escapeHtml(draftId)} | ${SITE_NAME}</title>
    <style>
      :root{color-scheme:light dark;--bg:#eef4ff;--card:#fff;--input:#f8fbff;--text:#111827;--muted:#667085;--line:#dbe5f6;--accent:#2563eb;--shadow:0 24px 64px rgba(15,23,42,.1)}
      @media (prefers-color-scheme:dark){:root{--bg:#070b14;--card:#151b28;--input:#202838;--text:#f8fafc;--muted:#b8c1d1;--line:#2a3447;--shadow:none}}
      *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:inherit}.container{width:min(1120px,calc(100% - 32px));margin:auto}
      .site-header,.site-footer{border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--card) 94%,transparent)}.site-footer{border-top:1px solid var(--line);border-bottom:0}.header-inner,.footer-inner{display:flex;align-items:center;justify-content:space-between;gap:22px;padding:16px 0}.brand{display:flex;align-items:center;gap:12px;text-decoration:none;font-weight:900}.brand-logo{width:44px;height:44px;border-radius:10px}.main-nav,.header-actions{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.main-nav a{text-decoration:none;color:var(--muted);font-weight:800}
      .button{display:inline-flex;min-height:44px;align-items:center;justify-content:center;border:0;border-radius:10px;cursor:pointer;font-weight:900;padding:12px 18px;text-decoration:none}.button-dark{background:var(--accent);color:#fff}.button-light{border:1px solid var(--line);background:var(--card);color:var(--text)}.full-width{width:100%}
      .breadcrumbs{border-bottom:1px solid var(--line);color:var(--muted);font-weight:800}.breadcrumbs-inner{display:flex;gap:10px;padding:14px 0}.section{padding:54px 0}.eyebrow{margin:0 0 10px;color:#60a5fa;font-size:.78rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase}h1{margin:0;font-size:clamp(2.2rem,6vw,4.6rem);line-height:.95}.lead{max-width:760px;color:var(--muted);font-size:1.1rem;line-height:1.6}
      .listing-form{margin-top:32px}.listing-workspace{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:22px;align-items:start}.listing-main-column{display:grid;gap:16px}.form-section,.side-panel-card{border:1px solid var(--line);border-radius:10px;background:var(--card);box-shadow:var(--shadow);padding:22px}.form-section-highlight{border-color:color-mix(in srgb,var(--accent) 35%,var(--line))}.section-heading{display:flex;gap:12px;align-items:flex-start;margin-bottom:18px}.section-heading h2{margin:0;font-size:1.2rem}.section-heading p{margin:5px 0 0;color:var(--muted);line-height:1.45}.section-step{display:grid;width:32px;height:32px;flex:0 0 auto;place-items:center;border-radius:8px;background:var(--accent);color:#fff;font-weight:900}
      .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.full-field{grid-column:1 / -1}label{display:grid;gap:8px;color:var(--muted);font-weight:800}input,textarea{width:100%;border:1px solid var(--line);border-radius:10px;background:var(--input);color:var(--text);font:inherit;font-weight:700;padding:12px 14px}textarea{resize:vertical}.listing-side-panel{position:sticky;top:24px}.side-panel-card{display:grid;gap:16px}.side-panel-card h2{margin:0}.publish-checklist{display:grid;gap:10px;margin:0;padding:0;list-style:none;color:var(--muted)}.publish-checklist li{position:relative;padding-left:20px;line-height:1.45}.publish-checklist li:before{position:absolute;top:.6em;left:0;width:8px;height:8px;border-radius:999px;background:var(--accent);content:""}.form-message{color:var(--muted);font-weight:800;line-height:1.45}
      .photo-preview-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.photo-empty-state{grid-column:1 / -1;border:1px solid var(--line);border-radius:10px;background:var(--input);color:var(--muted);padding:18px;text-align:center}.photo-preview-card{position:relative;overflow:hidden;min-height:130px;border:1px solid var(--line);border-radius:10px;background:var(--input)}.photo-preview-card img{display:block;width:100%;height:100%;min-height:130px;object-fit:cover}.photo-preview-actions{position:absolute;right:8px;bottom:8px;left:8px;border-radius:8px;background:rgba(15,23,42,.78);color:#fff;padding:7px 8px;font-size:.78rem;font-weight:900}
      @media (max-width:860px){.header-inner,.footer-inner{align-items:flex-start;flex-direction:column}.listing-workspace{grid-template-columns:1fr}.listing-side-panel{position:static}.form-grid,.photo-preview-grid{grid-template-columns:1fr}}
    </style>
  </head>
  <body>
    <header class="site-header" data-api-url="${escapeHtml(apiUrl)}">
      <div class="container header-inner">
        <a class="brand" href="/" aria-label="${SITE_NAME}">
          <img class="brand-logo" src="/sitecraft-logo.png" alt="" width="44" height="44" decoding="async">
          <span>${SITE_NAME}</span>
        </a>
        <div class="header-menu">
          <nav class="main-nav" aria-label="Основная навигация">
            <a href="/">Главная</a>
            <a href="/cars">Авто</a>
            <a href="/sell">Продать авто</a>
            <a href="/dashboard">Кабинет</a>
          </nav>
          <div class="header-actions">
            <a class="button button-dark header-action" href="/dashboard/new">Добавить объявление</a>
          </div>
        </div>
      </div>
    </header>
    <main>
      <nav class="breadcrumbs" aria-label="Хлебные крошки">
        <div class="container breadcrumbs-inner">
          <a href="/">Главная</a>
          <span class="breadcrumb-separator" aria-hidden="true">/</span>
          <a href="/dashboard">Кабинет</a>
          <span class="breadcrumb-separator" aria-hidden="true">/</span>
          <span aria-current="page">AI-черновик</span>
        </div>
      </nav>
      <section class="section page-hero new-listing-hero">
        <div class="container">
          <p class="eyebrow">AI-черновик</p>
          <h1>Проверьте объявление</h1>
          <p class="lead">AI заполнил поля по фото. Перед отправкой на модерацию проверьте данные и исправьте неточности.</p>
          <form class="listing-form listing-form-enhanced" id="draft-form" data-api-url="${escapeHtml(apiUrl)}" data-draft-id="${escapeHtml(draftId)}">
            <div class="listing-workspace">
              <div class="listing-main-column">
                <fieldset class="form-section form-section-highlight">
                  <div class="section-heading">
                    <span class="section-step">1</span>
                    <div>
                      <h2>Основные данные</h2>
                      <p>Проверьте распознанную марку, модель, год, цену и город.</p>
                    </div>
                  </div>
                  <div class="form-grid">
                    ${renderInput("title", "Название")}
                    ${renderInput("brand", "Марка")}
                    ${renderInput("model", "Модель")}
                    ${renderInput("year", "Год", "number")}
                    ${renderInput("mileage", "Пробег", "number")}
                    ${renderInput("price", "Цена", "number")}
                    ${renderInput("city", "Город")}
                  </div>
                </fieldset>
                <fieldset class="form-section">
                  <div class="section-heading">
                    <span class="section-step">2</span>
                    <div>
                      <h2>Характеристики</h2>
                      <p>Эти поля попадут на публичную страницу после модерации.</p>
                    </div>
                  </div>
                  <div class="form-grid">
                    ${renderInput("fuel_type", "Топливо")}
                    ${renderInput("transmission", "Коробка передач")}
                    ${renderInput("body_type", "Кузов")}
                    ${renderInput("color", "Цвет")}
                    <label class="full-field">
                      <span>Описание</span>
                      <textarea name="description" rows="8"></textarea>
                    </label>
                  </div>
                </fieldset>
                <fieldset class="form-section">
                  <div class="section-heading">
                    <span class="section-step">3</span>
                    <div>
                      <h2>Фото из черновика</h2>
                      <p>Эти изображения будут прикреплены к объявлению при публикации.</p>
                    </div>
                  </div>
                  <div class="photo-preview-grid" id="draft-images">
                    <div class="photo-empty-state">Загружаю изображения...</div>
                  </div>
                </fieldset>
              </div>
              <aside class="listing-side-panel">
                <div class="side-panel-card">
                  <p class="eyebrow">Публикация</p>
                  <h2>Что дальше</h2>
                  <ul class="publish-checklist">
                    <li>Черновик можно сохранить без публикации.</li>
                    <li>Кнопка публикации создаст slug и отправит объявление на модерацию.</li>
                    <li>Публичная страница появится после одобрения.</li>
                  </ul>
                  <button class="button button-light full-width" type="submit" data-action="save">Сохранить черновик</button>
                  <button class="button button-dark full-width" type="submit" data-action="publish">Отправить на модерацию</button>
                  <p class="form-message" id="draft-message">Загружаю AI-черновик...</p>
                </div>
              </aside>
            </div>
          </form>
        </div>
      </section>
    </main>
    <footer class="site-footer">
      <div class="container footer-inner">
        <div>
          <strong>${SITE_NAME}</strong>
          <p>Продукт компании <a href="https://sitecraft.agency">SiteCraft Agency</a>.</p>
          <p>Поддержка: <a href="mailto:support@sitecraft.agency">support@sitecraft.agency</a></p>
        </div>
      </div>
    </footer>
    <script>
      const AUTH_TOKEN_KEY = "sitecraft_auto_market_auth_token";
      const AUTH_USER_KEY = "sitecraft_auto_market_auth_user";
      const AUTH_DEBUG_KEY = "sitecraft_auto_market_auth_debug";
      const getCookie = (name) => {
        const match = document.cookie.split("; ").find((item) => item.startsWith(encodeURIComponent(name) + "="));
        return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
      };
      const getAuthToken = () => {
        const storedToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
        const cookieToken = getCookie(AUTH_TOKEN_KEY);
        if (!storedToken && cookieToken) window.localStorage.setItem(AUTH_TOKEN_KEY, cookieToken);
        return storedToken || cookieToken;
      };
      const clearAuth = () => {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
        window.localStorage.removeItem(AUTH_USER_KEY);
        window.localStorage.removeItem(AUTH_DEBUG_KEY);
        const secure = window.location.protocol === "https:" ? "; Secure" : "";
        document.cookie = encodeURIComponent(AUTH_TOKEN_KEY) + "=; Max-Age=0; Path=/; SameSite=Lax" + secure;
        document.cookie = encodeURIComponent(AUTH_USER_KEY) + "=; Max-Age=0; Path=/; SameSite=Lax" + secure;
      };
      const getFriendlyErrorMessage = (error, fallback = "Что-то пошло не так. Попробуйте ещё раз.") => {
        const raw = error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error ?? "");
        const value = raw.toLowerCase();
        if (value.includes("unauthorized") || value.includes("401")) return "Сессия входа устарела. Войдите в кабинет ещё раз.";
        if (value.includes("limit") || value.includes("rate") || value.includes("too many")) return "Лимит генераций временно исчерпан. Попробуйте позже.";
        if (value.includes("openai") || value.includes("ai") || value.includes("model")) return "Не удалось создать AI-черновик. Попробуйте другие фото или повторите позже.";
        if (value.includes("failed to fetch") || value.includes("network") || value.includes("cors") || value.includes("xano") || value.includes("api")) return "Сервер временно недоступен. Попробуйте ещё раз чуть позже.";
        return /^[\\x00-\\x7F]*$/.test(raw) ? fallback : raw;
      };
      const token = getAuthToken();
      const form = document.querySelector("#draft-form");
      const message = document.querySelector("#draft-message");
      const imageGrid = document.querySelector("#draft-images");
      const fields = ["title", "brand", "model", "year", "mileage", "fuel_type", "transmission", "body_type", "color", "price", "description", "city"];

      const setMessage = (value) => {
        if (message instanceof HTMLElement) message.textContent = value;
      };

      const parseJsonResponse = async (response) => {
        const text = await response.text();
        try {
          return text ? JSON.parse(text) : {};
        } catch {
          return { message: text };
        }
      };

      const requestDraftEndpoint = async (path, options = {}) => {
        if (!(form instanceof HTMLFormElement)) throw new Error("Форма черновика не найдена.");
        const response = await fetch(form.dataset.apiUrl + path, options);

        if (response.status === 404 && path.startsWith("/dashboard/drafts/")) {
          return fetch(form.dataset.apiUrl + path.replace("/dashboard/drafts/", "/drafts/"), options);
        }

        return response;
      };

      const escapeHtml = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

      const getImageUrl = (image) => image?.image_url || image?.url || image?.image?.url || "";

      const renderImages = (images) => {
        if (!(imageGrid instanceof HTMLElement)) return;
        const list = Array.isArray(images) ? images : [];

        if (!list.length) {
          imageGrid.innerHTML = '<div class="photo-empty-state">Фото пока не прикреплены к черновику.</div>';
          return;
        }

        imageGrid.innerHTML = list
          .map((image, index) => {
            const url = getImageUrl(image);
            return url
              ? '<article class="photo-preview-card"><img src="' + escapeHtml(url) + '" alt="Фото черновика ' + (index + 1) + '"><div class="photo-preview-actions"><span>Фото ' + (index + 1) + '</span></div></article>'
              : "";
          })
          .join("");
      };

      const fillForm = (draft) => {
        fields.forEach((field) => {
          const control = form?.querySelector('[name="' + field + '"]');
          if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
            control.value = draft?.[field] ?? "";
          }
        });
        renderImages(draft?.images || draft?.photos || []);
      };

      const collectPayload = () => {
        const payload = {};
        fields.forEach((field) => {
          const control = form?.querySelector('[name="' + field + '"]');
          if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
            payload[field] = control.value.trim();
          }
        });
        return payload;
      };

      async function loadDraft() {
        if (!(form instanceof HTMLFormElement)) return;

        if (!token) {
          window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
          return;
        }

        const response = await requestDraftEndpoint("/dashboard/drafts/" + encodeURIComponent(form.dataset.draftId || ""), {
          headers: { Authorization: "Bearer " + token },
        });

        if (!response.ok) {
          if (response.status === 401) {
            clearAuth();
            window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
            return;
          }
          const errorPayload = await parseJsonResponse(response);
          throw new Error(errorPayload?.message || "Не удалось загрузить AI-черновик.");
        }

        const draft = await parseJsonResponse(response);
        fillForm(draft?.draft || draft);
        setMessage("Черновик загружен. Проверьте поля перед отправкой.");
      }

      form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitter = event.submitter;
        const action = submitter instanceof HTMLElement ? submitter.dataset.action : "save";

        if (!(form instanceof HTMLFormElement) || !token) return;

        try {
          setMessage(action === "publish" ? "Создаю объявление и отправляю на модерацию..." : "Сохраняю черновик...");
          const draftPath = "/dashboard/drafts/" + encodeURIComponent(form.dataset.draftId || "");
          const saveResponse = await requestDraftEndpoint(draftPath, {
            method: "PATCH",
            headers: {
              Authorization: "Bearer " + token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(collectPayload()),
          });

          if (!saveResponse.ok) {
            const errorPayload = await parseJsonResponse(saveResponse);
            throw new Error(errorPayload?.message || "Не удалось сохранить черновик.");
          }

          if (action === "publish") {
            const publishResponse = await requestDraftEndpoint(draftPath + "/publish", {
              method: "POST",
              headers: { Authorization: "Bearer " + token },
            });

            if (!publishResponse.ok) {
              const errorPayload = await parseJsonResponse(publishResponse);
              throw new Error(errorPayload?.message || "Не удалось отправить объявление на модерацию.");
            }
            const published = await parseJsonResponse(publishResponse);
            const slug = published?.slug || published?.car?.slug;
            setMessage("Объявление создано и отправлено на модерацию.");
            if (slug) window.location.href = "/dashboard/listings";
            return;
          }

          setMessage("Черновик сохранён.");
        } catch (error) {
          console.error(error);
          setMessage(getFriendlyErrorMessage(error, "Не удалось сохранить черновик. Попробуйте ещё раз."));
        }
      });

      loadDraft().catch((error) => {
        console.error(error);
        setMessage(getFriendlyErrorMessage(error, "Не удалось загрузить AI-черновик."));
      });
    </script>
  </body>
</html>`;
}

function renderInput(name: string, label: string, type = "text") {
  return `<label>
    <span>${escapeHtml(label)}</span>
    <input type="${escapeHtml(type)}" name="${escapeHtml(name)}">
  </label>`;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const typedContext = context as unknown as PagesContext;
  const draftId = typedContext.params.id;

  if (!draftId) {
    return new Response("Draft not found", { status: 404 });
  }

  return new Response(renderDraftPage(draftId, typedContext.env), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
};
