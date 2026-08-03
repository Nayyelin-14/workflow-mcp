# CI/CD

## GitHub Actions

| Workflow | Trigger | Jobs |
|----------|---------|------|
| `ci.yml` | PR to qa/main | Lint, TypeScript, Tests (matrix), Build |
| `deploy.yml` | CI pass on main/qa | Vercel deploy (production / preview) |

- **Composite setup action** — shared setup (checkout, node, deps, prisma, cache) used by all jobs
- **Caching** — Prisma engine + Next.js build cache
- **Coverage** — uploaded as artifact on every PR
- **Dependabot** — weekly npm updates (grouped), monthly GitHub Actions updates

## Branch Strategy

```
feature/foo → PR → qa (preview deploy) → PR → main (production deploy)
```

- `main` — production (protected, requires PR + CI pass)
- `qa` — staging (preview URL, optional protection)

## Deployment

Deploys to Vercel via GitHub Actions (not Git auto-deploy). Requires these secrets:

| Secret | Source |
|--------|--------|
| `VERCEL_TOKEN` | Vercel account settings |
| `VERCEL_ORG_ID` | `npx vercel whoami` |
| `VERCEL_PROJECT_ID` | Vercel project settings |
