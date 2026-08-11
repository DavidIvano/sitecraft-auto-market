import { getLocaleDefinition, publicLocaleDefinitions } from "./config.ts";
import { hasUiDictionary } from "./messages.ts";
import { hasPublicPageDictionary } from "./publicRoutes.ts";
import { hasPublicStaticPageDictionary } from "./staticPages.ts";
import { hasCompleteVehicleTaxonomy } from "../domain/vehicleTaxonomy.ts";

export const RELEASE4_FLAG_NAMES = [
  "I18N_ENABLED",
  "I18N_API_READ_ENABLED",
  "I18N_ADMIN_TEST_LOCALE_AWARE_READ_ENABLED",
  "I18N_DUAL_WRITE_ENABLED",
  "I18N_PUBLIC_ROUTES_ENABLED",
  "I18N_AI_TRANSLATION_ENABLED",
] as const;

export type Release4FlagName = typeof RELEASE4_FLAG_NAMES[number];
export type Release4Flags = Record<Release4FlagName, boolean>;

const enabled = (value: unknown) => String(value ?? "").trim().toLowerCase() === "true";

export function readRelease4Flags(env: Record<string, unknown>): Release4Flags {
  return Object.fromEntries(RELEASE4_FLAG_NAMES.map((name) => [
    name,
    enabled(env[name] ?? env[`PUBLIC_${name}`]),
  ])) as Release4Flags;
}

export function getRelease4ConfigErrors(flags: Release4Flags): string[] {
  const errors: string[] = [];
  if (flags.I18N_PUBLIC_ROUTES_ENABLED && (!flags.I18N_ENABLED || !flags.I18N_API_READ_ENABLED)) {
    errors.push("I18N_PUBLIC_ROUTES_ENABLED requires I18N_ENABLED and I18N_API_READ_ENABLED");
  }
  if (flags.I18N_API_READ_ENABLED && !flags.I18N_ENABLED) {
    errors.push("I18N_API_READ_ENABLED requires I18N_ENABLED");
  }
  if (flags.I18N_ADMIN_TEST_LOCALE_AWARE_READ_ENABLED && (!flags.I18N_ENABLED || !flags.I18N_API_READ_ENABLED)) {
    errors.push("I18N_ADMIN_TEST_LOCALE_AWARE_READ_ENABLED requires I18N_ENABLED and I18N_API_READ_ENABLED");
  }
  return errors;
}

export function isPublicLocaleRouteEnabled(locale: unknown, flags: Release4Flags): boolean {
  const definition = getLocaleDefinition(locale);
  return Boolean(
    definition?.isActive
      && definition.isPublic
      && hasUiDictionary(definition.code)
      && hasPublicPageDictionary(definition.code)
      && hasPublicStaticPageDictionary(definition.code)
      && hasCompleteVehicleTaxonomy(definition.code)
      && flags.I18N_ENABLED
      && flags.I18N_API_READ_ENABLED
      && flags.I18N_PUBLIC_ROUTES_ENABLED
      && getRelease4ConfigErrors(flags).length === 0,
  );
}

export function getEnabledPublicLocaleDefinitions(flags: Release4Flags) {
  return publicLocaleDefinitions.filter((definition) => isPublicLocaleRouteEnabled(definition.code, flags));
}
