# Chat & Workflow Execution — Complete Function-by-Function Breakdown

## Overview

This document explains how the "Workflow Preview" chat works. When a user opens the workflow editor, clicks "Preview", and types a message, that message is **run through the entire workflow graph** (nodes connected by edges) as if it were a program. Each node is an instruction, edges are the control flow, and the chat panel shows real-time execution progress.

---

## Files involved (in order of execution)

1. `components/workflow/live-chat/chat-panel.tsx` — Frontend chat UI
2. `lib/transport.ts` — Custom transport that intercepts chat messages
3. `app/api/upstash/trigger/route.ts` — Schedules the workflow via QStash
4. `app/api/workflow/live-chat/route.ts` — Two handlers:
   - `GET` — SSE stream (browser listens here)
   - `POST` — QStash callback that executes the workflow
5. `lib/workflow/executeWorkflow.ts` — The core execution engine
6. `lib/workflow/node-config.ts` — Node type definitions & executor registry
7. `types/workflow.ts` — TypeScript types for the executor
8. `lib/helper.ts` — Utility functions (Mustache variable substitution)
9. `lib/realtime.ts` — Upstash Realtime pub/sub client
10. `lib/cancel.ts` — Cancellation mechanism (AbortController + Redis flag)
11. `lib/openrouter.ts` — OpenRouter LLM client
12. `lib/redis.ts` — Upstash Redis client
13. `lib/prisma.ts` — Prisma database client
14. `lib/constants.ts` — Model list and tool definitions
15. `app/actions/agent-workflow.ts` — Server actions for LLM calls
16. `components/workflow/custom-nodes/start/startnode-executor.ts` — Start node logic
17. `components/workflow/custom-nodes/agent/agentnode-executor.tsx` — Agent node logic
18. `components/workflow/custom-nodes/if-else/ifelse-executor.tsx` — If/Else node logic
19. `components/workflow/custom-nodes/end/endnode-executer.tsx` — End node logic

---

## 1. `chat-panel.tsx` — The Chat UI Component

### What it does

This is the React component that renders the chat panel inside the workflow preview sheet. It uses Vercel AI SDK's `useChat` hook with a custom transport.

### State variables

- `input` (string) — The current text in the textarea.
- `chatId` (string | null) — A unique ID for the chat session (generated via `crypto.randomUUID()`). Used to reset the conversation when "New Chat" is clicked.

### `useChat` hook

```ts
const { messages, sendMessage, status, stop } = useChat<UIMessage>({
  id: chatId ?? undefined,
  messages: [],
  transport: createWorkFlowTransport({ workflowId }),
});
```

**What each property does:**
- `messages` — Array of `UIMessage` objects. Each message has `id`, `role` ("user" | "assistant"), and `parts` (array of content parts like text, tool-calls, data-workflow-Node, etc.).
- `sendMessage` — Function to send a new message. Calls `transport.fetch()` under the hood.
- `status` — Current connection status: `"idle"` | `"streaming"` | `"submitted"`.
- `stop` — Function to abort the current stream.

### `isLoading` computed value

```ts
const isLoading = status === "submitted" ||
  (status === "streaming" && !messages[messages.length - 1]?.parts.some(
    (part) => part.type === "text" && Boolean(part.text),
  ));
```

- True when the message is submitted but not yet streaming, OR when streaming but no text has arrived yet.
- Shows a "Thinking..." bouncing dots animation.

### `handleSubmit`

```ts
const handleSubmit = (message: PromptInputMessage) => {
  if (!message?.text?.trim()) return;
  sendMessage({ text: message.text });
  setInput("");
};
```

- Called when user presses enter or clicks the submit button.
- Calls `sendMessage` which triggers the entire workflow execution chain.

### Rendering logic

The component renders:

1. **Header** — "Workflow Preview" title + "New Chat" button (resets `chatId`).
2. **Empty state** — If no messages yet, shows a placeholder with "Preview your workflow".
3. **Message list** — Iterates over `messages`. For each message:
   - Checks if it contains `data-workflow-Node` parts (execution steps) or `text` parts (final response).
   - For `text` parts → renders `<MessageResponse>`.
   - For `data-workflow-Node` parts → renders `<NodeDisplay>`.
   - If the assistant message has steps but no text, shows a hint: "This run finished without sending any text back..."
4. **Loading indicator** — Shows bouncing dots while `isLoading` is true.
5. **Input area** — Textarea with submit button (or "Stop" button while streaming).

---

## 1a. `NodeDisplay` Component (inside `chat-panel.tsx`)

### What it does

Renders a visual block for each node execution step in the chat.

### `summarizeOutput` function

```ts
function summarizeOutput(output: unknown): string | null {
  if (output == null) return null;
  if (typeof output === "string") return output || null;
  if (typeof output === "object") {
    const record = output as Record<string, unknown>;
    if (typeof record.text === "string") return record.text || null;
    if (typeof record.matchedCase === "string") return `→ ${record.matchedCase}`;
    if (typeof record.selectedBranch === "string") return `→ ${record.selectedBranch}`;
    if (typeof record.input === "string") return record.input || null;
  }
  return null;
}
```

- Extracts a human-readable summary from the node's output.
- Priority: `text` → `matchedCase` (for If/Else) → `selectedBranch` → `input` (for Start).
- Returns `null` if nothing meaningful found.

### `NodeDisplay` rendering

- Shows the node's icon (from `getNodeConfig`) in a colored circle.
- Icon changes based on status: spinner (loading), alert (error), or the node's icon (complete).
- Shows the node name and a summary of its output.
- If `toolCall` is active → shows "Calling toolName..." shimmer.
- If `toolResult` is available → shows a green checkmark with the tool name.
- If error → shows error text in red.

---

## 2. `transport.ts` — Custom Chat Transport

### `createWorkFlowTransport`

```ts
export const createWorkFlowTransport = ({ workflowId }: { workflowId: string }) => {
  return new DefaultChatTransport({
    api: "/api/upstash/trigger",
    async prepareSendMessagesRequest({ messages }) { ... },
    prepareReconnectToStreamRequest: (data) => { ... },
    fetch: async (input, init) => { ... },
  });
};
```

This creates a custom transport for the AI SDK's `useChat` hook. Instead of sending messages directly to an LLM API, it:

1. **`prepareSendMessagesRequest`** — Intercepts the messages before sending. Extracts the last message's text for logging. Returns `{ body: { workflowId, messages } }` which becomes the POST body.

2. **`prepareReconnectToStreamRequest`** — If the SSE stream disconnects and needs reconnection, adds a header `x-is-reconnect: "true"` to identify reconnection attempts.

3. **`fetch`** — This is the key function. It overrides the default fetch behavior:
   - First, it calls `fetch(input, init)` where `input` is `/api/upstash/trigger` and `init` contains the POST body with `{ workflowId, messages }`.
   - The response from `/api/upstash/trigger` contains `{ workflowRunId }`.
   - Then it opens a **new `GET` fetch** to `/api/workflow/live-chat?id=${workflowRunId}` — this is the SSE stream.
   - Returns the SSE response, which `useChat` uses to receive streaming data.

---

## 3. `trigger/route.ts` — QStash Trigger API

### `POST /api/upstash/trigger`

