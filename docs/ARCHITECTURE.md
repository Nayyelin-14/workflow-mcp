# Architecture

```
app/
├── (routes)/
│   ├── (landing)/              # Public landing page
│   ├── (dashboard)/            # /workflow — workflow list
│   └── SingleWorkflow/         # /workflow/[id] — visual editor
│       └── [workflowId]/
│           ├── page.tsx            # Canvas page (providers, layout)
│           ├── layout.tsx          # Minimal wrapper
│           └── _common/
│               ├── header.tsx          # Edit/preview toggle, save, delete
│               ├── workflow-canva.tsx  # Main ReactFlow canvas
│               └── NodePanel.tsx       # Drag-and-drop node palette
├── api/
│   ├── auth/[kindeAuth]/       # Kinde auth handler
│   └── workflow/               # CRUD endpoints (GET, POST, PUT, GET/:id)
├── error.tsx                   # Global error boundary
├── loading.tsx                 # Root loading state
└── globals.css                 # Tailwind v4 + shadcn theme (oklch)
components/
├── ui/                         # 27+ shadcn primitives
├── ai-elements/                # Chat UI (Conversation, Message, PromptInput)
├── workflow/
│   ├── live-chat/              # Preview chat panel (Sheet + ChatPanel)
│   ├── workflow-node.tsx       # Generic node wrapper with settings dialog
│   ├── controls.tsx            # Canvas zoom/pan/select controls
│   ├── mention-input.tsx       # {{variable}} mention autocomplete
│   └── custom-nodes/           # Node type components and settings
│       ├── agent/              # Agent node + settings + JSON schema editor
│       ├── start/              # Start node + settings
│       ├── end/                # End node + settings
│       ├── if-else/            # If/Else node + settings
│       └── comment/            # Comment node (inline textarea)
context/
├── workflow-context.tsx        # Live node/edge state, variable resolution
└── query-provider.tsx          # TanStack QueryClient provider
features/
└── use-workflow.ts             # React Query hooks (list, get, create, update)
hooks/
├── use-node-data.ts            # Local state with blur-based commit
├── use-unsaved-change.ts       # Track unsaved changes against saved baseline
├── use-mobile.ts               # Responsive breakpoint detection
├── use-as-ref.ts               # Stable callback refs
├── use-isomorphic-layout-effect.ts  # SSR-safe useLayoutEffect
└── __tests__/
store/
└── workflow-store.ts           # Zustand store (savedNodes, savedEdges)
lib/
├── prisma.ts                   # DB client (singleton)
├── utils.ts                    # cn() class merger
├── helper.ts                   # nanoid-based ID generator
├── constants.ts                # DRAG_DATA_TYPE, AI models, tools
├── timeout.ts                  # Promise timeout with AbortSignal
├── api-utils.ts                # Auth helpers, error responses
├── rate-limit.ts               # Upstash Redis rate limiter (in-memory fallback)
├── redis.ts                    # Upstash Redis client
├── auth-cache.ts               # Redis-cached user lookup
├── compose-refs.ts             # React ref composition utility
└── workflow/node-config.ts     # Node type definitions, configs, factory
patches/
└── next-themes+0.4.6.patch     # patch-package fix for next-themes
proxy.ts                         # Kinde auth middleware
```

## State Management

Three layers:

1. **Zustand** (`store/workflow-store.ts`) — Canonical "saved" state. Stores `savedNodes`/`savedEdges` after a successful save to compare against current canvas state.

2. **React Context** (`context/workflow-context.tsx`) — Live working state for the open workflow. Provides `nodes`, `setNodes`, `edges`, `setEdges`, `view` (edit/preview), and `getVariablesForNode()`.

3. **TanStack React Query** (`features/use-workflow.ts`) — Server state. Queries and mutations for workflow CRUD. Automatically caches and invalidates.
