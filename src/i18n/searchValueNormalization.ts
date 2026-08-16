type SearchValueField = "vehicle_type" | "body_type" | "fuel_type" | "transmission";

const aliases: Record<SearchValueField, Record<string, string[]>> = {
  vehicle_type: {
    passenger_car: ["pkw", "легковой автомобиль", "легковий автомобіль", "passenger car"],
    electric_vehicle: ["elektrofahrzeug", "электромобиль", "електромобіль", "electric vehicle"],
    commercial_vehicle: ["nutzfahrzeug", "коммерческий транспорт", "комерційний транспорт", "commercial vehicle"],
    motorcycle: ["motorrad", "мотоцикл", "motorcycle"],
    truck: ["lkw", "грузовой транспорт", "вантажний транспорт", "truck"],
    trailer: ["anhänger", "прицеп", "причіп", "trailer"],
  },
  body_type: {
    sedan: ["limousine", "седан", "sedan"],
    wagon: ["kombi", "универсал", "універсал", "wagon"],
    hatchback: ["schrägheck", "хэтчбек", "хетчбек", "hatchback"],
    coupe: ["coupé", "купе", "coupe"],
    convertible: ["cabriolet", "кабриолет", "кабріолет", "convertible"],
    suv: ["suv / geländewagen", "внедорожник / suv", "позашляховик / suv", "suv"],
    crossover: ["кроссовер", "кросовер", "crossover"],
    minivan: ["van / minivan", "минивэн", "мінівен", "minivan"],
    van: ["kastenwagen", "фургон", "van"],
    pickup: ["пикап", "пікап", "pickup"],
    limousine: ["stretchlimousine", "лимузин", "limousine"],
  },
  fuel_type: {
    petrol: ["benzin", "бензин", "petrol", "gasoline"],
    diesel: ["diesel", "дизель"],
    lpg: ["autogas / lpg", "газ / lpg", "lpg"],
    hybrid: ["hybrid", "гибрид", "гібрид"],
    plugin_hybrid: ["plug-in-hybrid", "plug-in hybrid", "плагін-гібрид", "plugin hybrid"],
    electric: ["elektro", "электро", "електро", "electric"],
    hydrogen: ["wasserstoff", "водород", "водень", "hydrogen"],
  },
  transmission: {
    manual: ["schaltgetriebe", "механика", "механіка", "manual"],
    automatic: ["automatik", "автомат", "automatic"],
    automated_manual: ["automatisiertes schaltgetriebe", "робот", "automated manual"],
    cvt: ["cvt", "вариатор", "варіатор"],
  },
};

const normalizedAliases = Object.fromEntries(Object.entries(aliases).map(([field, values]) => [
  field,
  new Map(Object.entries(values).flatMap(([code, labels]) => [[code, code], ...labels.map((label) => [label, code] as const)])),
])) as Record<SearchValueField, Map<string, string>>;

export function normalizeSearchValue(field: SearchValueField, input: unknown) {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  return normalizedAliases[field].get(raw.toLocaleLowerCase("und")) || raw;
}
