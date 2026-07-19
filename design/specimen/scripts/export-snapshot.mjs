// export-snapshot.mjs - read the RTK history database and write data/snapshot.json.
// The JSON file is the single source of truth for every measured figure on the
// site. Grouping mirrors `rtk gain`: rows are grouped by exact rtk_cmd, the
// typical percent is the mean of per-run savings_pct, and the overall figure is
// pooled saved-over-input across all logged commands.
// No dependencies beyond node:sqlite (Node 22+).

import { DatabaseSync } from "node:sqlite";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "data");
const OUT_FILE = join(OUT_DIR, "snapshot.json");

const DB_PATH =
  process.env.RTK_HISTORY_DB ||
  join(process.env.LOCALAPPDATA || join(process.env.HOME || "", ".local", "share"), "rtk", "history.db");

const db = new DatabaseSync(DB_PATH, { readOnly: true });

// Local date, YYYY-MM-DD. The snapshot is stamped with the day it was taken.
const now = new Date();
const snapshotDate = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
].join("-");

// ---------- Overall summary (pooled, matches the rtk gain headline) ----------
const summaryRow = db
  .prepare(
    "SELECT COUNT(*) n, SUM(input_tokens) input, SUM(output_tokens) output, SUM(saved_tokens) saved FROM commands"
  )
  .get();
const summary = {
  commands: summaryRow.n,
  inputTokens: summaryRow.input,
  outputTokens: summaryRow.output,
  savedTokens: summaryRow.saved,
  savedPct: Math.round((10000 * summaryRow.saved) / summaryRow.input) / 100,
};

// ---------- Per-command groups (exact rtk_cmd, matches the rtk gain table) ----------
const groups = db
  .prepare(
    "SELECT rtk_cmd cmd, COUNT(*) n, SUM(saved_tokens) saved, AVG(savings_pct) avgPct FROM commands GROUP BY rtk_cmd ORDER BY saved DESC LIMIT 200"
  )
  .all();

// Family key: subcommand identity, so two arg variants of the same command
// cannot occupy two datasheet rows.
const MULTI = new Set(["git", "npm", "pnpm", "yarn", "cargo", "docker", "test", "gh"]);
function familyOf(cmd) {
  const toks = cmd.trim().split(/\s+/).slice(1); // drop leading "rtk"
  if (!toks.length) return null;
  if (MULTI.has(toks[0]) && toks[1] && !toks[1].startsWith("-")) return toks[0] + " " + toks[1];
  return toks[0];
}

// Display name: the command with hashy or pathy arguments stripped, flags kept.
function displayOf(cmd) {
  const toks = cmd.trim().split(/\s+/);
  const kept = [toks[0]];
  for (const t of toks.slice(1)) {
    const isFlag = t.startsWith("-");
    const isWord = /^[a-z][a-z0-9_-]{0,11}$/i.test(t);
    const hexish = /^[0-9a-f]{6,}/i.test(t) || t.includes("..") || t.includes("/") || t.includes("\\");
    if ((isFlag || isWord) && !hexish) kept.push(t);
    else break;
  }
  return kept.join(" ").slice(0, 30);
}

const seen = new Set();
const rows = [];
for (const g of groups) {
  const family = familyOf(g.cmd);
  if (!family || seen.has(family) || g.saved <= 0) continue;
  seen.add(family);
  rows.push({
    family,
    display: displayOf(g.cmd),
    shortLabel: family.split(" ").pop(),
    n: g.n,
    savedTokens: g.saved,
    typPct: Math.round(10 * g.avgPct) / 10,
  });
  if (rows.length === 6) break;
}

// ---------- Featured application note: the top git diff group ----------
const diffTop = db
  .prepare(
    "SELECT rtk_cmd cmd, COUNT(*) n, SUM(saved_tokens) saved, AVG(savings_pct) avgPct FROM commands WHERE rtk_cmd LIKE 'rtk git diff%' GROUP BY rtk_cmd ORDER BY saved DESC LIMIT 1"
  )
  .get();
const gitDiffTop = diffTop
  ? {
      display: displayOf(diffTop.cmd),
      n: diffTop.n,
      savedTokens: diffTop.saved,
      typPct: Math.round(10 * diffTop.avgPct) / 10,
    }
  : null;

// ---------- Daily usage series (last 30 days, raw spend and savings) ----------
const daily = db
  .prepare(
    "SELECT substr(timestamp,1,10) date, COUNT(*) commands, SUM(input_tokens) inputTokens, SUM(output_tokens) outputTokens, SUM(saved_tokens) savedTokens FROM commands GROUP BY substr(timestamp,1,10) ORDER BY date DESC LIMIT 30"
  )
  .all()
  .reverse()
  .map((d) => ({
    date: d.date,
    commands: d.commands,
    inputTokens: d.inputTokens,
    outputTokens: d.outputTokens,
    savedTokens: d.savedTokens,
    savedPct: d.inputTokens ? Math.round((10000 * d.savedTokens) / d.inputTokens) / 100 : 0,
  }));

const snapshot = { snapshotDate, source: "rtk gain history.db", scope: "global", summary, rows, gitDiffTop, daily };

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(snapshot, null, 2) + "\n");
console.log(`snapshot ${snapshotDate}: ${summary.commands} commands, ${summary.savedPct}% saved -> ${OUT_FILE}`);
