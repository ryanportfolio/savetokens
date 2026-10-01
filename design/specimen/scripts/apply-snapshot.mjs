// apply-snapshot.mjs - inject data/snapshot.json into the site files.
// Rewrites every measured figure on index.html, guide.html, llms.txt, and the
// repo-root README.md from the snapshot, using <!-- LIVE:key --> ... <!-- END:key --> region markers for
// HTML blocks, JSON parsing for the JSON-LD graphs, and attribute rewrites for
// meta tags. It also writes the STK hero figure (fetched from STK's gain.json)
// and regenerates sitemap.xml with git-history lastmod dates. Idempotent:
// running twice produces identical output for unchanged inputs. verify.mjs
// remains the release gate and must pass after this script runs.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const snap = JSON.parse(readFileSync(join(ROOT, "data", "snapshot.json"), "utf8"));

const DATE = snap.snapshotDate;
// Coarse "July 2026" label for the STK card, from the meter reading's own
// generated_at (the page script re-stamps it on each live fetch).
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
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
const plainName = (r) => {
  const p = r.display.replace(/^rtk /, "");
  return p === "read" ? "file reads" : p;
};
const byPct = [...rows].sort((a, b) => b.typPct - a.typPct);
const minRow = byPct[byPct.length - 1];
const maxRow = byPct.find((r) => r.n >= 2) ?? byPct[0];
const top3 = byPct.filter((r) => r.n >= 2).slice(0, 3);
const topAbs = [...rows].sort((a, b) => b.savedTokens - a.savedTokens)[0];
const mostFrequent = [...rows].sort((a, b) => b.n - a.n)[0];

// ---------- shared copy ----------
const metaDescription = `Token-saving techniques for AI coding agents: ${pct1(S.savedPct)}% token reduction measured across ${cnt(S.commands)} real commands. Measured numbers in green, estimates marked with a tilde.`;
const articleDescription = `Token-saving techniques for AI coding agents, with measured figures from logged raw-versus-filtered token deltas: ${pct1(S.savedPct)}% typical reduction across ${cnt(S.commands)} real commands, snapshot ${DATE}. Estimates carry no before-and-after log and are marked with a tilde.`;
const faq1Core = (where) =>
  `Measured across ${cnt(S.commands)} real commands in the snapshot dated ${DATE}: routing shell output through the RTK filter reduced output tokens by ${pct1(S.savedPct)} percent overall, ${tokProse(S.savedTokens)} tokens saved. Per-command savings range from ${pct1(minRow.typPct)} percent for ${plainName(minRow)} to ${pct1(maxRow.typPct)} percent for one large ${plainName(maxRow)}. Every number's sample count and source is in the table ${where}.`;
const faq3Caution = top3.some((r) => r.n <= 3)
  ? " Figures with n at or below 3 are single observations, not distributions."
  : "";
const faq3Core = `Commands with large raw output filter best: ${top3
  .map((r) => `${plainName(r)} saved ${pct1(r.typPct)} percent (n=${r.n})`)
  .join(", ")}.${faq3Caution} High-frequency commands save a lower percentage but large absolute totals: ${plainName(topAbs)} saved ${pct1(topAbs.typPct)} percent, ${tokProse(topAbs.savedTokens)} tokens, across ${cnt(topAbs.n)} runs.`;
const caveFaqLead = `The logged caveman replies total ${tokProse(cave.outputTokens)} tokens across ${cnt(cave.sessions)} sessions, saving at ${estProse(cave.estSavedTokens)} tokens.`;
const caveFaqStyle = `The style compresses wording, but caveats, code, and error strings are preserved exactly.`;
// Joined form feeds the FAQPage JSON-LD; the visible FAQ renders it as two paragraphs.
const caveFaq = `${caveFaqLead} ${caveFaqStyle}`;

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
          if (q.name.startsWith("How much does filtering")) q.acceptedAnswer.text = faq1Core("on this page");
          if (q.name.startsWith("Which commands")) q.acceptedAnswer.text = faq3Core;
        }
      }
    }
    return open + "\n" + JSON.stringify(data, null, 2) + "\n" + close;
  }
);

