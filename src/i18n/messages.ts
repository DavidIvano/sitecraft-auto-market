import type { Locale } from "./locales.ts";
import { translateArTrRecord } from "./arTrTranslations.ts";
import { translateFrCoreRecord } from "./frCoreTranslations.ts";

const ruMessages = {
  language: "Язык",
  navHome: "Главная",
  navCars: "Авто",
  navDashboard: "Кабинет",
  navSell: "Продать авто",
  navPricing: "Тарифы",
  navModeration: "Модерация",
  navPrivacy: "Приватность",
  navSupport: "Поддержка",
  navLogin: "Войти",
  navLogout: "Выйти",
  navRegister: "Регистрация",
  navAddListing: "Добавить объявление",
  navigation: "Навигация SiteCraft Auto Market",
  siteSections: "Разделы сайта",
  mainNavigation: "Основная навигация",
  footerLinks: "Ссылки в подвале",
  breadcrumbs: "Хлебные крошки",
  theme: "Тема",
  themeToggle: "Переключить тему",
  themeDark: "Тёмная тема",
  themeEnableDark: "Включить тёмную тему",
  themeEnableLight: "Включить светлую тему",
  menuOpen: "Открыть меню",
  menuClose: "Закрыть меню",
  sidebarOpen: "Открыть боковое меню",
  sidebarClose: "Скрыть боковое меню",
  footerProduct: "Продукт компании SiteCraft Agency для премиальной доски объявлений авто.",
  footerSupport: "Поддержка и запросы по данным:",
  cookieTitle: "Cookie и приватность",
  cookieText: "Мы используем только необходимые cookie для входа, сохранения сессии и запоминания уведомления. Рекламных и аналитических cookie нет.",
  cookieMore: "Подробнее",
  cookieAccept: "Понятно",
  homeTitle: "Премиальная доска объявлений авто",
  homeHeroTitle: "Купите или продайте авто быстрее с AI-помощником",
  homeHeroLead: "Загрузите фото автомобиля — AI заполнит черновик, подскажет, что улучшить, проверит качество объявления и поможет покупателю найти подходящую машину.",
  homeCreateFromPhoto: "Создать объявление по фото",
  homeFindWithAi: "Подобрать авто с AI",
  homeAiDisclaimer: "AI помогает с данными объявления, но финальную информацию подтверждает продавец.",
  categoryVehicle: "Категория транспорта",
  tabCars: "Авто",
  tabElectric: "Электро",
  tabPremium: "Премиум",
  fieldBrand: "Марка",
  fieldModel: "Модель",
  fieldPriceFrom: "Цена от",
  fieldPriceTo: "Цена до",
  fieldYearFrom: "Год от",
  fieldMileageTo: "Пробег до",
  fieldFuel: "Топливо",
  fieldTransmission: "Трансмиссия",
  fieldCity: "Город",
  anyValue: "Неважно",
  modelExample: "Например, A4",
  cityExample: "Берлин",
  viewListings: "Смотреть объявления",
  reset: "Сбросить",
  moreFilters: "Больше фильтров",
  aiHelps: "Как AI помогает",
  aiDraftTitle: "AI создаёт черновик",
  aiDraftText: "Загрузите фото — AI предложит марку, модель, цвет, кузов, топливо и описание.",
  aiImproveTitle: "AI улучшает объявление",
  aiImproveText: "Показывает качество объявления, недостающие поля и готовые подсказки для вставки.",
  aiBuyerTitle: "AI помогает покупателю",
  aiBuyerText: "Покупатель пишет обычным языком, какое авто ищет, а сайт применяет фильтры.",
  aiModeratorTitle: "AI помогает модератору",
  aiModeratorText: "AI находит противоречия, слабые места и помогает сформировать причину исправления.",
  carCategories: "Категории авто",
  categoryControls: "Управление слайдером категорий",
  previousCategories: "Предыдущие категории",
  nextCategories: "Следующие категории",
  carCategoriesLabel: "Категории автомобилей",
  categoriesLoading: "Подбираю категории автомобилей...",
  categoriesEmpty: "Категории появятся после публикации объявлений.",
  categoryVehicleText: "Объявления этого типа транспорта.",
  categoryBodyText: "Автомобили с кузовом {value}.",
  quickBrand: "Быстрый выбор бренда",
  brandControls: "Управление слайдером марок",
  previousBrands: "Предыдущие марки",
  nextBrands: "Следующие марки",
  popularBrands: "Популярные марки автомобилей",
  view: "Смотреть",
  showBrand: "Показать {value}",
  listingsCount: "{count} объявл.",
  freshCars: "Свежие автомобили",
  loadingCars: "Загружаю свежие автомобили",
  loadingCarsText: "Подбираю последние опубликованные объявления.",
  allCars: "Все авто",
  premiumCars: "Премиум-автомобили",
  premiumDisclosure: "Автомобили с активным размещением на главной. Услуга не является редакционной рекомендацией.",
  viewCatalog: "Смотреть каталог",
  showFiltered: "Показать: {count}",
  noFilteredCars: "По этим фильтрам пока нет опубликованных объявлений.",
  noCars: "Пока нет опубликованных объявлений.",
  foundCars: "Найдено объявлений: {count}.",
  newestCars: "Показаны самые новые опубликованные объявления.",
  loadCarsFailed: "Не удалось загрузить объявления. Попробуйте обновить страницу.",
  serviceUnavailable: "Сервис временно недоступен. Попробуйте позже.",
  photoMissing: "Фото пока не добавлено",
  carDefault: "Автомобиль",
  dateMissing: "Дата не указана",
  promoted: "Продвигается",
  promotionBoosted: "Поднято",
  promotionFeatured: "Выделено",
  promotionPremium: "Премиум",
  sold: "Продано",
  openListing: "Открыть объявление {value}",
  savedOn: "Сохранено {value}",
  specYear: "Год",
  specMileage: "Пробег",
  specFuel: "Топливо",
  specTransmission: "Коробка",
  cityMissing: "Город не указан",
  kilometre: "км",
} as const;

