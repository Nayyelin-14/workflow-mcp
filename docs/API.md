# API Endpoints

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| GET | `/api/auth/[kindeAuth]` | No | None | Kinde auth handler |
| GET | `/api/workflow` | Yes | None | List user's workflows |
| POST | `/api/workflow` | Yes | 20 req / 60s per user | Create workflow (name required) |
| GET | `/api/workflow/:id` | Yes | None | Get single workflow with parsed flowObject |
| PUT | `/api/workflow/:id` | Yes | None | Save workflow nodes/edges to flowObject |
| POST | `/api/chat` | — | — | Chat completion (endpoint referenced by preview panel) |

- Rate limiting uses Upstash Redis (sliding window) with in-memory fallback when Redis is unavailable.
- All API routes have `maxDuration = 60s` configured for serverless deployment.
- Queries use a 55s timeout with AbortSignal (also triggers on client disconnect).
