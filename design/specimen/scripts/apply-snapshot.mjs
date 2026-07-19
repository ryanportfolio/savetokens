// apply-snapshot.mjs - inject data/snapshot.json into the site pages.
// Regenerates every LIVE-marked region in index.html and guide.html, rewrites
// the JSON-LD blocks and meta descriptions that carry numbers, and refreshes
// the llms.txt headline. Idempotent: running twice on the same snapshot is
// byte-identical. Output is LF-normalized.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SPECIMEN = join(HERE, "..");
const snap = JSON.parse(readFileSync(join(SPECIMEN, "data", "snapshot.json"), "utf8"));

const date = snap.snapshotDate;
const s = snap.summary;
const rows = snap.rows;
const cave = snap.caveman;

// ---------- formatting ----------
const int = (n) => Number(n).toLocaleString("en-US");
const pct1 = (p) => Number(p).toFixed(1);
const tok = (t) =>
  t >= 1e6 ? (t / 1e6).toFixed(1) + "M" : t >= 1e3 ? (t / 1e3).toFixed(1) + "K" : String(t);
const millions = (t) => (t / 1e6).toFixed(1) + " million";
const cavePct = Math.round(cave.assumedReduction * 100); // deliberately coarse
const caveTok = "~" + Math.round(cave.estSavedTokens / 1e6) + "M"; // deliberately coarse

// ---------- region replacement ----------
function region(html, name, inner) {
  const open = `<!-- LIVE:${name} -->`;
  const close = `<!-- /LIVE:${name} -->`;
  const a = html.indexOf(open);
  const b = html.indexOf(close);
  if (a === -1 || b === -1 || b < a) throw new Error(`marker ${name} not found or malformed`);
  return html.slice(0, a + open.length) + "\n" + inner + "\n" + html.slice(b);
}

function replaceJsonLd(html, mutate) {
  return html.replace(
    /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,
    (m, openTag, body, closeTag) => {
      const obj = JSON.parse(body);
      mutate(obj);
      return openTag + "\n" + JSON.stringify(obj, null, 2) + "\n" + closeTag;
    }
  );
}

const measuredSlot = (val, unit = "") =>
  `<span class="fig fig-m" data-figure data-kind="measured"><span class="tag">measured</span><span class="val num">${val}</span>${unit ? `<span class="unit">${unit}</span>` : ""}</span>`;
const estimateSlot = (val, unit = "") =>
  `<span class="fig fig-e" data-figure data-kind="estimated"><span class="tag">estimate</span><span class="val num">${val}</span>${unit ? `<span class="unit">${unit}</span>` : ""}</span>`;

// ---------- shared FAQ sentences (visible text and JSON-LD stay in sync) ----------
const maxSavedRow = rows[0];
const maxNRow = rows.reduce((a, b) => (b.n > a.n ? b : a), rows[0]);
const byPct = [...rows].sort((a, b) => b.typPct - a.typPct);

const faqHow = (suffix) =>
  `Measured across ${int(s.commands)} real commands in the snapshot dated ${date}, routing shell commands through the RTK filter reduced output tokens by ${pct1(s.savedPct)} percent overall, ${millions(s.savedTokens)} tokens saved. Per-command savings range from ${pct1(byPct[byPct.length - 1].typPct)} percent for ${byPct[byPct.length - 1].family} to ${pct1(byPct[0].typPct)} percent for ${byPct[0].family}. ${suffix}`;

const faqMost = `Commands with large raw output filter best: ${byPct
  .slice(0, 3)
  .map((r) => `${r.family} saved ${pct1(r.typPct)} percent (n=${int(r.n)})`)
  .join(", ")}. High-frequency commands save a lower percentage but large absolute totals: ${maxNRow.family} saved ${pct1(maxNRow.typPct)} percent, ${tok(maxNRow.savedTokens)} tokens, across ${int(maxNRow.n)} runs.`;

const faqCaveman = `The estimate is roughly ${cavePct} percent of reply prose, deliberately lowballed: across ${int(cave.sessions)} real sessions with caveman mode on, assuming plain prose would have taken twice the tokens, that is roughly ${caveTok.slice(1)} tokens saved. Nobody has logged a true before-and-after, so this site prints it gray with a leading tilde, never in the green reserved for measured numbers. The style compresses wording, not meaning; facts, caveats, code, and error strings are preserved exactly.`;

