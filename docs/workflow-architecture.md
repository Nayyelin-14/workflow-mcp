# Workflow Architecture & Execution Flow

## Table of Contents
1. [Tech Stack](#tech-stack)
2. [Database Schema](#database-schema)
3. [Creating a Workflow](#creating-a-workflow)
4. [Editing the Canvas](#editing-the-canvas)
5. [Saving](#saving)
6. [Running a Workflow](#running-a-workflow)
7. [The Transport Layer](#the-transport-layer)
8. [QStash Trigger (Call 1)](#qstash-trigger-call-1)
9. [SSE Stream (Call 2)](#sse-stream-call-2)
10. [QStash Callback — Workflow Execution Begins](#qstash-callback--workflow-execution-begins)
11. [Node Execution Engine](#node-execution-engine)
12. [Individual Node Executors](#individual-node-executors)
13. [Streaming Responses](#streaming-responses)
14. [Variable System](#variable-system)
15. [Full Execution Trace (Start → Agent → End)](#full-execution-trace-start--agent--end)
16. [Key Observations & Limitations](#key-observations--limitations)
17. [File Index](#file-index)

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js** (App Router, React 19) |
| UI | **React Flow** (`@xyflow/react` v12) — canvas, nodes, edges |
| AI | **AI SDK** (`ai`, `@ai-sdk/react` v6) — `useChat` hook, `DefaultChatTransport`, `streamText` |
| LLM Provider | **OpenRouter** (via custom `streamAgentAction` server action) |
| Database | **MongoDB** via **Prisma** ORM |
| Queue | **Upstash QStash** — reliable async job queue |
| Realtime | **Upstash Realtime** (Redis pub/sub) — streaming chunks |
| Auth | **Kinde Auth** (with Redis session cache) |
| State | **React Context** (canvas editing) + **Zustand** (save tracking) + **TanStack Query** (API data) |

---

## 2. Database Schema

```prisma
model Workflow {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  userId      String
  name        String
  description String
  flowObject  String   @default("{}")    // JSON: { nodes: Node[], edges: Edge[] }
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

Key thing: **`flowObject`** is a JSON string storing the entire workflow graph — `{ "nodes": [...], "edges": [...] }`. Each node has `{ id, type, position, data }` where `data` contains type-specific settings (instructions, model, conditions, value, etc.)

---

## 3. Creating a Workflow

### 3a. User clicks "New Workflow"

**File:** `app/(routes)/(dashboard)/_common/createWorkflow.tsx:51-57`

DialogTrigger opens a form with name + description fields.

**File:** `createWorkflow.tsx:42-48`

On submit, calls:
```ts
createWorkflowMutation(data, { onSuccess: () => setOpen(false) })
```

### 3b. Mutation fires

**File:** `features/use-workflow.ts:59-72`

`useCreateWorkFlow` sends `POST /api/workflow` with `{ name, description }`:
```ts
mutationFn: async ({ name, description }) =>
  axios.post("/api/workflow", { name, description }).then(res => res.data)
```

### 3c. Server creates MongoDB document

**File:** `app/api/workflow/route.ts:31-95` — `POST` handler:

| Step | Lines | Code |
|---|---|---|
| Auth | 43-44 | `const user = await getAuthenticatedUser()` |
| Rate limit | 46-48 | `rateLimit(key, { maxRequests: 20, windowMs: 60_000 })` |
| Validation | 36-40 | Name required check |
| Create | 61-68 | `prisma.workflow.create({ data: { userId: user.id, name, description } })` |
| Response | 73-76 | Returns `201 { workflow }` |

Note: `flowObject` defaults to `"{}"` via Prisma schema default.

### 3d. Frontend navigates to editor

Redirects to `/SingleWorkflow/${newWorkflow.id}`.

---

## 4. Editing the Canvas

### 4a. Page Load

**File:** `app/(routes)/SingleWorkflow/[workflowId]/page.tsx:12-17`

```tsx
const workflowId = params?.workflowId as string;
const { data: workflow, isPending } = useGetWorkflowById(workflowId);
const flowObject = workflow?.flowObject as { nodes: Node[]; edges: Edge[] } | undefined;
```

**File:** `features/use-workflow.ts:36-53` — `useGetWorkflowById`:

```tsx
queryFn: async () => {
  const res = await axios.get(`/api/workflow/${workflowId}`);
  const result = res?.data?.data as WorkflowDetail & { flowObject: { nodes: Node[]; edges: Edge[] } };
  if (result?.flowObject) {
    setSavedState(result.flowObject.nodes, result.flowObject.edges);
  }
  return result ?? null;
},
```

**File:** `app/api/workflow/[workflowId]/route.ts:14-51` — `GET` handler:

| Step | Lines | Code |
|---|---|---|
| Auth | 19-20 | `getAuthenticatedUser()` |
| Fetch | 24-30 | `prisma.workflow.findUnique({ where: { id: workflowId } })` |
| Ownership | 32 | `workflow.userId !== user.id` — 404 |
| Parse | 38 | `flowObject = JSON.parse(workflow.flowObject)` |
| Response | 39-46 | `{ data: { id, name, flowObject } }` |

### 4b. WorkflowProvider initializes state

**File:** `context/workflow-context.tsx:40-43`

```tsx
const start_node = createNode({ type: NodeTypeEnum.START });
const [nodes, setNodes] = useState<Node[]>(() =>
  initialNodes?.length ? initialNodes : [start_node],
);
const [edges, setEdges] = useState<Edge[]>(initialEdges ?? []);
```

If empty (new workflow), seeds a default **Start** node.

**File:** `context/workflow-context.tsx:53-76` — Variable auto-complete:

```ts
const getUpStreamNodes = (nodeId: string) => {
  const upstream = new Set<string>();
  const addToset = (id: string) => {
    edges.filter((e) => e.target === id).forEach((e) => {
      upstream.add(e.source);
      addToset(e.source);
    });
  };
  addToset(nodeId);
  return upstream;
};
const getVariablesForNode = (nodeId: string) => {
  const upstreamNodeIds = getUpStreamNodes(nodeId);
  return nodes.filter((node) => upstreamNodeIds.has(node.id))
    .map((n) => ({ id: n.id, label: n.data.label, outputs: (n.data.outputs as string[]) || [] }));
};
```

### 4c. ReactFlow Canvas renders

**File:** `app/(routes)/SingleWorkflow/[workflowId]/_common/workflow-canva.tsx:48-54`

```tsx
const nodeTypes = {
  [NodeTypeEnum.START]: StartNode,
  [NodeTypeEnum.AGENT]: AgentNode,
  [NodeTypeEnum.IF_ELSE]: IfElseNode,
  [NodeTypeEnum.COMMENT]: CommentNode,
  [NodeTypeEnum.END]: EndNode,
};
```

**File:** `workflow-canva.tsx:133-152` — `<ReactFlow>` renders with `nodes`, `edges`, `nodeTypes`.

### 4d. Drag & Drop from NodePanel

**File:** `app/(routes)/SingleWorkflow/[workflowId]/_common/NodePanel.tsx:7-20`

```ts
const NODE_LIST = [
  { group: "Core", items: [NodeTypeEnum.AGENT, NodeTypeEnum.END, NodeTypeEnum.COMMENT] },
  { group: "Logic", items: [NodeTypeEnum.IF_ELSE] },
  { group: "Network", items: [NodeTypeEnum.HTTP] },
];
```

**File:** `NodePanel.tsx:22-25` — Drag handler sets node type:

```ts
const onDragStart = (event, nodeType) => {
  event.dataTransfer.setData(DRAG_DATA_TYPE, nodeType);
  event.dataTransfer.effectAllowed = "move";
};
```

`DRAG_DATA_TYPE = "application/reactflow"` from `lib/constants.ts`.

**File:** `workflow-canva.tsx:86-109` — `onDrop`:

```tsx
const onDrop = useCallback((event) => {
  const node_type = event.dataTransfer.getData(DRAG_DATA_TYPE) as NodeType;
  const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
  const newNode = createNode({ type: node_type, position });
  setNodes((prev) => [...prev, newNode]);
}, [screenToFlowPosition, setNodes]);
```

### 4e. `createNode()` — the factory

**File:** `lib/workflow/node-config.ts:163-197`

```ts
export function createNode({ type, position = { x: 400, y: 200 } }: CreateNodeOptions) {
  const config = getNodeConfig(type);
  const id = generateID(type);  // nanoid, e.g. "agent_aB3xYz9LmK"
  return {
    id, type, position,
    deleteable: type === NodeTypeEnum.START ? false : true,
    data: {
      label: config.label,
      color: config.color,
      nodeType: type,
      outputs: config.outputs,
      ...config.inputs,  // Merge type-specific defaults
    },
  };
}
```

### 4f. Node Configuration Registry

**File:** `lib/workflow/node-config.ts:46-127` — `NODE_CONFIG`:

| Node Type | Lines | Key Defaults |
|---|---|---|
| `start` | 47-56 | `{ inputValue: " " }` |
| `agent` | 58-72 | `{ instructions: "", model: MODELS[0], tools: [], outputFormat: "text", responseSchema: null }` |
| `if_else` | 74-90 | `{ conditions: [{ caseName: "", variable: "", operator: "", value: "" }] }` |
| `http` | 92-104 | `{ method: "GET", url: "", headers: {}, body: {} }` — no visual component, no executor |
| `comment` | 106-115 | `{ comment: "" }` — no executor |
| `end` | 117-126 | `{ value: " " }` |

**File:** `lib/workflow/node-config.ts:129-152` — Lookup functions:

```ts
export const getNodeConfig = (type: NodeType) => NODE_CONFIG?.[type] || null;
export const getNodeExecutor = (type: NodeType) => NODE_EXECUTORS?.[type as keyof typeof NODE_EXECUTORS] || null;
```

### 4g. Connecting nodes (edges)

**File:** `workflow-canva.tsx:71-79`

```tsx
const onConnect = useCallback((params: Connection) => {
  setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot));
}, [setEdges]);
```

Creates edges like `{ id: "xy-edge__a1-b2", source: "agent_yyy", target: "end_zzz" }`.

---

## 5. Saving

### 5a. Unsaved changes detection

**File:** `store/workflow-store.ts:4-20` — Zustand store:

```ts
interface WorkflowStoreState {
  savedNodes: Node[];
  savedEdges: Edge[];
}
export const useWorkflowStore = create<WorkflowStoreState>((set) => ({
  savedEdges: [],
  savedNodes: [],
  setSavedState: (nodes, edges) => set({ savedEdges: edges, savedNodes: nodes }),
  resetSavedState: () => set({ savedEdges: [], savedNodes: [] }),
}));
```

A custom hook `useUnsavedChanges` compares current `nodes`/`edges` with `savedNodes`/`savedEdges`. Difference triggers the **ActionBar** (`workflow-canva.tsx:167-191`).

### 5b. Save button

**File:** `workflow-canva.tsx:120-127`

```tsx
const handleSaveChanges = () => {
  updateWorkFlowAction({ nodes, edges });
};
```

**File:** `features/use-workflow.ts:74-92` — `useUpdateWorkflow`:

```ts
mutationFn: async (data) => axios.put(`/api/workflow/${workflowId}`, data).then(res => res.data),
onSuccess: (result) => {
  setSavedState(flowObject.nodes, flowObject.edges);
  toast.success("Workflow updated successfully");
},
```

### 5c. Server stores JSON string

**File:** `app/api/workflow/[workflowId]/route.ts:53-101` — `PUT` handler:

| Step | Lines | Code |
|---|---|---|
| Auth | 58-59 | `getAuthenticatedUser()` |
| Get body | 62-65 | `{ nodes, edges } = await req.json()` |
| Ownership | 66-72 | `prisma.workflow.findUnique` + userId check |
| Update | 81-84 | `prisma.workflow.update({ where: { id }, data: { flowObject: JSON.stringify({ nodes, edges }) } })` |
| Response | 90-97 | Returns updated workflow |

MongoDB stores: `"flowObject": "{\"nodes\":[...],\"edges\":[...]}"`

---

## 6. Running a Workflow

When user switches to **Preview** mode and types a message:

### 6a. Chat sheet opens

**File:** `components/workflow/live-chat/index.tsx:15-37`

```tsx
<Sheet open={view === "preview"} ...>
  <SheetContent side="right" ...>
    <ChatPanel workflowId={workflowId} />
  </SheetContent>
</Sheet>
```

### 6b. ChatPanel initializes `useChat`

**File:** `components/workflow/live-chat/chat-panel.tsx:39-45`

```tsx
const { messages, sendMessage, status } = useChat<UIMessage>({
  id: chatId ?? undefined,
  messages: [],
  transport: createWorkFlowTransport({ workflowId }),
});
```

### 6c. User sends message

**File:** `chat-panel.tsx:56-62`

```tsx
const handleSubmit = (message: PromptInputMessage) => {
  if (!message?.text?.trim()) return;
  sendMessage({ text: message.text });
  setInput("");
};
```

This triggers the custom transport's `fetch`.

---

## 7. The Transport Layer

### 7a. Custom DefaultChatTransport

**File:** `lib/transport.ts:3-54`

```ts
export const createWorkFlowTransport = ({ workflowId }) => {
  return new DefaultChatTransport({
    api: "/api/upstash/trigger",

    async prepareSendMessagesRequest({ messages }) {
      return { body: { workflowId, messages } };
    },

    fetch: async (input, init) => {
      // Call 1: POST /api/upstash/trigger
      const triggerResponse = await fetch(input, init);        // line 39
      const triggerData = await triggerResponse.json();         // line 42
      const workflowRunId = triggerData.workflowRunId;          // line 43

      // Call 2: Open SSE stream
      const sseUrl = `/api/workflow/live-chat?id=${workflowRunId}`;  // line 46
      return fetch(sseUrl, { method: "GET" });                 // line 49-51
    },
  });
};
```

Two sequential HTTP calls:

**Call 1** — `POST /api/upstash/trigger` with `{ workflowId, messages }`

**Call 2** — `GET /api/workflow/live-chat?id=${workflowRunId}` (SSE stream)

---

## 8. QStash Trigger (Call 1)

### 8a. POST /api/upstash/trigger

**File:** `app/api/upstash/trigger/route.ts:1-56`

| Step | Lines | Code |
|---|---|---|
| Client init | 4-7 | `new Client({ baseUrl, token })` |
| Base URL | 9-11 | From `VERCEL_URL` or `http://localhost:3000` |
| Parse body | 18 | `{ workflowId, messages } = await request.json()` |
| Build payload | 23-35 | `{ url, retries: 3, keepTriggerConfig: true, headers, body }` |
| Trigger | 39 | `const { workflowRunId } = await client.trigger(triggerPayload)` |
| Response | 42-45 | `{ success: true, workflowRunId }` |

QStash enqueues the job reliably and returns `workflowRunId` immediately.

---

## 9. SSE Stream (Call 2)

### 9a. GET /api/workflow/live-chat?id=wfr_xxx

**File:** `app/api/workflow/live-chat/route.ts:9-58`

| Step | Lines | Code |
|---|---|---|
| Parse ID | 14-16 | `searchParams.get("id")` |
| Get channel | 24 | `const channel = realtime.channel(workflowRunId)` |
| Create stream | 27-51 | `new ReadableStream({ start(controller) { ... } })` |
| Subscribe | 31-44 | `channel.subscribe({ events: ["workflow.chunk"], onData({ data }) { ... } })` |
| Enqueue SSE | 36-37 | `controller.enqueue(`data: ${JSON.stringify(data)}\n\n`)` |
| On finish | 39-42 | `if (data.type === "finish") controller.close()` |
| Abort | 45-47 | `req.signal.addEventListener("abort", () => controller.close())` |
| Return | 53-57 | `new Response(stream, { headers: { "Content-Type": "text/event-stream" } })` |

**File:** `lib/realtime.ts:12`

```ts
export const realtime = new Realtime({ schema, redis });
```

Subscribes to Upstash Realtime channel (Redis pub/sub). Browser keeps SSE connection open.

---

## 10. QStash Callback — Workflow Execution Begins

### 10a. serve() handler triggered

**File:** `app/api/workflow/live-chat/route.ts:60-139`

```ts
export const { POST } = serve(
  async (context) => {
    const { workflowId, messages } = context.requestPayload;      // line 67
    const workflowRunId = context.workflowRunId;                   // line 75
    const channel = realtime.channel(workflowRunId);               // line 76
```

`serve()` from `@upstash/workflow/nextjs`:
- Parses QStash callback
- Provides `context.run()` for durable steps (independent retry)
- Manages lifecycle

### 10b. Extract user input

**File:** `live-chat/route.ts:77-82`

```ts
const message = messages[messages.length - 1];
const userInput =
  message.role === "user" && message.parts[0].type === "text"
    ? message.parts[0].text : "";
```

### 10c. Step 1: Fetch workflow from DB

**File:** `live-chat/route.ts:85-108` — `context.run("fetch-from-database", ...)`

```ts
const workflowData = await prisma.workflow.findUnique({ where: { id: workflowId } });
const obj = JSON.parse(workflowData.flowObject);
const nodes = obj.nodes as Node[];
const edges = obj.edges as Edge[];
return { nodes, edges };
```

Returns the parsed graph.

### 10d. Step 2: Execute node graph

**File:** `live-chat/route.ts:111-124` — `context.run("worflow-execution", ...)`

```ts
await executeWorkflow(nodes, edges, userInput, messages, channel, workflowRunId);
```

---

## 11. Node Execution Engine

### 11a. Entry point

**File:** `lib/workflow/executeWorkflow.ts:6-71`

| Step | Lines | Code |
|---|---|---|
| Find Start | 14 | `nodes.find(n => n.type === NodeTypeEnum.START)` |
| Init context | 17-26 | `{ outputs: { [startNode.id]: { input: userInput } }, history, workflowRunId, channel }` |
| Walk loop | 36-65 | `while (currentNodeId) { ... }` |
| Lookup executor | 45 | `getNodeExecutor(node.type)` |
| Execute | 49 | `const result = await executor(node, context)` |
| Store output | 50 | `context.outputs[node.id] = result.output` |
| Follow edge | 57 | `edges.find(e => e.source === currentNodeId)` — **first edge only** |
| Next node | 60 | `currentNodeId = outgoingEdge.target` |

### 11b. Executor Registry

**File:** `lib/workflow/node-config.ts:39-44`

```ts
export const NODE_EXECUTORS = {
  [NodeTypeEnum.START]:   () => ExecuteStartNode,
  [NodeTypeEnum.AGENT]:   () => ExecuteAgentNode,
  [NodeTypeEnum.IF_ELSE]: () => ExecuteIfElseNode,
  [NodeTypeEnum.END]:     () => ExecuteEndNode,
};
```

### 11c. Context Type

**File:** `types/workflow.ts:6-14`

```ts
type Channel = { emit: (...args: any[]) => Promise<void> };
export type ExecutorContextType = {
  outputs: Record<string, unknown>;
  history: UIMessage[];
  workflowRunId: string;
  channel: Channel;
};
export type ExecutorResultType = {
  output: unknown;
};
```

---

## 12. Individual Node Executors

### 12a. START NODE

**File:** `components/workflow/custom-nodes/start/startnode-executor.ts:5-14`

```ts
export const ExecuteStartNode = (node: Node, context: ExecutorContextType) => {
  const startOutput = context.outputs[node.id] as { input?: string } | undefined;
  return { output: { input: startOutput?.input || "" } };
};
```

Passes through the pre-loaded user input from `context.outputs[startNodeId].input`.

### 12b. AGENT NODE (LLM)

**File:** `components/workflow/custom-nodes/agent/agentnode-executor.tsx:9-146`

| Step | Lines | Code |
|---|---|---|
| Destructure context | 15 | `const { channel, history } = context` |
| Read config | 17-23 | `instructions, model, tools, outputFormat, responseSchema` from `node.data` |
| Resolve variables | 25-28 | `replacesdVariables(instructions, context)` |
| Configure JSON schema | 33-41 | `jsonOutput = outputFormat === "json" ? { output: Output.object({ ... }) } : undefined` |
| Call LLM | 43-52 | `const result = await streamAgentAction({ model, instructions, history, jsonOutput, selectedTools })` |
| JSON mode | 76-86 | `const text = await result.text; return { output: JSON.parse(text) }` |
| Text mode: stream | 88-136 | Iterate `result.fullStream`, emit chunks to channel |

**Streaming chunks (text mode):**

```ts
let fullText = "";
for await (const chunk of result.fullStream) {
  if (chunk.type === "text-delta") {
    fullText += chunk.text;
    await channel.emit("workflow.chunk", {
      type: "data-workflow-Node",
      id: node.id,
      data: { status: "loading", type: "text-delta", output: fullText },
    });
  }
  if (chunk.type === "tool-call") {
    await channel.emit("workflow.chunk", {
      type: "data-workflow-Node",
      data: { status: "loading", type: "tool-call", toolCall: { name: chunk.toolName } },
    });
  }
}
return { output: { text: fullText } };
```

**Server action — `streamAgentAction`:**

**File:** `app/actions/agent-workflow.ts:12-55`

| Step | Lines | Code |
|---|---|---|
| Convert messages | 28 | `const modelMessage = await convertToModelMessages(history)` |
| Build tools | 32-34 | Map selected tools (webSearch, etc.) |
| Build system prompt | 40-43 | `You are a helpful assistant... Must use instructions: ${instructions}` |
| streamText | 45-52 | `streamText({ model: openrouter.chat(model), system, messages, tools, ...jsonOutput })` |

### 12c. IF/ELSE NODE

**File:** `components/workflow/custom-nodes/if-else/ifelse-executor.tsx:12-91`

```ts
export const ExecuteIfElseNode = (node, context) => {
  const { outputs } = context;
  const conditions = (node.data?.conditions as ExecuteCondition[]) || [];

  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];

    if (!condition.operator || condition.value === undefined || !condition.variable) {
      continue;
    }

    const variable = replacesdVariables(condition.variable, outputs);
    const conditionValue = condition.value;

    const varExpr = needsQuoting(variable) ? JSON.stringify(variable) : variable;
    const valueExpr = needsQuoting(conditionValue) ? JSON.stringify(conditionValue) : conditionValue;
    const expression = `${varExpr} ${condition.operator} ${valueExpr}`;

    const parser = new Parser();
    const result = parser.evaluate(expression);

    if (result) {
      return { output: { result: true, selectedBranch: `condition-${i}` } };
    }
  }
  return { output: { result: false, selectedBranch: "else" } };
};
```

**Problem:** Engine follows `edges.find(e.source === currentNodeId)` — always the first edge, not the one matching `selectedBranch`.

### 12d. END NODE

**File:** `components/workflow/custom-nodes/end/endnode-executer.tsx:3-13`

```ts
export const ExecuteEndNode = (node: Node) => {
  const text = node?.data.value as string;
  return { output: { input: text } };
};
```

Reads `node.data.value` directly. **Does NOT resolve `{{variables}}`** — noted limitation.

---

## 13. Streaming Responses

### 13a. Real-time data flow

```
QStash Worker (Node.js)
  |
  +-- Agent executor: channel.emit("workflow.chunk", {...})
  |   agentnode-executor.tsx:93-104, 117-130
  |
  v
Upstash Realtime (Redis Pub/Sub)
  |  lib/realtime.ts:12
  |
  |  Subscriber: GET /api/workflow/live-chat SSE endpoint
  |  live-chat/route.ts:31-44
  |    channel.subscribe({ events: ["workflow.chunk"], onData({ data }) {
  |      controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
  |    }})
  |
  v
Browser
  |
  +-- DefaultChatTransport reads SSE events
  |   lib/transport.ts:49-51 (fetch returns SSE response)
  |
  +-- AI SDK's useChat hook parses SSE into UIMessageChunks
  |   chat-panel.tsx:39 (useChat receives transport)
  |
  +-- React re-renders Message component
      chat-panel.tsx:103-119
        msg.parts.map((p) => p.type === "text" && <MessageResponse>{p.text}</MessageResponse>)
```

---

## 14. Variable System

### 14a. Variable resolution

**File:** `lib/helper.ts:10-15`

```ts
import Mustache from "mustache";
export function replacesdVariables(template: string, variables: Record<string, unknown>) {
  return Mustache.render(template, variables);
}
```

Variables referenced as `{{nodeId.outputKey}}`:
- `{{start_xxx.input}}` — user's original input
- `{{agent_yyy.text}}` — agent's full response

`context.outputs` is the variables dictionary:
```ts
context.outputs = {
  "start_xxx": { input: "user message" },
  "agent_yyy": { text: "AI response..." },
};
```

### 14b. UI auto-complete

**File:** `context/workflow-context.tsx:53-76`

`getVariablesForNode(nodeId)` walks upstream edges via reverse traversal and returns available variables for the `MentionInput` component.

---

## 15. Full Execution Trace (Start - Agent - End)

This section walks through a complete workflow execution from creation to streaming response, referencing every file and line number involved.

### Phase A: Create the workflow document

**A1.** User clicks "New Workflow" dialog
- **File:** `app/(routes)/(dashboard)/_common/createWorkflow.tsx:51-57`

**A2.** Form submit calls `useCreateWorkFlow` mutation
- **File:** `createWorkflow.tsx:42-48`
- **File:** `features/use-workflow.ts:59-72`

**A3.** `POST /api/workflow` creates MongoDB document via Prisma
- **File:** `app/api/workflow/route.ts:61-68`
- Creates: `{ id: "abc123", userId: "...", name: "My Workflow", flowObject: "{}" }`

**A4.** Navigate to `/SingleWorkflow/abc123`

### Phase B: Load the canvas

**B1.** Page component fetches workflow
- **File:** `app/(routes)/SingleWorkflow/[workflowId]/page.tsx:12-17`
- `useGetWorkflowById(workflowId)` -> `GET /api/workflow/abc123`

**B2.** Server returns parsed flowObject
- **File:** `app/api/workflow/[workflowId]/route.ts:24-38`
- `JSON.parse(workflow.flowObject)` -> `{ nodes: [], edges: [] }` (new workflow)

**B3.** WorkflowProvider seeds default Start node
- **File:** `context/workflow-context.tsx:37-43`
- `createNode({ type: "start" })` generates `start_xxx`

**B4.** `createNode()` factory
- **File:** `lib/workflow/node-config.ts:163-197`
- Uses `generateID(type)` -> `start_aB3xYz9LmK` (nanoid)
- Merges `NODE_CONFIG["start"]` defaults: `{ inputValue: " ", outputs: ["input"] }`

**B5.** Zustand store snapshots initial state
- **File:** `features/use-workflow.ts:46` -> `setSavedState(nodes, edges)`
- **File:** `store/workflow-store.ts:11-14`

**B6.** ReactFlow canvas renders with Start node
- **File:** `workflow-canva.tsx:48-54` (nodeTypes), `:133-152` (ReactFlow render)

### Phase C: Build the workflow (drag + configure)

**C1.** Drag Agent from NodePanel
- **File:** `NodePanel.tsx:22-25` — `event.dataTransfer.setData(DRAG_DATA_TYPE, "agent")`

**C2.** Drop on canvas -> `onDrop`
- **File:** `workflow-canva.tsx:86-109`
- `createNode({ type: "agent", position })` -> `agent_yyy`

**C3.** Drag End node (same mechanism) -> `end_zzz`

**C4.** Connect nodes via handles
- **File:** `workflow-canva.tsx:71-79`
- `onConnect` -> `addEdge` creates:
  - `{ source: "start_xxx", target: "agent_yyy" }`
  - `{ source: "agent_yyy", target: "end_zzz" }`

**C5.** Configure Agent node (double-click)
- Instructions: `"Answer: {{start_xxx.input}}"`
- Model, tools, outputFormat, etc.

**C6.** Configure End node (double-click)
- Value: `"{{agent_yyy.text}}"`

**C7.** Variable auto-complete via `MentionInput`
- **File:** `context/workflow-context.tsx:53-76` — `getVariablesForNode()` walks upstream edges

### Phase D: Save

**D1.** "Save Changes" button
- **File:** `workflow-canva.tsx:120-127` -> `updateWorkFlowAction({ nodes, edges })`

**D2.** `PUT /api/workflow/abc123`
- **File:** `features/use-workflow.ts:77-78` — axios PUT

**D3.** Server stores JSON
- **File:** `app/api/workflow/[workflowId]/route.ts:81-84`
- `prisma.workflow.update({ data: { flowObject: JSON.stringify({ nodes, edges }) } })`

**D4.** Zustand updates saved state
- **File:** `features/use-workflow.ts:83-84` -> `setSavedState(nodes, edges)`

### Phase E: Execute (send a message)

**E1.** Switch to Preview mode -> Chat sheet opens
- **File:** `components/workflow/live-chat/index.tsx:15-37`

**E2.** ChatPanel initializes `useChat` with custom transport
- **File:** `components/workflow/live-chat/chat-panel.tsx:39-45`
- `createWorkFlowTransport({ workflowId })`

**E3.** User types message and sends
- **File:** `chat-panel.tsx:56-62` -> `sendMessage({ text: "Hello" })`

**E4.** Transport's custom `fetch` fires (Call 1: trigger)
- **File:** `lib/transport.ts:33-51`
- `POST /api/upstash/trigger` with `{ workflowId, messages }`

**E5.** Trigger route enqueues QStash job
- **File:** `app/api/upstash/trigger/route.ts:23-39`
- `client.trigger({ url: "...", retries: 3, body: { workflowId, messages } })`
- Returns `{ workflowRunId: "wfr_xxx" }`

**E6.** Transport opens SSE stream (Call 2)
- **File:** `lib/transport.ts:46-51`
- `GET /api/workflow/live-chat?id=wfr_xxx`
- Browser subscribes to SSE events

**E7.** SSE endpoint subscribes to Realtime channel
- **File:** `app/api/workflow/live-chat/route.ts:24-44`
- `channel.subscribe({ events: ["workflow.chunk"], onData({ data }) { controller.enqueue(...) } })`

### Phase F: QStash callback — workflow execution

**F1.** QStash delivers job to `POST /api/workflow/live-chat`
- **File:** `live-chat/route.ts:60-139` — `serve()` handler

**F2.** Extract user message
- **File:** `live-chat/route.ts:77-82`
- `userInput = "Hello"`

**F3.** Step 1: Fetch workflow from database
- **File:** `live-chat/route.ts:85-108` — `context.run("fetch-from-database", ...)`
- `prisma.workflow.findUnique({ where: { id: "abc123" } })`
- `JSON.parse(flowObject)` -> `{ nodes: [start_xxx, agent_yyy, end_zzz], edges: [e1, e2] }`

**F4.** Step 2: Execute workflow
- **File:** `live-chat/route.ts:111-124` — `context.run("worflow-execution", ...)`
- Calls `executeWorkflow(nodes, edges, "Hello", messages, channel, "wfr_xxx")`

### Phase G: Node Execution Engine

**G1.** Initialize context
- **File:** `lib/workflow/executeWorkflow.ts:17-26`
```ts
context = {
  outputs: { start_xxx: { input: "Hello" } },
  history: messages,
  workflowRunId: "wfr_xxx",
  channel: <realtime channel>,
};
```

**G2.** Execution loop begins
- **File:** `executeWorkflow.ts:28-65` — `while (currentNodeId)`

### Phase H: Start Node execution

**H1.** Executor lookup
- **File:** `executeWorkflow.ts:45` -> `getNodeExecutor("start")`
- **File:** `node-config.ts:40` -> `() => ExecuteStartNode`

**H2.** ExecuteStartNode
- **File:** `components/workflow/custom-nodes/start/startnode-executor.ts:5-14`
```ts
const startOutput = context.outputs["start_xxx"] as { input?: string };
return { output: { input: "Hello" } };
```

**H3.** Store output and follow edge
- **File:** `executeWorkflow.ts:50` — `context.outputs["start_xxx"] = { input: "Hello" }`
- **File:** `executeWorkflow.ts:57-60` — Find edge `e1` (source: start_xxx -> target: agent_yyy)
- `currentNodeId = "agent_yyy"`

### Phase I: Agent Node execution (LLM call)

**I1.** Executor lookup
- **File:** `executeWorkflow.ts:45` -> `getNodeExecutor("agent")`
- **File:** `node-config.ts:41` -> `() => ExecuteAgentNode`

**I2.** Read agent config
- **File:** `agentnode-executor.tsx:17-23`
```ts
const { instructions, model, tool, outputFormat, responseSchema } = node.data;
// instructions = "Answer: {{start_xxx.input}}"
// model = "google/gemini-2.0-flash-001"
```

**I3.** Resolve variables
- **File:** `agentnode-executor.tsx:25-28` -> `replacesdVariables(instructions, context)`
- **File:** `lib/helper.ts:10-15` -> `Mustache.render("Answer: {{start_xxx.input}}", context)`
- Resolves to: `"Answer: Hello"`

**I4.** Call OpenRouter via server action
- **File:** `agentnode-executor.tsx:43-52` -> `await streamAgentAction({ ... })`
- **File:** `app/actions/agent-workflow.ts:45-52`
```ts
const result = streamText({
  model: openrouter.chat("google/gemini-2.0-flash-001"),
  system: "You are a helpful assistant... Must use instructions: Answer: Hello",
  messages: modelMessage,
});
```

**I5.** Stream chunks to realtime channel
- **File:** `agentnode-executor.tsx:88-136`
```ts
let fullText = "";
for await (const chunk of result.fullStream) {
  if (chunk.type === "text-delta") {
    fullText += chunk.text;
    await channel.emit("workflow.chunk", {
      type: "data-workflow-Node",
      id: "agent_yyy",
      data: { status: "loading", type: "text-delta", output: fullText },
    });
  }
}
return { output: { text: "The full AI response..." } };
```

**I6.** Each `channel.emit()` publishes to Redis pub/sub. The SSE endpoint (`live-chat/route.ts:31-44`) receives and forwards to browser.

### Phase J: End Node execution

**J1.** Executor lookup
- **File:** `executeWorkflow.ts:45` -> `getNodeExecutor("end")`
- **File:** `node-config.ts:43` -> `() => ExecuteEndNode`

**J2.** ExecuteEndNode
- **File:** `components/workflow/custom-nodes/end/endnode-executer.tsx:3-13`
```ts
const text = node?.data.value as string; // "{{agent_yyy.text}}"
return { output: { input: text } };      // NOT resolved (gap)
```

### Phase K: Stream completion

**K1.** Loop ends (`executeWorkflow.ts:61-63` — no outgoing edge from end_zzz)
**K2.** `serve()` handler completes (`live-chat/route.ts:126-128`)
**K3.** No explicit `{ type: "finish" }` emitted — SSE stream may stay open until timeout (gap)

---

## 16. Key Observations & Limitations

### Current limitations:

1. **Linear execution only** — The execution engine picks `edges.find(e.source === currentNodeId)` (`executeWorkflow.ts:57`) — the **first** edge in array order. It does NOT:
   - Route by `sourceHandle` (If/Else branches don't route to different nodes)
   - Handle parallel branches or forks
   - Handle multiple outgoing edges

2. **No HTTP executor** — HTTP node type defined in `NODE_CONFIG` (`node-config.ts:92-104`) and listed in NodePanel (`NodePanel.tsx:17-19`), but has **no visual component** and **no executor registered** in `NODE_EXECUTORS` (`node-config.ts:39-44`).

3. **No Comment executor** — Comment node has a visual component (`nodeTypes` at `workflow-canva.tsx:52`) but no executor (expected — it is an annotation).

4. **End node does not resolve variables** — `endnode-executer.tsx:5` reads `node.data.value` directly but does not call `replacesdVariables()` to resolve `{{agent_yyy.text}}` patterns.

5. **No explicit "finish" signal** — `executeWorkflow.ts` completes without emitting `{ type: "finish" }`, so the SSE stream (`live-chat/route.ts:39-42`) may not close cleanly.

6. **Unused variables** — The `outputs` destructured in `ExecuteAgentNode` is never used (it uses `context` directly). The `StartNode.executor` imports `React` (`startnode-executor.ts:3`) but does not use it.

7. **Full `context` passed to `replacesdVariables`** — In `agentnode-executor.tsx:25-28`, `replacesdVariables(instructions, context)` passes the full context (including `channel`, `history`, etc.), not just `context.outputs`. Mustache would try to interpolate `{{channel}}` etc. This might cause subtle bugs.

---

## 17. File Index

| Purpose | File Path |
|---|---|
| Canvas page | `app/(routes)/SingleWorkflow/[workflowId]/page.tsx` |
| Workflow context | `context/workflow-context.tsx` |
| Canvas + ReactFlow | `app/(routes)/SingleWorkflow/[workflowId]/_common/workflow-canva.tsx` |
| Node palette | `app/(routes)/SingleWorkflow/[workflowId]/_common/NodePanel.tsx` |
| Save state store | `store/workflow-store.ts` |
| API hooks | `features/use-workflow.ts` |
| Create workflow dialog | `app/(routes)/(dashboard)/_common/createWorkflow.tsx` |
| List/Create API | `app/api/workflow/route.ts` |
| Get/Update API | `app/api/workflow/[workflowId]/route.ts` |
| Trigger API | `app/api/upstash/trigger/route.ts` |
| SSE + Execute API | `app/api/workflow/live-chat/route.ts` |
| Transport | `lib/transport.ts` |
| Execution engine | `lib/workflow/executeWorkflow.ts` |
| Node config + executors | `lib/workflow/node-config.ts` |
| Types | `types/workflow.ts` |
| Realtime pub/sub | `lib/realtime.ts` |
| Helpers (IDs, variables) | `lib/helper.ts` |
| Constants (models, tools) | `lib/constants.ts` |
| Chat panel UI | `components/workflow/live-chat/chat-panel.tsx` |
| Chat sheet wrapper | `components/workflow/live-chat/index.tsx` |
| LLM server action | `app/actions/agent-workflow.ts` |
| Start executor | `components/workflow/custom-nodes/start/startnode-executor.ts` |
| Agent executor | `components/workflow/custom-nodes/agent/agentnode-executor.tsx` |
| If/Else executor | `components/workflow/custom-nodes/if-else/ifelse-executor.tsx` |
| End executor | `components/workflow/custom-nodes/end/endnode-executer.tsx` |
