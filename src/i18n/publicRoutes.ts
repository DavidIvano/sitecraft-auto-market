import { publicLocaleDefinitions } from "./config.ts";
import { EU_WAVE_LOCALES, translateEuWaveData } from "./euWaveCoreTranslations.ts";
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
  brand: string;
  model: string;
  similarVehicles: string;
  location: string;
  updated: string;
  locationMissing: string;
};

const de: PublicPageMessages = {
  homeTitle: "Fahrzeuge sicher finden und verkaufen",
  homeDescription: "Alle veröffentlichten Fahrzeuganzeigen bei SiteCraft Auto Market mit deutscher Benutzeroberfläche.",
  homeHeading: "Alle veröffentlichten Fahrzeuge",
  homeLead: "Der vollständige Fahrzeugbestand bleibt verfügbar. Vorhandene Übersetzungen werden verwendet; andernfalls wird der Originaltext klar als Ausgangsinhalt angezeigt.",
  browseCars: "Fahrzeuge ansehen",
  sellCar: "Fahrzeug verkaufen",
  reliabilityEyebrow: "Verlässliche Sprachauflösung",
  reliabilityHeading: "Kein stiller Sprachwechsel",
  reliabilityText: "Eine lokalisierte Fahrzeugseite ist nur verfügbar, wenn der Datensatz für diese Sprache freigegeben und aktuell ist.",
  catalogTitle: "Fahrzeuge",
  catalogDescription: "Alle veröffentlichten Fahrzeuganzeigen mit deutscher Benutzeroberfläche.",
  catalogLead: "Der vollständige Bestand wird angezeigt. Übersetzbare Systemwerte erscheinen auf Deutsch; noch nicht übersetzte Beschreibungstexte bleiben verfügbar.",
  results: "Ergebnisse",
  vehicles: "Fahrzeuge",
  emptyTitle: "Derzeit keine Anzeigen verfügbar",
  emptyText: "Sobald eine Anzeige veröffentlicht ist, erscheint sie wieder in diesem Katalog.",
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
  brand: "Marke",
  model: "Modell",
  similarVehicles: "Ähnliche Fahrzeuge",
  location: "Ort",
  updated: "Aktualisiert",
  locationMissing: "Ort nicht angegeben",
};

const en: PublicPageMessages = {
  homeTitle: "Find and sell vehicles safely",
  homeDescription: "All published vehicle listings on SiteCraft Auto Market with a complete English interface.",
  homeHeading: "All published vehicles",
  homeLead: "Browse the complete translated inventory with consistent vehicle data and no silent language fallback.",
  browseCars: "Browse vehicles",
  sellCar: "Sell a vehicle",
  reliabilityEyebrow: "Reliable language resolution",
  reliabilityHeading: "No silent language changes",
  reliabilityText: "A localized vehicle page is published only when its English content is complete, current, and verified by the release gate.",
  catalogTitle: "Vehicles",
  catalogDescription: "All published vehicle listings with a complete English interface.",
  catalogLead: "Every listing in this catalog has a current English title and description. Vehicle attributes use stable translated taxonomy values.",
  results: "Results",
  vehicles: "vehicles",
  emptyTitle: "No listings are currently available",
  emptyText: "Published vehicles will appear here after their English content passes the release checks.",
  verifiedListing: "Verified listing",
  vehicleData: "Vehicle data",
  technicalDetails: "Technical details",
  description: "Description",
  aboutVehicle: "About this vehicle",
  price: "Price",
  mileage: "Mileage",
  firstRegistration: "First registration",
  fuel: "Fuel",
  transmission: "Transmission",
  bodyType: "Body type",
  brand: "Brand",
  model: "Model",
  similarVehicles: "Similar vehicles",
  location: "Location",
  updated: "Updated",
  locationMissing: "Location not provided",
};