// ---------- index.html ----------
let index = readFileSync(join(SPECIMEN, "index.html"), "utf8").replace(/\r\n/g, "\n");

index = region(
  index,
  "stat-pct",
  `        ${measuredSlot(pct1(s.savedPct), "%")}
        <p class="what">of output tokens removed across every command routed through the filter.</p>
        <p class="src">rtk gain, snapshot ${date}, ${int(s.commands)} commands</p>`
);

index = region(
  index,
  "stat-saved",
  `        ${measuredSlot(tok(s.savedTokens))}
        <p class="what">tokens saved in total by filtering command output before the agent reads it.</p>
        <p class="src">rtk gain, snapshot ${date}, global scope</p>`
);

function rowNote(r) {
  if (r.n === 1) return "Single observation";
  if (r.n <= 3) return "A few runs dominated by one large one; read as a single sample, not an average";
  if (r === maxSavedRow) return "Biggest total saver";
  if (r === maxNRow) return "The most frequent command in the log";
  return "&nbsp;";
}

const tableRows = rows
  .map(
    (r) => `          <tr class="row-m">
            <td class="cmd" data-label="Command">${r.display}</td>
            <td class="n" data-label="Output tokens saved">${measuredSlot(pct1(r.typPct))}%</td>
            <td class="n" data-label="Total saved">${tok(r.savedTokens)}</td>
            <td class="n" data-label="Sample">n=${int(r.n)}</td>
            <td class="note" data-label="Notes">${rowNote(r)}</td>
          </tr>`
  )
  .join("\n");

index = region(
  index,
  "table",
  `${tableRows}
          <tr>
            <td class="cmd" data-label="Command">caveman mode</td>
            <td class="n" data-label="Output tokens saved">${estimateSlot("~" + cavePct)}%</td>
            <td class="n" data-label="Total saved">${caveTok}</td>
            <td class="n" data-label="Sample">${int(cave.sessions)} sessions</td>
            <td class="note" data-label="Notes">Lowballed estimate, assumed 2x plain-prose baseline; no before-and-after log. See <a href="/guide#caveman">caveman mode</a></td>
          </tr>
          <tr class="row-m totals">
            <td class="cmd" data-label="Command">All commands</td>
            <td class="n" data-label="Output tokens saved">${measuredSlot(pct1(s.savedPct))}%</td>
            <td class="n" data-label="Total saved">${tok(s.savedTokens)}</td>
            <td class="n" data-label="Sample">n=${int(s.commands)}</td>
            <td class="note" data-label="Notes">Everything routed through the filter</td>
          </tr>`
);

// Chart geometry: x = 110 + 172*log10(n) clamped to the axis, y from percent,
// marker radius grows with sample count so thin samples read as thin.
const X = (n) => Math.min(690, Math.max(110, 110 + 172 * Math.log10(Math.max(1, n))));
const Y = (p) => 250 - 2.3 * p;
const R = (n) => 2.5 + 1.5 * Math.log10(Math.max(1, n));
const placed = [];
const chartPoints = rows
  .map((r) => {
    const x = X(r.n);
    const y = Y(r.typPct);
    const rad = R(r.n).toFixed(1);
    const left = x > 400;
    const lx = left ? x - 9 : x + 9;
    let ly = Math.max(16, y - 8);
    // Nudge colliding labels below their dot, then step down until clear.
    while (placed.some((p) => Math.abs(p.ly - ly) < 14 && Math.abs(p.lx - lx) < 170)) {
      ly = ly < y ? y + 18 : ly + 15;
    }
    placed.push({ lx, ly });
    return `        <circle class="pt-m" cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rad}"/>
        <text class="ptlbl" x="${lx.toFixed(0)}" y="${ly.toFixed(0)}" text-anchor="${left ? "end" : "start"}">${r.shortLabel}, n=${int(r.n)}</text>`;
  })
  .join("\n");
const estY = Y(cavePct).toFixed(0);

