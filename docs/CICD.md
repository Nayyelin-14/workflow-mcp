# CI/CD

## Branch Strategy

```
feature/foo → PR → qa (preview deploy) → PR → main (production deploy)
```

- `main` — production (protected, requires PR + CI pass)
- `qa` — staging (preview URL, optional protection)

## GitHub Actions

| Workflow | Trigger | Jobs |
|----------|---------|------|
| `ci.yml` | PR to qa/main **and** direct push to qa/main | Lint, TypeScript, Tests, Audit (matrix), Build |
| `deploy.yml` | Manual (`workflow_dispatch`) on qa/main | Optional manual Vercel deploy via CLI |
| `dependabot-auto-merge.yml` | Dependabot PRs (`pull_request_target`) | Approve + auto-merge patch/minor updates |
| `report-stable-deployment.yml` | `deployment_status` events | Posts the stable preview/production URL to GitHub Environments |

- **Composite setup action** — `.github/actions/setup` (checkout, node 22, deps, Prisma cache, Next.js cache) used by all jobs
- **Caching** — Prisma engine (`~/.cache/prisma`, `lib/generated/prisma`) + Next.js build cache (`.next/cache`)
- **Coverage/audit** — `test:ci` and `audit:ci` run on every PR and push
- **Dependabot** — removed. `.github/dependabot.yml` was deleted; `dependabot-auto-merge.yml` remains as a leftover (harmless, does nothing without Dependabot).

## Deployment

Deploys to Vercel via **Vercel Git Integration** (auto-deploy on push to `qa`/`main`), not via GitHub Actions. GitHub Environments show URLs.

- `qa` → **Preview** environment → `https://workflow-mcp-git-qa-nay1.vercel.app`
- `main` → **Production** environment → `https://workflow-mcp-drab.vercel.app`

Vercel reports a per-commit hashed URL to GitHub, so `report-stable-deployment.yml` listens for `deployment_status` events and posts a new status with the stable alias as `target_url`/`environment_url`. It skips PR/feature-branch deployments and only matches commits that are the head of `qa` or `main` (resolved via the `branches-where-head` API).

> Note: `deploy.yml` is optional/manual and requires these secrets if you use it:

| Secret | Source |
|--------|--------|
| `VERCEL_TOKEN` | Vercel account settings |
| `VERCEL_ORG_ID` | `npx vercel whoami` |
| `VERCEL_PROJECT_ID` | Vercel project settings |
