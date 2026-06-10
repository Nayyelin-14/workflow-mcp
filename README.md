# Flowagent.ai

Flowagent.ai is an open-source visual AI workflow builder that lets you create multi-step agent workflows through a drag-and-drop interface. Instead of writing code to chain AI calls, conditional logic, HTTP requests, and data transformations, you compose them visually on a canvas.

## How It Works

### The Canvas
The editor is built on React Flow. You drag nodes from a palette onto the canvas and connect them by drawing edges between ports. Each node represents a step in the workflow — an AI agent call, a conditional branch, an HTTP request, etc.

### The Node System
Six node types are available:

- **Start** — The entry point. Every workflow begins here.
- **Agent** — The core AI node. Configure system instructions, pick a model (Gemini, GPT, Claude), assign tools (web search), set output format (text or JSON), and define a structured JSON schema for the response.
- **If/Else** — Conditional branching. Route execution down different paths based on upstream outputs.
- **HTTP** — Make external API requests within the workflow.
- **Comment** — Annotations for documentation.
- **End** — Terminal node. Marks workflow completion.

Nodes are connected by edges. Data flows from upstream nodes to downstream nodes.

### The Variable System
Downstream nodes can reference outputs from upstream nodes using `{{variable}}` syntax. When you type `{{` in an instruction field, a mention dropdown shows all available variables from connected upstream nodes (filtered by actual edge connections, not all nodes in the workflow).

For example, if an Agent node outputs `response.text`, a downstream node can reference it as `{{agent_abc123.response.text}}`.

### Agent Node Deep Dive
The Agent node is the most feature-rich:

1. **System Instructions** — Free-form text with `{{variable}}` mention support for dynamic inputs.
2. **Model Selection** — Choose from Gemini 2.0 Flash, Gemini 2.5 Flash Lite, Gemini 2.5 Flash, GPT-3.5 Turbo, or Claude 3 Haiku.
3. **Tools** — Enable web search or connect to external MCP servers.
4. **Output Format** — Text (free-form response) or JSON (structured output).
5. **JSON Schema Editor** — When JSON format is selected, a visual schema builder lets you define fields (name, type, description) and enum values for structured responses.

### Data Flow
1. The Start node triggers execution.
2. Connected nodes execute in topological order (upstream to downstream).
3. Each node's output is stored and available to downstream nodes via the variable system.
4. Conditional branches (If/Else) route execution based on runtime values.

### Current State
The workflow editor UI is fully functional for designing workflows. Start and Agent nodes have complete custom settings panels. If/Else, HTTP, Comment, and End nodes are defined in configuration and can be placed on the canvas but use generic rendering. The API supports creating, listing, and fetching workflows; save/update/delete are partially implemented.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix Nova) |
| Auth | Kinde (OAuth / magic link) |
| Database | MongoDB via Prisma ORM |
| Query | TanStack React Query v5 |
| Canvas | React Flow (@xyflow/react) |
| Forms | react-hook-form + zod |
| Testing | Vitest + Testing Library + jsdom |

## Architecture

```
app/
├── (routes)/
│   ├── (landing)/              # Public landing page
│   ├── (dashboard)/            # /workflow — workflow list
│   └── SingleWorkflow/         # /workflow/[id] — visual editor
├── api/
│   ├── auth/[kindeAuth]/       # Kinde auth handler
│   └── workflow/               # CRUD endpoints (GET, POST; no PUT/DELETE yet)
components/
├── ui/                         # 23 shadcn primitives incl. tags-input
└── workflow/                   # Canvas, nodes, mention-input, controls
context/
├── workflow-context.tsx         # Node/edge state, variable resolution
└── query-provider.tsx           # TanStack provider
features/
└── use-workflow.ts             # API hooks (CRUD queries + mutations)
hooks/
└── use-mobile.ts               # Responsive breakpoint detection
lib/
├── prisma.ts                   # DB client (singleton)
├── utils.ts                    # cn() class merger
├── helper.ts                   # nanoid-based ID generator
├── constants.ts                # AI models + tools config
├── rate-limit.ts               # Upstash Redis rate limiter (in-memory fallback)
├── timeout.ts                  # Promise timeout with AbortSignal support
└── workflow/node-config.ts     # Node types, configs, factory
proxy.ts                         # Kinde auth middleware (protects all routes except /)
```