```ts
export async function POST(request: Request) {
  const { workflowId, messages } = await request.json();
  const triggerPayload = {
    url: `${baseUrl}/api/workflow/live-chat`,
    retries: 3,
    keepTriggerConfig: true,
    headers: { "x-vercel-protection-bypass": ... },
    body: { workflowId, messages },
  };
  const { workflowRunId } = await client.trigger(triggerPayload);
  return NextResponse.json({ success: true, workflowRunId });
}
```

**What happens line by line:**

1. Receives `{ workflowId, messages }` from the transport's fetch.
2. Constructs a `triggerPayload`:
   - `url` — The endpoint QStash should call back: `{baseUrl}/api/workflow/live-chat`.
   - `retries: 3` — Retry up to 3 times on failure.
   - `keepTriggerConfig: true` — Preserve the trigger configuration across retries.
   - `headers` — Includes Vercel protection bypass token (for protected deployments).
   - `body` — The `{ workflowId, messages }` that will be passed to the callback.
3. `client.trigger(triggerPayload)` sends this to QStash's HTTP API:
   - QStash generates a unique `workflowRunId`.
   - Returns it **immediately** (synchronous HTTP response).
   - QStash **enqueues** the job and will asynchronously POST to the callback URL.
4. Returns `{ workflowRunId }` to the transport, which then opens the SSE stream.

**Key insight:** This is fire-and-forget from the browser's perspective. The trigger returns immediately with the `workflowRunId`, and the actual workflow execution happens later when QStash delivers the callback. Meanwhile, the browser opens an SSE stream using the same `workflowRunId` to listen for results.

---

## 4. `live-chat/route.ts` — The Dual Handler (SSE + Execution)

This file has TWO exports that handle TWO different HTTP methods on the same URL.

---

### 4a. `GET /api/workflow/live-chat` — SSE Stream (called by browser)

```ts
export const GET = async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const workflowRunId = searchParams.get("id") || searchParams.get("workflowRunId");
  if (!workflowRunId) return new Response("Missing workflow run id", { status: 400 });

  const channel = realtime.channel(workflowRunId);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      await channel.subscribe({
        events: ["workflow.chunk"],
        history: true,
        onData({ data }) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          if (data.type === "finish") controller.close();
        },
      });
      req.signal.addEventListener("abort", () => {
        cancelWorkflow(workflowRunId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
};
```

**Line by line:**

- **Line 15-17:** Parses the URL query params to get `workflowRunId` (either from `?id=` or `?workflowRunId=`).
- **Line 25:** Creates an Upstash Realtime channel for this `workflowRunId`. The channel uses Redis pub/sub under the hood — any event emitted on this channel is delivered to all subscribers.
- **Line 28-53:** Creates a `ReadableStream` (the SSE stream):
  - **Line 32-44:** Subscribes to `"workflow.chunk"` events on the channel. The `history: true` flag means if any events were missed before subscription, they'll be replayed. When a chunk arrives, it's encoded as SSE format (`data: {...}\n\n`) and sent to the browser. If the event `type` is `"finish"`, the stream is closed.
  - **Line 46-50:** If the client disconnects (aborts the request), it cancels the workflow via `cancelWorkflow(workflowRunId)` and closes the stream.
- **Line 55-59:** Returns the stream as an SSE response.

---

### 4b. `POST /api/workflow/live-chat` — QStash Callback (called by QStash)

```ts
export const { POST } = serve(
  async (context) => {
    // ... execution logic ...
  },
  {
    qstashClient: new Client({
      token: process.env.QSTASH_TOKEN!,
      headers: { "x-vercel-protection-bypass": ... },
    }),
  },
);
```

`serve()` is from `@upstash/workflow/nextjs`. It wraps the handler with QStash workflow support. The second argument provides the QStash client configuration so that `context.run()` can internally use QStash for step management.

#### Inside the `serve` callback:

**Step 1: Extract payload**

```ts
const { workflowId, messages } = context.requestPayload as { workflowId: string; messages: UIMessage[] };
const workflowRunId = context.workflowRunId;
```

- `context.requestPayload` is the `body` that was sent in the trigger payload (from step 3).
- `context.workflowRunId` is the same unique ID QStash generated.

**Step 2: Create the realtime channel**

```ts
const channel = realtime.channel(workflowRunId);
```

- Creates a channel with the same `workflowRunId`. This is the **same channel** the SSE stream (GET handler) subscribed to.
- When the workflow engine emits events on this channel, the SSE stream receives them.

**Step 3: Extract user input**

```ts
const message = messages[messages.length - 1];
const userInput = message.role === "user" && message.parts[0].type === "text"
  ? message.parts[0].text
  : "";
```

- Takes the **last message** from the messages array.
- Checks if it's a user message with text content.
- Extracts the text — this is what the user typed.

**Step 4: Fetch workflow from database**

```ts
const { nodes, edges } = await context.run("fetch-from-database", async () => {
  const workflowData = await prisma.workflow.findUnique({ where: { id: workflowId } });
  const obj = JSON.parse(workflowData.flowObject);
  const nodes = obj.nodes as Node[];
  const edges = obj.edges as Edge[];
  return { nodes, edges };
});
```

- `context.run("step-name", async () => {...})` — This is an Upstash Workflow feature. It wraps the function as a "step" that can be retried independently. If this step fails, only this step is retried (not the entire workflow).
- Queries Prisma for the workflow by its ID.
- Parses `flowObject` — this is the JSON string stored in the database that contains `{ nodes: [...], edges: [...] }`.
- Extracts nodes and edges — these are ReactFlow-compatible objects that define the visual workflow graph.

**Step 5: Execute the workflow**

```ts
await context.run("worflow-execution", async () => {
  await executeWorkflow(nodes, edges, userInput, messages, channel, workflowRunId);
});
```

- Another `context.run` step.
- Calls the core execution engine (see next section).

---

## 5. `executeWorkflow.ts` — The Core Execution Engine

This is the heart of the system. It takes the parsed nodes/edges and executes them in topological order.

---

### 5a. `topologicalSort(nodes, edges)`

```ts
export function topologicalSort(nodes: Node[], edges: Edge[]) {
  const graph = new TopologicalSort(new Map());
  const excludeTypes: NodeType[] = [NodeTypeEnum.COMMENT];

  nodes.forEach((node) => { graph.addNode(node.id, node); });
  edges.forEach((edge) => { graph.addEdge(edge.source, edge.target); });

  try {
    const sortedResult = graph.sort();
    const sortedIds = Array.from(sortedResult.keys());
    const sortedNodes = sortedIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((n) => n?.type !== undefined && !excludeTypes.includes(n.type as NodeType));
    return sortedNodes;
  } catch (error) {
    throw new Error("Workflow contains a cycle or invalid dependencies. Cannot execute");
  }
}
```

**How it works:**

