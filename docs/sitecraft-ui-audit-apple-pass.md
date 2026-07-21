# SiteCraft Auto Market UI audit

Date: 2026-07-13  
Evidence: published Cloudflare site at `https://sitecraft-auto-market.pages.dev/`, inspected at desktop and mobile widths before implementation.  
Scope: visual hierarchy, spacing, typography, accessibility risks, responsive behavior, repeated CSS, shared components, and appropriate use of glass. Business logic and backend contracts are out of scope.

## System findings

1. The product already has a recognizable dark macOS-inspired shell, but successive CSS passes redefine the same surfaces, radii, spacing, and typography. The cascade rather than the token layer determines the final design.
2. Glass is used on both control surfaces and long-form content. This weakens hierarchy and makes cards, forms, and detail panels feel equally elevated.
3. Desktop navigation correctly relies on the sidebar, but active state semantics were not exposed with `aria-current`.
4. Buttons and controls vary between 38, 42, and 44 pixels. A shared 44-pixel ergonomic baseline is needed.
5. The catalogue and home cards share most structure, but repeated late CSS blocks make parity fragile.
6. Page heroes, result panels, forms, and cards use the same shadow and radius, reducing visual distinction between page structure and repeated content.
7. The dark theme is visually coherent, but blue glows and gradients are overused. Solid accent controls and quieter shadows improve clarity.
8. Full-page catalogue capture showed several lazy images as empty surfaces. This may be capture timing rather than a user-facing failure, so it requires viewport-level verification after deployment.
9. The mobile full-page detail capture places the fixed bottom navigation inside the visual flow. A normal viewport check is required to confirm that the fixed layer does not cover content.
10. Screenshot evidence cannot prove keyboard order, screen-reader output, form validation semantics, or full WCAG compliance.

## Page audit

| Surface | Purpose and primary action | Main issues | Shared component direction | Glass use |
| --- | --- | --- | --- | --- |
| Home | Discover inventory or start an AI listing; primary actions are photo listing and catalogue search. | Hero and search compete for attention; feature cards and catalogue cards share the same elevation; mobile becomes long before inventory appears. | Shared hero spacing, search controls, `CarCard`, section heading, empty/loading state. | Header, sidebar, search control layer only. |
| `/cars/` | Find and compare vehicles; primary action is filtering and opening a listing. | AI search and filters create a tall control stack; list/grid cards depend on late overrides; result toolbar is visually heavy. | Sticky filter toolbar, sort control, `CarCard`, catalogue empty state. | Filter toolbar and view/sort controls; results stay solid. |
| `/cars/[slug]/` | Inspect a vehicle and contact the seller. | Gallery and contact panel are strong, but every specification cell is separately framed; related cards vary in image availability; mobile contact/navigation layers need overlap checks. | Gallery, two-column specs, contact panel, compact related card. | Gallery controls and sticky contact actions only. |
| `/sell/` | Explain and start the selling flow. | Timeline and upload surface are both panel-heavy; explanatory copy has similar weight to the CTA. | Step/timeline, upload drop zone, primary CTA. | Compact progress/control layer; form content solid. |
| `/login/` | Authenticate. | Benefit panel and auth panel compete; repeated nested form surface; hierarchy can be simplified. | Auth shell, social button, divider, labelled fields, message state. | Auth window header/control edge only. |
| `/register/` | Create an account. | Same concerns as login plus denser password guidance and more vertical pressure on mobile. | Shared auth shell and field states. | Same as login. |
| `/dashboard/` | Orient the signed-in seller. | Four equal stat cards lack a clear next action; loading/auth text needs consistent status treatment. | Dashboard hero, stat card, task CTA, skeleton/message state. | Compact dashboard toolbar only. |
| `/dashboard/new/` | Create a listing with AI or manually. | The flow is structurally progressive, but many nested panels make the screen feel heavier than the task. | Mode switch, step indicator, photo area, review fields, sticky quality panel. | Mode switch and sticky action/score controls only. |
| `/dashboard/listings/` | Manage real listings. | Loading state is improved, but row actions and status need a clearer hierarchy on narrow screens. | Listing row/card, status badge, action menu, skeleton/empty state. | Toolbar only; rows stay solid. |
| `/dashboard/billing/` | Buy services and review purchases. | Balance, products, and history all use the same panel weight; price/benefit hierarchy needs stronger grouping. | Balance summary, product card, purchase history row. | Balance/action toolbar only. |
| `/admin/moderation/` | Review listings and take explicit admin actions. | Published unauthenticated audit redirected to login, so table density and dangerous-action separation could not be visually verified in this run. Code shows appropriate status sidebar and separated dangerous actions. | Status navigation, moderation table row, image review, safe/danger groups, loading/access states. | Status/filter toolbar only; table and review content solid. |

## Accessibility and responsive priorities

- Keep interactive targets at least 44 pixels and preserve visible focus.
- Expose active navigation with `aria-current` and keep admin links hidden until authorization is confirmed.
- Preserve labels for all fields and do not use color alone for status.
- Maintain equal mobile safe-area insets for bottom navigation and cookie notice.
- Use opaque fallbacks when backdrop blur is unavailable.
- Disable nonessential transforms and transitions when reduced motion is requested.
- Verify 1440, 1024, 768, and 390 widths after the implementation is published.