const fr: PublicPageMessages = {
  homeTitle: "Trouvez et vendez des véhicules en toute sécurité",
  homeDescription: "Toutes les annonces de véhicules publiées sur SiteCraft Auto Market avec une interface entièrement en français.",
  homeHeading: "Tous les véhicules publiés",
  homeLead: "Parcourez l’ensemble du catalogue traduit avec des données cohérentes, sans changement silencieux de langue.",
  browseCars: "Voir les véhicules",
  sellCar: "Vendre un véhicule",
  reliabilityEyebrow: "Résolution linguistique fiable",
  reliabilityHeading: "Aucun changement de langue silencieux",
  reliabilityText: "Une page de véhicule localisée est publiée uniquement lorsque son contenu français est complet, à jour et validé par le contrôle de publication.",
  catalogTitle: "Véhicules",
  catalogDescription: "Toutes les annonces de véhicules publiées avec une interface entièrement en français.",
  catalogLead: "Chaque annonce de ce catalogue possède un titre et une description en français à jour. Les caractéristiques utilisent des valeurs de taxonomie traduites et stables.",
  results: "Résultats",
  vehicles: "véhicules",
  emptyTitle: "Aucune annonce n’est disponible actuellement",
  emptyText: "Les véhicules publiés apparaîtront ici après validation de leur contenu français.",
  verifiedListing: "Annonce vérifiée",
  vehicleData: "Données du véhicule",
  technicalDetails: "Caractéristiques techniques",
  description: "Description",
  aboutVehicle: "À propos de ce véhicule",
  price: "Prix",
  mileage: "Kilométrage",
  firstRegistration: "Première immatriculation",
  fuel: "Carburant",
  transmission: "Boîte de vitesses",
  bodyType: "Carrosserie",
  brand: "Marque",
  model: "Modèle",
  similarVehicles: "Véhicules similaires",
  location: "Localisation",
  updated: "Mis à jour",
  locationMissing: "Localisation non indiquée",
};

const ru: PublicPageMessages = {
  homeTitle: "Безопасно находите и продавайте автомобили",
  homeDescription: "Все опубликованные объявления автомобилей SiteCraft Auto Market с полноценным русским интерфейсом.",
  homeHeading: "Все опубликованные автомобили",
  homeLead: "Просматривайте полный каталог с едиными данными автомобилей и без незаметного переключения языка.",
  browseCars: "Смотреть автомобили",
  sellCar: "Продать автомобиль",
  reliabilityEyebrow: "Надёжное определение языка",
  reliabilityHeading: "Без незаметной смены языка",
  reliabilityText: "Русская страница автомобиля публикуется только при наличии полного и актуального текста, прошедшего проверку выпуска.",
  catalogTitle: "Автомобили",
  catalogDescription: "Все опубликованные объявления автомобилей с полноценным русским интерфейсом.",
  catalogLead: "У каждого объявления есть актуальные русские заголовок и описание. Характеристики используют стабильные значения единой классификации.",
  results: "Результаты",
  vehicles: "автомобилей",
  emptyTitle: "Сейчас нет доступных объявлений",
  emptyText: "Опубликованные автомобили появятся здесь после прохождения проверки русского содержимого.",
  verifiedListing: "Проверенное объявление",
  vehicleData: "Данные автомобиля",
  technicalDetails: "Технические характеристики",
  description: "Описание",
  aboutVehicle: "Об автомобиле",
  price: "Цена",
  mileage: "Пробег",
  firstRegistration: "Первая регистрация",
  fuel: "Топливо",
  transmission: "Коробка передач",
  bodyType: "Тип кузова",
  brand: "Марка",
  model: "Модель",
  similarVehicles: "Похожие автомобили",
  location: "Местоположение",
  updated: "Обновлено",
  locationMissing: "Местоположение не указано",
};

const uk: PublicPageMessages = {
  homeTitle: "Безпечно знаходьте та продавайте автомобілі",
  homeDescription: "Усі опубліковані оголошення автомобілів SiteCraft Auto Market із повним українським інтерфейсом.",
  homeHeading: "Усі опубліковані автомобілі",
  homeLead: "Переглядайте повністю перекладений каталог з узгодженими даними автомобілів і без непомітного перемикання мови.",
  browseCars: "Переглянути автомобілі",
  sellCar: "Продати автомобіль",
  reliabilityEyebrow: "Надійне визначення мови",
  reliabilityHeading: "Без непомітної зміни мови",
  reliabilityText: "Українська сторінка автомобіля публікується лише тоді, коли її вміст повний, актуальний і пройшов перевірку випуску.",
  catalogTitle: "Автомобілі",
  catalogDescription: "Усі опубліковані оголошення автомобілів із повним українським інтерфейсом.",
  catalogLead: "Кожне оголошення має актуальні українські заголовок і опис. Характеристики використовують стабільні перекладені значення єдиної класифікації.",
  results: "Результати",
  vehicles: "автомобілів",
  emptyTitle: "Зараз немає доступних оголошень",
  emptyText: "Опубліковані автомобілі з’являться тут після проходження перевірки українського вмісту.",
  verifiedListing: "Перевірене оголошення",
  vehicleData: "Дані автомобіля",
  technicalDetails: "Технічні характеристики",
  description: "Опис",
  aboutVehicle: "Про автомобіль",
  price: "Ціна",
  mileage: "Пробіг",
  firstRegistration: "Перша реєстрація",
  fuel: "Паливо",
  transmission: "Коробка передач",
  bodyType: "Тип кузова",
  brand: "Марка",
  model: "Модель",
  similarVehicles: "Схожі автомобілі",
  location: "Місцезнаходження",
  updated: "Оновлено",
  locationMissing: "Місцезнаходження не вказано",
};