## Prerequisites

- Node.js >= 20 (`.nvmrc` enforces Node 20)
- MongoDB Atlas account (free tier)
- Kinde account (free tier)
- Upstash Redis account (free tier) — optional; falls back to in-memory rate limiting

## Getting Started

```bash
git clone <repo-url>
cd workflow-mcp
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MongoDB connection string |
| `KINDE_CLIENT_ID` | Kinde OAuth client ID |
| `KINDE_CLIENT_SECRET` | Kinde OAuth client secret |
| `KINDE_ISSUER_URL` | Kinde tenant URL |
| `KINDE_SITE_URL` | App URL (http://localhost:3000) |
| `KINDE_POST_LOGIN_REDIRECT_URL` | Post-login redirect |
| `KINDE_POST_LOGOUT_REDIRECT_URL` | Post-logout redirect |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL (for rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

```bash
npx prisma generate
npm run dev
```

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
| `npm run test:coverage` | Run with coverage report |

## Project Structure

### Route Groups

- **`/`** — Landing page (public)
- **`/workflow`** — Dashboard listing saved workflows
- **`/workflow/[id]`** — Visual workflow editor with React Flow canvas

### Workflow Nodes

6 node types defined in configuration. Start and Agent have full custom components; others are draggable but use generic rendering:

| Node | Type | Deletable | Custom Component |
|------|------|-----------|-----------------|
| Start | Entry point | No | Yes |
| Agent | AI agent configuration | Yes | Yes |
| If/Else | Conditional branching | Yes | No (generic) |
| HTTP | API request | Yes | No (generic) |
| Comment | Annotation | Yes | No (generic) |
| End | Terminal | Yes | No (generic) |

### Agent Node Features

- **System instructions** with `{{variable}}` mention support (auto-complete from upstream node outputs)
- **Model selection** — 5 models: Gemini 2.0 Flash, Gemini 2.5 Flash Lite, Gemini 2.5 Flash, GPT-3.5 Turbo, Claude 3 Haiku
- **Tools** — Web Search (native), MCP Server (placeholder)
- **Output format** — Text or JSON
- **JSON schema editor** — Visual builder for structured output with support for string, number, boolean, and enum fields

### Variable System

Upstream node outputs are automatically available as `{{nodeId.outputName}}` variables. The mention input provides autocomplete suggestions scoped to nodes that connect upstream in the workflow.

### API Endpoints

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| GET | `/api/auth/[kindeAuth]` | No | None | Kinde auth handler |
| GET | `/api/workflow` | Yes | None | List user's workflows |
| POST | `/api/workflow` | Yes | 20 req / 60s per user | Create workflow (name required) |
| GET | `/api/workflow/:id` | Yes | None | Get single workflow |

- Rate limiting uses Upstash Redis (sliding window) with in-memory fallback when Redis is unavailable.
- All API routes have `maxDuration = 60s` configured for serverless deployment.
- Queries use a 55s timeout with AbortSignal (also triggers on client disconnect).
- PUT/PATCH/DELETE endpoints are not yet implemented.

## CI/CD

### GitHub Actions

| Workflow | Trigger | Jobs |
|----------|---------|------|
| `ci.yml` | PR to qa/main | Lint, TypeScript, Tests (matrix), Build |
| `deploy.yml` | CI pass on main/qa | Vercel deploy (production / preview) |

- **Composite setup action** — shared setup (checkout, node, deps, prisma, cache) used by all jobs
- **Caching** — Prisma engine + Next.js build cache
- **Coverage** — uploaded as artifact on every PR
- **Dependabot** — weekly npm updates (grouped), monthly GitHub Actions updates

### Branch Strategy

```
feature/foo → PR → qa (preview deploy) → PR → main (production deploy)
```

- `main` — production (protected, requires PR + CI pass)
- `qa` — staging (preview URL, optional protection)

### Deployment

Deploys to Vercel via GitHub Actions (not Git auto-deploy). Requires these secrets:

| Secret | Source |
|--------|--------|
| `VERCEL_TOKEN` | Vercel account settings |
| `VERCEL_ORG_ID` | `npx vercel whoami` |
| `VERCEL_PROJECT_ID` | Vercel project settings |