1. Creates a topological sort graph (using the `topological-sort` library).
2. Adds all nodes (except Comment nodes) as vertices in the graph.
3. Adds all edges as directed edges (source → target).
4. Calls `graph.sort()` — this performs a topological sort, which orders nodes so that every edge goes from an earlier node to a later node.
5. If there's a cycle in the graph (e.g., A→B→C→A), the sort throws an error.
6. Filters out Comment nodes (they're excluded from execution).
7. Returns the sorted array of nodes — this is the execution order.

**Example for the Sentiment Workflow:**
```
Start → Classify Sentiment → Check Sentiment → (Respond Happy OR Respond Angry OR Respond Neutral) → End
```
The topological sort preserves this order.

---

### 5b. `getNextNode(currentNodeId, edges, context)`

```ts
export const getNextNode = (currentNodeId: string, edges: Edge[], context: ExecutorContextType) => {
  const outgoingEdges = edges.filter((edge) => edge.source === currentNodeId);
  if (outgoingEdges.length === 0) return [];

  const currentOutput = context.outputs[currentNodeId] as
    | { output?: { selectedBranch?: string } }
    | undefined;

  if (currentOutput?.output?.selectedBranch) {
    const branchEdge = outgoingEdges.find(
      (edge) => edge.sourceHandle === currentOutput.output?.selectedBranch,
    );
    return branchEdge ? [branchEdge.target] : [];
  }
  return outgoingEdges.map((edge) => edge.target);
};
```

**How it works:**

1. Finds all edges that start from the current node.
2. If there are no outgoing edges, returns empty array (dead end).
3. Checks the current node's output in `context.outputs`:
   - If the output has a `selectedBranch` (this is set by If/Else nodes), it looks for the edge whose `sourceHandle` matches that branch name (e.g., `condition-0`, `condition-1`, `else`).
   - Only follows that **one specific edge** (branching logic).
   - If no matching edge is found, returns empty array.
4. If there's no `selectedBranch`, it follows **all** outgoing edges (fan-out logic, e.g., Start → Agent, or Agent → If/Else).

**Example:**
- For a Start node → follows all outgoing edges (typically just one, to the first Agent).
- For an If/Else node with `selectedBranch: "condition-0"` → only follows the edge whose `sourceHandle` is `"condition-0"`.
- For an Agent → follows all outgoing edges (usually just one, to End).

---

### 5c. `executeWorkflow(nodes, edges, userInput, messages, channel, workflowRunId)`

This is the main execution function. Let's go through it line by line.

```ts
export const executeWorkflow = async (
  nodes: Node[], edges: Edge[], userInput: string,
  messages: UIMessage[], channel: ExecutorContextType["channel"], workflowRunId: string,
) => {
```

**Parameters:**
- `nodes` — Array of workflow nodes (from the database).
- `edges` — Array of workflow edges (from the database).
- `userInput` — The text the user typed.
- `messages` — The full conversation history.
- `channel` — Upstash Realtime channel for emitting events (received by the SSE stream).
- `workflowRunId` — Unique ID for this execution run.

---

#### Step 1: Find the Start node

```ts
const startNode = nodes.find((n) => n.type === NodeTypeEnum.START);
if (!startNode) throw new Error("Start node is not found in the workflow");
```

- Every workflow must have one Start node. If not, execution fails.

---

#### Step 2: Check cancellation flag in Redis

```ts
const cancelledInRedis = await redis.get(`cancel:${workflowRunId}`);
if (cancelledInRedis) {
  await channel.emit("workflow.chunk", { type: "finish", finishReason: "stop" });
  cleanupWorkflow(workflowRunId);
  return { success: true, output: "Workflow cancelled by user" };
}
```

- Before starting, checks if a Redis key `cancel:${workflowRunId}` exists (set by `cancelWorkflow()`).
- If it exists, the workflow was cancelled by the user before execution started.
- Emits a `finish` event to close the SSE stream, cleans up, and returns early.

---

#### Step 3: Get abort signal

```ts
const signal = getWorkflowAbortSignal(workflowRunId);
```

- Gets or creates an `AbortController` for this workflow run.
- If `cancelWorkflow()` is called later, this signal will be aborted, and the execution can stop early.

---

#### Step 4: Create the execution context

```ts
const context: ExecutorContextType = {
  outputs: {
    [startNode.id]: { input: userInput },
  },
  history: messages || [],
  workflowRunId,
  channel,
  signal,
};
```

**`ExecutorContextType` (from `types/workflow.ts`):**
```ts
export type ExecutorContextType = {
  outputs: Record<string, unknown>;  // Stores each node's output, keyed by node ID
  history: UIMessage[];              // Conversation history
  workflowRunId: string;             // Unique run ID
  channel: Channel;                  // For emitting events
  signal?: AbortSignal;              // For cancellation
};
```

- Initializes `outputs` with the Start node's output containing the user input.
- Stores the conversation history for LLM context.
- The `channel` is shared with the SSE stream.

---

#### Step 5: Topological sort

```ts
const sortedNodes = topologicalSort(nodes, edges);
const nodeToExecuteNext = new Set<string>([startNode.id]);
let lastOutputText = "";
```

- `sortedNodes` — All nodes in execution order (topological).
- `nodeToExecuteNext` — A Set tracking which nodes should actually execute. Initially contains only the Start node. As nodes execute, their downstream nodes are added.
- `lastOutputText` — Tracks the last text output for use when the workflow ends (e.g., End node might not have text).

---

#### Step 6: Main execution loop

```ts
for (const node of sortedNodes) {
```

Iterates through sorted nodes. For each node:

##### 6a. Skip if not in the execution set

```ts
if (!nodeToExecuteNext.has(node?.id as string)) {
  continue;
}
```

- Even though the node is in the sorted order, it should only execute if it's reachable from the Start node via the `nodeToExecuteNext` set. Nodes on unvisited branches are skipped.

##### 6b. Check cancellation

```ts
if (signal.aborted) {
  await channel.emit("workflow.chunk", { type: "finish", finishReason: "stop" });
  cleanupWorkflow(workflowRunId);
  return { success: true, output: "Workflow cancelled by user" };
}
```

- If the abort signal was triggered (user clicked "Stop"), stop execution.

##### 6c. Get the executor function

```ts
const nodeType = node?.type as NodeType;
const executor = getNodeExecutor(nodeType);
if (!executor) continue;
```

- Looks up the executor function for this node type from `NODE_EXECUTORS` map.
- If no executor found (e.g., for future node types), skips the node.

##### 6d. Emit "processing" event

```ts
await channel.emit("workflow.chunk", {
  type: "data-workflow-Node",
  id: node.id,
  data: {
    id: node.id,
    nodeType: node.type,
    nodeName: node.data?.label,
    status: "processing",
  },
});
```

- Sends an event indicating this node is starting execution.
- The SSE stream picks this up and the `NodeDisplay` component shows a spinner.

##### 6e. Execute the node

```ts
try {
  const result = await executor(node, context);
  const outputText = result.output?.text ?? result.output;
```

- Calls the node's executor function (e.g., `ExecuteAgentNode`, `ExecuteIfElseNode`, etc.).
- Each executor receives the node data and the execution context and returns a result with an `output` field.

##### 6f. Emit "complete" event

```ts
await channel.emit("workflow.chunk", {
  type: "data-workflow-Node",
  id: node?.id,
  data: {
    id: node?.id,
    nodeType: node?.type,
    nodeName: node?.data.label,
    status: "complete",
    ...(outputText ? { output: outputText } : {}),
  },
});
```

- Sends a completion event with the node's output (if any).
- The `NodeDisplay` shows a checkmark and the output summary.

##### 6g. Store output and find next nodes (skip for Start node)

```ts
if (node?.type !== NodeTypeEnum.START) {
  context.outputs[node.id] = result;
  const outputText = result?.output?.text ?? "";
  if (outputText) lastOutputText = outputText;
  const nextNodes = getNextNode(node.id, edges, context);
  nextNodes.forEach((id) => nodeToExecuteNext.add(id));
}
```

- Saves the node's output to `context.outputs` (accessible to downstream nodes via Mustache variable substitution).
- Updates `lastOutputText` if this node produced text.
- Calls `getNextNode()` to find which nodes come next based on edges and any branch selection.
- Adds those next node IDs to `nodeToExecuteNext` so they'll execute when the loop reaches them.

**Note:** The Start node's output is skipped from `context.outputs` because it was already set when the context was initialized (step 4). Its output (`input`) is already available.

##### 6h. Handle End node

```ts
if (node?.type === NodeTypeEnum.END) {
  const endOutput = result?.output?.input ?? result?.output?.text ?? "";
  await emitTextResponse(channel, endOutput || lastOutputText);
  await channel.emit("workflow.chunk", { type: "finish", finishReason: "stop" });
  cleanupWorkflow(workflowRunId);
  return { success: true, output: context.outputs };
}
```

- If the End node was executed, the workflow is complete.
- Gets the End node's value (or falls back to `lastOutputText`).
- Calls `emitTextResponse` to send the final text to the user.
- Emits `finish` event to close the SSE stream.
- Calls `cleanupWorkflow()` to remove abort controllers and Redis flags.
- Returns all outputs.

##### 6i. Handle nodes with no outgoing edges

```ts
const nextNodeIds = getNextNode(node?.id, edges, context);
if (nextNodeIds.length === 0) {
  await emitTextResponse(channel, lastOutputText);
  await channel.emit("workflow.chunk", { type: "finish", finishReason: "stop" });
  cleanupWorkflow(workflowRunId);
  return { success: true, output: "Workflow Stopped!!! Nothing to execute" };
}
```

- If a node (other than End) has no outgoing edges, the workflow ends here.
- Emits the last known text and finishes.

##### 6j. Error handling

```ts
} catch (error) {
  await channel.emit("workflow.chunk", {
    type: "data-workflow-Node",
    id: node.id,
    data: { id: node.id, nodeType: node.type, nodeName: node.data?.label, status: "error", error: ... },
  });
  cleanupWorkflow(workflowRunId);
  throw error;
}
```

- If any node executor throws an error, emits an error event and re-throws.
- The outer handler (`live-chat/route.ts` POST handler) catches this error.

---

### 5d. `emitTextResponse(channel, text)`

```ts
async function emitTextResponse(channel, text: string) {
  if (!text || text.trim().length === 0) return;
  const trimmed = text.trim();
  const chunkSize = 500;
  for (let i = 0; i < trimmed.length; i += chunkSize) {
    await channel.emit("workflow.chunk", {
      type: "text-delta",
      textDelta: trimmed.slice(i, i + chunkSize),
    });
  }
}
```

- Emits the final response text in chunks of 500 characters.
- Each chunk has `type: "text-delta"` which the `useChat` hook interprets as streaming text.
- The browser accumulates these chunks and displays them as a typing effect.

---

## 6. `node-config.ts` — Node Type Definitions & Executor Registry

### `NodeTypeEnum`

```ts
export const NodeTypeEnum = {
  START: "start",
  AGENT: "agent",
  IF_ELSE: "if_else",
  END: "end",
  HTTP: "http",
  COMMENT: "comment",
} as const;
```

A constant enum mapping node type names to their string values. `as const` ensures these are literal types.

### `NodeType`

```ts
export type NodeType = (typeof NodeTypeEnum)[keyof typeof NodeTypeEnum];
// Evaluates to: "start" | "agent" | "if_else" | "end" | "http" | "comment"
```

### `NODE_EXECUTORS` — The executor registry

```ts
export const NODE_EXECUTORS = {
  [NodeTypeEnum.START]: ExecuteStartNode,
  [NodeTypeEnum.AGENT]: ExecuteAgentNode,
  [NodeTypeEnum.IF_ELSE]: ExecuteIfElseNode,
  [NodeTypeEnum.END]: ExecuteEndNode,
};
```

A map from node type to its executor function. Used by `getNodeExecutor()`.

### `NODE_CONFIG` — Node configuration defaults

```ts
export const NODE_CONFIG: Record<NodeType, NodeConfigBase> = {
  [NodeTypeEnum.START]: {
    type: "start",
    label: "Start",
    icon: Play,
    color: "bg-emerald-500",
    inputs: { inputValue: " " },
    outputs: ["input"],      // Accessible as {{nodeId.input}}
  },
  [NodeTypeEnum.AGENT]: {
    type: "agent",
    label: "Agent",
    icon: MousePointer2Icon,
    color: "bg-blue-500",
    inputs: { label: "Agent", instructions: "", model: MODELS[0].value, tools: [], outputFormat: "text", responseSchema: null },
    outputs: ["output.text"], // Accessible as {{nodeId.output.text}}
  },
  [NodeTypeEnum.IF_ELSE]: {
    type: "if_else",
    label: "If / Else",
    icon: GitBranch,
    color: "bg-orange-500",
    inputs: { conditions: [{ caseName: "", variable: "", operator: "", value: "" }] },
    outputs: ["output.result"],
  },
  [NodeTypeEnum.HTTP]: { ... },
  [NodeTypeEnum.COMMENT]: { ... },
  [NodeTypeEnum.END]: {
    type: "end",
    label: "End",
    icon: Flag,
    color: "bg-red-500",
    inputs: { value: " " },
    outputs: ["output.end"],
  },
};
```

Each node type has:
- `type` — The string identifier.
- `label` — Display name.
- `icon` — Lucide icon component.
- `color` — Tailwind CSS background color class.
- `inputs` — Default input values (the form fields users edit).
- `outputs` — The available output variables that can be referenced with `{{nodeId.outputName}}`.

### `getNodeConfig(type)`

```ts
export const getNodeConfig = (type: NodeType) => {
  const nodeType = NODE_CONFIG?.[type];
  if (!nodeType) return null;
  return nodeType;
};
```

- Looks up a node type's configuration from `NODE_CONFIG`.
- Used by `NodeDisplay` to get the icon and color for rendering.

### `getNodeExecutor(type)`

```ts
export const getNodeExecutor = (type: NodeType) => {
  const nodeExecutor = NODE_EXECUTORS?.[type as keyof typeof NODE_EXECUTORS];
  if (!nodeExecutor) return null;
  return nodeExecutor;
};
```

- Looks up the executor function for a node type.
- Used by `executeWorkflow` to find the function that runs each node.

### `createNode({ type, position })`

```ts
export function createNode({ type, position = { x: 400, y: 200 } }: CreateNodeOptions) {
  const config = getNodeConfig(type);
  if (!config) throw new Error(`No node config found ${type}`);
  const id = generateID(type);

  const node = {
    id,
    type,
    position,
    deleteable: type === NodeTypeEnum.START ? false : true,
    data: {
      label: config.label,
      color: config.color,
      nodeType: type,
      outputs: config.outputs,
      ...config.inputs,
    },
  };
  return node;
}
```

- Creates a new node for the ReactFlow canvas.
- Generates a unique ID like `agent-abc123xyz`.
- Merges the node config defaults with any custom inputs.
- Start nodes cannot be deleted.

---

## 7. `types/workflow.ts` — TypeScript Types

### `Channel`

```ts
type Channel = { emit: (...args: any[]) => Promise<void> };
```

- Represents an Upstash Realtime channel.
- The `emit` method publishes events that all subscribers receive.

### `ExecutorContextType`

```ts
export type ExecutorContextType = {
  outputs: Record<string, unknown>;  // Stores each node's output, keyed by node ID
  history: UIMessage[];              // Full conversation history
  workflowRunId: string;             // Unique run ID for this execution
  channel: Channel;                  // Realtime channel for emitting events
  signal?: AbortSignal;              // Optional abort signal for cancellation
};
```

- Passed to every node executor.
- `outputs` — Accumulates results as nodes execute. Start's output is `{ input: userMessage }`, Agent's output is `{ text: "..." }`, If/Else's output is `{ selectedBranch: "condition-0", matchedCase: "Happy" }`.
- `history` — The conversation history, used for LLM context in Agent nodes.
- `channel` — For real-time progress updates.
- `signal` — For detecting and responding to cancellation.

### `ExecutorResultType`

```ts
export type ExecutorResultType = {
  output: unknown;
};
```

- The return type for node executors.
- Each executor returns an object with an `output` field.

---

## 8. `helper.ts` — Utility Functions

### `generateID(type)`

```ts
import { customAlphabet } from "nanoid";
import { urlAlphabet } from "nanoid";
const generateSuffix = customAlphabet(urlAlphabet, 10);

export function generateID(type: string): string {
  return `${type.toLocaleLowerCase()}-${generateSuffix()}`;
}
```

- Generates a unique node ID using `nanoid`.
- Format: `{type}-{10-character-random-string}`.
- Examples: `start-6skRtQV`, `agent-JBm0NaJ`.

### `replacesdVariables(template, variables)`

```ts
import Mustache from "mustache";

export function replacesdVariables(template: string, variables: Record<string, unknown>) {
  return Mustache.render(template, variables);
}
```

- Uses the **Mustache** templating engine to replace `{{variable}}` placeholders with actual values.
- The `variables` object is `context.outputs` from the executor, which has the structure:
  ```ts
  {
    "start-6skRtQV": { input: "I'm so happy today" },
    "agent-JBm0NaJ": { output: { text: "happy" } },
  }
  ```
- So `{{start-6skRtQV.input}}` resolves to `"I'm so happy today"`.
- And `{{agent-JBm0NaJ.output.text}}` resolves to `"happy"`.
- Mustache supports dot notation for nested object traversal.

---

## 9. `realtime.ts` — Upstash Realtime Client

```ts
import { Realtime, InferRealtimeEvents } from "@upstash/realtime";
import { redis } from "./redis";
import z from "zod/v4";
import { UIMessageChunk } from "ai";

const schema = {
  workflow: {
    chunk: z.any() as z.ZodType<UIMessageChunk>,
  },
};

export const realtime = new Realtime({ schema, redis });
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>;
```

- Creates an `Upstash Realtime` client backed by Upstash Redis.
- Defines a schema with one event type: `workflow.chunk` (any data, typed as `UIMessageChunk`).
- The `realtime.channel(workflowRunId)` method creates a channel whose Redis key is the `workflowRunId`.
- Under the hood, it uses **Redis Pub/Sub**:
  - `channel.emit("workflow.chunk", data)` publishes to Redis.
  - `channel.subscribe({ events: ["workflow.chunk"], onData })` subscribes to those events.
  - Messages are delivered to **all** subscribers of the same channel key.
- This is how the POST handler (workflow execution) communicates with the GET handler (SSE stream) — they share the same `workflowRunId` as the channel key.

---

## 10. `cancel.ts` — Cancellation Mechanism

### `controllers` Map

```ts
const controllers = new Map<string, AbortController>();
```

- In-memory map (server-side) that stores `AbortController` instances per `workflowRunId`.
- Used to signal cancellation across async operations.

### `cancelWorkflow(workflowRunId)`

```ts
export function cancelWorkflow(workflowRunId: string) {
  let controller = controllers.get(workflowRunId);
  if (!controller) {
    controller = new AbortController();
    controllers.set(workflowRunId, controller);
  }
  controller.abort();
  redis.set(`cancel:${workflowRunId}`, "1", { ex: 120 }).catch(() => {});
}
```

- Gets or creates an `AbortController` for this run.
- Calls `controller.abort()` — this triggers the `signal.aborted` checks in `executeWorkflow` and `ExecuteAgentNode`.
- Also sets a Redis key `cancel:${workflowRunId}` with a 120-second TTL. This is a backup so that even if the abort signal is missed (e.g., if the workflow hasn't started yet), the Redis check at the beginning of `executeWorkflow` catches it.

### `getWorkflowAbortSignal(workflowRunId)`

```ts
export function getWorkflowAbortSignal(workflowRunId: string): AbortSignal {
  let controller = controllers.get(workflowRunId);
  if (!controller) {
    controller = new AbortController();
    controllers.set(workflowRunId, controller);
  }
  return controller.signal;
}
```

- Returns the `AbortSignal` associated with this run.
- If no controller exists yet, creates one.
- The signal is passed to `ExecutorContextType` and used by:
  - `executeWorkflow` — checks `signal.aborted` before each node.
  - `ExecuteAgentNode` — checks `signal?.aborted` before and during LLM streaming.
  - `streamAgentAction` / `generateAgentText` — passed as `abortSignal` to `streamText()` / `generateText()`.

### `cleanupWorkflow(workflowRunId)`

```ts
export function cleanupWorkflow(workflowRunId: string) {
  controllers.delete(workflowRunId);
  redis.del(`cancel:${workflowRunId}`).catch(() => {});
}
```

- Removes the `AbortController` from memory.
- Deletes the Redis cancel flag.
- Called at the end of workflow execution (success, error, or cancellation).

---

## 11. `openrouter.ts` — OpenRouter LLM Client

```ts
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});
```

- Creates an OpenRouter provider instance for the AI SDK.
- OpenRouter is a unified API for many LLMs (Gemini, GPT-4, Claude, DeepSeek, etc.).
- Used by `streamAgentAction()` and `generateAgentText()` via `openrouter.chat(model)`.

---

## 12. `redis.ts` — Upstash Redis Client

```ts
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
```

- Creates an Upstash Redis client (HTTP-based Redis, serverless-friendly).
- Used by:
  - `realtime.ts` — As the backing store for Realtime pub/sub.
  - `cancel.ts` — To set/check/delete the cancel flag.
  - `executeWorkflow.ts` — To check the cancel flag before execution.

---

## 13. `prisma.ts` — Prisma Database Client

```ts
import { PrismaClient } from "./generated/prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
export default prisma;
```

- Standard Prisma singleton pattern.
- In non-production environments, stores the client on `global` to avoid multiple instances during hot reload.
- Used by `live-chat/route.ts` to fetch the workflow from the database.

---

## 14. `constants.ts` — Model & Tool Lists

### `MODELS`

```ts
export const MODELS = [
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (Good, Fast, Cheap)" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini (Cheap & Fast)" },
  { value: "deepseek/deepseek-chat", label: "DeepSeek V3" },
  { value: "anthropic/claude-3-haiku", label: "Claude 3 Haiku (Fast)" },
];
```

- Available LLM models for Agent nodes.
- The first model (`gemini-2.5-flash-lite`) is the default for new Agent nodes.

### `TOOLS`

```ts
export const TOOLS: ToolType[] = [
  {
    id: "webSearch",
    type: "native",
    name: " Web Search",
    description: "Search the web",
    icon: GlobeIcon,
  },
  {
    id: "mcpServer",
    type: "mcp",
    name: "MCP server",
    description: "Connect to external MCP server",
    icon: Server,
    tools: [],
  },
];
```

- Available tools for Agent nodes.
- `native` — Built-in tools (web search via Exa API).
- `mcp` — MCP server tools (external integrations).

---

## 15. `agent-workflow.ts` — LLM Server Actions

This file contains server-side functions for calling LLMs.

### `buildSystemPrompt(instructions, selectedTools, jsonOutput)`

```ts
function buildSystemPrompt(instructions, selectedTools, jsonOutput) {
  const toolNames = selectedTools.filter((t) => t.type === "native").map((t) => t.value);
  const toolList = toolNames.map((name) => `- ${name}`).join("\n");

  let prompt = `You follow instructions exactly. Never refuse or ask for clarification.\n\n${instructions}`;
  if (toolList) prompt += `\n\nAvailable tools:\n${toolList}`;
  return prompt;
}
```

- Constructs the system prompt for the LLM.
- Starts with a directive: "You follow instructions exactly. Never refuse or ask for clarification."
- Appends the user's custom instructions (which may contain Mustache placeholders already resolved by `replacesdVariables`).
- Appends the list of available tools if any.

### `convertToModelMessages(history)`

```ts
function convertToModelMessages(history: UIMessage[]): ModelMessage[] {
  return history
    .map((msg) => {
      const text = (msg.parts as any)?.find((p: any) => p.type === "text")?.text || "";
      if (!text) return null;
      return { role: msg.role as "user" | "assistant", content: text };
    })
    .filter((msg): msg is NonNullable<typeof msg> => msg !== null);
}
```

- Converts the AI SDK's `UIMessage[]` format to the simpler `ModelMessage[]` format expected by `streamText()`.
- Extracts only the `text` parts from each message (ignoring tool calls, data parts, etc.).
- Filters out messages that have no text content.

### `getAssistantContext(history)`

```ts
function getAssistantContext(history: UIMessage[]): string {
  const prevPart = [...history]
    .reverse()
    .find((m) => m.role === "assistant")
    ?.parts?.find((p: any) => p.type === "text") as { type: "text"; text: string } | undefined;
  const prevText = prevPart?.text || "";
  return prevText ? prevText.split(/[.!?]/)[0].trim().substring(0, 120) : "";
}
```

- Finds the **last assistant message** in the conversation history.
- Extracts the **first sentence** (up to 120 characters).
- Used as context for web search queries to make them more relevant.

### `streamAgentAction({ model, instructions, history, jsonOutput, selectedTools, signal })`

```ts
export async function streamAgentAction({ model, instructions, history, jsonOutput, selectedTools, signal }) {
  const modelMessage = await convertToModelMessages(history);
  const tools: Record<string, any> = {};

  for (const t of selectedTools.filter((t) => t.type === "native")) {
    if (t.value === "webSearch") {
      const ws = webSearch({ apiKey: process.env.EXA_API_KEY });
      const prevTopic = getAssistantContext(history);
      tools.webSearch = {
        description: ws.description,
        inputSchema: ws.inputSchema,
        execute: async (args, options) => {
          const query = prevTopic
            ? `${args.query} - context: previous topic was ${prevTopic}`
            : args.query;
          return ws.execute({ ...args, query });
        },
      };
    }
  }

  const systemPrompt = buildSystemPrompt(instructions, selectedTools, jsonOutput);
  const result = streamText({
    model: openrouter.chat(model),
    system: systemPrompt,
    messages: modelMessage,
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    stopWhen: stepCountIs(5),
    maxOutputTokens: 2000,
    abortSignal: signal,
    ...jsonOutput,
  });
  return result;
}
```

**What it does:**

1. Converts the conversation history to the format the LLM expects.
2. Builds the tools object:
   - If `webSearch` is selected, creates a `webSearch` tool backed by the Exa search API.
   - The tool's `execute` method enriches the search query with previous conversation context.
3. Builds the system prompt from the instructions.
4. Calls Vercel AI SDK's `streamText()`:
   - `model` — The selected LLM via OpenRouter.
   - `system` — The system prompt (instructions + available tools).
   - `messages` — The conversation history.
   - `tools` — Available tools (undefined if none selected).
   - `stopWhen: stepCountIs(5)` — Stops after 5 tool call steps (prevents infinite tool loops).
   - `maxOutputTokens: 2000` — Limits response length.
   - `abortSignal` — For cancellation support.
   - `jsonOutput` — If output format is JSON, this includes an `output: Output.object({ schema })` to enforce structured output.
5. Returns the `streamText` result, which has:
   - `text` — Promise that resolves to the full text.
   - `textStream` — Async iterable of text chunks.
   - `fullStream` — Async iterable of ALL chunks (text deltas, tool calls, tool results, errors).
   - `toolCalls` — Promise with array of tool calls.
   - `usage` — Token usage statistics.

### `generateAgentText({ model, instructions, history, jsonOutput, selectedTools, signal })`

```ts
export async function generateAgentText({ model, instructions, history, jsonOutput, selectedTools, signal }) {
  const modelMessage = await convertToModelMessages(history);
  const tools: Record<string, any> = {};
  const prevTopic = getAssistantContext(history);

  // ... (same tool setup as streamAgentAction) ...

  const systemPrompt = buildSystemPrompt(instructions, selectedTools, jsonOutput);
  const result = await generateText({
    model: openrouter.chat(model),
    system: systemPrompt,
    messages: modelMessage,
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    maxOutputTokens: 2000,
    abortSignal: signal,
    ...jsonOutput,
  });
  return result.text;
}
```

- Similar to `streamAgentAction` but uses `generateText()` instead of `streamText()`.
- `generateText()` waits for the **full response** and returns it as a single string.
- Used as a **fallback** in `ExecuteAgentNode` when streaming produces no text (e.g., streaming fails or the stream is empty).
- No `stopWhen` limit here (unlike streaming mode).

### `extractAgentContent(parts)`

```ts
function extractAgentContent(parts: any[]) {
  const content: any[] = [];
  parts?.filter((p) => p.type === "data-workflow-node" && p.data?.nodeType === "agent")
    ?.map((p) => {
      const { type, toolCall, toolResult, output } = p.data;
      if (type === "tool-call" && toolCall) { content.push({ type: "tool-call", toolCallId: toolCall.toolCallId, toolName: toolCall.name }); }
      if (type === "tool-result" && toolResult) { content.push({ type: "tool-result", toolCallId: toolResult.toolCallId, toolName: toolResult.name, result: toolResult.result }); }
      if (typeof output === "string") { content.push({ type: "text", text: output }); }
      else if (output?.text) { content.push({ type: "text", text: output.text }); }
    });
  return { role: "assistant" as const, content: content.length > 0 ? content : "" };
}
```

- This function is defined but **not currently used anywhere** in the codebase. It appears to be a utility for converting agent execution data back into a `ModelMessage` format, possibly for future conversation persistence or multi-turn execution.

---

## 16. `startnode-executor.ts` — Start Node Executor

```ts
export const ExecuteStartNode = (node: Node, context: ExecutorContextType) => {
  const startOutput = context.outputs[node.id] as { input?: string } | undefined;
  const result = {
    output: {
      input: startOutput?.input || "",
    },
  };
  return result;
};
```

**What it does:**
- Is **synchronous** (no async).
- Reads the user input from `context.outputs[node.id].input` (which was set in `executeWorkflow` step 4).
- Returns `{ output: { input: userInput } }`.
- The input is then available to downstream nodes as `{{startNodeId.input}}`.
- Note: The output is NOT stored in `context.outputs` by `executeWorkflow` (it checks `node.type !== NodeTypeEnum.START` before storing), because it was already pre-populated.

---

## 17. `agentnode-executor.tsx` — Agent Node Executor

This is the most complex executor. It calls an LLM and streams the response.

```ts
export const ExecuteAgentNode = async (node: Node, context: ExecutorContextType) => {
```

**Step 1: Extract node data**

```ts
const { channel, history, signal } = context;
const { instructions, model: selectedModel, tools: selectedTools = [], outputFormat = "text", responseSchema } = node.data;
```

- `channel` — For emitting real-time events.
- `history` — Conversation history (for LLM context).
- `signal` — For cancellation.
- `instructions` — The custom prompt the user wrote for this Agent node.
- `selectedModel` — The LLM to use (e.g., `google/gemini-2.5-flash-lite`).
- `selectedTools` — Tools like web search.
- `outputFormat` — `"text"` or `"json"`.
- `responseSchema` — JSON schema for structured output (only used when `outputFormat === "json"`).

**Step 2: Resolve variable placeholders**

```ts
const replacedInstructions = replacesdVariables(instructions as string, context.outputs);
```

- Replaces `{{nodeId.output.path}}` placeholders in the instructions with actual values from previously executed nodes.
- For the Sentiment Workflow's "Classify Sentiment" agent:
  - Instructions: `"Analyze the user's input and classify their sentiment... User input: \"{{start-6skRtQV.input}}\""`
  - After replacement: `"Analyze the user's input and classify their sentiment... User input: \"I'm so happy today\""`

**Step 3: Handle JSON output format**

```ts
const jsonOutput = outputFormat === "json" && responseSchema
  ? { output: Output.object({ schema: convertJsonSchemaToZod(responseSchema as any) }) }
  : undefined;
```

- If the output format is JSON and a schema is provided, converts the JSON schema to a Zod schema and uses `Output.object()` to enforce structured output from the LLM.

**Step 4: Check cancellation**

```ts
if (signal?.aborted) {
  return { output: { text: "" } };
}
```

**Step 5: Call LLM via streaming**

```ts
const result = await streamAgentAction({
  model, instructions: replacedInstructions, history,
  jsonOutput, signal, selectedTools,
});
```

- Calls the server action that invokes `streamText()`.

**Step 6: Handle JSON output (non-streaming)**

```ts
if (outputFormat === "json") {
  const text = await result.text;
  return { output: JSON.parse(text) };
}
```

- If JSON mode, waits for the full response, parses it, and returns the parsed object.

**Step 7: Stream text output**

```ts
let fullText = "";
const toolResults: { name: string; result: unknown }[] = [];
for await (const chunk of result.fullStream) {
```

- Iterates over the `fullStream` iterable from `streamText()`.
- For each chunk:

**a) Text delta**

```ts
if (c.type === "text-delta" || c.type === "text") {
  fullText += c.text ?? "";
  await channel.emit("workflow.chunk", {
    type: "data-workflow-Node",
    id: node.id,
    data: { id: node.id, nodeType: node.type, nodeName: node.data.label, status: "loading", type: "text", output: fullText },
  });
}
```

- Accumulates the text.
- Emits a progress event with the current accumulated text.
- The `NodeDisplay` shows the text updating in real-time.

**b) Error**

