import type { AiNormalizedFields } from "./types";

type NormalizeOptions = {
  currentYear?: number;
};

type NormalizeResult = {
  fields: AiNormalizedFields;
  warnings: string[];
};

const FUEL_VALUES = {
  "Бензин": ["petrol", "gasoline", "gasolin", "benzine", "бензин"],
  "Дизель": ["diesel", "дизельный", "дизель"],
  "Газ / LPG": ["lpg", "autogas", "gas", "газ"],
  "Гибрид": ["hybrid", "гибрид"],
  "Plug-in Hybrid": ["plug-in hybrid", "plugin hybrid", "phev", "plug in", "плагин гибрид"],
  "Электро": ["electric", "electro", "ev", "электро", "электромобиль"],
  "Водород": ["hydrogen", "wasserstoff", "водород"],
} as const;

const TRANSMISSION_VALUES = {
  "Автомат": ["automatic", "auto", "автомат", "автоматическая"],
  "Механика": ["manual", "механика", "механическая"],
  "Робот": ["robot", "робот", "robotic", "dsg"],
  "Вариатор": ["cvt", "вариатор"],
} as const;

const DRIVETRAIN_VALUES = {
  "Передний": ["front", "front-wheel drive", "fwd", "передний"],
  "Задний": ["rear", "rear-wheel drive", "rwd", "задний"],
  "Полный": ["all-wheel drive", "four-wheel drive", "awd", "4wd", "4x4", "полный"],
} as const;

const CONDITION_VALUES = {
  "Новый": ["new", "новый"],
  "Б/у": ["used", "gebraucht", "б/у", "бу"],
  "После ДТП": ["accident", "damaged", "после дтп"],
  "Требует ремонта": ["needs repair", "repair", "требует ремонта"],
  "Не на ходу": ["not running", "не на ходу"],
} as const;

const BODY_VALUES = {
  "Седан": ["sedan", "седан"],
  "Универсал": ["wagon", "estate", "универсал"],
  "Хэтчбек": ["hatchback", "хэтчбек", "хеджбек", "хетчбек"],
  "Купе": ["coupe", "купе"],
  "Кабриолет": ["cabrio", "convertible", "кабриолет"],
  "Внедорожник / SUV": ["suv", "внедорожник", "джип"],
  "Кроссовер": ["crossover", "кроссовер"],
  "Минивэн": ["minivan", "минивэн", "минивен"],
  "Фургон": ["van", "фургон"],
  "Пикап": ["pickup", "пикап"],
  "Лимузин": ["limousine", "limo", "лимузин"],
} as const;

const COLOR_VALUES = {
  "Белый": ["white", "белый"],
  "Чёрный": ["black", "черный", "чёрный"],
  "Серый": ["grey", "gray", "серый"],
  "Серебристый": ["silver", "серебристый"],
  "Синий": ["blue", "синий"],
  "Красный": ["red", "красный"],
  "Зелёный": ["green", "зеленый", "зелёный"],
  "Коричневый": ["brown", "коричневый"],
  "Бежевый": ["beige", "бежевый"],
  "Жёлтый": ["yellow", "желтый", "жёлтый"],
  "Оранжевый": ["orange", "оранжевый"],
  "Фиолетовый": ["purple", "violet", "фиолетовый"],
  "Золотой": ["gold", "golden", "золотой"],
} as const;

const VEHICLE_VALUES = {
  "Легковой автомобиль": ["car", "passenger car", "легковой", "авто"],
  "Электромобиль": ["electric car", "электромобиль"],
  "Коммерческий транспорт": ["commercial", "van", "transporter", "коммерческий"],
  "Мотоцикл": ["motorcycle", "мотоцикл"],
  "Грузовой транспорт": ["truck", "грузовой"],
  "Прицеп": ["trailer", "прицеп"],
} as const;

function cleanValue(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeKey(value: unknown) {
  return cleanValue(value).toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\s+/g, " ");
}

function normalizeByMap(
  fieldLabel: string,
  value: unknown,
  values: Record<string, readonly string[]>,
  warnings: string[],
  fallback = "",
) {
  const source = cleanValue(value);

  if (!source) {
    return "";
  }

  const sourceKey = normalizeKey(source);
  const exactMatch = Object.keys(values).find((option) => normalizeKey(option) === sourceKey);

  if (exactMatch) {
    return exactMatch;
  }

  for (const [option, aliases] of Object.entries(values)) {
    if (aliases.some((alias) => normalizeKey(alias) === sourceKey)) {
      return option;
    }
  }

  if (fallback) {
    warnings.push(`AI вернул ${fieldLabel} "${source}", такого варианта нет в форме. Поставил "${fallback}".`);
    return fallback;
  }

  warnings.push(`AI вернул ${fieldLabel} "${source}", но такого варианта нет в форме.`);
  return "";
}