index = region(
  index,
  "chart",
  `      <svg class="chart" viewBox="0 0 720 300" width="100%" style="min-width:600px;display:block" role="img" aria-label="Scatter of saved percent versus command count, measured points solid, estimate as a dashed reference line">
        <line class="axis" x1="70" y1="20" x2="70" y2="250"/>
        <line class="axis" x1="70" y1="250" x2="690" y2="250"/>
        <line class="grid base" x1="70" y1="250" x2="690" y2="250"/>
        <line class="grid" x1="70" y1="192" x2="690" y2="192"/>
        <line class="grid" x1="70" y1="135" x2="690" y2="135"/>
        <line class="grid" x1="70" y1="77"  x2="690" y2="77"/>
        <line class="grid" x1="70" y1="20"  x2="690" y2="20"/>
        <text x="62" y="253" text-anchor="end">0</text>
        <text x="62" y="195" text-anchor="end">25</text>
        <text x="62" y="138" text-anchor="end">50</text>
        <text x="62" y="80"  text-anchor="end">75</text>
        <text x="62" y="23"  text-anchor="end">100</text>
        <line class="axis" x1="110" y1="250" x2="110" y2="255"/>
        <line class="axis" x1="282" y1="250" x2="282" y2="255"/>
        <line class="axis" x1="454" y1="250" x2="454" y2="255"/>
        <line class="axis" x1="626" y1="250" x2="626" y2="255"/>
        <text x="110" y="266" text-anchor="middle">1</text>
        <text x="282" y="266" text-anchor="middle">10</text>
        <text x="454" y="266" text-anchor="middle">100</text>
        <text x="626" y="266" text-anchor="middle">1000</text>
        <text class="axlabel" x="380" y="292" text-anchor="middle">TIMES THE COMMAND RAN, LOG SCALE</text>
        <text class="axlabel" x="20" y="135" text-anchor="middle" transform="rotate(-90 20 135)">SAVED PERCENT</text>
${chartPoints}
        <line class="refline" x1="70" y1="${estY}" x2="690" y2="${estY}"/>
        <text class="lbl-full" x="680" y="${Number(estY) - 11}" text-anchor="end">estimate ~${cavePct}, no measured frequency</text>
        <text class="lbl-short" x="680" y="${Number(estY) - 11}" text-anchor="end">estimate ~${cavePct}</text>
      </svg>`
);

const g = snap.gitDiffTop;
const featurePool =
  g.n <= 5
    ? `That figure pools ${int(g.n)} runs dominated by one huge diff, so read it as a strong signal, not a guaranteed rate.`
    : `That figure averages ${int(g.n)} runs.`;
index = region(
  index,
  "feature",
  `      <div>
        <div class="big fig-m">${measuredSlot(pct1(g.typPct))}%</div>
        <div class="biglabel">Tokens saved on one large diff</div>
        <div class="big fig-m" style="font-size:1.5rem;margin-top:10px">${measuredSlot(tok(g.savedTokens))}</div>
        <div class="biglabel">Absolute tokens saved</div>
        <p class="src">rtk gain, snapshot ${date}, n=${int(g.n)}</p>
      </div>
      <div class="prose">
        <p>A full git diff of a large change can send millions of characters to the model, most of which the agent never reads line by line. Filtered, the same diff came back ${pct1(g.typPct)} percent smaller: ${millions(g.savedTokens)} tokens the agent never had to read.</p>
        <p>${featurePool} The habit it argues for: route any diff you would scroll past through the filter.</p>
      </div>`
);

index = region(index, "faq-how", `      <p>${faqHow("Every number's sample count and source is in the table above.")}</p>`);
index = region(index, "faq-most", `      <p>${faqMost}</p>`);
index = region(
  index,
  "footer",
  `    <p>Updated ${date}. All measured figures are a dated sample: snapshot ${date} from rtk gain logs, global scope, refreshed daily. Estimates are labeled and printed with a tilde. No number here is invented.</p>`
);

// Snapshot-date mentions outside LIVE regions (table intro line).
index = index.replace(/snapshot \d{4}-\d{2}-\d{2}/g, `snapshot ${date}`);

// Meta and OG descriptions carry the headline numbers.
const indexDesc = `Token-saving techniques for AI coding agents: ${pct1(s.savedPct)}% token reduction measured across ${int(s.commands)} real commands. Measured numbers in green, estimates marked with a tilde.`;
index = index.replace(
  /content="Token-saving techniques for AI coding agents: [^"]*"/g,
  `content="${indexDesc}"`
);

