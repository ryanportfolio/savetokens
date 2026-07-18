// verify.mjs - release-gate checks for the savetokens.tips design specimen.
// No dependencies. Reads index.html next to this file and fails loudly (exit 1)
// on any contract violation it can check statically. Prints PASS details on success.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "index.html");

// ---- Expected counts, encoded as constants (contract-derived) ----
const EXPECTED_TIP_ENTRIES = 1; // one complete tip entry in Application Information
const EXPECTED_FIG_SLOTS = 11; // 8 EC table slots + 1 AbsMax spec slot + 1 block-diagram delta + 1 Features headline
const EXPECTED_DATA_FIGURES = 13; // the 11 number slots + 2 provenance chips (5.1 measured, AbsMax spec)
const SNAPSHOT_LABEL = "snapshot 2026-07-18";

const EM_DASH = "—";

const errors = [];
const notes = [];

const html = readFileSync(FILE, "utf8");

// ---------- 1. Visible text: no em dash ----------
const visible = html
  .replace(/<style[\s\S]*?<\/style>/gi, "")
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<[^>]+>/g, " ");
if (visible.includes(EM_DASH)) {
  const idx = visible.indexOf(EM_DASH);
  errors.push(
    `Em dash (U+2014) found in visible text near: "...${visible.slice(Math.max(0, idx - 40), idx + 40).replace(/\s+/g, " ")}..."`
  );
} else {
  notes.push("No em dash in visible text.");
}

// ---------- 2. Snapshot label present ----------
if (!html.includes(SNAPSHOT_LABEL)) {
  errors.push(`Snapshot label "${SNAPSHOT_LABEL}" not found. Sample numbers must carry the dated snapshot label.`);
} else {
  notes.push(`Snapshot label "${SNAPSHOT_LABEL}" present.`);
}

// ---------- 3. Tip entry count ----------
const tipEntries = (html.match(/data-tip-entry/g) || []).length;
if (tipEntries !== EXPECTED_TIP_ENTRIES) {
  errors.push(`Expected ${EXPECTED_TIP_ENTRIES} tip entry (data-tip-entry), found ${tipEntries}.`);
} else {
  notes.push(`Tip entries: ${tipEntries} (expected ${EXPECTED_TIP_ENTRIES}).`);
}

// ---------- 4. Number-slot components carry a kind marker ----------
// A number slot is <span class="fig fig-m|fig-e|fig-s" ...> holding a tag span and
// a val span. Match on that fixed head so nested spans and optional superscripts
// cannot truncate the capture. Tag letter must agree with the class, and the
// tilde rule holds: forbidden on measured, mandatory on estimated and spec.
const slotOpen = [
  ...html.matchAll(
    /<span class="fig (fig-m|fig-e|fig-s)"[^>]*><span class="tag">\[([MES])\]<\/span><span class="val num">([^<]*)<\/span>/g
  ),
];
let slotCount = 0;
const TAG_FOR = { "fig-m": "M", "fig-e": "E", "fig-s": "S" };
for (const m of slotOpen) {
  slotCount++;
  const [, kindClass, tagLetter, val] = m;
  if (TAG_FOR[kindClass] !== tagLetter) {
    errors.push(`Slot #${slotCount}: class ${kindClass} carries [${tagLetter}], expected [${TAG_FOR[kindClass]}].`);
  }
  if (kindClass === "fig-m" && val.includes("~")) {
    errors.push(`Measured slot #${slotCount} carries a tilde. Tilde is forbidden on measured figures (contract 6.3).`);
  }
  if ((kindClass === "fig-e" || kindClass === "fig-s") && !val.trim().startsWith("~")) {
    errors.push(`Slot #${slotCount} (${kindClass}) lacks the mandatory leading tilde (contract 6.3). Value: ${val}`);
  }
}
if (slotCount !== EXPECTED_FIG_SLOTS) {
  errors.push(`Expected ${EXPECTED_FIG_SLOTS} number slots (class "fig"), found ${slotCount}.`);
} else {
  notes.push(`Number slots: ${slotCount} (expected ${EXPECTED_FIG_SLOTS}), each tag agrees with its class and tilde rule.`);
}

// ---------- 5. Every data-figure element declares a kind ----------
const dataFigOpen = [...html.matchAll(/data-figure(?:\s+data-kind="(measured|estimated|spec)")?/g)];
let dataFigCount = 0;
let missingKind = 0;
for (const m of dataFigOpen) {
  dataFigCount++;
  if (!m[1]) missingKind++;
}
if (missingKind > 0) {
  errors.push(`${missingKind} data-figure element(s) lack a data-kind of measured or estimated.`);
}
if (dataFigCount !== EXPECTED_DATA_FIGURES) {
  errors.push(`Expected ${EXPECTED_DATA_FIGURES} data-figure elements, found ${dataFigCount}.`);
} else {
  notes.push(`data-figure elements: ${dataFigCount} (expected ${EXPECTED_DATA_FIGURES}), all declare a kind.`);
}

// ---------- 6. Reserved footnote resolutions present ----------
if (!html.includes("Production tested")) errors.push('Reserved footnote "Production tested" resolution missing.');
if (!html.includes("Guaranteed by design")) errors.push('Reserved footnote "Guaranteed by design" resolution missing.');
if (!html.includes("Vendor specification, not measured here")) errors.push('Reserved footnote "Vendor specification, not measured here" resolution missing.');
if (!errors.some((e) => e.includes("footnote"))) notes.push("Both reserved footnote resolutions present.");

// ---------- Report ----------
if (errors.length) {
  console.error("VERIFY FAILED:");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

console.log("VERIFY PASS");
for (const n of notes) console.log("  + " + n);
console.log(`  + File: ${FILE}`);
