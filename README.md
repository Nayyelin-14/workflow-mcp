# Flowagent.ai

Flowagent.ai is an open-source visual AI workflow builder that lets you create multi-step agent workflows through a drag-and-drop interface. Instead of writing code to chain AI calls, conditional logic, HTTP requests, and data transformations, you compose them visually on a canvas.

![Flowagent.ai canvas](./docs/images/screenshot.png)
<!-- TODO: replace with an actual screenshot or demo GIF of the canvas -->

## 🔓 Live Demo

**Try it live:** [https://workflow-mcp-drab.vercel.app/](https://workflow-mcp-drab.vercel.app/)

> ⚠️ This is a shared public demo account — please don't change its password or delete existing workflows.

## Key Features

- **Visual canvas** — drag-and-drop workflow builder powered by React Flow
- **6 node types** — Start, Agent (multi-model AI), If/Else branching, HTTP, Comment, End
- **Variable system** — reference upstream outputs with `{{variable}}` syntax and autocomplete mentions
- **AI chat preview** — test your workflow live with a built-in streaming chat panel
- **Multi-model support** — Gemini, GPT, and Claude model selection per Agent node
- **JSON structured output** — define response schemas visually for typed agent responses

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix Nova) |
| Auth | Kinde (Google OAuth, custom sign-in page) |
| Database | MongoDB via Prisma ORM |
| Query | TanStack React Query v5 |
| Canvas | React Flow (@xyflow/react) |
| State | Zustand v5 + React Context |
| AI SDK | Vercel AI SDK v6 (`ai`, `@ai-sdk/react`) |
| Markdown | streamdown v2 (CJK, code, math, mermaid plugins) |
| Icons | lucide-react |
| Forms | react-hook-form + zod |
| Testing | Vitest + Testing Library + jsdom |
| Rate Limiting | Upstash Redis (in-memory fallback) |

## Quick Start

```bash
git clone <repo-url>
cd workflow-mcp
npm install
cp .env.example .env
npx prisma generate
npm run dev
```

See [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for full environment variable descriptions.

### QStash: local vs production

Workflow runs are triggered through **Upstash QStash**, which calls back into your deployed app — so it needs a publicly reachable URL. Locally, this is handled by Upstash's built-in development server:

| Setting | Local dev | Production (Vercel) |
|---------|-----------|---------------------|
| `QSTASH_DEV` | `true` | unset / `false` |
| `QSTASH_BASE_URL` | not used (dev server auto-managed) | real QStash region URL |
| `QSTASH_TOKEN` | not used | real token |
| `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` | not used | real signing keys |

With `QSTASH_DEV=true`, the `@upstash/workflow` SDK auto-downloads and starts a local QStash dev server on first use, and the live chat preview in `/SingleWorkflow/[id]` works against `http://localhost:3000` with no tunnel or account. No code changes are needed — `app/api/upstash/trigger/route.ts` already falls back to `localhost:3000` when `VERCEL_URL` is unset.

> Note: `VERCEL_AUTOMATION_BYPASS_SECRET` (auto-injected by Vercel when "Protection Bypass for Automation" is enabled under Settings → Deployment Protection) is needed when QStash calls a protected deployment. The code falls back to the legacy `VERCEL_PROTECTION_BYPASS_TOKEN` name if set.

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) — directory tree, state management
- [Node System](./docs/NODE_SYSTEM.md) — canvas, node types, variables, agent deep dive
- [API](./docs/API.md) — endpoint reference
- [CI/CD](./docs/CICD.md) — GitHub Actions workflows, branch strategy, deployment
- [Development](./docs/DEVELOPMENT.md) — prerequisites, environment variables, scripts

## Contributing

Contributions welcome — open an issue or PR.

## License

<!-- TODO: add a LICENSE file and reference it here (e.g. MIT — see LICENSE) -->
