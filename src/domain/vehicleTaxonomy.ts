import { getLocaleFallbackChain } from "../i18n/locale.ts";

export const vehicleTypeCodes = [
  "passenger_car",
  "electric_car",
  "commercial_vehicle",
  "motorcycle",
  "truck",
  "trailer",
] as const;

export const bodyTypeCodes = [
  "sedan",
  "wagon",
  "hatchback",
  "coupe",
  "convertible",
  "suv",
  "crossover",
  "minivan",
  "van",
  "pickup",
  "limousine",
] as const;

export const fuelTypeCodes = [
  "petrol",
  "diesel",
  "lpg",
  "hybrid",
  "plugin_hybrid",
  "electric",
  "hydrogen",
] as const;

export const transmissionCodes = ["manual", "automatic", "automated_manual", "cvt"] as const;
export const drivetrainCodes = ["front_wheel_drive", "rear_wheel_drive", "all_wheel_drive"] as const;
export const colorCodes = [
  "white",
  "black",
  "gray",
  "silver",
  "blue",
  "red",
  "green",
  "brown",
  "beige",
  "yellow",
  "orange",
  "purple",
  "gold",
  "other",
] as const;
export const vehicleConditionCodes = ["new", "used", "accident_damaged", "needs_repair", "not_running"] as const;
export const sellerTypeCodes = ["private", "dealer"] as const;

export const vehicleTaxonomyCodes = {
  vehicle_type: vehicleTypeCodes,
  body_type: bodyTypeCodes,
  fuel_type: fuelTypeCodes,
  transmission: transmissionCodes,
  drivetrain: drivetrainCodes,
  color: colorCodes,
  vehicle_condition: vehicleConditionCodes,
  seller_type: sellerTypeCodes,
} as const;

export type VehicleTaxonomyName = keyof typeof vehicleTaxonomyCodes;
export type VehicleTaxonomyCode = (typeof vehicleTaxonomyCodes)[VehicleTaxonomyName][number];

type TaxonomyLabels = Record<string, Partial<Record<string, string>>>;

