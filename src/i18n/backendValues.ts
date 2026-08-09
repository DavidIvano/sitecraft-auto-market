import type { Locale } from "./locales.ts";
import { translateArTrPhrase } from "./arTrTranslations.ts";

export type BackendValueField =
  | "vehicle_type"
  | "body_type"
  | "fuel_type"
  | "transmission"
  | "drivetrain"
  | "color"
  | "vehicle_condition"
  | "seller_type"
  | "country";

type LocalizedValue = {
  code: string;
  labels: Record<Locale, string>;
  legacy?: string[];
};

const value = (
  code: string,
  de: string,
  ru: string,
  uk: string,
  en: string,
  legacy: string[] = [],
): LocalizedValue => ({
  code,
  labels: {
    de,
    ru,
    uk,
    en,
    ar: translateArTrPhrase(ru, "ar"),
    tr: translateArTrPhrase(ru, "tr"),
  },
  legacy,
});

export const BACKEND_VALUE_CATALOG: Record<BackendValueField, readonly LocalizedValue[]> = {
  vehicle_type: [
    value("passenger_car", "Pkw", "Легковой автомобиль", "Легковий автомобіль", "Passenger car"),
    value("electric_vehicle", "Elektrofahrzeug", "Электромобиль", "Електромобіль", "Electric vehicle"),
    value("commercial_vehicle", "Nutzfahrzeug", "Коммерческий транспорт", "Комерційний транспорт", "Commercial vehicle"),
    value("motorcycle", "Motorrad", "Мотоцикл", "Мотоцикл", "Motorcycle"),
    value("truck", "Lkw", "Грузовой транспорт", "Вантажний транспорт", "Truck"),
    value("trailer", "Anhänger", "Прицеп", "Причіп", "Trailer"),
  ],
  body_type: [
    value("sedan", "Limousine", "Седан", "Седан", "Sedan"),
    value("wagon", "Kombi", "Универсал", "Універсал", "Wagon"),
    value("hatchback", "Schrägheck", "Хэтчбек", "Хетчбек", "Hatchback"),
    value("coupe", "Coupé", "Купе", "Купе", "Coupe"),
    value("convertible", "Cabriolet", "Кабриолет", "Кабріолет", "Convertible"),
    value("suv", "SUV / Geländewagen", "Внедорожник / SUV", "Позашляховик / SUV", "SUV"),
    value("crossover", "Crossover", "Кроссовер", "Кросовер", "Crossover"),
    value("minivan", "Van / Minivan", "Минивэн", "Мінівен", "Minivan"),
    value("van", "Kastenwagen", "Фургон", "Фургон", "Van"),
    value("pickup", "Pickup", "Пикап", "Пікап", "Pickup"),
    value("limousine", "Stretchlimousine", "Лимузин", "Лімузин", "Limousine"),
  ],
  fuel_type: [
    value("petrol", "Benzin", "Бензин", "Бензин", "Petrol", ["gasoline"]),
    value("diesel", "Diesel", "Дизель", "Дизель", "Diesel"),
    value("lpg", "Autogas / LPG", "Газ / LPG", "Газ / LPG", "LPG"),
    value("hybrid", "Hybrid", "Гибрид", "Гібрид", "Hybrid"),
    value("plugin_hybrid", "Plug-in-Hybrid", "Plug-in Hybrid", "Плагін-гібрид", "Plug-in hybrid", ["plug-in hybrid"]),
    value("electric", "Elektro", "Электро", "Електро", "Electric"),
    value("hydrogen", "Wasserstoff", "Водород", "Водень", "Hydrogen"),
  ],
  transmission: [
    value("manual", "Schaltgetriebe", "Механика", "Механіка", "Manual"),
    value("automatic", "Automatik", "Автомат", "Автомат", "Automatic"),
    value("automated_manual", "Automatisiertes Schaltgetriebe", "Робот", "Робот", "Automated manual"),
    value("cvt", "CVT", "Вариатор", "Варіатор", "CVT"),
  ],
  drivetrain: [
    value("front_wheel_drive", "Frontantrieb", "Передний", "Передній", "Front-wheel drive", ["fwd"]),
    value("rear_wheel_drive", "Hinterradantrieb", "Задний", "Задній", "Rear-wheel drive", ["rwd"]),
    value("all_wheel_drive", "Allradantrieb", "Полный", "Повний", "All-wheel drive", ["awd", "4wd"]),
  ],
  color: [
    value("white", "Weiß", "Белый", "Білий", "White"),
    value("black", "Schwarz", "Чёрный", "Чорний", "Black", ["Черный"]),
    value("gray", "Grau", "Серый", "Сірий", "Gray", ["grey"]),
    value("silver", "Silber", "Серебристый", "Сріблястий", "Silver"),
    value("blue", "Blau", "Синий", "Синій", "Blue"),
    value("red", "Rot", "Красный", "Червоний", "Red"),
    value("green", "Grün", "Зелёный", "Зелений", "Green"),
    value("brown", "Braun", "Коричневый", "Коричневий", "Brown"),
    value("beige", "Beige", "Бежевый", "Бежевий", "Beige"),
    value("yellow", "Gelb", "Жёлтый", "Жовтий", "Yellow"),
    value("orange", "Orange", "Оранжевый", "Помаранчевий", "Orange"),
    value("purple", "Violett", "Фиолетовый", "Фіолетовий", "Purple"),
    value("gold", "Gold", "Золотой", "Золотий", "Gold"),
    value("other", "Andere", "Другой", "Інший", "Other"),
  ],
  vehicle_condition: [
    value("new", "Neu", "Новый", "Новий", "New"),
    value("used", "Gebraucht", "Б/у", "Вживаний", "Used"),
    value("accident_damaged", "Unfallfahrzeug", "После ДТП", "Після ДТП", "Accident damaged"),
    value("needs_repair", "Reparaturbedürftig", "Требует ремонта", "Потребує ремонту", "Needs repair"),
    value("not_running", "Nicht fahrbereit", "Не на ходу", "Не на ходу", "Not running"),
  ],
  seller_type: [
    value("private", "Privat", "Частное лицо", "Приватна особа", "Private seller", ["частный продавец"]),
    value("dealership", "Autohaus", "Автосалон", "Автосалон", "Dealership", ["salon"]),
    value("dealer", "Händler", "Дилер", "Дилер", "Dealer"),
  ],
  country: [
    value("DE", "Deutschland", "Германия", "Німеччина", "Germany", ["de", "germany"]),
  ],
};