export type UiMessageKey = keyof typeof ruMessages;
export type UiMessages = Record<UiMessageKey, string>;

const deMessages: UiMessages = {
  language: "Sprache", navHome: "Startseite", navCars: "Autos", navDashboard: "Konto", navSell: "Auto verkaufen", navPricing: "Preise", navModeration: "Moderation", navPrivacy: "Datenschutz", navSupport: "Support", navLogin: "Anmelden", navLogout: "Abmelden", navRegister: "Registrieren", navAddListing: "Anzeige erstellen", navigation: "Navigation SiteCraft Auto Market", siteSections: "Website-Bereiche", mainNavigation: "Hauptnavigation", footerLinks: "Links im Footer", breadcrumbs: "Brotkrümelnavigation", theme: "Design", themeToggle: "Design wechseln", themeDark: "Dunkles Design", themeEnableDark: "Dunkles Design aktivieren", themeEnableLight: "Helles Design aktivieren", menuOpen: "Menü öffnen", menuClose: "Menü schließen", sidebarOpen: "Seitenmenü öffnen", sidebarClose: "Seitenmenü ausblenden", footerProduct: "Ein Produkt von SiteCraft Agency für einen hochwertigen Automarktplatz.", footerSupport: "Support und Datenanfragen:", cookieTitle: "Cookies und Datenschutz", cookieText: "Wir verwenden nur notwendige Cookies für Anmeldung, Sitzung und die Speicherung dieses Hinweises. Es gibt keine Werbe- oder Analyse-Cookies.", cookieMore: "Mehr erfahren", cookieAccept: "Verstanden",
  homeTitle: "Premium-Automarktplatz", homeHeroTitle: "Auto schneller kaufen oder verkaufen – mit AI-Unterstützung", homeHeroLead: "Laden Sie Fahrzeugfotos hoch: AI erstellt einen Entwurf, schlägt Verbesserungen vor, prüft die Anzeigenqualität und hilft bei der Fahrzeugsuche.", homeCreateFromPhoto: "Anzeige aus Fotos erstellen", homeFindWithAi: "Auto mit AI finden", homeAiDisclaimer: "AI unterstützt bei den Anzeigendaten; die endgültigen Angaben bestätigt der Verkäufer.", categoryVehicle: "Fahrzeugkategorie", tabCars: "Autos", tabElectric: "Elektro", tabPremium: "Premium", fieldBrand: "Marke", fieldModel: "Modell", fieldPriceFrom: "Preis ab", fieldPriceTo: "Preis bis", fieldYearFrom: "Baujahr ab", fieldMileageTo: "Kilometer bis", fieldFuel: "Kraftstoff", fieldTransmission: "Getriebe", fieldCity: "Ort", anyValue: "Beliebig", modelExample: "Zum Beispiel A4", cityExample: "Berlin", viewListings: "Anzeigen ansehen", reset: "Zurücksetzen", moreFilters: "Weitere Filter",
  aiHelps: "So hilft AI", aiDraftTitle: "AI erstellt den Entwurf", aiDraftText: "Fotos hochladen – AI schlägt Marke, Modell, Farbe, Karosserie, Kraftstoff und Beschreibung vor.", aiImproveTitle: "AI verbessert die Anzeige", aiImproveText: "Zeigt Anzeigenqualität, fehlende Felder und direkt nutzbare Vorschläge.", aiBuyerTitle: "AI hilft Käufern", aiBuyerText: "Beschreiben Sie das gesuchte Auto in Alltagssprache; die Website setzt passende Filter.", aiModeratorTitle: "AI hilft bei der Moderation", aiModeratorText: "AI erkennt Widersprüche und Schwachstellen und unterstützt bei Korrekturhinweisen.", carCategories: "Fahrzeugkategorien", categoryControls: "Steuerung des Kategorie-Sliders", previousCategories: "Vorherige Kategorien", nextCategories: "Nächste Kategorien", carCategoriesLabel: "Fahrzeugkategorien", categoriesLoading: "Fahrzeugkategorien werden geladen...", categoriesEmpty: "Kategorien erscheinen nach Veröffentlichung von Anzeigen.", categoryVehicleText: "Anzeigen dieses Fahrzeugtyps.", categoryBodyText: "Fahrzeuge mit Karosserie {value}.", quickBrand: "Schnellauswahl nach Marke", brandControls: "Steuerung des Marken-Sliders", previousBrands: "Vorherige Marken", nextBrands: "Nächste Marken", popularBrands: "Beliebte Automarken", view: "Ansehen", showBrand: "{value} anzeigen", listingsCount: "{count} Anzeigen", freshCars: "Neue Fahrzeuge", loadingCars: "Neue Fahrzeuge werden geladen", loadingCarsText: "Die neuesten veröffentlichten Anzeigen werden geladen.", allCars: "Alle Autos", premiumCars: "Premium-Fahrzeuge", premiumDisclosure: "Fahrzeuge mit aktiver Platzierung auf der Startseite. Dies ist keine redaktionelle Empfehlung.", viewCatalog: "Katalog ansehen", showFiltered: "Anzeigen: {count}", noFilteredCars: "Für diese Filter gibt es noch keine veröffentlichten Anzeigen.", noCars: "Noch keine veröffentlichten Anzeigen.", foundCars: "Gefundene Anzeigen: {count}.", newestCars: "Die neuesten veröffentlichten Anzeigen werden angezeigt.", loadCarsFailed: "Anzeigen konnten nicht geladen werden. Bitte aktualisieren Sie die Seite.", serviceUnavailable: "Der Dienst ist vorübergehend nicht verfügbar. Bitte später erneut versuchen.", photoMissing: "Noch kein Foto", carDefault: "Fahrzeug", dateMissing: "Datum nicht angegeben", promoted: "Gesponsert", promotionBoosted: "Hervorgehoben", promotionFeatured: "Top-Anzeige", promotionPremium: "Premium", sold: "Verkauft", openListing: "Anzeige {value} öffnen", savedOn: "Gespeichert {value}", specYear: "Jahr", specMileage: "Kilometer", specFuel: "Kraftstoff", specTransmission: "Getriebe", cityMissing: "Ort nicht angegeben", kilometre: "km",
};

