# Design QA: mobile catalog cards and filters

Status: PASSED

## Reference

- Source: user-provided compact dark vehicle card.
- Comparison: `artifacts/ui-redesign/reference-comparison.png`.

## Verified

- 390 px and 360 px: image stays beside the vehicle facts.
- Location, favourite control, view count, price, status and four core facts remain readable.
- No horizontal page overflow (`scrollWidth === viewport width`).
- Premium label fits the media column without wrapping.
- Mobile filters open as a drawer and expose three named groups.
- Desktop filters remain sticky and do not overlap the query field or actions.
- Smart query applies parsed filters and keeps the user in the catalog when AI is unavailable.
- Browser console contains no errors.
- Desktop grid: the first 12 cards are exactly 430 px high; every media area is 210 px high.
- Mobile grid at 390 px: the first 12 cards are exactly 222 px high; every media area fills the same 220 px inner height.
- Vehicle images use `object-fit: cover`, so source aspect ratios cannot resize the cards.
- Mobile promotion labels are pinned 10 px from the inline-start and bottom edges, share the same baseline as the view counter and never overlap it at 414 px.

## Findings resolved

- P1: legacy two-column AI form collapsed the query field in the narrow desktop sidebar.
- P2: promotion disclosure wrapped inside the mobile image column.
- P2: smart selection stopped before applying the local parser after auth, credit or network failures.
- P2: a legacy global `top: 10px` stretched the mobile promotion overlay and vertically centered its badge; the component now resets the block-start inset and anchors both overlays to the bottom edge.

## Residual differences

- The reference has room for eight facts; the real 360-390 px catalog card intentionally keeps four essential facts to preserve readability.
- Existing brand colors and typography were retained instead of copying the reference literally.