export const vehicleTaxonomyLabels: Record<VehicleTaxonomyName, TaxonomyLabels> = {
  vehicle_type: {
    passenger_car: { de: "Pkw", en: "Passenger car", ru: "Легковой автомобиль", uk: "Легковий автомобіль", "zh-Hans": "乘用车" },
    electric_car: { de: "Elektroauto", en: "Electric car", ru: "Электромобиль", uk: "Електромобіль", "zh-Hans": "电动汽车" },
    commercial_vehicle: { de: "Nutzfahrzeug", en: "Commercial vehicle", ru: "Коммерческий транспорт", uk: "Комерційний транспорт", "zh-Hans": "商用车" },
    motorcycle: { de: "Motorrad", en: "Motorcycle", ru: "Мотоцикл", uk: "Мотоцикл", "zh-Hans": "摩托车" },
    truck: { de: "Lkw", en: "Truck", ru: "Грузовой транспорт", uk: "Вантажний транспорт", "zh-Hans": "卡车" },
    trailer: { de: "Anhänger", en: "Trailer", ru: "Прицеп", uk: "Причіп", "zh-Hans": "拖车" },
  },
  body_type: {
    sedan: { de: "Limousine", en: "Sedan", ru: "Седан", uk: "Седан", "zh-Hans": "轿车" },
    wagon: { de: "Kombi", en: "Wagon", ru: "Универсал", uk: "Універсал", "zh-Hans": "旅行车" },
    hatchback: { de: "Schrägheck", en: "Hatchback", ru: "Хэтчбек", uk: "Хетчбек", "zh-Hans": "掀背车" },
    coupe: { de: "Coupé", en: "Coupe", ru: "Купе", uk: "Купе", "zh-Hans": "双门轿跑" },
    convertible: { de: "Cabrio", en: "Convertible", ru: "Кабриолет", uk: "Кабріолет", "zh-Hans": "敞篷车" },
    suv: { de: "SUV", en: "SUV", ru: "Внедорожник / SUV", uk: "Позашляховик / SUV", "zh-Hans": "SUV" },
    crossover: { de: "Crossover", en: "Crossover", ru: "Кроссовер", uk: "Кросовер", "zh-Hans": "跨界车" },
    minivan: { de: "Van", en: "Minivan", ru: "Минивэн", uk: "Мінівен", "zh-Hans": "小型货车" },
    van: { de: "Transporter", en: "Van", ru: "Фургон", uk: "Фургон", "zh-Hans": "厢式货车" },
    pickup: { de: "Pickup", en: "Pickup", ru: "Пикап", uk: "Пікап", "zh-Hans": "皮卡" },
    limousine: { de: "Stretchlimousine", en: "Limousine", ru: "Лимузин", uk: "Лімузин", "zh-Hans": "豪华轿车" },
  },
  fuel_type: {
    petrol: { de: "Benzin", en: "Petrol", ru: "Бензин", uk: "Бензин", "zh-Hans": "汽油" },
    diesel: { de: "Diesel", en: "Diesel", ru: "Дизель", uk: "Дизель", "zh-Hans": "柴油" },
    lpg: { de: "Autogas / LPG", en: "LPG", ru: "Газ / LPG", uk: "Газ / LPG", "zh-Hans": "液化石油气" },
    hybrid: { de: "Hybrid", en: "Hybrid", ru: "Гибрид", uk: "Гібрид", "zh-Hans": "混合动力" },
    plugin_hybrid: { de: "Plug-in-Hybrid", en: "Plug-in hybrid", ru: "Plug-in Hybrid", uk: "Плагін-гібрид", "zh-Hans": "插电式混合动力" },
    electric: { de: "Elektro", en: "Electric", ru: "Электро", uk: "Електро", "zh-Hans": "纯电动" },
    hydrogen: { de: "Wasserstoff", en: "Hydrogen", ru: "Водород", uk: "Водень", "zh-Hans": "氢能" },
  },
  transmission: {
    manual: { de: "Schaltgetriebe", en: "Manual", ru: "Механика", uk: "Механіка", "zh-Hans": "手动" },
    automatic: { de: "Automatik", en: "Automatic", ru: "Автомат", uk: "Автомат", "zh-Hans": "自动" },
    automated_manual: { de: "Automatisiertes Schaltgetriebe", en: "Automated manual", ru: "Робот", uk: "Робот", "zh-Hans": "自动手动" },
    cvt: { de: "CVT", en: "CVT", ru: "Вариатор", uk: "Варіатор", "zh-Hans": "无级变速" },
  },
  drivetrain: {
    front_wheel_drive: { de: "Frontantrieb", en: "Front-wheel drive", ru: "Передний", uk: "Передній", "zh-Hans": "前轮驱动" },
    rear_wheel_drive: { de: "Heckantrieb", en: "Rear-wheel drive", ru: "Задний", uk: "Задній", "zh-Hans": "后轮驱动" },
    all_wheel_drive: { de: "Allradantrieb", en: "All-wheel drive", ru: "Полный", uk: "Повний", "zh-Hans": "全轮驱动" },
  },
  color: {
    white: { de: "Weiß", en: "White", ru: "Белый", uk: "Білий", "zh-Hans": "白色" },
    black: { de: "Schwarz", en: "Black", ru: "Чёрный", uk: "Чорний", "zh-Hans": "黑色" },
    gray: { de: "Grau", en: "Gray", ru: "Серый", uk: "Сірий", "zh-Hans": "灰色" },
    silver: { de: "Silber", en: "Silver", ru: "Серебристый", uk: "Сріблястий", "zh-Hans": "银色" },
    blue: { de: "Blau", en: "Blue", ru: "Синий", uk: "Синій", "zh-Hans": "蓝色" },
    red: { de: "Rot", en: "Red", ru: "Красный", uk: "Червоний", "zh-Hans": "红色" },
    green: { de: "Grün", en: "Green", ru: "Зелёный", uk: "Зелений", "zh-Hans": "绿色" },
    brown: { de: "Braun", en: "Brown", ru: "Коричневый", uk: "Коричневий", "zh-Hans": "棕色" },
    beige: { de: "Beige", en: "Beige", ru: "Бежевый", uk: "Бежевий", "zh-Hans": "米色" },
    yellow: { de: "Gelb", en: "Yellow", ru: "Жёлтый", uk: "Жовтий", "zh-Hans": "黄色" },
    orange: { de: "Orange", en: "Orange", ru: "Оранжевый", uk: "Помаранчевий", "zh-Hans": "橙色" },
    purple: { de: "Violett", en: "Purple", ru: "Фиолетовый", uk: "Фіолетовий", "zh-Hans": "紫色" },
    gold: { de: "Gold", en: "Gold", ru: "Золотой", uk: "Золотий", "zh-Hans": "金色" },
    other: { de: "Andere", en: "Other", ru: "Другой", uk: "Інший", "zh-Hans": "其他" },
  },
  vehicle_condition: {
    new: { de: "Neu", en: "New", ru: "Новый", uk: "Новий", "zh-Hans": "新车" },
    used: { de: "Gebraucht", en: "Used", ru: "Б/у", uk: "Вживаний", "zh-Hans": "二手" },
    accident_damaged: { de: "Unfallfahrzeug", en: "Accident damaged", ru: "После ДТП", uk: "Після ДТП", "zh-Hans": "事故车" },
    needs_repair: { de: "Reparaturbedürftig", en: "Needs repair", ru: "Требует ремонта", uk: "Потребує ремонту", "zh-Hans": "需要维修" },
    not_running: { de: "Nicht fahrbereit", en: "Not running", ru: "Не на ходу", uk: "Не на ходу", "zh-Hans": "无法行驶" },
  },
  seller_type: {
    private: { de: "Privat", en: "Private", ru: "Частное лицо", uk: "Приватна особа", "zh-Hans": "个人" },
    dealer: { de: "Händler", en: "Dealer", ru: "Дилер", uk: "Дилер", "zh-Hans": "经销商" },
  },
};

export function isVehicleTaxonomyCode(taxonomy: VehicleTaxonomyName, value: unknown): value is VehicleTaxonomyCode {
  return (vehicleTaxonomyCodes[taxonomy] as readonly string[]).includes(String(value ?? ""));
}

export function getVehicleTaxonomyLabel(taxonomy: VehicleTaxonomyName, code: string, locale: string) {
  const labels = vehicleTaxonomyLabels[taxonomy][code];
  if (!labels) return code;
  for (const candidate of getLocaleFallbackChain(locale)) {
    if (labels[candidate]) return labels[candidate]!;
  }
  return code;
}

export function getVehicleTaxonomyOptions(taxonomy: VehicleTaxonomyName, locale: string) {
  return (vehicleTaxonomyCodes[taxonomy] as readonly string[]).map((code) => ({
    value: code,
    label: getVehicleTaxonomyLabel(taxonomy, code, locale),
  }));
}

export function hasCompleteVehicleTaxonomy(locale: string) {
  return (Object.keys(vehicleTaxonomyCodes) as VehicleTaxonomyName[]).every((taxonomy) => (
    (vehicleTaxonomyCodes[taxonomy] as readonly string[]).every((code) => Boolean(vehicleTaxonomyLabels[taxonomy][code]?.[locale]))
  ));
}
