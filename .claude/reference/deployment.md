# Deployment

> Deploy target, build output, asset paths, publish flow.

## Site

- Static site, Vercel, project root = `design/specimen/` (`vercel.json` + `.vercelignore` live there). Push to `main` triggers deploy.
- `.vercelignore` excludes `verify.mjs` and `scripts/`; `renders/` must stay deployed (og:image, checked by verify).
- `data/snapshot.json` deploys on purpose: it is the public machine-readable figure feed.

## Live figure pipeline (daily refresh)

Single source of truth: `design/specimen/data/snapshot.json`, exported from the local RTK history database (`%LOCALAPPDATA%\rtk\history.db`, SQLite).

1. `node design/specimen/scripts/export-snapshot.mjs` reads history.db (override path with `RTK_HISTORY_DB`), writes `data/snapshot.json`. Grouping mirrors `rtk gain`: per-command rows group by exact `rtk_cmd`, typ percent = mean of per-run `savings_pct`; overall = pooled saved/input. It also computes the caveman estimate: assistant `output_tokens` summed from `~/.claude/projects/**/*.jsonl` (deduped by message id; a session counts only on an explicit activation record, hook default or Skill launch), scaled by a deliberately lowballed 50% reduction (2x baseline) -> `[E]` figure, never `[M]`. Scan results cache per file in `%LOCALAPPDATA%\savetokens-refresh-cache.json` (mtime+size keyed; safe to delete).
2. `node design/specimen/scripts/apply-snapshot.mjs` injects the snapshot into `index.html`, `guide.html`, `llms.txt` via `<!-- LIVE:key --> ... <!-- END:key -->` region markers, JSON-LD parse-and-rewrite, and meta-attribute rewrites. Idempotent; writes LF.
3. `node design/specimen/verify.mjs` is the release gate; its snapshot label is read from `data/snapshot.json`, so stale HTML fails.
4. `scripts/daily-refresh.ps1` orchestrates export, apply, verify, commit, push to `main` (registered in Windows Task Scheduler as `savetokens-daily-refresh`). It works in a dedicated clone at `%LOCALAPPDATA%\savetokens-refresh` (auto-created, hard-reset to `origin/main` each run) so the user's working checkout is never touched. Logs to `%LOCALAPPDATA%\savetokens-refresh.log`.

Editing rules: never hand-edit figures inside LIVE regions; change the templates in `apply-snapshot.mjs` instead, then re-run apply + verify. `renders/*.png` screenshots are static and show whatever figures existed when captured.