```ts
else if (c.type === "error") {
  throw new Error(c.message ?? String(c.error ?? "Unknown error"));
}
```

**c) Tool call**

```ts
else if (c.type === "tool-call") {
  await channel.emit("workflow.chunk", {
    type: "data-workflow-Node",
    id: node.id,
    data: { id: node.id, nodeType: node.type, nodeName: node.data.label, status: "loading", type: "tool-call", ...(fullText ? { output: fullText } : {}), toolCall: { name: c.toolName! } },
  });
}
```

- Emits a "Calling webSearch..." event shown in the UI.

**d) Tool result**

```ts
else if (c.type === "tool-result") {
  toolResults.push({ name: c.toolName!, result: c.output });
  await channel.emit("workflow.chunk", {
    type: "data-workflow-Node",
    id: node.id,
    data: { id: node.id, nodeType: node.type, nodeName: node.data.label, status: "loading", type: "tool-result", ...(fullText ? { output: fullText } : {}), toolResult: { toolCallId: c.toolCallId!, name: c.toolName!, result: c.output } },
  });
}
```

- Stores the tool result and emits a "✓" completion event shown in the UI.

**Step 8: Handle tool-only responses**

```ts
if (!fullText && toolResults.length > 0) {
  // Gets the last user message
  // Creates a summary prompt from tool results
  // Calls generateText() to create a human-readable summary
  // Sets fullText to the summary
}
```

