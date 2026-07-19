# Deployment

> Deploy target, build output, asset paths, publish flow.

- Host: Vercel, project `savetokens`, team scope `sardonicasts-projects`, production domain `https://savetokens.tips`.
- **No git integration.** Merging to `main` does NOT deploy. Every deploy is a manual Vercel CLI run.
- Deploy root: `design/specimen/` (static files, no build step). `vercel.json` sets `cleanUrls: true`, so `guide.html` serves at `/guide`.
- Publish flow, from a checkout matching `origin/main`:

  ```bash
  cd design/specimen
  npx -y vercel@latest link --yes --project savetokens --scope sardonicasts-projects   # once per checkout/worktree
  npx -y vercel@latest deploy --prod --yes
  ```

- `link` writes `design/specimen/.vercel/` and `.env.local`; both are covered by `design/specimen/.gitignore`.
- Gate before deploying: `node design/specimen/verify.mjs` must pass (contract release gates).
- Verify after deploying: `curl --ssl-no-revoke -s -o /dev/null -w "%{http_code}" https://savetokens.tips/guide` (see pitfalls: plain curl fails TLS on this machine).
