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
  Audi: ["80", "90", "100", "A1", "A2", "A3", "A4", "A4 allroad", "A5", "A6", "A6 allroad", "A7", "A8", "Q2", "Q3", "Q4 e-tron", "Q5", "Q7", "Q8", "e-tron", "e-tron GT", "RS3", "RS4", "RS5", "RS6", "RS7", "S3", "S4", "S5", "S6", "S7", "S8", "TT", "R8"],
  BMW: ["1 Series", "2 Series", "2 Series Active Tourer", "3 Series", "3 Series Touring", "4 Series", "5 Series", "5 Series Touring", "6 Series", "7 Series", "8 Series", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "Z3", "Z4", "i3", "i4", "i5", "i7", "i8", "iX", "iX1", "iX3", "M2", "M3", "M4", "M5", "M8"],
  "Mercedes-Benz": ["A-Class", "B-Class", "C-Class", "C-Class T-Modell", "E-Class", "E-Class T-Modell", "S-Class", "CLA", "CLC", "CLK", "CLS", "CLE", "G-Class", "GLA", "GLB", "GLC", "GLE", "GLK", "GLS", "M-Class", "SL", "SLC", "SLK", "Sprinter", "V-Class", "Vito", "EQB", "EQC", "EQE", "EQS", "EQA"],
  Volkswagen: ["up!", "Lupo", "Polo", "Golf", "Golf Plus", "Golf Sportsvan", "Jetta", "Bora", "Passat", "Passat Variant", "Arteon", "Beetle", "Scirocco", "T-Cross", "T-Roc", "Taigo", "Tiguan", "Tiguan Allspace", "Touareg", "Touran", "Sharan", "Caddy", "Transporter", "Crafter", "Amarok", "ID.3", "ID.4", "ID.5", "ID.7", "ID. Buzz"],
  Opel: ["Adam", "Agila", "Ampera", "Antara", "Corsa", "Astra", "Cascada", "Combo", "Crossland", "Frontera", "Grandland", "Insignia", "Karl", "Meriva", "Mokka", "Omega", "Signum", "Tigra", "Vectra", "Vivaro", "Zafira"],
  Ford: ["B-Max", "C-Max", "EcoSport", "Edge", "Explorer", "Fiesta", "Focus", "Fusion", "Galaxy", "Ka", "Kuga", "Maverick", "Mondeo", "Mustang", "Mustang Mach-E", "Puma", "Ranger", "S-Max", "Tourneo", "Transit"],
  Skoda: ["Citigo", "Enyaq", "Fabia", "Favorit", "Felicia", "Kamiq", "Karoq", "Kodiaq", "Octavia", "Praktik", "Rapid", "Roomster", "Scala", "Superb", "Yeti"],
  Toyota: ["Aygo", "Yaris", "Yaris Cross", "Corolla", "Corolla Verso", "Auris", "Avensis", "Camry", "C-HR", "GT86", "GR86", "Highlander", "Hilux", "Land Cruiser", "Mirai", "Prius", "Proace", "RAV4", "Supra", "Verso"],
  Honda: ["Accord", "Civic", "CR-V", "CR-Z", "e", "FR-V", "HR-V", "Insight", "Jazz", "Legend", "NSX", "Prelude", "S2000", "ZR-V"],
  Mazda: ["121", "2", "3", "5", "6", "MX-3", "MX-5", "RX-8", "CX-3", "CX-30", "CX-5", "CX-7", "CX-9", "CX-60", "CX-80", "Mazda2", "Mazda3", "Mazda5", "Mazda6"],
  Nissan: ["350Z", "370Z", "Almera", "Ariya", "Cube", "GT-R", "Juke", "Leaf", "Micra", "Murano", "Navara", "Note", "Pathfinder", "Primastar", "Pulsar", "Qashqai", "Terrano", "Townstar", "X-Trail"],
  Renault: ["Arkana", "Austral", "Captur", "Clio", "Espace", "Grand Scenic", "Kadjar", "Kangoo", "Koleos", "Laguna", "Megane", "Modus", "Scenic", "Talisman", "Trafic", "Twingo", "Vel Satis", "Zoe"],
  Peugeot: ["106", "107", "108", "206", "207", "208", "306", "307", "308", "406", "407", "508", "1007", "2008", "3008", "5008", "Partner", "Rifter", "RCZ", "Traveller"],
  "Citroën": ["AX", "Berlingo", "C1", "C2", "C3", "C3 Aircross", "C4", "C4 Cactus", "C4 Picasso", "C5", "C5 Aircross", "C5 X", "C6", "C8", "DS3", "DS4", "DS5", "Jumpy", "Saxo", "Spacetourer", "Xsara"],
  Fiat: ["500", "500C", "500L", "500X", "Barchetta", "Bravo", "Croma", "Doblo", "Ducato", "Fiorino", "Freemont", "Grande Punto", "Idea", "Multipla", "Panda", "Punto", "Qubo", "Scudo", "Sedici", "Stilo", "Tipo", "Ulysse"],
  Hyundai: ["Accent", "Atos", "Bayon", "Coupe", "Elantra", "Getz", "Grandeur", "i10", "i20", "i30", "i40", "IONIQ", "IONIQ 5", "IONIQ 6", "ix20", "ix35", "Kona", "Matrix", "Santa Fe", "Sonata", "Terracan", "Trajet", "Tucson", "Veloster"],
  Kia: ["Carens", "Carnival", "Ceed", "Cerato", "EV3", "EV6", "EV9", "Magentis", "Niro", "Opirus", "Optima", "Picanto", "ProCeed", "Rio", "Sorento", "Soul", "Sportage", "Stinger", "Stonic", "Venga", "XCeed"],
  Seat: ["Alhambra", "Altea", "Arona", "Arosa", "Ateca", "Cordoba", "Exeo", "Ibiza", "Leon", "Mii", "Tarraco", "Toledo"],
  Volvo: ["C30", "C40", "C70", "EX30", "EX90", "S40", "S60", "S80", "S90", "V40", "V50", "V60", "V70", "V90", "XC40", "XC60", "XC70", "XC90"],
  Tesla: ["Model 3", "Model S", "Model X", "Model Y", "Cybertruck", "Roadster"],
  Porsche: ["356", "718", "911", "924", "928", "944", "968", "Boxster", "Cayman", "Cayenne", "Macan", "Panamera", "Taycan"],
  Mini: ["Cooper", "Cooper S", "Clubman", "Countryman", "Cabrio", "Coupe", "Paceman", "Roadster"],
  Dacia: ["Dokker", "Duster", "Jogger", "Lodgy", "Logan", "Logan MCV", "Sandero", "Sandero Stepway", "Spring"],
  Mitsubishi: ["ASX", "Carisma", "Colt", "Eclipse Cross", "Galant", "Grandis", "L200", "Lancer", "Outlander", "Pajero", "Space Star"],
  Suzuki: ["Across", "Alto", "Baleno", "Grand Vitara", "Ignis", "Jimny", "Kizashi", "S-Cross", "Splash", "Swift", "Swace", "SX4", "Vitara", "Wagon R+"],
  Subaru: ["BRZ", "Forester", "Impreza", "Justy", "Legacy", "Levorg", "Outback", "Solterra", "Tribeca", "WRX", "XV"],
  Lexus: ["CT", "ES", "GS", "IS", "LC", "LS", "NX", "RC", "RX", "RZ", "SC", "UX"],
  "Land Rover": ["Defender", "Discovery", "Discovery Sport", "Freelander", "Range Rover", "Range Rover Evoque", "Range Rover Sport", "Range Rover Velar"],
  Jeep: ["Avenger", "Cherokee", "Commander", "Compass", "Gladiator", "Grand Cherokee", "Patriot", "Renegade", "Wrangler"],
  "Alfa Romeo": ["145", "147", "156", "159", "166", "4C", "Brera", "Giulia", "Giulietta", "GT", "MiTo", "Spider", "Stelvio", "Tonale"],
  Chevrolet: ["Aveo", "Camaro", "Captiva", "Corvette", "Cruze", "Epica", "Kalos", "Lacetti", "Malibu", "Matiz", "Orlando", "Spark", "Trax", "Volt"],
  Chrysler: ["300C", "Crossfire", "Grand Voyager", "Neon", "Pacifica", "PT Cruiser", "Sebring", "Voyager"],
  Dodge: ["Avenger", "Caliber", "Challenger", "Charger", "Durango", "Journey", "Nitro", "Ram", "Viper"],
  Jaguar: ["E-Pace", "F-Pace", "F-Type", "I-Pace", "S-Type", "XE", "XF", "XJ", "XK"],
  Smart: ["#1", "#3", "city-coupe", "forfour", "fortwo", "roadster"],
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

