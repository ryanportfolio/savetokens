// verify.mjs - release-gate checks for the savetokens.tips design specimen.
// No dependencies. Reads index.html next to this file and fails loudly (exit 1)
// on any contract violation it can check statically. Prints PASS details on success.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "index.html");
const GUIDE_FILE = join(HERE, "guide.html");
const ABOUT_FILE = join(HERE, "about.html");
const DEPLOY_IGNORE_FILE = join(HERE, ".vercelignore");
const OG_IMAGE_FILE = join(HERE, "renders", "desktop-1440.png");

// ---- Expected counts, encoded as constants (contract-derived) ----
const EXPECTED_TIP_ENTRIES = 1; // one complete tip entry in Application Information
const EXPECTED_FIG_SLOTS = 11; // 8 EC table slots + 1 AbsMax spec slot + 1 block-diagram delta + 1 Features headline
const EXPECTED_DATA_FIGURES = 13; // the 11 number slots + 2 provenance chips (5.1 measured, AbsMax spec)
// The dated label is bound to the committed snapshot, so a stale apply run
// (HTML not regenerated after a new export) fails this gate.
const SNAPSHOT_LABEL =
  "snapshot " + JSON.parse(readFileSync(join(HERE, "data", "snapshot.json"), "utf8")).snapshotDate;

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
// Check visible text (tags stripped, whitespace collapsed) so inline markup
// like a no-break span around the date does not defeat the check.
const visibleFlat = visible.replace(/\s+/g, " ");
if (!visibleFlat.includes(SNAPSHOT_LABEL)) {
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

// ---------- 7. Deterministic GEO 100/100 release contract ----------
// These thresholds mirror geo-audit v1.3.0, the engine behind willaicite.com.
const tagText = (value) => value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const attr = (tag, name) => {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? (match[1] ?? match[2] ?? match[3] ?? "").trim() : null;
};
const meta = (key) => {
  const lowerKey = key.toLowerCase();
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const tagKey = (attr(tag, "name") ?? attr(tag, "property") ?? "").toLowerCase();
    if (tagKey === lowerKey) return attr(tag, "content");
  }
  return null;
};

const title = tagText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
if (title.length < 15 || title.length > 70) {
  errors.push(`GEO topical focus: title must be 15-70 characters, found ${title.length}.`);
} else {
  notes.push(`GEO title length: ${title.length} characters.`);
}

const description = meta("description") ?? "";
if (description.length < 50 || description.length > 170) {
  errors.push(`GEO topical focus: meta description must be 50-170 characters, found ${description.length}.`);
} else {
  notes.push(`GEO meta description length: ${description.length} characters.`);
}

const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => tagText(match[1]));
if (h1s.length !== 1) {
  errors.push(`GEO answer readiness: expected exactly one H1, found ${h1s.length}.`);
} else {
  const titleTopic = title.split("|")[0].trim();
  if (h1s[0].toLowerCase() !== titleTopic.toLowerCase()) {
    errors.push(`GEO topical focus: H1 "${h1s[0]}" must match title topic "${titleTopic}".`);
  } else {
    notes.push("GEO title and H1 topic agree.");
  }
}

if (!/<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/i.test(html)) {
  errors.push("GEO topical focus: canonical link missing.");
}
for (const key of ["og:title", "og:description", "og:image"]) {
  if (!meta(key)) errors.push(`GEO entity metadata: ${key} missing.`);
}

const jsonLdNodes = [];
for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
  try {
    const parsed = JSON.parse(match[1]);
    for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
      if (Array.isArray(node?.["@graph"])) jsonLdNodes.push(...node["@graph"]);
      else if (node && typeof node === "object") jsonLdNodes.push(node);
    }
  } catch {
    errors.push("GEO structured data: invalid JSON-LD block.");
  }
}
const jsonLdTypes = new Set(jsonLdNodes.flatMap((node) => {
  const type = node?.["@type"];
  return (Array.isArray(type) ? type : [type]).filter(Boolean).map((value) => String(value).toLowerCase());
}));
for (const type of ["organization", "techarticle", "faqpage", "person", "breadcrumblist"]) {
  if (!jsonLdTypes.has(type)) errors.push(`GEO structured data: top-level ${type} node missing.`);
}
const articleNode = jsonLdNodes.find((node) => String(node?.["@type"] ?? "").toLowerCase() === "techarticle");
if (!articleNode?.author) errors.push("GEO structured data: TechArticle author missing.");
if (!articleNode?.datePublished || !articleNode?.dateModified) {
  errors.push("GEO structured data: TechArticle must include datePublished and dateModified.");
}
if (["organization", "techarticle", "faqpage", "person", "breadcrumblist"].every((type) => jsonLdTypes.has(type))) {
  notes.push("GEO JSON-LD types satisfy the 100-point threshold.");
}