- If the LLM only made tool calls but didn't generate text (e.g., webSearch tool with no verbal response), this fallback creates a summary of the tool results using a secondary LLM call.

**Step 9: Fallback: await full text**

```ts
if (!fullText) {
  fullText = (await result.text) ?? "";
}
```

- If the streaming loop produced no text (e.g., the stream had no text-delta events), waits for the full text promise.

**Step 10: Last resort: use generateAgentText**

```ts
if (!fullText) {
  fullText = await generateAgentText({ ... });
}
```

- If streaming completely failed, uses `generateText()` (non-streaming) as a final fallback.

**Step 11: Return result**

```ts
return { output: { text: fullText } };
```

- Returns the final text as the node's output.
- This is accessible to downstream nodes as `{{agentNodeId.output.text}}`.

---

## 18. `ifelse-executor.tsx` — If/Else Node Executor

### `evaluateCondition(variable, operator, value)`

```ts
function evaluateCondition(variable: string, operator: string, value: string): boolean {
  switch (operator) {
    case "=":           return variable === value;
    case "!=":          return variable !== value;
    case "contains":    return variable.includes(value);
    case "not_contains": return !variable.includes(value);
    case "starts_with": return variable.startsWith(value);
    case "ends_with":   return variable.endsWith(value);
    case ">": case "<": case ">=": case "<=":
      // Numeric comparison
      const left = Number(variable);
      const right = Number(value);
      if (Number.isNaN(left) || Number.isNaN(right)) return false;
      ...
    case "is_empty":    return variable.trim().length === 0;
    case "is_not_empty": return variable.trim().length > 0;
  }
}
```

