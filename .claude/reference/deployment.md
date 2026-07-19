# Deployment

> Deploy target, build output, asset paths, publish flow.

- Host: Vercel, project `savetokens`, team scope `sardonicasts-projects`, production domain `https://savetokens.tips`.
- **Git integration is connected (since 2026-07-19).** Merging to `main` auto-deploys to production. Project `rootDirectory` is `design/specimen` (set via API PATCH; `vercel git connect` had left it at `.`, which would have deployed the repo root).
- Deploy root: `design/specimen/` (static files, no build step). `vercel.json` sets `cleanUrls: true`, so `guide.html` serves at `/guide`.
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
