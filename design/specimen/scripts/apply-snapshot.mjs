// apply-snapshot.mjs - inject data/snapshot.json into the site files.
// Rewrites every measured figure on index.html, guide.html, and llms.txt from
// the snapshot, using <!-- LIVE:key --> ... <!-- END:key --> region markers for
// HTML blocks, JSON parsing for the JSON-LD graph, and attribute rewrites for
// meta tags. Idempotent: running twice produces identical output. verify.mjs
// remains the release gate and must pass after this script runs.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const snap = JSON.parse(readFileSync(join(ROOT, "data", "snapshot.json"), "utf8"));

const DATE = snap.snapshotDate;
const S = snap.summary;
const rows = snap.rows;
const diff = snap.gitDiffTop;
const cave = snap.caveman;

// ---------- formatting ----------
const pct1 = (x) => x.toFixed(1);
const cnt = (x) => x.toLocaleString("en-US");
const tok = (x) => (x >= 1e6 ? (x / 1e6).toFixed(1) + "M" : x >= 1e3 ? (x / 1e3).toFixed(1) + "K" : String(x));
const tokProse = (x) =>
  x >= 1e6 ? (x / 1e6).toFixed(1) + " million" : x >= 1e3 ? (x / 1e3).toFixed(1) + " thousand" : String(x);
// Estimates print coarse: whole millions/thousands, always with the tilde.
const estTok = (x) => "~" + (x >= 1e6 ? Math.round(x / 1e6) + "M" : x >= 1e3 ? Math.round(x / 1e3) + "K" : String(x));
const estProse = (x) =>
  "roughly " + (x >= 1e6 ? Math.round(x / 1e6) + " million" : x >= 1e3 ? Math.round(x / 1e3) + " thousand" : String(x));
// Caveman design target percent, deliberately lowballed (0.5 -> "~50").
const cavePct = Math.round(cave.assumedReduction * 100);
const caveMult = (1 / (1 - cave.assumedReduction)).toFixed(0); // 0.5 -> "2"

// ---------- derived selections ----------
const byPct = [...rows].sort((a, b) => b.typPct - a.typPct);
const minRow = byPct[byPct.length - 1];
const maxRow = byPct.find((r) => r.n >= 2) ?? byPct[0];
const top3 = byPct.filter((r) => r.n >= 2).slice(0, 3);
const topAbs = [...rows].sort((a, b) => b.savedTokens - a.savedTokens)[0];

const qualified = (r) =>
  r.n === 1 ? `a single ${r.display} run` : r.n <= 3 ? `one large ${r.display}` : r.display;

// ---------- shared copy ----------
const metaDescription = `Token-saving techniques for AI coding agents, characterized like a component datasheet: ${pct1(S.savedPct)}% typical token reduction measured across ${cnt(S.commands)} proxied commands.`;
const articleDescription = `Token-saving techniques for AI coding agents, characterized like a component datasheet. Measured figures come from logged raw-versus-filtered token deltas via the RTK proxy: ${pct1(S.savedPct)}% typical reduction across ${cnt(S.commands)} proxied commands, snapshot ${DATE}.`;
const faq1Core = `Measured across ${cnt(S.commands)} proxied commands in the snapshot dated ${DATE}, the RTK proxy techniques documented on savetokens.tips reduced output tokens by ${pct1(S.savedPct)} percent overall, ${tokProse(S.savedTokens)} tokens saved. Per-command savings range from ${pct1(minRow.typPct)} percent for ${minRow.display} to ${pct1(maxRow.typPct)} percent for ${qualified(maxRow)}.`;
const faq3Core = `Commands with large raw output filter best: ${top3
  .map((r) => `${r.display} saved ${pct1(r.typPct)} percent (n=${r.n})`)
  .join(", ")}. High-frequency commands save a lower percentage but large absolute totals: ${topAbs.display} saved ${pct1(topAbs.typPct)} percent, ${tokProse(topAbs.savedTokens)} tokens, across ${cnt(topAbs.n)} runs.`;