- Performs the actual condition check based on the operator.
- Supports string operators (`=`, `!=`, `contains`, `not_contains`, `starts_with`, `ends_with`).
- Supports numeric comparison operators (`>`, `<`, `>=`, `<=`).
- Supports emptiness checks (`is_empty`, `is_not_empty`).

### `ExecuteIfElseNode(node, context)`

```ts
export const ExecuteIfElseNode = (node: Node, context: ExecutorContextType) => {
  const { outputs } = context;
  const conditions = (node.data?.conditions as ExecuteCondition[]) || [];

  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];

    // Skip invalid conditions
    if (!condition.operator || !condition.variable) continue;
    if (!OPERATORS_WITHOUT_VALUE.has(condition.operator) && condition.value === undefined) continue;

    // Resolve variable: replace {{placeholders}} with actual values
    const variable = replacesdVariables(condition.variable, outputs).trim();
    let conditionValue = condition.value?.trim() ?? "";
    conditionValue = conditionValue.replace(/^"|"$/g, "");  // Remove surrounding quotes

    const result = evaluateCondition(variable, condition.operator, conditionValue);

    if (result) {
      return {
        output: {
          result: true,
          selectedBranch: `condition-${i}`,  // e.g., "condition-0", "condition-1"
          matchedCase: condition.caseName || `Condition ${i + 1}`,  // e.g., "Happy"
        },
      };
    }
  }

  // No conditions matched → route to "else"
  return {
    output: {
      result: false,
      selectedBranch: "else",
      matchedCase: "Else",
    },
  };
};
```

