export const PUBLIC_STATIC_PAGE_CODES = ["sell", "pricing", "support", "privacy", "impressum"] as const;
export type PublicStaticPageCode = typeof PUBLIC_STATIC_PAGE_CODES[number];

export type PublicStaticPage = {
  title: string;
  description: string;
  heading: string;
  lead: string;
  sections: Array<{ heading: string; body: string }>;
};

const de: Record<PublicStaticPageCode, PublicStaticPage> = {
  sell: {
    title: "Fahrzeug verkaufen",
    description: "Erstellen und veröffentlichen Sie Ihre Fahrzeuganzeige bei SiteCraft Auto Market.",
    heading: "Fahrzeug sicher verkaufen",
    lead: "Fotos und Fahrzeugdaten werden als Entwurf gespeichert und vor der Veröffentlichung geprüft.",
    sections: [{ heading: "Anzeige erstellen", body: "Melden Sie sich an, laden Sie Ihre Fotos hoch und prüfen Sie alle Angaben vor dem Absenden." }],
  },
  pricing: {
    title: "Preise",
    description: "Preise und optionale Leistungen von SiteCraft Auto Market.",
    heading: "Transparente Leistungen",
    lead: "Die Erstellung eines Entwurfs und optionale Hervorhebungen werden vor einer Buchung klar ausgewiesen.",
    sections: [{ heading: "Keine versteckten Kosten", body: "Der endgültige Preis wird angezeigt, bevor Sie eine kostenpflichtige Leistung bestätigen." }],
  },
  support: {
    title: "Support",
    description: "Hilfe und Kontakt für SiteCraft Auto Market.",
    heading: "Wie können wir helfen?",
    lead: "Bei Fragen zu Anzeigen, Konten oder Daten erreichen Sie uns per E-Mail.",
    sections: [{ heading: "Kontakt", body: "Schreiben Sie an ivanovdavid119@gmail.com und nennen Sie nach Möglichkeit die URL oder Anzeigen-ID." }],
  },
  privacy: {
    title: "Datenschutz",
    description: "Datenschutzhinweise für SiteCraft Auto Market.",
    heading: "Datenschutz",
    lead: "Wir verarbeiten nur Daten, die für Konto, Anzeige und sicheren Betrieb erforderlich sind.",
    sections: [
      { heading: "Verarbeitete Daten", body: "Dazu gehören Kontoangaben, Anzeigendaten, hochgeladene Bilder und technisch notwendige Protokolldaten." },
      { heading: "Ihre Rechte", body: "Sie können Auskunft, Berichtigung oder Löschung Ihrer personenbezogenen Daten anfordern." },
    ],
  },
  impressum: {
    title: "Impressum",
    description: "Anbieterinformationen für SiteCraft Auto Market.",
    heading: "Impressum",
    lead: "Informationen zum Anbieter dieses Dienstes.",
    sections: [{ heading: "Kontakt", body: "SiteCraft Agency · E-Mail: ivanovdavid119@gmail.com" }],
  },
};

const en: Record<PublicStaticPageCode, PublicStaticPage> = {
  sell: {
    title: "Sell a vehicle",
    description: "Create and publish your vehicle listing on SiteCraft Auto Market.",
    heading: "Sell your vehicle safely",
    lead: "Photos and vehicle data are saved as a draft and checked before publication.",
    sections: [{ heading: "Create a listing", body: "Sign in, upload your photos, and review every detail before submitting the listing." }],
  },
  pricing: {
    title: "Pricing",
    description: "Pricing and optional services on SiteCraft Auto Market.",
    heading: "Transparent services",
    lead: "Draft creation and optional promotion are clearly explained before any paid action.",
    sections: [{ heading: "No hidden costs", body: "The final price is shown before you confirm a paid service." }],
  },
  support: {
    title: "Support",
    description: "Help and contact information for SiteCraft Auto Market.",
    heading: "How can we help?",
    lead: "For questions about listings, accounts, or personal data, contact us by email.",
    sections: [{ heading: "Contact", body: "Email ivanovdavid119@gmail.com and include the relevant URL or listing ID when possible." }],
  },
  privacy: {
    title: "Privacy",
    description: "Privacy information for SiteCraft Auto Market.",
    heading: "Privacy",
    lead: "We process only the data required for accounts, listings, and secure operation of the service.",
    sections: [
      { heading: "Data we process", body: "This includes account details, listing data, uploaded images, and technically necessary logs." },
      { heading: "Your rights", body: "You may request access to, correction of, or deletion of your personal data." },
    ],
  },
  impressum: {
    title: "Legal notice",
    description: "Provider information for SiteCraft Auto Market.",
    heading: "Legal notice",
    lead: "Information about the provider of this service.",
    sections: [{ heading: "Contact", body: "SiteCraft Agency · Email: ivanovdavid119@gmail.com" }],
  },
};

const dictionaries: Partial<Record<string, Record<PublicStaticPageCode, PublicStaticPage>>> = { de, en };

export function hasPublicStaticPageDictionary(locale: string) {
  return Object.hasOwn(dictionaries, locale)
    && PUBLIC_STATIC_PAGE_CODES.every((page) => Boolean(dictionaries[locale]?.[page]));
}

export function isPublicStaticPageCode(value: unknown): value is PublicStaticPageCode {
  return typeof value === "string" && PUBLIC_STATIC_PAGE_CODES.includes(value as PublicStaticPageCode);
}

export function getPublicStaticPage(locale: string, page: PublicStaticPageCode) {
  return dictionaries[locale]?.[page] || null;
}
