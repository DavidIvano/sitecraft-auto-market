import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import ts from "typescript";

const roots = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : ["src/pages", "src/components", "src/layouts", "src/lib", "src/data"];
const extensions = new Set([".astro", ".ts"]);
const phrases = new Set();

const addPhrase = (candidate) => {
  const phrase = String(candidate || "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!/[А-Яа-яЁё]/u.test(phrase)) return;
  if (phrase.length < 2 || phrase.length > 500) return;
  if (/[${}<>]/u.test(phrase)) return;
  if (/^(https?:|\/|[\w.-]+@[\w.-]+$)/iu.test(phrase)) return;
  phrases.add(phrase);
};

const visit = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filename = join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(filename);
      continue;
    }
    if (!extensions.has(extname(entry.name))) continue;

    const source = readFileSync(filename, "utf8");
    if (extname(entry.name) === ".ts") {
      const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const visitNode = (node) => {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) addPhrase(node.text);
        ts.forEachChild(node, visitNode);
      };
      visitNode(sourceFile);
      continue;
    }
    for (const match of source.matchAll(/(["'`])((?:(?!\1).)*[А-Яа-яЁё](?:(?!\1).)*)\1/gs)) {
      if (!match[2].includes("\n") && !/[;{}]|(?:const|return|querySelector|innerHTML)\s/iu.test(match[2])) addPhrase(match[2]);
    }
    for (const match of source.matchAll(/>([^<]*[А-Яа-яЁё][^<]*)</gu)) {
      addPhrase(match[1]);
    }
  }
};

for (const root of roots) visit(root);
process.stdout.write(`${JSON.stringify([...phrases].sort((left, right) => left.localeCompare(right)), null, 2)}\n`);