export const engineVolumeOptionsByFuel: Record<string, string[]> = {
  "Бензин": ["0.8 л", "1.0 л", "1.2 л", "1.3 л", "1.4 л", "1.5 л", "1.6 л", "1.8 л", "2.0 л", "2.2 л", "2.3 л", "2.4 л", "2.5 л", "2.7 л", "3.0 л", "3.2 л", "3.5 л", "4.0 л", "4.2 л", "4.4 л", "4.8 л", "5.0 л", "5.5 л", "6.0 л", "6.2 л", "6.3 л", "6.5 л"],
  "Дизель": ["1.0 л", "1.2 л", "1.3 л", "1.4 л", "1.5 л", "1.6 л", "1.7 л", "1.9 л", "2.0 л", "2.2 л", "2.3 л", "2.4 л", "2.5 л", "2.7 л", "3.0 л", "3.2 л", "3.5 л", "4.0 л", "4.2 л", "4.4 л", "5.0 л", "6.0 л"],
  "Газ / LPG": ["1.0 л", "1.2 л", "1.4 л", "1.6 л", "1.8 л", "2.0 л", "2.4 л", "2.5 л", "3.0 л", "3.5 л", "4.0 л"],
  "Гибрид": ["1.0 л", "1.2 л", "1.4 л", "1.5 л", "1.6 л", "1.8 л", "2.0 л", "2.4 л", "2.5 л", "3.0 л", "3.5 л", "4.0 л"],
  "Plug-in Hybrid": ["1.0 л", "1.2 л", "1.4 л", "1.5 л", "1.6 л", "1.8 л", "2.0 л", "2.4 л", "2.5 л", "3.0 л", "3.5 л", "4.0 л"],
  "Электро": ["Электромотор", "До 40 кВт⋅ч", "40-60 кВт⋅ч", "60-80 кВт⋅ч", "80-100 кВт⋅ч", "100+ кВт⋅ч"],
  "Водород": ["Электромотор / водород"],
};

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
