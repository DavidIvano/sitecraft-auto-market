---
name: sitecraft-macos-web-design
description: Audit, design and implement macOS-inspired responsive web interfaces for SiteCraft Auto Market using Astro, TypeScript, CSS, Apple HIG and Liquid Glass principles. Use for navigation, vehicle cards, catalogue filters, vehicle detail pages, sell forms, dashboard, modals, responsive layouts and visual consistency.
---

# SiteCraft macOS Web Design

Use Apple guidance as a source of hierarchy, ergonomics, accessibility, materials, navigation, and motion principles. Implement everything with Astro, TypeScript, semantic HTML, and CSS.

## Product Character

- Keep the interface calm, premium, clean, automotive, understandable, responsive, and accessible.
- Make buying, comparing, publishing, and moderating vehicles feel efficient.
- Treat macOS as a quality and interaction reference, not a literal visual template.
- Preserve the existing SiteCraft identity, content, routes, and working behavior.

## Prohibited Patterns

- Do not use Apple logos, Finder branding, proprietary Apple assets, or bundled San Francisco font files.
- Do not add Swift, SwiftUI, UIKit, Xcode files, Apple SDKs, or native dependencies.
- Do not recreate system windows, traffic-light controls, or a fake macOS menu bar.
- Do not add decorative window controls without working behavior.
- Do not make every surface transparent or apply blur to every card.
- Do not place low-contrast text over vehicle photography.
- Do not add heavy decorative motion.
- Do not replace working Astro interfaces with static mockups.

## Liquid Glass Hierarchy

1. Keep content on the base canvas.
2. Reserve glass for navigation and control layers above content.
3. Let glass frame content without obscuring it.
4. Use glass selectively for the site header, sidebar, filter toolbar, floating controls, modal header, and mobile action bar.
5. Keep vehicle cards, long text, specifications, tables, and large forms opaque enough for sustained reading.
6. Verify text and control contrast over every material and photo.
7. Respect `prefers-reduced-motion`.
8. Provide an opaque fallback when `backdrop-filter` is unavailable.

## Typography

Use this safe system stack without downloading Apple font files:

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
```

- Use large display type only for the real home hero.
- Keep page titles, panel titles, labels, metadata, and helper text on a consistent scale.
- Keep letter spacing at `0` except where a compact uppercase eyebrow needs slight positive spacing.
- Never scale font size directly with viewport width.

## Design Tokens

Maintain centralized custom properties for:

- system font;
- light and dark canvas colors;
- solid and translucent surfaces;
- primary, secondary, and tertiary text;
- subtle and default borders;
- accent, success, warning, and danger states;
- control, card, panel, window, and pill radii;
- 4/8/12/16/20/24/32/40/48 spacing;
- controlled card and floating shadows;
- fast and normal motion durations.

Adapt token values to the existing product. Do not paste a palette blindly or create page-specific token sets.

## Component Rules

- Reuse `Header`, `Footer`, `CarCard`, status badges, mac components, and shared form classes before adding a component.
- Keep desktop sidebar navigation primary; keep the desktop header compact and action-focused.
- Show full navigation in the header only when the sidebar becomes the mobile/tablet bottom navigation.
- Never show guest and signed-in actions simultaneously; keep moderation admin-only.
- Make every primary interactive target at least `44px` in each practical dimension.
- Use one primary button per decision area. Use secondary and destructive styles semantically.
- Keep input labels visible. Do not rely on placeholders as labels.
- Use solid vehicle cards with stable image aspect ratios and equal-height content areas.
- Keep price prominent and vehicle metadata compact and scannable.
- Use a gallery-first detail layout with a sticky contact/info panel only where the viewport supports it.
- Keep long forms grouped into semantic sections with progressive disclosure.
- Give empty, loading, error, success, and disabled states consistent structure and language.
- Treat dialogs as focused tasks; use glass only on their control/header layer.

## Responsive Rules

- Verify at 1440, 1024, 768, and 390 CSS pixels.
- Use grid/flex constraints, `minmax()`, aspect ratios, and safe-area insets to prevent layout shifts.
- Keep equal side insets on fixed mobile navigation and cookie notices.
- Avoid horizontal overflow and truncated action labels.
- Preserve a visible primary action without covering page content.
- Use two-column specification grids on mobile only when values remain readable.

## Accessibility Rules

- Use landmarks, headings in order, explicit labels, and `aria-current` for active navigation.
- Keep visible `:focus-visible` treatment on links, buttons, fields, menu controls, and cards.
- Verify hover, active, disabled, loading, empty, error, and success states.
- Do not communicate status through color alone.
- Honor reduced motion and forced-colors modes.
- Treat screenshot review as visual evidence only; do not claim full accessibility compliance without keyboard and semantic checks.

## Workflow

1. Read `$hig` for factual accessibility and platform conventions.
2. Read `$ios-liquid-glass` for control-layer hierarchy and material behavior.
3. Inspect existing tokens, shared components, nearby pages, and current screenshots.
4. Identify the page purpose, primary action, hierarchy, typography, spacing, accessibility, mobile behavior, repetition, and glass suitability.
5. Fix tokens and shared components before page-specific CSS.
6. Preserve Xano calls, authentication, routes, SEO, Cloudflare storage, local storage, cookies, and payloads.
7. Run existing checks and production build.
8. Inspect rendered desktop, tablet, and mobile pages before claiming visual verification.
