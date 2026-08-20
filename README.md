# SiteCraft Auto Market

Базовая Astro-архитектура для будущей доски объявлений авто / интернет-магазина с Xano REST API, GitHub и Cloudflare Pages.

Актуальный русскоязычный отчёт о состоянии проекта, выполненных этапах и следующем плане разработки:

```txt
PROJECT_STATUS_AND_ROADMAP_RU.md
```

## Local development

```sh
npm install
cp .env.example .env
npm run dev
```

## Build

```sh
npm run build
```

## Cloudflare Pages deploy

This repository includes a GitHub Actions workflow:

```txt
.github/workflows/cloudflare-pages.yml
```

On every push to `main`, GitHub builds the Astro site and deploys `dist` to Cloudflare Pages with Wrangler.

Required GitHub repository secrets:

```txt
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

Recommended GitHub repository variables:

```txt
PUBLIC_XANO_API_URL
PUBLIC_SITE_URL
PUBLIC_SEO_TAXONOMY_API_ENABLED
PUBLIC_SEO_TAXONOMY_COMPATIBILITY_FALLBACK_ENABLED
PUBLIC_SEO_CATALOG_API_ENABLED
PUBLIC_SEO_CATALOG_COMPATIBILITY_FALLBACK_ENABLED
PUBLIC_SEO_SITEMAP_SHARDS_ENABLED
PUBLIC_SEO_SITEMAP_COMPATIBILITY_FALLBACK_ENABLED
```

Build command:

```sh
npm run build
```

Build output directory:

```txt
dist
```

Environment variables:

```txt
PUBLIC_XANO_API_URL
PUBLIC_XANO_AUTH_API_URL
PUBLIC_SITE_URL
PUBLIC_XANO_GOOGLE_AUTH_START_PATH
PUBLIC_XANO_GOOGLE_AUTH_CONTINUE_PATH
PUBLIC_SEO_TAXONOMY_API_ENABLED
PUBLIC_SEO_TAXONOMY_COMPATIBILITY_FALLBACK_ENABLED
PUBLIC_SEO_CATALOG_API_ENABLED
PUBLIC_SEO_CATALOG_COMPATIBILITY_FALLBACK_ENABLED
PUBLIC_SEO_SITEMAP_SHARDS_ENABLED
PUBLIC_SEO_SITEMAP_COMPATIBILITY_FALLBACK_ENABLED
```

All programmatic SEO rollout flags default to `false`. Enable each API flag
only after its additive bounded Xano contract in
`docs/xano/programmatic-seo-stage-2/` or
`docs/xano/programmatic-seo-stage-3/` has passed canary verification. The
compatibility fallbacks are temporary rollout aids, not a large-catalog mode.

Google auth setup is documented in:

```txt
docs/google-auth-setup.md
```

## Future features

* Xano Auth
* User dashboard
* Image upload
* Manual moderation
* Public approved listings
* Paid featured listings
* Stripe or PayPal payment
* SEO pages by brand, model and city
