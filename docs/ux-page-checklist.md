# UX page checklist

Use this checklist for every changed route and at 1440, 1024, 768, 430, and 375 px.

## Purpose

- [ ] The user can identify the page in 3-5 seconds.
- [ ] The primary goal is clear.
- [ ] One primary action is visually dominant.
- [ ] Secondary actions do not compete with the primary action.
- [ ] The next step after the action is stated or predictable.

## Navigation

- [ ] Only one full navigation model is visible.
- [ ] Guest and authenticated actions are mutually consistent.
- [ ] Admin links are absent for non-admin users.
- [ ] Current location is indicated.
- [ ] Mobile bottom navigation respects safe areas and does not cover consent/actions.

## Content

- [ ] Technical/internal terminology is absent.
- [ ] Titles and descriptions are concise and literal.
- [ ] Status labels explain the user's state.
- [ ] Repeated or low-priority content is removed or moved down.
- [ ] Empty and loading states are meaningful.

## Forms and errors

- [ ] Fields are grouped by user intent.
- [ ] Required, optional, and conditional fields are clear.
- [ ] Errors identify exact fields and a recovery action.
- [ ] Error recovery preserves entered data.
- [ ] Focus moves to the first invalid field.
- [ ] Loading always ends and double submission is prevented.

## Responsive and accessible

- [ ] No horizontal overflow.
- [ ] Text does not clip or overlap.
- [ ] Images have stable dimensions and appropriate cropping.
- [ ] Controls are at least 44 px high on touch screens.
- [ ] Keyboard focus is visible and ordered.
- [ ] Contrast and reduced-motion behavior are acceptable.

## Data and safety

- [ ] UI changes do not relax auth, ownership, moderation, or public predicates.
- [ ] Internal IDs and sensitive seller data are not exposed.
- [ ] AI output remains advisory and editable.
- [ ] Production deployment has separate explicit approval.
