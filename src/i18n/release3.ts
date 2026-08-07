export const RELEASE3_FLAG_NAMES = [
  "I18N_ENABLED",
  "I18N_API_READ_ENABLED",
  "I18N_ADMIN_TEST_LOCALE_AWARE_READ_ENABLED",
  "I18N_DUAL_WRITE_ENABLED",
  "I18N_PUBLIC_ROUTES_ENABLED",
  "I18N_AI_TRANSLATION_ENABLED",
  "I18N_LOCALE_DE_ENABLED",
  "I18N_LOCALE_EN_ENABLED",
  "I18N_LOCALE_UK_ENABLED",
  "I18N_LOCALE_ZH_HANS_ENABLED",
] as const;

export type Release3FlagName = typeof RELEASE3_FLAG_NAMES[number];
export type Release3Flags = Record<Release3FlagName, boolean>;

const enabled = (value: unknown) => String(value ?? "").trim().toLowerCase() === "true";

const flagValue = (env: Record<string, unknown>, name: Release3FlagName) => (
  env[name] ?? env[`PUBLIC_${name}`]
);

export function readRelease3Flags(env: Record<string, unknown>): Release3Flags {
  return Object.fromEntries(
    RELEASE3_FLAG_NAMES.map((name) => [name, enabled(flagValue(env, name))]),
  ) as Release3Flags;
}

export function getRelease3ConfigErrors(flags: Release3Flags): string[] {
  const errors: string[] = [];
  const publicGermanRequested = flags.I18N_LOCALE_DE_ENABLED;

  if (flags.I18N_PUBLIC_ROUTES_ENABLED && !flags.I18N_ENABLED) {
    errors.push("I18N_PUBLIC_ROUTES_ENABLED requires I18N_ENABLED");
  }

  if (flags.I18N_API_READ_ENABLED && !flags.I18N_ENABLED) {
    errors.push("I18N_API_READ_ENABLED requires I18N_ENABLED");
  }

  if (flags.I18N_ADMIN_TEST_LOCALE_AWARE_READ_ENABLED
    && (!flags.I18N_ENABLED || !flags.I18N_API_READ_ENABLED)) {
    errors.push("I18N_ADMIN_TEST_LOCALE_AWARE_READ_ENABLED requires I18N_ENABLED and I18N_API_READ_ENABLED");
  }

  if (publicGermanRequested && !flags.I18N_ENABLED) {
    errors.push("I18N_LOCALE_DE_ENABLED requires I18N_ENABLED");
  }
  if (publicGermanRequested && !flags.I18N_PUBLIC_ROUTES_ENABLED) {
    errors.push("I18N_LOCALE_DE_ENABLED requires I18N_PUBLIC_ROUTES_ENABLED");
  }
  if (publicGermanRequested && !flags.I18N_API_READ_ENABLED) {
    errors.push("I18N_LOCALE_DE_ENABLED requires I18N_API_READ_ENABLED");
  }
  if (publicGermanRequested && flags.I18N_AI_TRANSLATION_ENABLED) {
    errors.push("Release 3 German routes cannot depend on I18N_AI_TRANSLATION_ENABLED");
  }

  for (const name of [
    "I18N_LOCALE_EN_ENABLED",
    "I18N_LOCALE_UK_ENABLED",
    "I18N_LOCALE_ZH_HANS_ENABLED",
  ] as const) {
    if (flags[name]) errors.push(`${name} is outside the Release 3 scope`);
  }

  return errors;
}

export function assertValidRelease3Config(flags: Release3Flags) {
  const errors = getRelease3ConfigErrors(flags);
  if (errors.length > 0) {
    throw new Error(`Invalid multilingual Release 3 configuration: ${errors.join("; ")}`);
  }
  return flags;
}

export function isGermanPublicRouteEnabled(flags: Release3Flags) {
  return flags.I18N_ENABLED
    && flags.I18N_API_READ_ENABLED
    && flags.I18N_PUBLIC_ROUTES_ENABLED
    && flags.I18N_LOCALE_DE_ENABLED
    && !flags.I18N_AI_TRANSLATION_ENABLED
    && getRelease3ConfigErrors(flags).length === 0;
}

export function isPreviewEnvironment(env: Record<string, unknown>) {
  const explicit = String(env.ENVIRONMENT ?? env.PUBLIC_BUILD_ENVIRONMENT ?? "").trim().toLowerCase();
  const branch = String(env.CF_PAGES_BRANCH ?? "").trim().toLowerCase();
  return explicit === "preview" || explicit === "staging" || (Boolean(branch) && branch !== "main");
}