const tr: PublicPageMessages = {
  homeTitle: "Araçları güvenle bulun ve satın",
  homeDescription: "SiteCraft Auto Market'te eksiksiz Türkçe arayüzle yayımlanan tüm araç ilanları.",
  homeHeading: "Yayımlanan tüm araçlar",
  homeLead: "Tutarlı araç verileri ve sessiz dil değişimi olmadan tamamen çevrilmiş envanteri inceleyin.",
  browseCars: "Araçları incele",
  sellCar: "Araç sat",
  reliabilityEyebrow: "Güvenilir dil çözümleme",
  reliabilityHeading: "Sessiz dil değişimi yok",
  reliabilityText: "Yerelleştirilmiş bir araç sayfası yalnızca Türkçe içeriği eksiksiz, güncel ve yayın kontrolünden geçmişse yayımlanır.",
  catalogTitle: "Araçlar",
  catalogDescription: "Eksiksiz Türkçe arayüzle yayımlanan tüm araç ilanları.",
  catalogLead: "Bu katalogdaki her ilanın güncel Türkçe başlığı ve açıklaması vardır. Araç özellikleri kararlı ve çevrilmiş sınıflandırma değerlerini kullanır.",
  results: "Sonuçlar",
  vehicles: "araç",
  emptyTitle: "Şu anda kullanılabilir ilan yok",
  emptyText: "Yayımlanan araçlar, Türkçe içerikleri yayın kontrollerinden geçtikten sonra burada görünür.",
  verifiedListing: "Doğrulanmış ilan",
  vehicleData: "Araç bilgileri",
  technicalDetails: "Teknik özellikler",
  description: "Açıklama",
  aboutVehicle: "Bu araç hakkında",
  price: "Fiyat",
  mileage: "Kilometre",
  firstRegistration: "İlk tescil",
  fuel: "Yakıt",
  transmission: "Şanzıman",
  bodyType: "Kasa tipi",
  brand: "Marka",
  model: "Model",
  similarVehicles: "Benzer araçlar",
  location: "Konum",
  updated: "Güncellendi",
  locationMissing: "Konum belirtilmemiş",
};

const ar: PublicPageMessages = {
  homeTitle: "اعثر على المركبات وبِعها بأمان",
  homeDescription: "جميع إعلانات المركبات المنشورة في SiteCraft Auto Market بواجهة عربية كاملة.",
  homeHeading: "جميع المركبات المنشورة",
  homeLead: "تصفح المخزون المترجم بالكامل ببيانات مركبات متسقة ومن دون تغيير صامت للغة.",
  browseCars: "تصفح المركبات",
  sellCar: "بيع مركبة",
  reliabilityEyebrow: "تحديد موثوق للغة",
  reliabilityHeading: "لا تغيير صامت للغة",
  reliabilityText: "لا تُنشر صفحة مركبة محلية إلا عندما يكون محتواها العربي كاملاً ومحدثاً ومجتازاً لفحص الإصدار.",
  catalogTitle: "المركبات",
  catalogDescription: "جميع إعلانات المركبات المنشورة بواجهة عربية كاملة.",
  catalogLead: "يحتوي كل إعلان في هذا الكتالوج على عنوان ووصف عربيين محدثين، وتستخدم خصائص المركبة قيماً مترجمة وثابتة.",
  results: "النتائج",
  vehicles: "مركبات",
  emptyTitle: "لا توجد إعلانات متاحة حالياً",
  emptyText: "ستظهر المركبات المنشورة هنا بعد اجتياز محتواها العربي لفحوص الإصدار.",
  verifiedListing: "إعلان موثّق",
  vehicleData: "بيانات المركبة",
  technicalDetails: "المواصفات التقنية",
  description: "الوصف",
  aboutVehicle: "عن هذه المركبة",
  price: "السعر",
  mileage: "المسافة المقطوعة",
  firstRegistration: "التسجيل الأول",
  fuel: "الوقود",
  transmission: "ناقل الحركة",
  bodyType: "نوع الهيكل",
  brand: "العلامة التجارية",
  model: "الطراز",
  similarVehicles: "مركبات مشابهة",
  location: "الموقع",
  updated: "آخر تحديث",
  locationMissing: "الموقع غير مذكور",
};

const euWaveDictionaries = Object.fromEntries(
  EU_WAVE_LOCALES.map((locale) => [locale, translateEuWaveData(en, locale)]),
);

// A locale cannot become public until a complete dictionary is added here.
const dictionaries: Partial<Record<string, PublicPageMessages>> = { de, en, fr, tr, ar, ru, uk, ...euWaveDictionaries };

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