const normalize = (input: unknown) => String(input ?? "").trim().toLocaleLowerCase("und");

function aliases(item: LocalizedValue) {
  return [item.code, ...Object.values(item.labels), ...(item.legacy || [])].map(normalize);
}

export function normalizeBackendValue(field: BackendValueField, input: unknown): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  return BACKEND_VALUE_CATALOG[field].find((item) => aliases(item).includes(normalize(raw)))?.code || raw;
}

export function translateBackendValue(
  field: BackendValueField,
  input: unknown,
  locale: Locale,
): string {
  const code = normalizeBackendValue(field, input);
  const labels = BACKEND_VALUE_CATALOG[field].find((item) => item.code === code)?.labels;
  return labels?.[locale] || labels?.en || code;
}

export function getBackendValueOptions(field: BackendValueField, locale: Locale) {
  return BACKEND_VALUE_CATALOG[field].map((item) => ({ value: item.code, label: item.labels[locale] || item.labels.en }));
}

// Temporary write adapter. Remove it after Xano accepts canonical codes everywhere.
export function toLegacyRussianValue(field: BackendValueField, input: unknown): string {
  const code = normalizeBackendValue(field, input);
  return BACKEND_VALUE_CATALOG[field].find((item) => item.code === code)?.labels.ru || code;
}
