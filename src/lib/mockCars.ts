import type { CarListing } from "./types";

export const mockCars: CarListing[] = [
  {
    id: 1,
    slug: "bmw-530i-m-sport-2021",
    title: "BMW 530i M Sport",
    brand: "BMW",
    model: "530i",
    year: 2021,
    mileage: 42000,
    fuel_type: "Бензин",
    transmission: "Автомат",
    price: 42900,
    currency: "EUR",
    city: "Берлин",
    country: "Германия",
    description:
      "Ухоженный бизнес-седан с прозрачной историей, богатой комплектацией и свежим сервисом.",
    status: "approved",
    main_image_url:
      "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: 2,
    slug: "audi-q5-quattro-2020",
    title: "Audi Q5 Quattro",
    brand: "Audi",
    model: "Q5",
    year: 2020,
    mileage: 58000,
    fuel_type: "Дизель",
    transmission: "Автомат",
    price: 38900,
    currency: "EUR",
    city: "Мюнхен",
    country: "Германия",
    description:
      "Комфортный полноприводный кроссовер для города и дальних поездок.",
    status: "approved",
    main_image_url:
      "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: 3,
    slug: "mercedes-benz-c300-2022",
    title: "Mercedes-Benz C300",
    brand: "Mercedes-Benz",
    model: "C300",
    year: 2022,
    mileage: 26000,
    fuel_type: "Гибрид",
    transmission: "Автомат",
    price: 46700,
    currency: "EUR",
    city: "Гамбург",
    country: "Германия",
    description:
      "Современный премиальный седан с мягким гибридом и аккуратным салоном.",
    status: "approved",
    main_image_url:
      "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?auto=format&fit=crop&w=1200&q=80",
  },
];
