/* Static consistency checks that need no running database:
 *
 *  1. i18n — every statically resolvable translation key used in the app
 *     exists in ALL locale catalogs, and the catalogs are congruent. Catches
 *     the common 4-locale bug (key added to de, forgotten in ar/fr/en).
 *  2. Candidate field registry — every field the portal offers is accepted
 *     by the change workflow, and the two candidate types stay separated
 *     (no Ausbildung fields for skilled workers and vice versa).
 *
 * Usage: npm run check:consistency
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { locales } from "../src/i18n/routing";
import { candidateFields, fieldsFor } from "../src/lib/candidate-fields";
import { changeableFields } from "../src/lib/domain";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

function flatten(value: unknown, prefix = "", out = new Set<string>()): Set<string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, nested] of Object.entries(value)) {
      flatten(nested, prefix ? `${prefix}.${key}` : key, out);
    }
  } else if (prefix) {
    out.add(prefix);
  }
  return out;
}

const catalogs = new Map<string, Set<string>>();
for (const locale of locales) {
  const raw = readFileSync(`messages/${locale}.json`, "utf8");
  catalogs.set(locale, flatten(JSON.parse(raw)));
}

const missing: string[] = [];
let checked = 0;
let skipped = 0;

for (const file of walk("src")) {
  const source = readFileSync(file, "utf8");

  // Map local translator variables to their namespace.
  const namespaces = new Map<string, string>();
  const declPattern =
    /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*"([^"]*)"\s*\)/g;
  for (const match of source.matchAll(declPattern)) {
    namespaces.set(match[1], match[2]);
  }

  for (const [variable, namespace] of namespaces) {
    // Static calls only: t("some.key") — template literals are dynamic.
    const callPattern = new RegExp(`\\b${variable}(?:\\.has)?\\(\\s*"([^"]+)"`, "g");
    for (const call of source.matchAll(callPattern)) {
      const full = namespace ? `${namespace}.${call[1]}` : call[1];
      checked += 1;
      for (const locale of locales) {
        if (!catalogs.get(locale)!.has(full)) {
          missing.push(`${locale}: ${full}  (${file})`);
        }
      }
    }
    if (new RegExp(`\\b${variable}\\(\\s*\``).test(source)) skipped += 1;
  }
}

// Catalogs must also agree with each other.
const reference = catalogs.get(locales[0])!;
for (const locale of locales.slice(1)) {
  const other = catalogs.get(locale)!;
  for (const key of reference) {
    if (!other.has(key)) missing.push(`${locale}: ${key}  (fehlt gegenüber ${locales[0]})`);
  }
  for (const key of other) {
    if (!reference.has(key)) missing.push(`${locales[0]}: ${key}  (fehlt gegenüber ${locale})`);
  }
}

console.log(
  `i18n: ${checked} statische Schlüsselverwendungen geprüft, ` +
    `${skipped} dynamische Aufrufstellen übersprungen, ${locales.length} Locales.`
);

if (missing.length > 0) {
  console.error(`\n${missing.length} fehlende Schlüssel:`);
  for (const entry of [...new Set(missing)].sort()) console.error(`  - ${entry}`);
  process.exit(1);
}
console.log("  Alle Kataloge vollständig und deckungsgleich.");

// ---------------------------------------------------------------------------
// 2. Candidate field registry
// ---------------------------------------------------------------------------

const registryProblems: string[] = [];

for (const field of candidateFields) {
  if (!(field.key in changeableFields)) {
    registryProblems.push(
      `${field.key}: im Portal angeboten, aber nicht in changeableFields ` +
        "(die DB-Registry würde die Einreichung ablehnen)."
    );
  }
}

const apprenticeship = fieldsFor("apprenticeship_candidate").map((f) => f.key);
const skilled = fieldsFor("skilled_worker").map((f) => f.key);

const apprenticeshipOnly = [
  "target_occupations",
  "desired_training_start",
  "school_qualification",
  "school_specialization",
  "graduation_year",
  "german_certificate_type",
  "german_certificate_status",
  "internship_experience",
  "relevant_experience",
  "motivation_summary",
];
const skilledOnly = [
  "profession",
  "years_experience",
  "highest_qualification",
  "specialization",
  "preferred_positions",
];

for (const key of apprenticeshipOnly) {
  if (!apprenticeship.includes(key)) {
    registryProblems.push(`${key}: fehlt bei apprenticeship_candidate.`);
  }
  if (skilled.includes(key)) {
    registryProblems.push(`${key}: darf skilled_worker nicht angeboten werden.`);
  }
}
for (const key of skilledOnly) {
  if (!skilled.includes(key)) {
    registryProblems.push(`${key}: fehlt bei skilled_worker.`);
  }
  if (apprenticeship.includes(key)) {
    registryProblems.push(
      `${key}: darf apprenticeship_candidate nicht angeboten werden.`
    );
  }
}
for (const key of ["german_level", "availability_date", "relocation_ready", "preferred_locations"]) {
  if (!apprenticeship.includes(key) || !skilled.includes(key)) {
    registryProblems.push(`${key}: sollte für beide Kandidatentypen gelten.`);
  }
}

console.log(
  `Feld-Registry: ${candidateFields.length} Felder, ` +
    `${apprenticeship.length} für Ausbildung, ${skilled.length} für Fachkräfte.`
);

if (registryProblems.length > 0) {
  console.error(`\n${registryProblems.length} Registry-Probleme:`);
  for (const entry of registryProblems) console.error(`  - ${entry}`);
  process.exit(1);
}
console.log("  Portal-Felder und Änderungs-Registry sind konsistent.");