**How it works for the Sentiment Workflow:**

1. The "Classify Sentiment" agent returns `{ output: { text: "happy" } }`.
2. The If/Else node evaluates conditions:
   - Condition 0: `variable = "{{agent-JBm0NaJ.output.text}}"`, after substitution becomes `"happy"`. Operator: `"contains"`, value: `"happy"`. `"happy".includes("happy")` → `true`!
   - Returns `{ output: { selectedBranch: "condition-0", matchedCase: "Happy" } }`.
3. `getNextNode()` in `executeWorkflow.ts` sees `selectedBranch: "condition-0"` and follows only the edge with `sourceHandle: "condition-0"` → which leads to the "Respond Happy" agent.
4. The other agents ("Respond Angry", "Respond Neutral") are skipped entirely.

---

## 19. `endnode-executer.tsx` — End Node Executor

```ts
export const ExecuteEndNode = (node: Node) => {
  const text = node?.data.value as string;
  const result = {
    output: {
      input: text,
    },
  };
  return result;
};
```

**What it does:**
- Is **synchronous** (no async).
- Reads the `value` from the End node's data (set by the user in the editor).
- Returns `{ output: { input: value } }`.
- In `executeWorkflow`, when the End node executes:
  - Gets `result.output.input` as `endOutput`.
  - Falls back to `lastOutputText` if endOutput is empty.
  - Calls `emitTextResponse` to send the final message.
  - Emits `finish` event.
  - Cleans up and returns.

