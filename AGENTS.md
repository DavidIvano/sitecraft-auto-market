## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Apple-inspired frontend design

For every frontend design, layout, CSS, navigation, vehicle card, catalogue, vehicle detail, form, dashboard, modal, responsive or accessibility task:

1. Use the installed `$hig` skill for Apple HIG facts and accessibility conventions.
2. Use `$ios-liquid-glass` for Liquid Glass hierarchy, material and control-layer principles.
3. Use `$sitecraft-macos-web-design` to adapt those principles to the Astro web project.
4. Never add Swift, SwiftUI, UIKit, Xcode files or Apple SDK dependencies.
5. Preserve all existing Xano API calls, authentication, routes, SEO, storage integration and business logic.
6. Use shared design tokens and reusable components.
7. Do not redesign individual pages independently.
8. Test desktop, tablet and mobile layouts after visual changes.
9. Respect prefers-reduced-motion and keyboard accessibility.
10. Do not claim visual verification unless rendered pages were actually inspected.
