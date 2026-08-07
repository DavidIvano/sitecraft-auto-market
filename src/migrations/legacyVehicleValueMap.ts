import {
  isVehicleTaxonomyCode,
  type VehicleTaxonomyName,
} from "../domain/vehicleTaxonomy.ts";

const normalizeLegacyKey = (value: unknown) => String(value ?? "")
  .normalize("NFKC")
  .trim()
  .toLowerCase()
  .replaceAll("ё", "е")
  .replace(/[‐‑‒–—−]/g, "-")
  .replace(/\s*[/|]\s*/g, "/")
  .replace(/\s+/g, " ");

const map = (entries: Record<string, string>) => new Map(
  Object.entries(entries).map(([legacy, code]) => [normalizeLegacyKey(legacy), code]),
);

export const legacyVehicleValueMaps: Record<VehicleTaxonomyName, Map<string, string>> = {
  vehicle_type: map({
    "Легковой автомобиль": "passenger_car", "Passenger car": "passenger_car", Pkw: "passenger_car",
    Электромобиль: "electric_car", "Electric car": "electric_car", Elektroauto: "electric_car",
    "Коммерческий транспорт": "commercial_vehicle", "Commercial vehicle": "commercial_vehicle", Nutzfahrzeug: "commercial_vehicle",
    Мотоцикл: "motorcycle", Motorcycle: "motorcycle", Motorrad: "motorcycle",
    "Грузовой транспорт": "truck", Truck: "truck", Lkw: "truck",
    Прицеп: "trailer", Trailer: "trailer", Anhänger: "trailer",
  }),
  body_type: map({
    Седан: "sedan", Sedan: "sedan", Limousine: "sedan",
    Универсал: "wagon", Wagon: "wagon", Kombi: "wagon",
    Хэтчбек: "hatchback", Хетчбек: "hatchback", Hatchback: "hatchback", Schrägheck: "hatchback",
    Купе: "coupe", Coupe: "coupe", Coupé: "coupe",
    Кабриолет: "convertible", Convertible: "convertible", Cabrio: "convertible",
    "Внедорожник / SUV": "suv", "Внедорожник/SUV": "suv", SUV: "suv",
    Кроссовер: "crossover", Crossover: "crossover",
    Минивэн: "minivan", Minivan: "minivan", Van: "minivan",
    Фургон: "van", Transporter: "van",
    Пикап: "pickup", Pickup: "pickup",
    Лимузин: "limousine", Stretchlimousine: "limousine",
  }),
  fuel_type: map({
    Бензин: "petrol", Petrol: "petrol", Gasoline: "petrol", Benzin: "petrol",
    Дизель: "diesel", Diesel: "diesel",
    "Газ / LPG": "lpg", "Газ/LPG": "lpg", LPG: "lpg", Autogas: "lpg",
    Гибрид: "hybrid", Гібрид: "hybrid", Hybrid: "hybrid",
    "Plug-in Hybrid": "plugin_hybrid", "Plug-in-Hybrid": "plugin_hybrid", PHEV: "plugin_hybrid",
    Электро: "electric", Електро: "electric", Electric: "electric", Elektro: "electric",
    Водород: "hydrogen", Водень: "hydrogen", Hydrogen: "hydrogen", Wasserstoff: "hydrogen",
  }),
  transmission: map({
    Механика: "manual", Механіка: "manual", Manual: "manual", Schaltgetriebe: "manual",
    Автомат: "automatic", Automatic: "automatic", Automatik: "automatic",
    Робот: "automated_manual", "Automated manual": "automated_manual", Halbautomatik: "automated_manual",
    Вариатор: "cvt", Варіатор: "cvt", CVT: "cvt",
  }),
  drivetrain: map({
    Передний: "front_wheel_drive", Передній: "front_wheel_drive", FWD: "front_wheel_drive", Frontantrieb: "front_wheel_drive",
    Задний: "rear_wheel_drive", Задній: "rear_wheel_drive", RWD: "rear_wheel_drive", Heckantrieb: "rear_wheel_drive",
    Полный: "all_wheel_drive", Повний: "all_wheel_drive", AWD: "all_wheel_drive", "4WD": "all_wheel_drive", Allrad: "all_wheel_drive", Allradantrieb: "all_wheel_drive",
  }),
  color: map({
    Белый: "white", Білий: "white", White: "white", Weiß: "white",
    Черный: "black", Чёрный: "black", Чорний: "black", Black: "black", Schwarz: "black",
    Серый: "gray", Сірий: "gray", Gray: "gray", Grey: "gray", Grau: "gray",
    Серебристый: "silver", Сріблястий: "silver", Silver: "silver", Silber: "silver",
    Синий: "blue", Синій: "blue", Blue: "blue", Blau: "blue",
    Красный: "red", Червоний: "red", Red: "red", Rot: "red",
    Зеленый: "green", Зелёный: "green", Зелений: "green", Green: "green", Grün: "green",
    Коричневый: "brown", Коричневий: "brown", Brown: "brown", Braun: "brown",
    Бежевый: "beige", Бежевий: "beige", Beige: "beige",
    Желтый: "yellow", Жёлтый: "yellow", Жовтий: "yellow", Yellow: "yellow", Gelb: "yellow",
    Оранжевый: "orange", Помаранчевий: "orange", Orange: "orange",
    Фиолетовый: "purple", Фіолетовий: "purple", Purple: "purple", Violett: "purple",
    Золотой: "gold", Золотий: "gold", Gold: "gold",
    Другой: "other", Інший: "other", Other: "other", Andere: "other",
  }),
  vehicle_condition: map({
    Новый: "new", Новий: "new", New: "new", Neu: "new",
    "Б/у": "used", Бу: "used", Used: "used", Gebraucht: "used",
    "После ДТП": "accident_damaged", "Після ДТП": "accident_damaged", "Accident damaged": "accident_damaged", Unfallfahrzeug: "accident_damaged",
    "Требует ремонта": "needs_repair", "Потребує ремонту": "needs_repair", "Needs repair": "needs_repair", Reparaturbedürftig: "needs_repair",
    "Не на ходу": "not_running", "Not running": "not_running", "Nicht fahrbereit": "not_running",
  }),
  seller_type: map({
    "Частное лицо": "private", "Частный продавец": "private", "Приватна особа": "private", Private: "private", Privat: "private",
    Автосалон: "dealer", Дилер: "dealer", Dealer: "dealer", Händler: "dealer",
  }),
};

export type LegacyValueMigrationResult = {
  code: string | null;
  migration_status: "already_canonical" | "mapped" | "empty" | "needs_review";
  legacy_value?: string;
};

export function mapLegacyVehicleValue(
  taxonomy: VehicleTaxonomyName,
  value: unknown,
): LegacyValueMigrationResult {
  const legacyValue = String(value ?? "").trim();
  if (!legacyValue) return { code: null, migration_status: "empty" };
  if (isVehicleTaxonomyCode(taxonomy, legacyValue)) {
    return { code: legacyValue, migration_status: "already_canonical" };
  }

  const code = legacyVehicleValueMaps[taxonomy].get(normalizeLegacyKey(legacyValue));
  if (code) return { code, migration_status: "mapped", legacy_value: legacyValue };
  return { code: null, migration_status: "needs_review", legacy_value: legacyValue };
}
