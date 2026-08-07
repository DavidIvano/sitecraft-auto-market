import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTranslationSourceDocument,
  hashTranslationSource,
  serializeTranslationSource,
} from "../src/i18n/sourceHash.ts";

const fixture = {
  title: "Audi A3",
  description: "Описание",
  seo_title: "",
  seo_description: "",
  source_locale: "ru",
};

test("translation source document has stable keys and null semantics", () => {
  assert.deepEqual(buildTranslationSourceDocument(fixture), {
    title: "Audi A3",
    description: "Описание",
    seo_title: null,
    seo_description: null,
    image_alt_texts: null,
    search_keywords: null,
    source_locale: "ru",
    schema_version: "listing-i18n-v1",
  });
  assert.equal(
    serializeTranslationSource(fixture),
    '{"title":"Audi A3","description":"Описание","seo_title":null,"seo_description":null,"image_alt_texts":null,"search_keywords":null,"source_locale":"ru","schema_version":"listing-i18n-v1"}',
  );
});

test("translation hash normalizes line endings, whitespace and Unicode NFC", async () => {
  const canonical = await hashTranslationSource(fixture);
  const decomposed = await hashTranslationSource({
    ...fixture,
    title: "  Audi A3  ",
    description: "Cafe\u0301\r\n",
  });
  const composed = await hashTranslationSource({
    ...fixture,
    description: "Café\n",
  });

  assert.match(canonical, /^[a-f0-9]{64}$/);
  assert.equal(canonical, "f7ee58d56f5dffa657d1b951bbc39393888217f85efb669283a0ca0b23d8f788");
  assert.equal(decomposed, composed);
  assert.notEqual(canonical, decomposed);
});

test("non-translatable fields do not affect source hash", async () => {
  const baseline = await hashTranslationSource(fixture);
  const withOperationalFields = await hashTranslationSource({
    ...fixture,
    price: 5000,
    mileage: 120000,
    status: "approved",
    phone: "+49000000000",
  } as typeof fixture & Record<string, unknown>);
  assert.equal(withOperationalFields, baseline);
});

test("translatable fields and source locale change source hash", async () => {
  const baseline = await hashTranslationSource(fixture);
  assert.notEqual(await hashTranslationSource({ ...fixture, description: "Neu" }), baseline);
  assert.notEqual(await hashTranslationSource({ ...fixture, source_locale: "de" }), baseline);
  assert.notEqual(await hashTranslationSource({ ...fixture, search_keywords: ["Audi", "A3"] }), baseline);
});
