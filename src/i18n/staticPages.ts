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

const fr: Record<PublicStaticPageCode, PublicStaticPage> = {
  sell: {
    title: "Vendre un véhicule",
    description: "Créez et publiez votre annonce de véhicule sur SiteCraft Auto Market.",
    heading: "Vendez votre véhicule en toute sécurité",
    lead: "Les photos et les données du véhicule sont enregistrées comme brouillon et vérifiées avant publication.",
    sections: [{ heading: "Créer une annonce", body: "Connectez-vous, ajoutez vos photos et vérifiez chaque information avant d’envoyer l’annonce." }],
  },
  pricing: {
    title: "Tarifs",
    description: "Tarifs et services optionnels de SiteCraft Auto Market.",
    heading: "Des services transparents",
    lead: "La création du brouillon et les options de promotion sont clairement expliquées avant toute action payante.",
    sections: [{ heading: "Aucun coût caché", body: "Le prix final est affiché avant la confirmation d’un service payant." }],
  },
  support: {
    title: "Assistance",
    description: "Aide et coordonnées de SiteCraft Auto Market.",
    heading: "Comment pouvons-nous vous aider ?",
    lead: "Pour toute question concernant une annonce, un compte ou vos données, contactez-nous par e-mail.",
    sections: [{ heading: "Contact", body: "Écrivez à ivanovdavid119@gmail.com et indiquez si possible l’URL ou l’identifiant de l’annonce." }],
  },
  privacy: {
    title: "Confidentialité",
    description: "Informations sur la confidentialité de SiteCraft Auto Market.",
    heading: "Confidentialité",
    lead: "Nous traitons uniquement les données nécessaires aux comptes, aux annonces et au fonctionnement sécurisé du service.",
    sections: [
      { heading: "Données traitées", body: "Cela comprend les informations du compte, les données des annonces, les images ajoutées et les journaux techniquement nécessaires." },
      { heading: "Vos droits", body: "Vous pouvez demander l’accès, la rectification ou la suppression de vos données personnelles." },
    ],
  },
  impressum: {
    title: "Mentions légales",
    description: "Informations sur l’éditeur de SiteCraft Auto Market.",
    heading: "Mentions légales",
    lead: "Informations concernant l’éditeur de ce service.",
    sections: [{ heading: "Contact", body: "SiteCraft Agency · E-mail : ivanovdavid119@gmail.com" }],
  },
};

const dictionaries: Partial<Record<string, Record<PublicStaticPageCode, PublicStaticPage>>> = { de, en, fr };

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