// STK showpiece figure, written into the HTML at apply time so crawlers and
// no-JS readers see a number; the page script still refreshes it live from
// /stk/data/gain.json. STK's own caveat: est_tokens is gross bytes avoided / 4
// with follow-up reads excluded, so net savings are unmeasured. No logged
// counterfactual means it is an estimate under the site's rules: tilde, coarse.
// A failed fetch keeps the figure already in the page rather than failing the
// daily run.
const STK_GAIN_URL = process.env.STK_GAIN_URL || "https://ryanportfolio.github.io/STK/data/gain.json";
async function stkReading() {
  try {
    const res = await fetch(STK_GAIN_URL, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = JSON.parse((await res.text()).trimStart()); // trimStart drops the feed's BOM
    const n = d?.stk?.est_tokens;
    const at = typeof d?.generated_at === "string" && d.generated_at.match(/^(\d{4})-(\d{2})-\d{2}/);
    if (typeof n !== "number" || !(n > 0) || !at) throw new Error("unexpected gain.json shape");
    return { fig: estTok(n), asof: `${MONTH_NAMES[Number(at[2]) - 1]} ${at[1]}` };
  } catch (err) {
    const fig = index.match(/id="stk-live"><span class="tag">[a-z ]+<\/span><span class="val num">(~[^<]+)<\/span>/)?.[1];
    const asof = index.match(/<span id="stk-asof">([^<]+)<\/span>/)?.[1];
    if (!fig || !asof) throw new Error(`STK gain.json fetch failed (${err.message}) and index.html has no prior STK figure`);
    console.warn(`warning: STK gain.json fetch failed (${err.message}); keeping ${fig} (${asof})`);
    return { fig, asof };
  }
}
const stk = await stkReading();

// Hero stats: two measured + the STK showpiece card (estimate, see above).
index = replaceBlock(
  index,
  "hero-stats",
  `      <div class="stat">
        <span class="badge">RTK</span>
        <span class="fig fig-m" data-figure data-kind="measured"><span class="tag">measured</span><span class="val num">${pct1(S.savedPct)}</span><span class="unit">%</span></span>
        <p class="what">of output tokens removed across every command routed through the filter.</p>
        <p class="src">rtk gain, snapshot ${DATE}, ${cnt(S.commands)} commands</p>
      </div>
      <div class="stat">
        <span class="badge">RTK</span>
        <span class="fig fig-m" data-figure data-kind="measured"><span class="tag">measured</span><span class="val num">${tok(S.savedTokens)}</span></span>
        <p class="what">tokens saved in total by filtering command output before the agent reads it.</p>
        <p class="src">rtk gain, snapshot ${DATE}, global scope</p>
      </div>
      <a class="stat stat-link" href="/stk/">
        <span class="badge">STK</span>
        <span class="fig fig-e" data-figure data-kind="estimated" id="stk-live"><span class="tag">estimate</span><span class="val num">${stk.fig}</span></span>
        <p class="what">tokens kept out of context by STK, a hook that clamps oversized file reads.</p>
        <p class="src">stk gain upper bound (bytes avoided / 4, net unmeasured), as of <span id="stk-asof">${stk.asof}</span></p>
        <p class="src"><strong>STK &middot; Session Token Killer &#8594;</strong></p>
      </a>`,
  "index.html"
);

// Numbers section intro.
index = replaceBlock(
  index,
  "numbers-intro",
  `      <p>Every percentage below is measured in production.</p>`,
  "index.html"
);

// Measurements table rows.
const noteFor = (r) => {
  if (r.n === 1) return "Single observation";
  if (r.n <= 3) return "Small sample dominated by one run; read as a single sample, not an average";
  if (r === topAbs) return "Biggest total saver in the log";
  if (r === mostFrequent) return "The most frequent command in the log";
  return "&nbsp;";
};
const tableRow = (r) => `          <tr class="row-m">
            <td class="cmd" data-label="Command">${r.display}</td>
            <td class="n" data-label="Output tokens saved"><span class="fig fig-m" data-figure data-kind="measured"><span class="tag">measured</span><span class="val num">${pct1(r.typPct)}</span></span>%</td>
            <td class="n" data-label="Total saved">${tok(r.savedTokens)}</td>
            <td class="n" data-label="Sample">n=${cnt(r.n)}</td>
            <td class="note" data-label="Notes">${noteFor(r)}</td>
          </tr>`;
index = replaceBlock(
  index,
  "table-rows",
  rows.map(tableRow).join("\n") +
    `\n          <tr>
            <td class="cmd" data-label="Command">caveman replies (terse prompting)</td>
            <td class="n" data-label="Output tokens saved"><span class="fig fig-e" data-figure data-kind="estimated"><span class="tag">estimate</span><span class="val num">~${cavePct}</span></span>%</td>
            <td class="n" data-label="Total saved">${estTok(cave.estSavedTokens)}</td>
            <td class="n" data-label="Sample">${cnt(cave.sessions)} sessions</td>
            <td class="note" data-label="Notes">Estimate: assumed ${caveMult}x prose baseline, no before-and-after log. See <a href="/guide#caveman">caveman mode</a></td>
          </tr>
          <tr class="row-m totals">
            <td class="cmd" data-label="Command">All commands</td>
            <td class="n" data-label="Output tokens saved"><span class="fig fig-m" data-figure data-kind="measured"><span class="tag">measured</span><span class="val num">${pct1(S.savedPct)}</span></span>%</td>
            <td class="n" data-label="Total saved">${tok(S.savedTokens)}</td>
            <td class="n" data-label="Sample">n=${cnt(S.commands)}</td>
            <td class="note" data-label="Notes">Everything routed through the filter</td>
          </tr>`,
  "index.html"
);

// Scatter: measured points and labels, x = 110 + 172*log10(n),
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
const refY = Math.round(250 - 2.3 * cavePct);
index = replaceBlock(
  index,
  "chart-refline",
  `        <!-- estimate: caveman replies ~${cavePct}%, no measured frequency, so a horizontal
             dashed line that claims no x position rather than a point. -->
        <line class="refline" x1="70" y1="${refY}" x2="690" y2="${refY}"/>
        <text class="lbl-full" x="680" y="${refY - 11}" text-anchor="end">estimate ~${cavePct}, no measured frequency</text>
        <text class="lbl-short" x="680" y="${refY - 11}" text-anchor="end">estimate ~${cavePct}</text>`,
  "index.html"
);

// How-it-works feature: top git diff group.
index = replaceBlock(
  index,
  "feature",
  `      <div>
        <div class="big fig-m"><span class="fig fig-m" data-figure data-kind="measured"><span class="tag">measured</span><span class="val num">${pct1(diff.typPct)}</span></span>%</div>
        <div class="biglabel">Tokens saved on one large diff</div>
        <div class="big fig-m" style="font-size:1.5rem;margin-top:10px"><span class="fig fig-m" data-figure data-kind="measured"><span class="tag">measured</span><span class="val num">${tok(diff.savedTokens)}</span></span></div>
        <div class="biglabel">Absolute tokens saved</div>
        <p class="src">rtk gain, snapshot ${DATE}, n=${diff.n}</p>
      </div>
      <div class="prose">
        <p>A full git diff of a large change can send millions of characters to the model, most of which the agent never reads line by line. Filtered, the same diff came back ${pct1(diff.typPct)} percent smaller: ${tokProse(diff.savedTokens)} tokens the agent never had to read.</p>
      </div>`,
  "index.html"
);

// FAQ, visible copy.
index = replaceBlock(
  index,
  "faq-q1",
  `      <p>${faq1Core("above").replace(`dated ${DATE}`, `dated <span class="num">${DATE}</span>`)}</p>`,
  "index.html"
);
index = replaceBlock(index, "faq-q3", `      <p>${faq3Core}</p>`, "index.html");

// Footer (carries the dated snapshot label).
index = replaceBlock(
  index,
  "footer-note",
  `    <p>Updated ${DATE}. All measured figures are a dated sample: snapshot ${DATE} from rtk gain logs, global scope, values revise as samples grow. Estimates are labeled and printed with a tilde. No number here is invented.</p>`,
  "index.html"
);

writeFileSync(join(ROOT, "index.html"), lf(index));

// ---------- guide.html ----------
let guide = readFileSync(join(ROOT, "guide.html"), "utf8");

// JSON-LD: caveman answer and dateModified.
guide = guide.replace(
  /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,
  (_, open, body, close) => {
    const data = JSON.parse(body);
    for (const node of data["@graph"]) {
      const type = String(node["@type"]).toLowerCase();
      if (type === "techarticle") node.dateModified = DATE;
      if (type === "faqpage") {
        for (const q of node.mainEntity) {
          if (q.name.startsWith("How much does caveman")) q.acceptedAnswer.text = caveFaq;
        }
      }
    }
    return open + "\n" + JSON.stringify(data, null, 2) + "\n" + close;
  }
);

// Hero stats: measured RTK total + lowballed caveman estimate.
guide = replaceBlock(
  guide,
  "guide-hero-measured",
  `      <div class="stat">
        <span class="badge">Measured</span>
        <span class="fig fig-m" data-figure data-kind="measured"><span class="tag">measured</span><span class="val num">${pct1(S.savedPct)}</span><span class="unit">%</span></span>
        <p class="what">of output tokens removed by filtering command output before the agent reads it.</p>
        <p class="src">rtk gain, snapshot ${DATE}, ${cnt(S.commands)} commands, ${tok(S.savedTokens)} tokens saved</p>
      </div>`,
  "guide.html"
);
guide = replaceBlock(
  guide,
  "guide-hero-caveman",
  `      <div class="stat">
        <span class="badge">Estimate</span>
        <span class="fig fig-e" data-figure data-kind="estimated"><span class="tag">estimate</span><span class="val num">~${cavePct}</span><span class="unit">%</span></span>
        <p class="what">shorter replies with caveman mode.</p>
        <p class="src">assumed ${caveMult}x prose baseline, est ${estTok(cave.estSavedTokens)} saved, no before-and-after log</p>
      </div>`,
  "guide.html"
);

// Caveman section: target figure plus the derivation.
guide = replaceBlock(
  guide,
  "guide-caveman-target",
  `      <p>On ultra you can expect <span class="fig fig-e" data-figure data-kind="estimated"><span class="tag">estimate</span><span class="val num">~${cavePct}</span></span>% less tokens.</p>`,
  "guide.html"
);

// Advanced section: inline measured RTK total.
guide = replaceBlock(
  guide,
  "guide-rtk-inline",
  `      <p>Shell output is the biggest silent cost: a large diff or test run can dump thousands of lines the agent never needed. Filtering removed <span class="fig fig-m" data-figure data-kind="measured"><span class="tag">measured</span><span class="val num">${pct1(S.savedPct)}</span></span>% of output tokens across ${cnt(S.commands)} commands (snapshot ${DATE}). Per-command numbers and how it works are on the <a href="/">measurements page</a>.</p>`,
  "guide.html"
);

// FAQ, visible copy.
guide = replaceBlock(
  guide,
  "guide-faq-caveman",
  `      <p>${caveFaqLead}</p>\n      <p>${caveFaqStyle}</p>`,
  "guide.html"
);

// Footer (carries the dated snapshot label).
guide = replaceBlock(
  guide,
  "guide-footer-note",
  `    <p>Updated ${DATE}. Measured figures come from per-command before-and-after logs, snapshot ${DATE}.</p>`,
  "guide.html"
);

writeFileSync(join(ROOT, "guide.html"), lf(guide));

// ---------- llms.txt ----------
let llms = readFileSync(join(ROOT, "llms.txt"), "utf8");
llms = llms.replace(
  /^> .*$/m,
  `> Token-saving techniques for AI coding agents (Claude Code, Codex). Measured figures come from per-command raw-versus-filtered token deltas logged by the RTK proxy: ${pct1(S.savedPct)}% typical reduction across ${cnt(S.commands)} real commands, snapshot ${DATE}. Estimates carry no before-and-after log and are marked with a tilde.`
);
writeFileSync(join(ROOT, "llms.txt"), lf(llms));

// ---------- README.md (repo root) ----------
const readmePath = join(ROOT, "..", "..", "README.md");
let readme = readFileSync(readmePath, "utf8");
readme = replaceBlock(
  readme,
  "readme-figures",
  `> **Current characterization** (snapshot ${DATE}, global scope)
>
> | | |
> |---|---|
> | **[M] ${pct1(S.savedPct)}%** | of output tokens removed by filtering command output before the agent reads it. rtk gain, ${cnt(S.commands)} commands, ${tok(S.savedTokens)} tokens saved |
> | **[E] ~${cavePct}%** | shorter replies with caveman mode. Deliberately lowballed target, est ${estTok(cave.estSavedTokens)} tokens, no before-and-after log |`,
  "README.md"
);
writeFileSync(readmePath, lf(readme));

// ---------- sitemap.xml ----------
// lastmod comes from git history: the file's last commit date, or today when
// the file has uncommitted changes (this run just rewrote its figures, so the
// commit about to be made carries today's date). /stk/ is the proxied STK
// Pages site, so its date is the last commit under docs/ in the STK repo; if
// the GitHub API is unreachable the previous sitemap's date for it stands.
const git = (...args) => execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8" }).trim();
const localToday = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
};
// git diff, not git status: this script writes LF, so under core.autocrlf
// status flags every rewritten file even when its content is unchanged.
const changed = (file) => {
  try {
    git("diff", "--quiet", "HEAD", "--", file);
    return false;
  } catch (err) {
    if (err.status === 1) return true;
    throw err;
  }
};
const fileLastmod = (file) => (changed(file) ? localToday() : git("log", "-1", "--format=%cs", "--", file));
const sitemapPath = join(ROOT, "sitemap.xml");
const prevSitemap = existsSync(sitemapPath) ? readFileSync(sitemapPath, "utf8") : "";
async function stkLastmod() {
  try {
    const res = await fetch("https://api.github.com/repos/ryanportfolio/STK/commits?sha=main&path=docs&per_page=1", {
      headers: { "User-Agent": "savetokens-apply-snapshot", Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const date = (await res.json())?.[0]?.commit?.committer?.date;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(date)) throw new Error("unexpected commits shape");
    return date.slice(0, 10);
  } catch (err) {
    const prev = prevSitemap.match(/<loc>https:\/\/savetokens\.tips\/stk\/<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/)?.[1];
    if (!prev) throw new Error(`STK commit date lookup failed (${err.message}) and sitemap.xml has no prior /stk/ date`);
    console.warn(`warning: STK commit date lookup failed (${err.message}); keeping ${prev}`);
    return prev;
  }
}
const pages = [
  ["https://savetokens.tips/", fileLastmod("index.html")],
  ["https://savetokens.tips/guide", fileLastmod("guide.html")],
  ["https://savetokens.tips/about", fileLastmod("about.html")],
  ["https://savetokens.tips/stk/", await stkLastmod()],
];
writeFileSync(
  sitemapPath,
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(([loc, lastmod]) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`).join("\n")}
</urlset>
`
);

console.log(`applied snapshot ${DATE}: total ${pct1(S.savedPct)}%, ${rows.length} command rows, caveman est ${estTok(cave.estSavedTokens)}`);
