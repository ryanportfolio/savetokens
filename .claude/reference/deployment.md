# Deployment

> Deploy target, build output, asset paths, publish flow.

## Site / hosting

- Host: Vercel, project `savetokens`, team scope `sardonicasts-projects`, production domain `https://savetokens.tips`.
- **Git integration is connected (since 2026-07-19).** Merging to `main` auto-deploys to production. Project `rootDirectory` is `design/specimen` (set via API PATCH; `vercel git connect` had left it at `.`, which would have deployed the repo root).
- Deploy root: `design/specimen/` (static files, no build step). `vercel.json` sets `cleanUrls: true`, so `guide.html` serves at `/guide`.
- `.vercelignore` excludes `verify.mjs` and `scripts/`; `renders/` must stay deployed (og:image, checked by verify). `data/snapshot.json` deploys on purpose: it is the public machine-readable figure feed.
- Manual fallback (if git integration is off or a deploy must bypass it):

  ```bash
  cd design/specimen
  npx -y vercel@latest link --yes --project savetokens --scope sardonicasts-projects   # once per checkout
  npx -y vercel@latest deploy --prod --yes
  ```

- `vercel git connect` quirks on this machine: it fails with "No local Git repository found" inside a `.claude/worktrees/*` worktree (the `.git` file confuses it) and even at a normal checkout's subdirectory; pass the repo URL explicitly: `vercel git connect https://github.com/ryanportfolio/savetokens --yes`.
- `link` writes `design/specimen/.vercel/` and `.env.local`; both are covered by `design/specimen/.gitignore`.
- Gate before merging: `node design/specimen/verify.mjs` must pass (release gates for both pages).
- Verify after deploying: `curl --ssl-no-revoke -s -o /dev/null -w "%{http_code}" https://savetokens.tips/guide` plus a sentinel grep for the newest change (see pitfalls: plain curl fails TLS on this machine).

## Live figure pipeline (daily refresh)

Single source of truth: `design/specimen/data/snapshot.json`, exported from the local RTK history database (`%LOCALAPPDATA%\rtk\history.db`, SQLite).

1. `node design/specimen/scripts/export-snapshot.mjs` reads history.db (override path with `RTK_HISTORY_DB`), writes `data/snapshot.json`. Grouping mirrors `rtk gain`: per-command rows group by exact `rtk_cmd`, typ percent = mean of per-run `savings_pct`; overall = pooled saved/input. It also computes the caveman estimate: assistant `output_tokens` summed from `~/.claude/projects/**/*.jsonl` (deduped by message id; a session counts only on an explicit activation record, hook default or Skill launch), scaled by a deliberately lowballed 50% reduction (2x baseline) -> `[E]` figure, never `[M]`. Scan results cache per file in `%LOCALAPPDATA%\savetokens-refresh-cache.json` (mtime+size keyed; safe to delete).
2. `node design/specimen/scripts/apply-snapshot.mjs` injects the snapshot into `index.html`, `guide.html`, `llms.txt` via `<!-- LIVE:key --> ... <!-- END:key -->` region markers, JSON-LD parse-and-rewrite, and meta-attribute rewrites. Idempotent; writes LF.
3. `node design/specimen/verify.mjs` is the release gate; its snapshot label is read from `data/snapshot.json`, so stale HTML fails.
4. `scripts/daily-refresh.ps1` orchestrates export, apply, verify, commit, push to `main` (registered in Windows Task Scheduler as `savetokens-daily-refresh`). It works in a dedicated clone at `%LOCALAPPDATA%\savetokens-refresh` (auto-created, hard-reset to `origin/main` each run) so the user's working checkout is never touched. Logs to `%LOCALAPPDATA%\savetokens-refresh.log`.

Editing rules: never hand-edit figures inside LIVE regions; change the templates in `apply-snapshot.mjs` instead, then re-run apply + verify. `renders/*.png` screenshots are static and show whatever figures existed when captured.
