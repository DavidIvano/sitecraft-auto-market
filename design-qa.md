# Promoted catalog cards and fullscreen lightbox design QA

## Scope

- Production catalog: `https://sitecraft-auto-market.pages.dev/cars/?lang=ru`
- Production vehicle: `https://sitecraft-auto-market.pages.dev/cars/mercedes-benz-a-class-2008-56/?lang=ru`
- Promotion-card reference: `/Users/david/.codex/generated_images/01a00b68-01c7-7483-95a7-df056fa5ebce/exec-90fedf77-4e51-4001-a140-bd10f909127a.png` (1487 × 1058)
- Lightbox source state: existing production viewer before this change
- Browser: Codex in-app browser
- Theme and locale: dark, Russian

## Visual evidence

- Lightbox before, 390 × 844 at DPR 1: `work/design-audit-cards-lightbox/03-lightbox-before-mobile.jpg`
- Lightbox after, 390 × 844 at DPR 1: `work/design-audit-cards-lightbox/08-lightbox-after-390x844.jpg`
- Lightbox tablet after, 820 × 1000 at DPR 1: `work/design-audit-cards-lightbox/10-lightbox-after-820x1000.jpg`
- Catalog cards after, 390 × 844 at DPR 1: `work/design-audit-cards-lightbox/09-catalog-after-390x844.jpg`
- Catalog cards after, 820 × 1000 at DPR 1: `work/design-audit-cards-lightbox/11-catalog-after-820x1000.jpg`
- Catalog list after, 1280 × 900 at DPR 1: `work/design-audit-cards-lightbox/13-catalog-final-1280x900.jpg`
- Combined lightbox before/after input: `work/design-audit-cards-lightbox/14-lightbox-before-after-comparison.jpg`
- Combined promotion target/catalog implementation input: `work/design-audit-cards-lightbox/15-promotion-target-catalog-comparison.jpg`

The combined inputs were inspected with the source and implementation visible together. The lightbox comparison uses the same 390 × 844 viewport and first-image state. The promotion comparison uses the selected blue/indigo/gold plan cards as the visual-language target and the live catalog cards as the responsive implementation.

## Fidelity review

- Layout and spacing: the photo now owns the full viewport; count, close, navigation, and filmstrip float over the media rather than consuming grid rows. The catalog cards retain their real content and familiar structure.
- Typography: compact uppercase promotion labels preserve the promotion-page hierarchy without increasing card copy density. Existing catalog title, price, specification, and status hierarchy remains unchanged.
- Colors and surfaces: Boost maps to blue, Featured to indigo, and Premium to gold. Borders, inset highlights, gradients, icon wells, and focus rings reuse the selected promotion-page palette.
- Imagery: real listing photos are preserved with `object-fit: contain` in the lightbox and `object-fit: cover` in catalog cards. No placeholder, CSS-drawn, or substituted imagery was introduced.
- Icons: ArrowUp, Star, Crown, Gem, Chevron, and X come from the shared Lucide registry. No custom SVG or CSS icon art was added.
- Accessibility: the close and navigation controls remain at least 44 × 44 px, safe-area insets are respected, focus-visible rings are present, dialog focus returns to the gallery trigger, and reduced-motion disables smooth thumbnail scrolling.

## Responsive and interaction checks

- Mobile 390 × 844: no horizontal overflow; the complete photo remains visible; close/count stay in the safe top layer; navigation does not change image height; the thumbnail rail scrolls horizontally.
- Tablet 820 × 1000: portrait images use the available height effectively; glass controls stay legible without obscuring the subject; Premium and Featured cards preserve their distinct tiers.
- Desktop 1280 × 900: list view is now a 240 px horizontal row instead of the previous 778 px vertical card. Final geometry was 888 × 240 with a 336.68 px media column and no document overflow.
- Next button changed `1 / 7` to `2 / 7`.
- Thumbnail 4 changed the state to `4 / 7`.
- ArrowLeft changed `4 / 7` to `3 / 7`.
- Escape closed the native dialog and restored focus to `Открыть фото на весь экран`.
- Production browser console check returned no errors or warnings for the verified catalog state.
- Current production inventory exposed Premium and Featured examples. Boost had no active live listing, so its blue ArrowUp markup and tier class were verified through the deterministic renderer test.

## Iterations made from QA

1. Removed visible zoom controls and moved the count/close controls into a compact overlay.
2. Converted the footer from a layout row into an overlaid, scrollable thumbnail filmstrip.
3. Unified all promotion decorations under one reusable banner with tier-specific icon and palette.
4. Replaced the Featured badge-check icon with the promotion-page Star icon.
5. Found and fixed the old desktop list-view regression that produced 778 px tall cards; final height is 240 px.
6. Re-ran production screenshots and interaction checks after both Cloudflare deploys.

## Verification

- Astro check: 0 errors; existing informational hints only.
- Full test suite: 483/483 passed.
- Focused lightbox and public-card tests: 12/12 passed.
- Production build and asset verification: passed.
- Cloudflare deploy and production smoke test: passed for commit `9962e8b` (run `31973212650`).
- Outstanding visual findings: no P0, P1, or P2 issues.

final result: passed
