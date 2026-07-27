# npm audit remediation

Date: 26 July 2026

## Baseline

- Command: `npm audit --json`
- Findings: 11 total, 7 high, 4 moderate, 0 critical.
- Dependency graph: 618 edges, 428 unique package/version entries, no `npm ls` problems.
- Automatic force upgrade is prohibited and was not used.

## Inventory and classification

| Package | Installed / affected | Safe target | Direct | Severity | Class | Runtime relevance |
| --- | --- | --- | --- | --- | --- | --- |
| `wrangler` | 4.112.0 / through 4.113.0 | 4.114.0 | yes, dev | high | A/C | deployment and local Worker tooling; not shipped as application code |
| `@cloudflare/vite-plugin` | 1.45.1 / through 1.46.0 | 1.47.0 | no | high | A/C | build/dev integration through the Cloudflare adapter |
| `miniflare` | 4.20260714.0 / through 4.20260721.0 | 4.20260722.0 | no | high | A/C | local Worker emulation |
| `sharp` | 0.34.5 / below 0.35.0 | 0.35.2 | no | high | A/D | Astro image optimization and local/build processing |
| `postcss` | 8.5.15 / through 8.5.17 | 8.5.23 | no | high | A/D | build-time CSS processing; source files are project-controlled |
| `svgo` | 4.0.1 / below 4.0.2 | 4.0.2 | no | high | A/D | build-time SVG optimization; no user-uploaded SVG optimization path |
| `fast-uri` | 3.1.2 / through 3.1.3 | 3.1.4 | no | high | A/C | AJV/YAML language tooling path |
| `@astrojs/language-server` | 2.16.10 | 2.16.13 | no | moderate | A/C | Astro check/editor tooling |
| `volar-service-yaml` | 0.0.70 | 0.0.71 | no | moderate | A/C | language tooling only |
| `yaml-language-server` | 1.20.0 | 1.23.0 | no | moderate | A/C | language tooling only |
| `yaml` | nested 2.7.1 / below 2.8.3 | 2.8.3 | no | moderate | A/C | nested language-server parser |

Classification legend:

- A: patch/minor-compatible remediation.
- C: development dependency path.
- D: not present as vulnerable code in the deployed application runtime; used during build/optimization.

Severity is preserved from npm advisories. Reduced runtime applicability is not a severity downgrade.

## Advisories

- `fast-uri`: GHSA-v2hh-gcrm-f6hx and GHSA-4c8g-83qw-93j6.
- `postcss`: GHSA-r28c-9q8g-f849.
- `sharp`: GHSA-f88m-g3jw-g9cj.
- `svgo`: GHSA-2p49-hgcm-8545.
- nested `yaml`: GHSA-48c2-rrv3-qjmp.

## Upgrade plan

1. Run `npm audit fix` without `--force`; the dry-run proposes only compatible package/lockfile changes.
2. Do not upgrade TypeScript 6 to TypeScript 7 in this security batch; it is unrelated and a major change.
3. Run `npm ci`, `npm audit`, `npm run check`, `npm test`, `npm run build`, and `git diff --check`.
4. Run focused browser smoke QA for catalog, detail, login-protected dashboard routes and Deal Finder.
5. Record the final graph and any remaining advisories below.

## Result

- Executed `npm audit fix` without `--force`.
- Added 1 package and changed 23 packages in `package-lock.json`; `package.json` ranges were unchanged.
- Final `npm audit`: 0 vulnerabilities.
- Updated security-relevant resolved versions:
  - Wrangler 4.114.0;
  - Cloudflare Vite plugin 1.47.0;
  - Miniflare 4.20260722.0;
  - Sharp 0.35.2;
  - PostCSS 8.5.23;
  - SVGO 4.0.2;
  - fast-uri 3.1.4;
  - Astro language server 2.16.13;
  - Volar YAML 0.0.71;
  - YAML language server 1.23.0 with nested YAML 2.8.3.
- `npm run check`: 0 errors, 0 warnings, 0 hints.
- `npm test`: 251/251 passed.
- `npm run build`: passed; Cloudflare Worker bundle compiled with Wrangler 4.114.0.
- Browser dependency smoke: 12 checks at 390 and 1440 px, no overflow and no console warnings/errors.

Remaining non-security updates are deliberately excluded: Lucide 1.25.0 -> 1.27.0 is unrelated to the advisories, and TypeScript 6.0.3 -> 7.0.2 is a major upgrade requiring a separate migration.