---

## Complete End-to-End Flow (with all function calls)

Here's the exact sequence for the Sentiment Workflow with user input "I'm so happy today":

```
1. [Browser] User types "I'm so happy today" and clicks send
2. [Browser] chat-panel.tsx — handleSubmit() calls sendMessage({ text: "I'm so happy today" })
3. [Browser] transport.ts — prepareSendMessagesRequest() bundles { workflowId, messages }
4. [Browser] transport.ts — fetch() POSTs to /api/upstash/trigger
5. [Server]  trigger/route.ts — client.trigger() enqueues to QStash, returns workflowRunId
6. [Browser] transport.ts — Opens GET /api/workflow/live-chat?id={workflowRunId} (SSE stream)
7. [Server]  live-chat/route.ts GET — subscribes to realtime channel, waits for "workflow.chunk" events
8. [QStash]  Calls POST /api/workflow/live-chat (async, moments later)
9. [Server]  live-chat/route.ts POST — Extract workflowId, messages, userInput from payload
10. [Server] live-chat/route.ts POST — context.run("fetch-from-database")
    → prisma.workflow.findUnique({ id: workflowId })
    → JSON.parse(workflowData.flowObject)
    → Returns { nodes, edges }
11. [Server] live-chat/route.ts POST — context.run("worflow-execution")
    → executeWorkflow(nodes, edges, "I'm so happy today", messages, channel, workflowRunId)
12. [Server] executeWorkflow.ts — Check Redis cancel flag (not cancelled)
13. [Server] executeWorkflow.ts — topologicalSort(nodes, edges) → [start, agent1, if_else, agent2(angry), agent3(happy), agent4(neutral), end]
14. [Server] executeWorkflow.ts — Initialize context with userInput in start node's output
15. [Server] executeWorkflow.ts — Loop: start-6skRtQV
    → Emit "processing"
    → ExecuteStartNode() → returns { output: { input: "I'm so happy today" } }
    → Emit "complete"
    → getNextNode() → follows edge to agent-JBm0NaJ (Classify Sentiment)
    → Add agent-JBm0NaJ to nodeToExecuteNext
16. [Server] executeWorkflow.ts — Loop: agent-JBm0NaJ (Classify Sentiment)
    → Emit "processing"
    → ExecuteAgentNode():
        → replacesdVariables(instructions, context.outputs)
          → "Analyze... User input: \"{{start-6skRtQV.input}}\"" → "Analyze... User input: \"I'm so happy today\""
        → streamAgentAction({ model: "google/gemini-2.5-flash-lite", instructions: "Analyze...", history, ... })
          → streamText() calls OpenRouter / Gemini API
        → Iterate fullStream chunks → accumulate text → emit "loading" events with partial text
        → LLM responds: "happy"
        → Returns { output: { text: "happy" } }
    → Emit "complete" with output "happy"
    → context.outputs["agent-JBm0NaJ"] = { output: { text: "happy" } }
    → getNextNode() → follows edge to if_else-oysfJcE
17. [Server] executeWorkflow.ts — Loop: if_else-oysfJcE (Check Sentiment)
    → Emit "processing"
    → ExecuteIfElseNode():
        → Condition 0: variable = "{{agent-JBm0NaJ.output.text}}" → "happy", operator="contains", value="happy"
          → replacesdVariables("{{agent-JBm0NaJ.output.text}}", outputs) → "happy"
          → evaluateCondition("happy", "contains", "happy") → true
          → Return { output: { selectedBranch: "condition-0", matchedCase: "Happy" } }
    → Emit "complete" with output "→ Happy"
    → context.outputs["if_else-oysfJcE"] = { output: { selectedBranch: "condition-0", matchedCase: "Happy" } }
    → getNextNode(): selectedBranch = "condition-0" → find edge with sourceHandle="condition-0"
    → Destination: agent-l7CUDiR (Respond Happy)
    → Add agent-l7CUDiR to nodeToExecuteNext
    (agent-pYgiWPs and agent-MvUTUsK are NOT added)

18. [Server] executeWorkflow.ts — Loop: agent-l7CUDiR (Respond Happy)
    → Emit "processing"
    → ExecuteAgentNode():
        → Instructions: "The user is feeling happy. Respond with an enthusiastic... Original input: \"{{start-6skRtQV.input}}\""
        → After replacement: "...Original input: \"I'm so happy today\""
        → Call LLM → returns "That's wonderful! I'm so glad you're feeling great today! 😊"
        → Returns { output: { text: "That's wonderful! I'm so glad you're feeling great today! 😊" } }
    → Emit "complete"
    → context.outputs["agent-l7CUDiR"] = { output: { text: "..." } }
    → lastOutputText = "That's wonderful!..."
    → getNextNode() → follows edge to end-GkGI1vN

19. [Server] executeWorkflow.ts — Loop: end-GkGI1vN (End)
    → Emit "processing"
    → ExecuteEndNode() → returns { output: { input: " " } }
    → Emit "complete"
    → endOutput = " " (empty)
    → emitTextResponse(channel, lastOutputText) → sends "That's wonderful!..." as text-delta chunks
    → Emit "finish"
    → cleanupWorkflow()

20. [Server] The "text-delta" and "finish" events are published to Upstash Realtime channel
21. [Server] The SSE stream (GET handler) receives these events
22. [Browser] SSE chunks arrive at fetch() in transport.ts → useChat processes them
23. [Browser] The text-delta chunks are accumulated and rendered as streaming text in MessageResponse
24. [Browser] The "data-workflow-Node" events are rendered as NodeDisplay components showing step-by-step progress
25. [Browser] The "finish" event closes the SSE stream
```