const mainHtml = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? "";
const mainText = tagText(mainHtml.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " "));
const opening = mainText.split(/\s+/).slice(0, 200).join(" ");
if (!/\bToken-saving techniques for AI coding agents are\b/i.test(opening)) {
  errors.push('GEO answer readiness: opening must contain the direct answer "Token-saving techniques for AI coding agents are ...".');
}
const questionHeadings = [...mainHtml.matchAll(/<h[2-6]\b[^>]*>([\s\S]*?)<\/h[2-6]>/gi)]
  .map((match) => tagText(match[1]))
  .filter((text) => /^(who|what|why|how|when|where|which|can|does|do|is|are|should|will)\b/i.test(text) || text.endsWith("?"));
if (questionHeadings.length < 3) {
  errors.push(`GEO answer readiness: need at least 3 question headings, found ${questionHeadings.length}.`);
}
if (!/\bFAQ\b|Frequently Asked/i.test(mainText)) errors.push("GEO answer readiness: FAQ section missing.");
if (!/<(?:ul|ol)\b/i.test(mainHtml)) errors.push("GEO answer readiness: main-content list missing.");
if (!/<table\b/i.test(mainHtml)) errors.push("GEO answer readiness: main-content table missing.");

const stats = mainText.match(/(?:[$€£]\s?\d[\d,.]*)|(?:\b\d[\d,.]*\s?(?:%|percent|million|billion|thousand|tokens?|commands?|runs?|years?)\b)/gi) ?? [];
if (stats.length < 6) errors.push(`GEO evidence density: need at least 6 statistics, found ${stats.length}.`);
const blockquotes = (mainHtml.match(/<blockquote\b[^>]*>/gi) ?? []).length;
if (blockquotes < 3) errors.push(`GEO evidence density: need at least 3 quotations, found ${blockquotes}.`);
const outbound = [...mainHtml.matchAll(/<a\b[^>]*href\s*=\s*["'](https?:\/\/[^"']+)["'][^>]*>/gi)]
  .map((match) => match[1])
  .filter((href) => {
    try { return new URL(href).hostname.replace(/^www\./, "") !== "savetokens.tips"; }
    catch { return false; }
  });
if (outbound.length < 5) errors.push(`GEO evidence density: need at least 5 outbound citations, found ${outbound.length}.`);
if (!outbound.some((href) => /\.(gov|edu)(\/|$)|arxiv\.org|acm\.org|ieee\.org/i.test(href))) {
  errors.push("GEO evidence density: authoritative-domain citation missing.");
}
if (stats.length >= 6 && blockquotes >= 3 && outbound.length >= 5) {
  notes.push(`GEO evidence density: ${stats.length} statistics, ${blockquotes} quotations, ${outbound.length} outbound citations.`);
}

