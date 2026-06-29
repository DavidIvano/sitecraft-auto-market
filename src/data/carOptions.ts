export const carBrands = [
  "Audi",
  "BMW",
  "Mercedes-Benz",
  "Volkswagen",
  "Opel",
  "Ford",
  "Skoda",
  "Toyota",
  "Honda",
  "Mazda",
  "Nissan",
  "Renault",
  "Peugeot",
  "Citroën",
  "Fiat",
  "Hyundai",
  "Kia",
  "Seat",
  "Volvo",
  "Tesla",
  "Porsche",
  "Mini",
  "Dacia",
  "Mitsubishi",
  "Suzuki",
  "Subaru",
  "Lexus",
  "Land Rover",
  "Jeep",
  "Alfa Romeo",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Jaguar",
  "Smart",
];

export const carModelsByBrand: Record<string, string[]> = {
  Audi: ["A1", "A3", "A4", "A5", "A6", "A7", "A8", "Q2", "Q3", "Q5", "Q7", "Q8", "e-tron", "TT", "R8"],
  BMW: ["1 Series", "2 Series", "3 Series", "4 Series", "5 Series", "6 Series", "7 Series", "8 Series", "X1", "X3", "X5", "X6", "X7", "i3", "i4", "iX"],
  "Mercedes-Benz": ["A-Class", "B-Class", "C-Class", "E-Class", "S-Class", "CLA", "CLS", "GLA", "GLB", "GLC", "GLE", "GLS", "V-Class", "EQE", "EQS"],
  Volkswagen: ["up!", "Polo", "Golf", "Passat", "Arteon", "T-Cross", "T-Roc", "Tiguan", "Touareg", "Touran", "Sharan", "ID.3", "ID.4", "ID.5", "ID. Buzz"],
  Opel: ["Adam", "Corsa", "Astra", "Insignia", "Mokka", "Crossland", "Grandland", "Zafira", "Combo", "Vivaro"],
  Ford: ["Fiesta", "Focus", "Mondeo", "Kuga", "Puma", "EcoSport", "S-Max", "Galaxy", "Transit", "Mustang", "Ranger"],
  Skoda: ["Fabia", "Scala", "Octavia", "Superb", "Kamiq", "Karoq", "Kodiaq", "Enyaq", "Roomster", "Yeti"],
  Toyota: ["Aygo", "Yaris", "Corolla", "Camry", "C-HR", "RAV4", "Highlander", "Land Cruiser", "Prius", "Proace"],
  Honda: ["Jazz", "Civic", "Accord", "HR-V", "CR-V", "e", "ZR-V", "Prelude"],
  Mazda: ["Mazda2", "Mazda3", "Mazda6", "CX-3", "CX-30", "CX-5", "CX-60", "MX-5"],
  Nissan: ["Micra", "Juke", "Qashqai", "X-Trail", "Leaf", "Ariya", "Navara", "Townstar"],
  Renault: ["Clio", "Megane", "Talisman", "Captur", "Kadjar", "Koleos", "Scenic", "Kangoo", "Trafic", "Zoe"],
  Peugeot: ["108", "208", "308", "508", "2008", "3008", "5008", "Rifter", "Traveller"],
  "Citroën": ["C1", "C3", "C4", "C5 X", "Berlingo", "C3 Aircross", "C5 Aircross", "Spacetourer"],
  Fiat: ["500", "Panda", "Tipo", "Punto", "500X", "500L", "Doblo", "Ducato"],
  Hyundai: ["i10", "i20", "i30", "IONIQ", "IONIQ 5", "IONIQ 6", "Kona", "Tucson", "Santa Fe", "Bayon"],
  Kia: ["Picanto", "Rio", "Ceed", "ProCeed", "XCeed", "Stonic", "Niro", "Sportage", "Sorento", "EV6"],
  Seat: ["Ibiza", "Leon", "Arona", "Ateca", "Tarraco", "Alhambra", "Mii"],
  Volvo: ["S60", "S90", "V40", "V60", "V90", "XC40", "XC60", "XC90", "C40"],
  Tesla: ["Model 3", "Model S", "Model X", "Model Y", "Cybertruck"],
  Porsche: ["718", "911", "Boxster", "Cayman", "Panamera", "Macan", "Cayenne", "Taycan"],
  Mini: ["Cooper", "Clubman", "Countryman", "Cabrio", "Paceman"],
  Dacia: ["Sandero", "Logan", "Duster", "Jogger", "Spring", "Dokker", "Lodgy"],
  Mitsubishi: ["Space Star", "ASX", "Eclipse Cross", "Outlander", "L200", "Pajero"],
  Suzuki: ["Swift", "Baleno", "Ignis", "Vitara", "S-Cross", "Jimny", "Swace"],
  Subaru: ["Impreza", "Legacy", "Outback", "Forester", "XV", "BRZ", "Solterra"],
  Lexus: ["CT", "IS", "ES", "GS", "LS", "UX", "NX", "RX", "RZ", "LC"],
  "Land Rover": ["Defender", "Discovery", "Discovery Sport", "Range Rover", "Range Rover Sport", "Range Rover Velar", "Range Rover Evoque"],
  Jeep: ["Renegade", "Compass", "Cherokee", "Grand Cherokee", "Wrangler", "Gladiator", "Avenger"],
  "Alfa Romeo": ["MiTo", "Giulietta", "Giulia", "Stelvio", "Tonale", "4C"],
  Chevrolet: ["Spark", "Aveo", "Cruze", "Malibu", "Trax", "Camaro", "Corvette", "Captiva"],
  Chrysler: ["300C", "Voyager", "Grand Voyager", "Pacifica", "PT Cruiser"],
  Dodge: ["Caliber", "Journey", "Charger", "Challenger", "Durango", "Ram"],
  Jaguar: ["XE", "XF", "XJ", "F-Type", "E-Pace", "F-Pace", "I-Pace"],
  Smart: ["fortwo", "forfour", "#1", "#3"],
};

export const bodyTypes = [
  "Седан",
  "Универсал",
  "Хэтчбек",
  "Купе",
  "Кабриолет",
  "Внедорожник / SUV",
  "Кроссовер",
  "Минивэн",
  "Фургон",
  "Пикап",
  "Лимузин",
];

export const fuelTypes = [
  "Бензин",
  "Дизель",
  "Газ / LPG",
  "Гибрид",
  "Plug-in Hybrid",
  "Электро",
  "Водород",
];

export const transmissions = ["Механика", "Автомат", "Робот", "Вариатор"];

export const drivetrains = ["Передний", "Задний", "Полный"];

export const doorCounts = ["2/3", "4/5"];

export const seatCounts = ["2", "4", "5", "6", "7", "8+"];

export const colors = [
  "Белый",
  "Чёрный",
  "Серый",
  "Серебристый",
  "Синий",
  "Красный",
  "Зелёный",
  "Коричневый",
  "Бежевый",
  "Жёлтый",
  "Оранжевый",
  "Фиолетовый",
  "Золотой",
  "Другой",
];

export const carConditions = [
  "Новый",
  "Б/у",
  "После ДТП",
  "Требует ремонта",
  "Не на ходу",
];

export const sellerTypes = ["Частное лицо", "Автосалон", "Дилер"];
