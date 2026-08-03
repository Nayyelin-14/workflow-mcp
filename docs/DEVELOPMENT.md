# Development

## Prerequisites

- Node.js >= 22 (`.nvmrc` enforces Node 22)
- MongoDB Atlas account (free tier)
- Kinde account (free tier)
- Upstash Redis account (free tier) — optional; falls back to in-memory rate limiting

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MongoDB connection string |
| `KINDE_CLIENT_ID` | Kinde OAuth client ID |
| `KINDE_CLIENT_SECRET` | Kinde OAuth client secret |
| `KINDE_ISSUER_URL` | Kinde tenant URL |
| `KINDE_SITE_URL` | App URL (http://localhost:3000) |
| `KINDE_POST_LOGIN_REDIRECT_URL` | Post-login redirect |
| `KINDE_POST_LOGOUT_REDIRECT_URL` | Post-logout redirect |
| `KINDE_GOOGLE_CONNECTION_ID` | Kinde Google connection ID (skips the connection chooser on the custom sign-in page) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL (for rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI model access |
| `QSTASH_TOKEN` | Upstash QStash token for workflow triggering |
| `QSTASH_BASE_URL` | Upstash QStash base URL |
| `QSTASH_CURRENT_SIGNING_KEY` | QStash current HMAC signing key (callback verification) |
| `QSTASH_NEXT_SIGNING_KEY` | QStash next HMAC signing key (key rotation) |
| `QSTASH_DEV` | `true` for local dev (auto-manages a local QStash dev server); unset for production |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Vercel Protection Bypass secret (auto-injected when "Protection Bypass for Automation" is enabled); falls back to `VERCEL_PROTECTION_BYPASS_TOKEN` |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type check |
| `npm test` | Run tests once |
| `npm run test:watch` | Watch mode |
| `npm run test:ci` | CI verbose output |
| `npm run test:coverage` | Run with coverage report |
| `postinstall` | Prisma generate + patch-package |