const ukMessages: UiMessages = {
  language: "Мова", navHome: "Головна", navCars: "Авто", navDashboard: "Кабінет", navSell: "Продати авто", navPricing: "Тарифи", navModeration: "Модерація", navPrivacy: "Приватність", navSupport: "Підтримка", navLogin: "Увійти", navLogout: "Вийти", navRegister: "Реєстрація", navAddListing: "Додати оголошення", navigation: "Навігація SiteCraft Auto Market", siteSections: "Розділи сайту", mainNavigation: "Основна навігація", footerLinks: "Посилання в підвалі", breadcrumbs: "Навігаційний ланцюжок", theme: "Тема", themeToggle: "Змінити тему", themeDark: "Темна тема", themeEnableDark: "Увімкнути темну тему", themeEnableLight: "Увімкнути світлу тему", menuOpen: "Відкрити меню", menuClose: "Закрити меню", sidebarOpen: "Відкрити бічне меню", sidebarClose: "Сховати бічне меню", footerProduct: "Продукт компанії SiteCraft Agency для преміальної дошки оголошень авто.", footerSupport: "Підтримка та запити щодо даних:", cookieTitle: "Cookie та приватність", cookieText: "Ми використовуємо лише необхідні cookie для входу, сесії та збереження цього повідомлення. Рекламних і аналітичних cookie немає.", cookieMore: "Докладніше", cookieAccept: "Зрозуміло",
  homeTitle: "Преміальна дошка оголошень авто", homeHeroTitle: "Купуйте або продавайте авто швидше з AI-помічником", homeHeroLead: "Завантажте фото автомобіля — AI заповнить чернетку, запропонує покращення, перевірить якість оголошення та допоможе знайти потрібне авто.", homeCreateFromPhoto: "Створити оголошення з фото", homeFindWithAi: "Підібрати авто з AI", homeAiDisclaimer: "AI допомагає з даними оголошення, але остаточну інформацію підтверджує продавець.", categoryVehicle: "Категорія транспорту", tabCars: "Авто", tabElectric: "Електро", tabPremium: "Преміум", fieldBrand: "Марка", fieldModel: "Модель", fieldPriceFrom: "Ціна від", fieldPriceTo: "Ціна до", fieldYearFrom: "Рік від", fieldMileageTo: "Пробіг до", fieldFuel: "Паливо", fieldTransmission: "Коробка передач", fieldCity: "Місто", anyValue: "Неважливо", modelExample: "Наприклад, A4", cityExample: "Берлін", viewListings: "Переглянути оголошення", reset: "Скинути", moreFilters: "Більше фільтрів",
  aiHelps: "Як допомагає AI", aiDraftTitle: "AI створює чернетку", aiDraftText: "Завантажте фото — AI запропонує марку, модель, колір, кузов, паливо та опис.", aiImproveTitle: "AI покращує оголошення", aiImproveText: "Показує якість оголошення, відсутні поля та готові підказки.", aiBuyerTitle: "AI допомагає покупцеві", aiBuyerText: "Покупець описує звичайною мовою потрібне авто, а сайт застосовує фільтри.", aiModeratorTitle: "AI допомагає модератору", aiModeratorText: "AI знаходить суперечності, слабкі місця та допомагає сформувати причину виправлення.", carCategories: "Категорії авто", categoryControls: "Керування слайдером категорій", previousCategories: "Попередні категорії", nextCategories: "Наступні категорії", carCategoriesLabel: "Категорії автомобілів", categoriesLoading: "Підбираю категорії автомобілів...", categoriesEmpty: "Категорії з’являться після публікації оголошень.", categoryVehicleText: "Оголошення цього типу транспорту.", categoryBodyText: "Автомобілі з кузовом {value}.", quickBrand: "Швидкий вибір марки", brandControls: "Керування слайдером марок", previousBrands: "Попередні марки", nextBrands: "Наступні марки", popularBrands: "Популярні марки автомобілів", view: "Переглянути", showBrand: "Показати {value}", listingsCount: "Оголошень: {count}", freshCars: "Свіжі автомобілі", loadingCars: "Завантажую свіжі автомобілі", loadingCarsText: "Підбираю останні опубліковані оголошення.", allCars: "Усі авто", premiumCars: "Преміум-автомобілі", premiumDisclosure: "Автомобілі з активним розміщенням на головній. Послуга не є редакційною рекомендацією.", viewCatalog: "Переглянути каталог", showFiltered: "Показати: {count}", noFilteredCars: "За цими фільтрами ще немає опублікованих оголошень.", noCars: "Поки немає опублікованих оголошень.", foundCars: "Знайдено оголошень: {count}.", newestCars: "Показано найновіші опубліковані оголошення.", loadCarsFailed: "Не вдалося завантажити оголошення. Оновіть сторінку.", serviceUnavailable: "Сервіс тимчасово недоступний. Спробуйте пізніше.", photoMissing: "Фото ще не додано", carDefault: "Автомобіль", dateMissing: "Дату не вказано", promoted: "Просувається", promotionBoosted: "Піднято", promotionFeatured: "Виділено", promotionPremium: "Преміум", sold: "Продано", openListing: "Відкрити оголошення {value}", savedOn: "Збережено {value}", specYear: "Рік", specMileage: "Пробіг", specFuel: "Паливо", specTransmission: "Коробка", cityMissing: "Місто не вказано", kilometre: "км",
};

