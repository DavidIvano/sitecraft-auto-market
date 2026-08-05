import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCarSearchIntent } from "../src/lib/ai/parseCarSearchIntent.ts";
import {
  applyBuyerSearchCriteriaToParams,
  getBuyerSearchClarifications,
  getBuyerSearchCriteriaFromParams,
  getBuyerSearchMatchReasons,
  getBuyerSearchRelaxations,
  normalizeBuyerSearchCriteria,
} from "../src/lib/buyer-search/model.ts";

const root = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, root), "utf8");

test("AI intent parser extracts only supported, explicit vehicle criteria", () => {
  const result = parseCarSearchIntent("BMW X5 дизель автомат до 10 000 EUR после 2015 года, пробег до 150 000 км");

  assert.equal(result.filters.brand, "BMW");
  assert.equal(result.filters.model, "X5");
  assert.equal(result.filters.fuel_type, "Дизель");
  assert.equal(result.filters.transmission, "Автомат");
  assert.equal(result.filters.price_max, 10_000);
  assert.equal(result.filters.year_min, 2015);
  assert.equal(result.filters.mileage_max, 150_000);
});

test("unsupported AI values are rejected instead of becoming invented filters", () => {
  assert.deepEqual(normalizeBuyerSearchCriteria({
    brand: "Imaginary Motors",
    body_type: "Летающий",
    fuel_type: "Вода",
    price_max: -100,
    model: "Valid free text",
    city: "Berlin",
  }), {
    model: "Valid free text",
    city: "Berlin",
  });
});

test("at least 80 percent of representative prompts produce valid filters or clarification", () => {
  const prompts = [
    "BMW X5 до 10000 евро",
    "семейный дизель до 7000 евро рядом с Braunschweig",
    "автомат после 2015 года пробег до 120000 км",
    "Volkswagen Golf",
    "электромобиль",
    "нужна удобная машина",
    "Audi универсал",
    "машина в Berlin",
    "кабриолет бензин",
    "что-нибудь для города",
  ];

  const handled = prompts.filter((query) => {
    const result = parseCarSearchIntent(query);
    return Object.keys(result.filters).length > 0 || getBuyerSearchClarifications(query, result.filters).length > 0;
  });

  assert.ok(handled.length / prompts.length >= 0.8, `${handled.length} of ${prompts.length} prompts handled`);
});

test("criteria remain round-trippable and manually editable in the URL", () => {
  const params = applyBuyerSearchCriteriaToParams(new URLSearchParams("sort=price_asc"), {
    brand: "Skoda",
    price_max: 9_500,
    fuel_type: "Дизель",
  }, { replace: true });

  assert.equal(params.get("sort"), "price_asc");
  assert.deepEqual(getBuyerSearchCriteriaFromParams(params), {
    brand: "Skoda",
    fuel_type: "Дизель",
    price_max: 9_500,
  });
});

test("match explanations use listing facts and zero-result actions change one criterion", () => {
  const criteria = { brand: "Skoda", price_max: 10_000, city: "Berlin", mileage_max: 150_000 };
  const reasons = getBuyerSearchMatchReasons({
    brand: "Skoda",
    price: 8_900,
    city: "Berlin Mitte",
    mileage: 130_000,
  }, criteria);

  assert.deepEqual(reasons, ["Марка Skoda", "Цена в бюджете до 10 000 EUR", "Пробег до 150 000 км"]);
  const relaxations = getBuyerSearchRelaxations(criteria);
  assert.equal(relaxations[0]?.remove, "city");
  assert.equal(relaxations[1]?.changes?.price_max, 11_500);
});

test("catalog exposes one workflow, editable criteria, cost, reasons and recovery", () => {
  const catalog = readProjectFile("src/pages/cars/index.astro");
  const searchBar = readProjectFile("src/components/SearchBar.astro");
  const messages = readProjectFile("src/i18n/catalogMessages.ts");

  assert.match(catalog, /messages\.aiTitle/);
  assert.match(catalog, /interpolate\(messages\.aiSubmit, \{ count: aiSearchPolicy\.cost \}\)/);
  assert.match(catalog, /id="buyer-applied-criteria"/);
  assert.match(catalog, /id="buyer-search-clarifications"/);
  assert.match(catalog, /getBuyerSearchMatchReasons/);
  assert.match(catalog, /data-relaxation-id/);
  assert.match(searchBar, /messages\.applyFree/);
  assert.match(messages, /aiTitle: "Найдите автомобиль одним запросом"/);
  assert.match(messages, /aiTitle: "Finden Sie ein Auto mit einer Anfrage"/);
  assert.match(messages, /aiTitle: "Знайдіть автомобіль одним запитом"/);
  assert.match(messages, /aiTitle: "Find a car with one request"/);
  assert.match(searchBar, /name="fuel_type"/);
  assert.match(searchBar, /name="transmission"/);
  assert.match(searchBar, /name="mileage_max"/);
});