if (!meta("author")) errors.push("GEO entity trust: meta author missing.");
if (!/<a\b[^>]*href\s*=\s*["']\/about["']/i.test(mainHtml)) errors.push("GEO entity trust: /about link missing.");
if (!/<a\b[^>]*>[^<]*contact[^<]*<\/a>/i.test(mainHtml) && !/href\s*=\s*["'](?:mailto:|tel:|\/contact)/i.test(mainHtml)) {
  errors.push("GEO entity trust: reachable contact route missing.");
}
if (!/<link\b[^>]*rel\s*=\s*["'][^"']*icon/i.test(html)) errors.push("GEO entity trust: favicon declaration missing.");
if (!existsSync(ABOUT_FILE)) errors.push("GEO entity trust: about.html missing.");
if (!existsSync(OG_IMAGE_FILE)) errors.push("GEO entity metadata: local og:image asset missing.");
const deployIgnore = readFileSync(DEPLOY_IGNORE_FILE, "utf8");
if (/^renders\/$/m.test(deployIgnore)) errors.push("GEO entity metadata: renders/ is excluded from the deployment package.");

// ---------- 8. Guide page (application note AN-0001) ----------
// Contract Section 1.1 binds all pages. Run the statically checkable copy and
// number-slot gates against guide.html: no em dash in visible text (copy blocks
// included, they are user-visible strings), snapshot label on cited figures,
// kind tags agreeing with slot classes, and the tilde rule.
const EXPECTED_GUIDE_FIG_SLOTS = 3; // 1 [S] context window + 1 [E] caveman + 1 [M] RTK total
if (!existsSync(GUIDE_FILE)) {
  errors.push("guide.html missing. Application note AN-0001 is linked from the datasheet.");
} else {
  const guideHtml = readFileSync(GUIDE_FILE, "utf8");
  const guideVisible = guideHtml
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ");
  if (guideVisible.includes(EM_DASH)) {
    const idx = guideVisible.indexOf(EM_DASH);
    errors.push(
      `guide.html: em dash (U+2014) found in visible text near: "...${guideVisible.slice(Math.max(0, idx - 40), idx + 40).replace(/\s+/g, " ")}..."`
    );
  } else {
    notes.push("guide.html: no em dash in visible text.");
  }
  if (!guideVisible.replace(/\s+/g, " ").includes(SNAPSHOT_LABEL)) {
    errors.push(`guide.html: snapshot label "${SNAPSHOT_LABEL}" not found. Cited figures must carry the dated snapshot label.`);
  } else {
    notes.push(`guide.html: snapshot label "${SNAPSHOT_LABEL}" present.`);
  }
  // Guide slots appear both inline (span.fig) and as the featured display figure
  // (div.big), so the match accepts either head while keeping tag and val fixed.
  const guideSlots = [
    ...guideHtml.matchAll(
      /<(?:span class="fig|div class="big) (fig-m|fig-e|fig-s)"[^>]*><span class="tag">\[([MES])\]<\/span><span class="val num">([^<]*)<\/span>/g
    ),
  ];
  let guideSlotCount = 0;
  for (const m of guideSlots) {
    guideSlotCount++;
    const [, kindClass, tagLetter, val] = m;
    if (TAG_FOR[kindClass] !== tagLetter) {
      errors.push(`guide.html slot #${guideSlotCount}: class ${kindClass} carries [${tagLetter}], expected [${TAG_FOR[kindClass]}].`);
    }
    if (kindClass === "fig-m" && val.includes("~")) {
      errors.push(`guide.html measured slot #${guideSlotCount} carries a tilde. Tilde is forbidden on measured figures (contract 6.3).`);
    }
    if ((kindClass === "fig-e" || kindClass === "fig-s") && !val.trim().startsWith("~")) {
      errors.push(`guide.html slot #${guideSlotCount} (${kindClass}) lacks the mandatory leading tilde (contract 6.3). Value: ${val}`);
    }
  }
  if (guideSlotCount !== EXPECTED_GUIDE_FIG_SLOTS) {
    errors.push(`guide.html: expected ${EXPECTED_GUIDE_FIG_SLOTS} number slots, found ${guideSlotCount}.`);
  } else {
    notes.push(`guide.html: number slots: ${guideSlotCount} (expected ${EXPECTED_GUIDE_FIG_SLOTS}), each tag agrees with its class and tilde rule.`);
  }
  if (!guideHtml.includes("Production tested")) errors.push('guide.html: reserved footnote "Production tested" resolution missing.');
  if (!guideHtml.includes("Guaranteed by design")) errors.push('guide.html: reserved footnote "Guaranteed by design" resolution missing.');
  if (!guideHtml.includes("Vendor specification, not measured here")) errors.push('guide.html: reserved footnote "Vendor specification, not measured here" resolution missing.');
}

// ---------- Report ----------
if (errors.length) {
  console.error("VERIFY FAILED:");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

console.log("VERIFY PASS");
for (const n of notes) console.log("  + " + n);
console.log(`  + File: ${FILE}`);