const enMessages: UiMessages = {
  language: "Language", navHome: "Home", navCars: "Cars", navDashboard: "Dashboard", navSell: "Sell a car", navPricing: "Pricing", navModeration: "Moderation", navPrivacy: "Privacy", navSupport: "Support", navLogin: "Sign in", navLogout: "Sign out", navRegister: "Register", navAddListing: "Add listing", navigation: "SiteCraft Auto Market navigation", siteSections: "Site sections", mainNavigation: "Main navigation", footerLinks: "Footer links", breadcrumbs: "Breadcrumbs", theme: "Theme", themeToggle: "Toggle theme", themeDark: "Dark theme", themeEnableDark: "Enable dark theme", themeEnableLight: "Enable light theme", menuOpen: "Open menu", menuClose: "Close menu", sidebarOpen: "Open sidebar", sidebarClose: "Hide sidebar", footerProduct: "A SiteCraft Agency product for a premium vehicle marketplace.", footerSupport: "Support and data requests:", cookieTitle: "Cookies and privacy", cookieText: "We only use essential cookies for sign-in, sessions, and remembering this notice. We do not use advertising or analytics cookies.", cookieMore: "Learn more", cookieAccept: "Got it",
  homeTitle: "Premium vehicle marketplace", homeHeroTitle: "Buy or sell a car faster with an AI assistant", homeHeroLead: "Upload vehicle photos and AI will create a draft, suggest improvements, check listing quality, and help buyers find the right car.", homeCreateFromPhoto: "Create listing from photos", homeFindWithAi: "Find a car with AI", homeAiDisclaimer: "AI assists with listing data, but the seller confirms all final information.", categoryVehicle: "Vehicle category", tabCars: "Cars", tabElectric: "Electric", tabPremium: "Premium", fieldBrand: "Make", fieldModel: "Model", fieldPriceFrom: "Price from", fieldPriceTo: "Price to", fieldYearFrom: "Year from", fieldMileageTo: "Mileage to", fieldFuel: "Fuel", fieldTransmission: "Transmission", fieldCity: "City", anyValue: "Any", modelExample: "For example, A4", cityExample: "Berlin", viewListings: "View listings", reset: "Reset", moreFilters: "More filters",
  aiHelps: "How AI helps", aiDraftTitle: "AI creates a draft", aiDraftText: "Upload photos and AI will suggest the make, model, colour, body, fuel type, and description.", aiImproveTitle: "AI improves the listing", aiImproveText: "It shows listing quality, missing fields, and ready-to-use suggestions.", aiBuyerTitle: "AI helps buyers", aiBuyerText: "Buyers describe the car they want in natural language and the site applies matching filters.", aiModeratorTitle: "AI helps moderators", aiModeratorText: "AI finds contradictions and weak spots and helps prepare correction requests.", carCategories: "Car categories", categoryControls: "Category carousel controls", previousCategories: "Previous categories", nextCategories: "Next categories", carCategoriesLabel: "Vehicle categories", categoriesLoading: "Loading vehicle categories...", categoriesEmpty: "Categories will appear after listings are published.", categoryVehicleText: "Listings for this vehicle type.", categoryBodyText: "Cars with a {value} body.", quickBrand: "Quick make selection", brandControls: "Make carousel controls", previousBrands: "Previous makes", nextBrands: "Next makes", popularBrands: "Popular car makes", view: "View", showBrand: "Show {value}", listingsCount: "{count} listings", freshCars: "Latest cars", loadingCars: "Loading latest cars", loadingCarsText: "Fetching the newest published listings.", allCars: "All cars", premiumCars: "Premium cars", premiumDisclosure: "Cars with active homepage promotion. This service is not an editorial recommendation.", viewCatalog: "View catalogue", showFiltered: "Show: {count}", noFilteredCars: "There are no published listings matching these filters yet.", noCars: "There are no published listings yet.", foundCars: "Listings found: {count}.", newestCars: "Showing the newest published listings.", loadCarsFailed: "Could not load listings. Please refresh the page.", serviceUnavailable: "The service is temporarily unavailable. Please try again later.", photoMissing: "No photo added yet", carDefault: "Vehicle", dateMissing: "Date not provided", promoted: "Promoted", promotionBoosted: "Boosted", promotionFeatured: "Featured", promotionPremium: "Premium", sold: "Sold", openListing: "Open listing {value}", savedOn: "Saved {value}", specYear: "Year", specMileage: "Mileage", specFuel: "Fuel", specTransmission: "Transmission", cityMissing: "City not provided", kilometre: "km",
};

export const UI_MESSAGES: Record<Locale, UiMessages> = {
  de: deMessages,
  ru: ruMessages,
  uk: ukMessages,
  en: enMessages,
  ar: translateArTrRecord(ruMessages, "ar"),
  tr: translateArTrRecord(ruMessages, "tr"),
  fr: translateFrCoreRecord(enMessages),
};

export function hasUiDictionary(locale: string): boolean {
  return Object.hasOwn(UI_MESSAGES, locale);
}

export function getMessages(locale: Locale): UiMessages {
  return UI_MESSAGES[locale] || UI_MESSAGES.en;
}

export function interpolate(message: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    message,
  );
}
