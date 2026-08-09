import { publicLocaleDefinitions } from "./config.ts";
import { getLocalizedPath } from "./routes.ts";

export type PublicPageMessages = {
  homeTitle: string;
  homeDescription: string;
  homeHeading: string;
  homeLead: string;
  browseCars: string;
  sellCar: string;
  reliabilityEyebrow: string;
  reliabilityHeading: string;
  reliabilityText: string;
  catalogTitle: string;
  catalogDescription: string;
  catalogLead: string;
  results: string;
  vehicles: string;
  emptyTitle: string;
  emptyText: string;
  verifiedListing: string;
  vehicleData: string;
  technicalDetails: string;
  description: string;
  aboutVehicle: string;
  price: string;
  mileage: string;
  firstRegistration: string;
  fuel: string;
  transmission: string;
  bodyType: string;
  location: string;
  updated: string;
  locationMissing: string;
};

const de: PublicPageMessages = {
  homeTitle: "Fahrzeuge sicher finden und verkaufen",
  homeDescription: "Geprüfte Fahrzeuganzeigen mit vorhandenen deutschen Inhalten bei SiteCraft Auto Market.",
  homeHeading: "Geprüfte Fahrzeuge auf Deutsch",
  homeLead: "Hier erscheinen ausschließlich Anzeigen mit einem vorhandenen und aktuellen deutschen Inhalt. Fehlende Übersetzungen werden nicht durch Texte in einer anderen Sprache ersetzt.",
  browseCars: "Fahrzeuge ansehen",
  sellCar: "Fahrzeug verkaufen",
  reliabilityEyebrow: "Verlässliche Sprachauflösung",
  reliabilityHeading: "Kein stiller Sprachwechsel",
  reliabilityText: "Eine lokalisierte Fahrzeugseite ist nur verfügbar, wenn der Datensatz für diese Sprache freigegeben und aktuell ist.",
  catalogTitle: "Fahrzeuge",
  catalogDescription: "Geprüfte Fahrzeuganzeigen mit aktuellen deutschen Inhalten.",
  catalogLead: "Nur Anzeigen mit freigegebenem und aktuellem Inhalt werden angezeigt.",
  results: "Ergebnisse",
  vehicles: "Fahrzeuge",
  emptyTitle: "Derzeit keine Anzeigen verfügbar",
  emptyText: "Inhalte aus einer anderen Sprache werden nicht als Übersetzung ausgegeben.",
  verifiedListing: "Geprüfte Anzeige",
  vehicleData: "Fahrzeugdaten",
  technicalDetails: "Technische Angaben",
  description: "Beschreibung",
  aboutVehicle: "Über dieses Fahrzeug",
  price: "Preis",
  mileage: "Kilometerstand",
  firstRegistration: "Erstzulassung",
  fuel: "Kraftstoff",
  transmission: "Getriebe",
  bodyType: "Karosserie",
  location: "Ort",
  updated: "Aktualisiert",
  locationMissing: "Ort nicht angegeben",
};

// A locale cannot become public until a complete dictionary is added here.
const dictionaries: Partial<Record<string, PublicPageMessages>> = { de };

export function hasPublicPageDictionary(locale: string) {
  return Object.hasOwn(dictionaries, locale);
}

export function getPublicPageMessages(locale: string) {
  const messages = dictionaries[locale];
  if (!messages) throw new Error(`Public page dictionary is not ready for locale ${locale}`);
  return messages;
}

export function getRouteAlternates(pathname: string, readyLocales?: readonly string[]) {
  const ready = readyLocales ? new Set(readyLocales) : null;
  return publicLocaleDefinitions
    .filter((definition) => hasPublicPageDictionary(definition.code) && (!ready || ready.has(definition.code)))
    .map((definition) => ({
      locale: definition.code,
      path: getLocalizedPath(pathname, definition.code),
      label: definition.nativeName,
    }));
}