function normalizeDoors(value: unknown) {
  const source = cleanValue(value);

  if (!source) {
    return "";
  }

  if (source === "2/3" || source === "4/5") {
    return source;
  }

  const numberValue = Number(source.replace(/\D+/g, ""));

  if (numberValue === 2 || numberValue === 3) {
    return "2/3";
  }

  if (numberValue === 4 || numberValue === 5) {
    return "4/5";
  }

  return "";
}

function normalizeSeats(value: unknown) {
  const source = cleanValue(value);

  if (!source) {
    return "";
  }

  if (source === "8+") {
    return "8+";
  }

  const numberValue = Number(source.replace(/\D+/g, ""));

  if ([2, 4, 5, 6, 7].includes(numberValue)) {
    return String(numberValue);
  }

  if (numberValue >= 8) {
    return "8+";
  }

  return "";
}

function normalizeYear(value: unknown, warnings: string[], currentYear: number) {
  const source = cleanValue(value);

  if (!source) {
    return "";
  }

  const match = source.match(/\b(19|20)\d{2}\b/);
  const year = Number(match?.[0] || source);

  if (!Number.isInteger(year) || year < 1980 || year > currentYear) {
    warnings.push(`AI вернул год "${source}", но допустим диапазон 1980-${currentYear}.`);
    return "";
  }

  return String(year);
}

function normalizeMonth(value: unknown, fieldLabel: string, warnings: string[]) {
  const source = cleanValue(value);
  if (!source) return "";
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(source)) return source;
  warnings.push(`AI вернул ${fieldLabel} "${source}", но требуется формат YYYY-MM.`);
  return "";
}

function normalizeOwnersCount(value: unknown) {
  const source = cleanValue(value);
  if (!source) return "";
  if (source === "5+") return "5";
  const parsed = Number(source.replace(/\D+/g, ""));
  return Number.isInteger(parsed) && parsed > 0 ? String(parsed) : "";
}

export function normalizeAiDraftFields(input: AiNormalizedFields, options: NormalizeOptions = {}): NormalizeResult {
  const warnings: string[] = [];
  const currentYear = options.currentYear || new Date().getFullYear();
  const fields: AiNormalizedFields = {};

  fields.title = cleanValue(input.title);
  fields.brand = cleanValue(input.brand);
  fields.model = cleanValue(input.model);
  fields.year = normalizeYear(input.year, warnings, currentYear);
  fields.color = normalizeByMap("цвет", input.color, COLOR_VALUES, warnings, input.color ? "Другой" : "");
  fields.body_type = normalizeByMap("кузов", input.body_type, BODY_VALUES, warnings);
  fields.vehicle_type =
    normalizeByMap("тип транспорта", input.vehicle_type, VEHICLE_VALUES, warnings) || "Легковой автомобиль";
  fields.fuel_type = normalizeByMap("топливо", input.fuel_type, FUEL_VALUES, warnings);
  fields.transmission = normalizeByMap("коробку передач", input.transmission, TRANSMISSION_VALUES, warnings);
  fields.drivetrain = normalizeByMap("привод", input.drivetrain, DRIVETRAIN_VALUES, warnings);
  fields.doors = normalizeDoors(input.doors);
  fields.seats = normalizeSeats(input.seats);
  fields.engine_volume = cleanValue(input.engine_volume);
  fields.owners_count = normalizeOwnersCount(input.owners_count);
  fields.first_registration = normalizeMonth(input.first_registration, "дату первой регистрации", warnings);
  fields.vehicle_condition = normalizeByMap(
    "состояние автомобиля",
    input.vehicle_condition,
    CONDITION_VALUES,
    warnings,
  );
  fields.seller_type = cleanValue(input.seller_type);
  fields.seller_name = cleanValue(input.seller_name);
  fields.seller_phone = cleanValue(input.seller_phone);
  fields.seller_email = cleanValue(input.seller_email);
  fields.vin = cleanValue(input.vin).toUpperCase();
  fields.has_valid_tuv = input.has_valid_tuv === true || input.has_valid_tuv === "true"
    ? true
    : input.has_valid_tuv === false || input.has_valid_tuv === "false"
      ? false
      : null;
  fields.tuv_valid_until = normalizeMonth(input.tuv_valid_until, "срок TÜV/HU", warnings) || null;
  fields.mileage = cleanValue(input.mileage);
  fields.price = cleanValue(input.price);
  fields.currency = cleanValue(input.currency);
  fields.city = cleanValue(input.city);
  fields.country = cleanValue(input.country);
  fields.description = cleanValue(input.description);

  return {
    fields: Object.fromEntries(Object.entries(fields).filter(([, value]) => cleanValue(value))) as AiNormalizedFields,
    warnings,
  };
}
