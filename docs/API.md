# API Endpoints

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| GET | `/api/auth/[kindeAuth]` | No | None | Kinde auth handler (login, register, callback, logout) |
| GET | `/api/workflow` | Yes | None | List user's workflows |
| POST | `/api/workflow` | Yes | 20 req / 60s per user | Create workflow (name required) |
| GET | `/api/workflow/:id` | Yes | None | Get single workflow with parsed flowObject |
| PUT | `/api/workflow/:id` | Yes | None | Save workflow nodes/edges to flowObject |
| DELETE | `/api/workflow/:id` | Yes | None | Delete workflow |
| POST | `/api/upstash/trigger` | No | None | Enqueue a workflow run on QStash (returns `workflowRunId`) |
| GET | `/api/workflow/live-chat` | No | None | SSE stream for a workflow run (`?id=<workflowRunId>`) |
| POST | `/api/workflow/live-chat` | No (QStash signature) | None | QStash callback — executes the workflow |

- Rate limiting uses Upstash Redis (sliding window) with in-memory fallback when Redis is unavailable.
- All API routes have `maxDuration = 60s` configured for serverless deployment.
- Queries use a 55s timeout with AbortSignal (also triggers on client disconnect).
- `/api/upstash/trigger` and `/api/workflow/live-chat` are public (`publicPaths` in `proxy.ts`) because QStash must reach them without a session; the workflow list/create/update/delete endpoints re-check auth server-side and return 401.
