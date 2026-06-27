# SiteCraft Auto Market

Базовая Astro-архитектура для будущей доски объявлений авто / интернет-магазина с Xano REST API, GitHub и Cloudflare Pages.

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
PUBLIC_SITE_URL
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
