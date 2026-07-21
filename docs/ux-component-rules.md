# UX component rules

Updated: 2026-07-15

## Spacing and shape

- Page rhythm uses 16, 24, and 32 px spacing.
- Controls keep a stable minimum height of 44 px.
- Navigation and control surfaces may use translucent glass.
- Forms, vehicle cards, documents, and tables use opaque readable surfaces.
- A page section is not wrapped in a decorative card unless the boundary supports a task.
- Avoid cards nested inside cards.

## Buttons

- One primary button per task area.
- Primary: filled blue, clear verb, stable height.
- Secondary: neutral filled or bordered surface.
- Dangerous: visually separated and requires confirmation.
- Icon-only buttons require an accessible name and tooltip when the icon is unfamiliar.
- Loading buttons keep their dimensions and communicate the current stage.

## Forms

- Group fields by user decision, not database ownership.
- Show required fields only when they are relevant.
- Keep optional/rare fields behind progressive disclosure when the contract permits it.
- Put help text next to the field it explains.
- Field errors appear below the control, set `aria-invalid`, and are referenced by `aria-describedby`.
- Preserve user input after server validation errors.
- Phone OR email means neither control is independently required.

## Cards

- Vehicle cards share a stable image aspect ratio and body layout.
- Images use `object-fit: cover` and never determine card height.
- Title, verification/AI badges, price, three compact facts, and the view action appear in the same order.
- Missing photos use one consistent placeholder.
- Paid and AI badges use short Russian labels.

## Status and feedback

- A badge states the current state; adjacent copy explains the next step when needed.
- Skeletons replace generic loading text for content blocks.
- Empty states explain what is absent and offer one useful next action.
- Errors use plain language and do not reveal service names, environment variables, stack traces, or internal IDs.

## Responsive behavior

- 1440/1024: page content uses constrained containers and no duplicate navigation.
- 768: controls may wrap, but main actions remain visible without horizontal scrolling.
- 430/375: single-column forms, 44 px targets, equal side insets, safe-area-aware bottom navigation.
- Text wraps inside its component; no fixed font scaling based on viewport width.

## Accessibility

- Visible focus treatment is required for links, buttons, fields, tabs, and cards.
- Selection is not communicated by color alone.
- Modal/lightbox opening locks document scroll and restores focus on close.
- Reduced-motion preferences disable nonessential animation.
- Images have meaningful alt text or empty alt when decorative.