// Written files are normalized to LF so repeated runs are byte-identical
// regardless of the checkout's autocrlf state.
const lf = (s) => s.replace(/\r\n/g, "\n");

// ---------- region replacement ----------
function replaceBlock(html, key, inner, file) {
  const re = new RegExp(`(<!-- LIVE:${key} -->)[\\s\\S]*?(<!-- END:${key} -->)`);
  if (!re.test(html)) throw new Error(`Marker LIVE:${key} not found in ${file}`);
  return html.replace(re, `$1\n${inner}\n$2`);
}

// ---------- index.html ----------
let index = readFileSync(join(ROOT, "index.html"), "utf8");

// Meta tags.
index = index
  .replace(/(<meta name="description" content=")[^"]*(")/, `$1${metaDescription}$2`)
  .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${metaDescription}$2`);

// JSON-LD graph: parse, mutate, re-serialize.
index = index.replace(
  /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,
  (_, open, body, close) => {
    const data = JSON.parse(body);
    for (const node of data["@graph"]) {
      const type = String(node["@type"]).toLowerCase();
      if (type === "techarticle") {
        node.description = articleDescription;
        node.dateModified = DATE;
      }
      if (type === "faqpage") {
        for (const q of node.mainEntity) {
          if (q.name.startsWith("How much")) q.acceptedAnswer.text = faq1Core;
          if (q.name.startsWith("Which commands")) q.acceptedAnswer.text = faq3Core;
        }
      }
    }
    return open + "\n" + JSON.stringify(data, null, 2) + "\n" + close;
  }
);

// Masthead revision and snapshot date.
index = index
  .replace(/(<dt>Rev:&nbsp;<\/dt><dd class="num">)[^<]*(<\/dd>)/, `$1B, live$2`)
  .replace(/(<dt>Snapshot:&nbsp;<\/dt><dd class="num">)[^<]*(<\/dd>)/, `$1${DATE}$2`);

// Every dated snapshot span.
index = index.replace(/(<span class="date">)\d{4}-\d{2}-\d{2}(<\/span>)/g, `$1${DATE}$2`);

// Features headline figure.
index = replaceBlock(
  index,
  "features-li",
  `      <li>Token reduction across all proxied commands: <span class="fig fig-m" data-figure data-kind="measured"><span class="tag">[M]</span><span class="val num">${pct1(S.savedPct)}</span></span>% typ, n=${cnt(S.commands)}, snapshot <span class="date">${DATE}</span>.</li>`,
  "index.html"
);

// Electrical Characteristics rows.
const slug = (r) => r.family.split(" ").pop().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
const used = new Map();
const partNo = (r) => {
  const s = slug(r);
  const k = (used.get(s) ?? 0) + 1;
  used.set(s, k);
  return `RTK-${s}-${String(k).padStart(2, "0")}`;
};
const condFor = (r) => {
  const base = `n=${cnt(r.n)}, ${tok(r.savedTokens)} saved`;
  if (r.n === 1) return `${base}, single observation`;
  if (r.n <= 3 && r.family === "git diff") return `${base}, one large diff`;
  if (r.n <= 3) return `${base}, small sample`;
  return base;
};
const supFor = (r) => (r.n <= 3 ? "1,3" : "1");
const ecRow = (r) => `          <tr class="row-m">
            <td class="partno" data-label="Part No">${partNo(r)}</td>
            <td data-label="Parameter">Tokens saved, ${r.display}</td>
            <td class="n nc" data-label="Min">&middot;</td>
            <td class="n" data-label="Typ"><span class="fig fig-m" data-figure data-kind="measured"><span class="tag">[M]</span><span class="val num">${pct1(r.typPct)}</span><sup>${supFor(r)}</sup></span></td>
            <td class="n nc" data-label="Max">&middot;</td>
            <td data-label="Unit">%</td>
            <td class="cond" data-label="Test conditions">${condFor(r)}</td>
          </tr>`;
index = replaceBlock(
  index,
  "ec-rows",
  rows.map(ecRow).join("\n") +
    `\n          <tr>
            <td class="partno" data-label="Part No">RTK-TERSE-01</td>
            <td data-label="Parameter">Prose reduction, terse prompting</td>
            <td class="n nc" data-label="Min">&middot;</td>
            <td class="n" data-label="Typ"><span class="fig fig-e" data-figure data-kind="estimated"><span class="tag">[E]</span><span class="val num">~${cavePct}</span><sup>2</sup></span></td>
            <td class="n nc" data-label="Max">&middot;</td>
            <td data-label="Unit">%</td>
            <td class="cond" data-label="Test conditions">assumed ${caveMult}x prose baseline, est ${estTok(cave.estSavedTokens)} saved, no counterfactual</td>
          </tr>
          <tr class="row-m totals">
            <td class="partno" data-label="Part No">STK-TOTAL</td>
            <td data-label="Parameter">All proxied commands</td>
            <td class="n nc" data-label="Min">&middot;</td>
            <td class="n" data-label="Typ"><span class="fig fig-m" data-figure data-kind="measured"><span class="tag">[M]</span><span class="val num">${pct1(S.savedPct)}</span><sup>1</sup></span></td>
            <td class="n nc" data-label="Max">&middot;</td>
            <td data-label="Unit">%</td>
            <td class="cond" data-label="Test conditions">n=${cnt(S.commands)} commands, ${tok(S.savedTokens)} saved</td>
          </tr>`,
  "index.html"
);

// Section 4 scatter: measured points and labels, x = 110 + 172*log10(n),
// y = 250 - 2.3*pct, r = 2.5 + 1.5*log10(n).
const pts = rows.map((r) => {
  const cx = Math.min(690, Math.round(110 + 172 * Math.log10(Math.max(1, r.n))));
  const cy = Math.round(250 - 2.3 * r.typPct);
  const rad = Math.round(10 * (2.5 + 1.5 * Math.log10(Math.max(1, r.n)))) / 10;
  return { ...r, cx, cy, rad, label: `${r.shortLabel}, n=${cnt(r.n)}` };
});
for (const p of pts) {
  p.side = p.cx > 560 ? "end" : "start";
  p.lx = p.side === "end" ? p.cx - 8 : p.cx + 8;
  p.ly = p.cy < 45 ? p.cy + 14 : p.cy - 8;
}
// Crude collision pass: nudge overlapping labels downward.
const placed = [];
for (const p of [...pts].sort((a, b) => a.ly - b.ly || a.lx - b.lx)) {
  let moved = true;
  while (moved) {
    moved = false;
    for (const q of placed) {
      const w = 7 * Math.max(p.label.length, q.label.length);
      if (Math.abs(p.ly - q.ly) < 12 && Math.abs(p.lx - q.lx) < w) {
        p.ly = Math.min(245, q.ly + 14);
        moved = true;
      }
    }
  }
  placed.push(p);
}
index = replaceBlock(
  index,
  "chart-points",
  `        <!-- measured points: x = 110 + 172 * log10(n), y = 250 - 2.3 * pct.
             Marker area encodes sample confidence: r = 2.5 + 1.5 * log10(n).
             Generated from data/snapshot.json, snapshot ${DATE}. -->\n` +
    pts
      .map(
        (p) =>
          `        <circle class="pt-m" cx="${p.cx}" cy="${p.cy}" r="${p.rad}"/><!-- ${p.shortLabel} ${pct1(p.typPct)}% n=${p.n} -->\n` +
          `        <text class="ptlbl" x="${p.lx}" y="${p.ly}" text-anchor="${p.side}">${p.label}</text>`
      )
      .join("\n"),
  "index.html"
);

// Section 4 estimated reference line, y = 250 - 2.3 * pct.
const refY = Math.round(250 - 2.3 * cavePct);
index = replaceBlock(
  index,
  "chart-refline",
  `        <!-- estimated reference: terse prompting ~${cavePct}%, no measured frequency, so a
             horizontal dashed line that claims no x position rather than a point. -->
        <line class="refline" x1="70" y1="${refY}" x2="690" y2="${refY}"/>
        <text class="lbl-full" x="680" y="${refY - 11}" text-anchor="end">[E] ~${cavePct}, design target, no measured frequency</text>
        <text class="lbl-short" x="680" y="${refY - 11}" text-anchor="end">[E] ~${cavePct}, design target</text>`,
  "index.html"
);

// Section 5 featured note: top git diff group.
const dSup = diff.n === 1 ? "1,2" : diff.n <= 3 ? "1,2" : "1";
index = replaceBlock(
  index,
  "tip-delta",
  `        <span class="delta num"><span class="fig fig-m" data-figure data-kind="measured"><span class="tag">[M]</span><span class="val num">${pct1(diff.typPct)}%</span><sup>${dSup}</sup> saved</span></span>`,
  "index.html"
);
index = replaceBlock(
  index,
  "tip-feature",
  `        <div>
          <div class="big fig-m"><span class="tag">[M]</span><span class="val num">${pct1(diff.typPct)}</span>%<sup style="font-size:0.9rem;color:var(--graphite)">${dSup}</sup></div>
          <div class="biglabel">Tokens saved, one large diff</div>
          <div class="big fig-m" style="font-size:1.5rem;margin-top:10px"><span class="tag" style="font-size:0.75rem">[M]</span><span class="val num">${tok(diff.savedTokens)}</span><sup style="font-size:0.75rem;color:var(--graphite)">${dSup}</sup></div>
          <div class="biglabel">Absolute tokens saved</div>
          <span class="chip" data-figure data-kind="measured">M, rtk gain, <span class="date">${DATE}</span>, global, n=${diff.n}</span>
        </div>`,
  "index.html"
);
const diffRuns =
  diff.n === 1
    ? "The delta comes from a single run and is treated as one sample, not a stable average"
    : `The delta is pooled across ${diff.n === 2 ? "two" : diff.n === 3 ? "three" : diff.n} runs and treated as one sample, not a stable average`;
index = replaceBlock(
  index,
  "tip-prose",
  `          <p>In one measured large diff the filtered output used ${pct1(diff.typPct)} percent fewer tokens than the raw diff, a saving of ${tokProse(diff.savedTokens)} tokens. ${diffRuns}, so read it as a strong signal rather than a guaranteed rate. Use rtk git diff whenever a diff is large enough that you would scroll past most of it anyway.</p>`,
  "index.html"
);

// FAQ, visible copy.
index = replaceBlock(
  index,
  "faq-q1",
  `      <p>${faq1Core.replace(`dated ${DATE}`, `dated <span class="date">${DATE}</span>`)} Every figure is characterized in Section 3 with sample counts and test conditions.</p>`,
  "index.html"
);
index = replaceBlock(index, "faq-q3", `      <p>${faq3Core}</p>`, "index.html");

// Revision history live row.
index = replaceBlock(
  index,
  "rev-live",
  `        <tr><td class="n">B</td><td class="n">${DATE}</td><td>Live daily characterization refresh from rtk gain, global scope. This row updates with each snapshot; figures above reflect the latest run.</td></tr>`,
  "index.html"
);

writeFileSync(join(ROOT, "index.html"), lf(index));

// ---------- guide.html ----------
let guide = readFileSync(join(ROOT, "guide.html"), "utf8");
guide = guide.replace(/(<span class="date">)\d{4}-\d{2}-\d{2}(<\/span>)/g, `$1${DATE}$2`);
guide = replaceBlock(
  guide,
  "guide-baseline",
  `      <p><strong>RTK proxy, measured baseline.</strong> Shell output filtering is the one technique on this site with a full counterfactual: across all proxied commands the reduction is <span class="fig fig-m" data-figure data-kind="measured"><span class="tag">[M]</span><span class="val num">${pct1(S.savedPct)}</span><sup>1</sup></span>% typ. <span class="chip" data-figure data-kind="measured">M, rtk gain, <span class="date">${DATE}</span>, global, n=${cnt(S.commands)}</span></p>`,
  "guide.html"
);
// Caveman feature block: one [E] slot (guide expects exactly 3 slots total),
// derivation and absolute estimate carried in prose, not in a new slot.
const caveDerivation = `The target is deliberately lowballed at ${cavePct} percent. Caveman replies logged across ${cnt(cave.sessions)} sessions total ${tokProse(cave.outputTokens)} output tokens; assuming plain prose would have run ${caveMult}x as long, the estimated saving is ${estProse(cave.estSavedTokens)} tokens. The spent side is logged, the baseline is assumed, so the figure stays estimated.`;
guide = replaceBlock(
  guide,
  "guide-caveman",
  `      <div>
        <div class="big fig-e"><span class="tag">[E]</span><span class="val num">~${cavePct}</span>%<sup style="font-size:0.9rem;color:var(--graphite)">1</sup></div>
        <div class="biglabel">Reply prose reduction, design target</div>
        <span class="chip" data-figure data-kind="estimated">E, lowballed by design, no counterfactual</span>
      </div>
      <div class="prose">
        <p>Caveman is a standing instruction that compresses the agent's reply prose while leaving every technical fact intact. The agent drops articles, filler, pleasantries, and hedging, speaks in fragments, and uses arrows for causality. Code, commits, file contents, function names, and error strings are never touched.</p>
        <p>The rule that makes it safe is accuracy first, brevity second. The style compresses wording, not meaning: a fact, caveat, or qualifier is never dropped to save tokens, and the agent returns to plain prose for security warnings, irreversible-action confirmations, and any sequence where compression would risk a misread.</p>
        <p>${caveDerivation}</p>
      </div>`,
  "guide.html"
);
const caveFaq = (site) =>
  `The design target is deliberately lowballed at roughly ${cavePct} percent of reply prose, and it is an estimate: no logged counterfactual exists, so ${site} prints it as [E] ~${cavePct} with a leading tilde and never in the measured accent color. Scaling the logged caveman reply tokens by the assumed ${caveMult}x baseline puts the saving at ${estProse(cave.estSavedTokens)} tokens across ${cnt(cave.sessions)} sessions, an estimate, not a measurement. The style compresses wording, not meaning; facts, caveats, code, and error strings are preserved exactly.`;
guide = replaceBlock(guide, "guide-faq-caveman", `      <p>${caveFaq("this site")}</p>`, "guide.html");
guide = guide.replace(
  /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,
  (_, open, body, close) => {
    const data = JSON.parse(body);
    for (const node of data["@graph"]) {
      if (String(node["@type"]).toLowerCase() !== "faqpage") continue;
      for (const q of node.mainEntity) {
        if (q.name.startsWith("How much does the caveman")) q.acceptedAnswer.text = caveFaq("savetokens.tips");
      }
    }
    return open + "\n" + JSON.stringify(data, null, 2) + "\n" + close;
  }
);
writeFileSync(join(ROOT, "guide.html"), lf(guide));

// ---------- llms.txt ----------
let llms = readFileSync(join(ROOT, "llms.txt"), "utf8");
llms = llms.replace(
  /^> .*$/m,
  `> Token-saving techniques for AI coding agents (Claude Code, Codex), characterized like a component datasheet. Measured figures come from per-command raw-versus-filtered token deltas logged by the RTK proxy: ${pct1(S.savedPct)}% typical reduction across ${cnt(S.commands)} proxied commands, snapshot ${DATE}. Estimated figures carry no counterfactual and are marked as such.`
);
writeFileSync(join(ROOT, "llms.txt"), lf(llms));

console.log(`applied snapshot ${DATE}: total ${pct1(S.savedPct)}%, ${rows.length} command rows`);