index = replaceJsonLd(index, (obj) => {
  for (const node of obj["@graph"]) {
    if (node["@type"] === "TechArticle") {
      node.description = `Token-saving techniques for AI coding agents, with measured figures from logged raw-versus-filtered token deltas: ${pct1(s.savedPct)}% typical reduction across ${int(s.commands)} real commands, snapshot ${date}. Estimates carry no before-and-after log and are marked with a tilde.`;
      node.dateModified = date;
    }
    if (node["@type"] === "FAQPage") {
      for (const q of node.mainEntity) {
        if (q.name.startsWith("How much does filtering"))
          q.acceptedAnswer.text = faqHow("Every number's sample count and source is in the table on this page.");
        if (q.name.startsWith("Which commands")) q.acceptedAnswer.text = faqMost;
      }
    }
  }
});

writeFileSync(join(SPECIMEN, "index.html"), index);

// ---------- guide.html ----------
let guide = readFileSync(join(SPECIMEN, "guide.html"), "utf8").replace(/\r\n/g, "\n");

guide = region(
  guide,
  "stat-measured",
  `        ${measuredSlot(pct1(s.savedPct), "%")}
        <p class="what">of output tokens removed by filtering command output before the agent reads it.</p>
        <p class="src">rtk gain, snapshot ${date}, ${int(s.commands)} commands, ${tok(s.savedTokens)} tokens saved</p>`
);

guide = region(
  guide,
  "stat-caveman",
  `        ${estimateSlot("~" + cavePct, "%")}
        <p class="what">shorter replies with caveman mode. A lowballed estimate from ${int(cave.sessions)} real sessions, not a measurement.</p>
        <p class="src">assumed 2x plain-prose baseline; no before-and-after log</p>`
);

guide = region(
  guide,
  "caveman-para",
  `      <p>Across ${int(cave.sessions)} real sessions with caveman mode on, replies have totaled ${tok(cave.outputTokens)} tokens. Assume plain prose would have taken twice as many, which is a deliberate lowball, and that is ${estimateSlot(caveTok)} tokens saved. It prints gray with a tilde because nobody has logged a true before-and-after.</p>`
);

guide = region(
  guide,
  "rtk",
  `      <p>Shell output is the biggest silent cost: a large diff or test run can dump thousands of lines the agent never needed. Filtering it is the one technique on this site with full before-and-after logs: ${measuredSlot(pct1(s.savedPct))}% of output tokens removed across ${int(s.commands)} commands (snapshot ${date}). Per-command numbers and how it works are on the <a href="/">measurements page</a>.</p>`
);

guide = region(guide, "faq-caveman", `      <p>${faqCaveman}</p>`);
guide = region(
  guide,
  "footer",
  `    <p>Updated ${date}. Measured figures come from per-command before-and-after logs, snapshot ${date}, refreshed daily; estimates are labeled and printed with a tilde. No number here is invented.</p>`
);

guide = guide.replace(/snapshot \d{4}-\d{2}-\d{2}/g, `snapshot ${date}`);

guide = replaceJsonLd(guide, (obj) => {
  for (const node of obj["@graph"]) {
    if (node["@type"] === "TechArticle") node.dateModified = date;
    if (node["@type"] === "FAQPage") {
      for (const q of node.mainEntity) {
        if (q.name.startsWith("How much does caveman")) q.acceptedAnswer.text = faqCaveman;
      }
    }
  }
});

writeFileSync(join(SPECIMEN, "guide.html"), guide);

// ---------- llms.txt ----------
let llms = readFileSync(join(SPECIMEN, "llms.txt"), "utf8").replace(/\r\n/g, "\n");
llms = llms.replace(
  /[\d.]+% typical token reduction measured across [\d,]+ (?:proxied|real) commands, snapshot \d{4}-\d{2}-\d{2}/,
  `${pct1(s.savedPct)}% typical token reduction measured across ${int(s.commands)} real commands, snapshot ${date}`
);
writeFileSync(join(SPECIMEN, "llms.txt"), llms);

console.log(
  `applied snapshot ${date}: ${pct1(s.savedPct)}% over ${int(s.commands)} commands, ${rows.length} table rows, caveman ~${cavePct}% / ${caveTok}`
);
