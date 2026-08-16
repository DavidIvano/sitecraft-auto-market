import { getLocaleDefinition } from "../src/i18n/config.ts";
import {
  STAGE3_EU_RELEASE_BATCHES,
  STAGE3_PRIMARY_RELEASE_ORDER,
  getStaticLocaleReleaseReadiness,
  isStrictSeoReleaseLocale,
} from "../src/i18n/releaseStage3.ts";

const describe = (locale) => {
  const definition = getLocaleDefinition(locale);
  const staticReadiness = getStaticLocaleReleaseReadiness(locale);
  const blockers = Object.entries(staticReadiness).flatMap(([name, ready]) => ready ? [] : [name]);
  return {
    locale,
    public: definition?.isPublic === true,
    strict_seo: isStrictSeoReleaseLocale(locale),
    static_ready: blockers.length === 0,
    blockers,
    checks: staticReadiness,
  };
};

const report = {
  primary: STAGE3_PRIMARY_RELEASE_ORDER.map(describe),
  eu_batches: STAGE3_EU_RELEASE_BATCHES.map((batch, index) => ({
    batch: index + 1,
    locales: batch.map(describe),
  })),
  release_rule: "public=true only after static readiness, Xano 100% data gate, sitemap/canonical/hreflang and HTTP smoke",
};

console.log(JSON.stringify(report, null, 2));
