# SiteCraft Auto Market UX audit

Updated: 2026-07-15

## Goal

The interface should explain location, next action, status, and error recovery to a first-time buyer or seller without exposing implementation language. The audit keeps the existing macOS direction and business contracts.

## Route audit

| Page | Primary user goal | Current problems | Cognitive load | Recommended structure | Priority |
| --- | --- | --- | --- | --- | --- |
| `/` | Start a car search or sell a car | Desktop navigation was duplicated; hero copy competes with controls | High | Compact public header, one search action, secondary content below | P1 |
| `/cars/` | Find and compare public cars | Mixed labels (`Finder`, `Settings`), AI and classic filters compete | High | Clear catalog heading, progressive filter panel, results and sorting | P1 |
| `/cars/[slug]/` | Inspect one car and contact seller | Dense facts and seller action need stable hierarchy | Medium | Gallery, summary/contact, grouped specifications, description, related cars | P1 |
| `/sell/` | Understand how to publish | Too many equal-value explanations can delay the CTA | Medium | Value statement, one create CTA, short process, reassurance | P2 |
| `/pricing/` | Choose a suitable product | Product detail and actions need direct comparison | Medium | Audience grouping, equal cards/actions, popular choice | P2 |
| `/login/` | Sign in | Global navigation can distract from authentication | Low | One centered auth task and recovery route | P2 |
| `/register/` | Create an account | Benefits and form can compete | Medium | Short benefit summary, one account form, login link | P2 |
| `/privacy/` | Read privacy terms | Long text requires scanning support | Low | Document card, section anchors, readable line length | P3 |
| `/impressum/` | Read company details | Formal content needs typographic structure | Low | Document card with clear legal sections | P3 |
| `/support/` | Get help | Support options need clear escalation | Low | Common questions, one contact action, response expectation | P2 |
| `/dashboard/` | Understand account state | Header and workspace navigation can repeat | Medium | Workspace sidebar, compact context header, next action | P1 |
| `/dashboard/new/` | Create a complete listing | Technical AI terminology and many fields appear at once | Very high | Photos first, AI draft, confirmation groups, one save/submit action | P0 |
| `/dashboard/listings/` | Manage own listings | Status and actions need prioritization | Medium | Owner cards/table, status explanation, primary next action | P1 |
| `/dashboard/listings/edit/` | Correct an existing listing | Long form and photo state require grouping | High | Overview, details, photos, publication sections | P1 |
| `/dashboard/billing/` | Buy and review services | Product and history states need separation | Medium | Balance summary, product cards, purchase history | P2 |
| `/admin/moderation/` | Review pending listings | Many actions and AI output can compete | High | Queue/filter, review details, recommendation, separated decisions | P1 |

## Viewport findings

| Width | Finding | Rule |
| --- | --- | --- |
| 1440 | Public sidebar and header duplicated navigation | Public pages use the compact header only |
| 1024 | Header actions can crowd the content | Collapse to one menu while preserving the primary CTA |
| 768 | Tablet needs one navigation model | Use the mobile/tablet navigation, never sidebar plus full header |
| 430 | Bottom navigation and cookie/action layers can compete | Respect safe area and reserve page-bottom space |
| 375 | Long labels and multi-column fields can overflow | Stack field groups, wrap labels, keep 44 px targets |

## Evidence captured before changes

- `docs/ux-audit-screenshots/01-production-car-detail-desktop.png`
- `docs/ux-audit-screenshots/02-production-home-desktop.png`
- `docs/ux-audit-screenshots/03-production-new-listing-desktop.png`
- `docs/ux-audit-screenshots/04-production-new-listing-mobile-375.png`

## Local verification evidence

- `docs/ux-audit-screenshots/05-local-home-desktop.png`
- `docs/ux-audit-screenshots/06-local-cars-desktop.png`
- `docs/ux-audit-screenshots/09-local-home-mobile-375.png`
- `docs/ux-audit-screenshots/13-home-production-local-same-viewport.png`

The local catalog was measured at 1440, 1024, 768, 430, and 375 px. Every measurement reported `scrollWidth <= innerWidth`. At 1440 px the public sidebar is hidden and the main header navigation is visible. From 1024 px down the main navigation is replaced by the fixed bottom navigation. At 375 px its left and right inset are both 12 px and its bottom inset is 12 px plus the device safe area.

The protected `/dashboard/new/` route correctly redirected a guest to `/login`; authenticated visual verification remains a Preview task because no Cloudflare Preview was authorized for this stage.

## Implemented high-priority improvements

- Public desktop pages now use the compact header and hide the persistent sidebar.
- Seller/admin workspaces keep the sidebar and hide duplicate main navigation links in the header.
- Catalog labels now use `Каталог автомобилей` and `Подбор по параметрам` instead of mixed technical wording.
- Paid/AI badges use Russian user-facing labels such as `Создано с AI` and `Выделенное`.
- The new-listing flow uses simpler action copy and shows field-level errors without discarding input.
- The AI review now follows save-before-submit, preserving the user's latest confirmed values.

## Remaining work

- Run authenticated visual and keyboard checks on all workspace pages in a shareable Preview.
- Reduce competing controls in the catalog AI/filter panel after usage data is available.
- Review legal-page line length and table overflow with production content.
- Perform screen-reader and reduced-motion verification before a production UI release.
