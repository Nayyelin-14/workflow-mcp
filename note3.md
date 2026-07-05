# Full End-to-End Deep Dive: Click "Send" → AI Response Rendered

## Table of Contents

1. [The Concrete Scenario](#1-the-concrete-scenario)
2. [Canvas Setup — How Nodes Are Created](#2-canvas-setup--how-nodes-are-created)
3. [Variable Discovery — How the User Knows What to Type](#3-variable-discovery--how-the-user-knows-what-to-type)
4. [Step-by-Step Execution Trace](#4-step-by-step-execution-trace)
   - [Phase 1: Click Send → useChat hook](#phase-1-click-send--usechat-hook)
   - [Phase 2: Custom Transport Bridges to QStash](#phase-2-custom-transport-bridges-to-qstash)
   - [Phase 3: Trigger Route Enqueues QStash Message](#phase-3-trigger-route-enqueues-qstash-message)
   - [Phase 4: SSE Stream Opens](#phase-4-sse-stream-opens)
   - [Phase 5: QStash Callback — Workflow Starts](#phase-5-qstash-callback--workflow-starts)
   - [Phase 6: START Node Execution](#phase-6-start-node-execution)
   - [Phase 7: AGENT Node Execution](#phase-7-agent-node-execution)
   - [Phase 8: END Node Execution](#phase-8-end-node-execution)
5. [How Chunks Become Message Parts (AI SDK Internals)](#5-how-chunks-become-message-parts-ai-sdk-internals)
6. [Final Render — What the User Sees](#6-final-render--what-the-user-sees)
7. [Why the End Node Shows `{ "input": " " }`](#7-why-the-end-node-shows--input---)

---

## 1. The Concrete Scenario

A user builds a **Nickname Generator** workflow with 3 connected nodes:

```
[Start: start-k7mN2xR9pQ] ──→ [Agent: agent-T8vB3mL5xK] ──→ [End: end-H3jL9pW2mN]
```

The user types in the chat panel: **"give me a random nickname"**

### What Each Node Does

| Node | ID | Role |
|------|----|------|
| Start | `start-k7mN2xR9pQ` | Receives the user's message as input, passes it downstream |
| Agent | `agent-T8vB3mL5xK` | Calls Gemini 2.0 Flash via OpenRouter with custom instructions that reference `{{start-k7mN2xR9pQ.input}}` |
| End | `end-H3jL9pW2mN` | Terminal node, finalizes execution |

### Edge Connections

```json
{ "source": "start-k7mN2xR9pQ", "target": "agent-T8vB3mL5xK" }
{ "source": "agent-T8vB3mL5xK", "target": "end-H3jL9pW2mN" }
```

---

## 2. Canvas Setup — How Nodes Are Created

When a user drags a node from the sidebar onto the canvas, `createNode(type)` is called.

### File: `lib/workflow/node-config.ts:166-199`

```typescript
export function createNode({
  type,
  position = { x: 400, y: 200 },
}: CreateNodeOptions) {
  const config = getNodeConfig(type);
  const id = generateID(type);
  // e.g., generateID("start") → "start-k7mN2xR9pQ"
  //        generateID("agent") → "agent-T8vB3mL5xK"
  //        generateID("end")   → "end-H3jL9pW2mN"

  const node = {
    id,
    type,
    position,
    data: {
      label: config.label,
      color: config.color,
      nodeType: type,
      outputs: config.outputs,  // Array of output keys from NODE_CONFIG
      ...config.inputs,         // Spread default input values
    },
  };
  return node;
}
```

### File: `lib/helper.ts:6-8` — ID generation

```typescript
import { customAlphabet } from "nanoid";
import { urlAlphabet } from "nanoid";
const generateSuffix = customAlphabet(urlAlphabet, 10);

export function generateID(type: string): string {
  return `${type.toLocaleLowerCase()}-${generateSuffix()}`;
}
// Example: "start-k7mN2xR9pQ"  (start- + 10 random alphanumeric chars)
```

### File: `lib/workflow/node-config.ts:46-127` — Each node type declares its outputs

```typescript
[NodeTypeEnum.START]: {
  outputs: ["input"],          // → {{nodeId.input}}
  inputs: { inputValue: " " },
},
[NodeTypeEnum.AGENT]: {
  outputs: ["output.text"],    // → {{nodeId.output.text}}
  inputs: { instructions: "", model: MODELS[0].value, tools: [], outputFormat: "text", responseSchema: null },
},
[NodeTypeEnum.IF_ELSE]: {
  outputs: ["output.result"],  // → {{nodeId.output.result}}
},
[NodeTypeEnum.END]: {
  outputs: ["output.end"],
  inputs: { value: " " },      // Default value for End node
},
```

The `outputs` array is the **contract** — it defines what variable names downstream nodes can reference. The `inputs` object provides default values for the node's configurable fields.

### What Gets Stored in the Database

When the user saves, the canvas state is serialized to JSON and stored in MongoDB via Prisma:

```json
{
  "id": "wf_abc123",
  "name": "Nickname Generator",
  "flowObject": "{\"nodes\":[{\"id\":\"start-k7mN2xR9pQ\",\"type\":\"start\",\"position\":{\"x\":100,\"y\":200},\"data\":{\"label\":\"Start\",\"nodeType\":\"start\",\"outputs\":[\"input\"],\"inputValue\":\" \"}},{\"id\":\"agent-T8vB3mL5xK\",\"type\":\"agent\",\"position\":{\"x\":400,\"y\":200},\"data\":{\"label\":\"Agent\",\"nodeType\":\"agent\",\"outputs\":[\"output.text\"],\"instructions\":\"You are a creative nickname generator.\\nThe user said: \\\"{{start-k7mN2xR9pQ.input}}\\\"\\nGenerate 3 fun nicknames.\",\"model\":\"google/gemini-2.0-flash-001\",\"tools\":[],\"outputFormat\":\"text\",\"responseSchema\":null}},{\"id\":\"end-H3jL9pW2mN\",\"type\":\"end\",\"position\":{\"x\":700,\"y\":200},\"data\":{\"label\":\"End\",\"nodeType\":\"end\",\"outputs\":[\"output.end\"],\"value\":\" \"}}],\"edges\":[{\"id\":\"edge-xyZ8m\",\"source\":\"start-k7mN2xR9pQ\",\"target\":\"agent-T8vB3mL5xK\"},{\"id\":\"edge-mN4bV\",\"source\":\"agent-T8vB3mL5xK\",\"target\":\"end-H3jL9pW2mN\"}]}"
}
```

---

## 3. Variable Discovery — How the User Knows What to Type

The user does **not** manually type `start-k7mN2xR9pQ.input`. The UI provides autocomplete.

### File: `components/workflow/mention-input.tsx`

The Agent node's `instructions` field uses a `<MentionInput>` component that wraps `react-mentions`.

**When the user types `{{`** in the instructions field, the library triggers autocomplete. The suggestions are computed by:

### File: `context/workflow-context.tsx:53-77`

```typescript
// Walk edges backward from current node to find all upstream (ancestor) nodes
const getUpStreamNodes = (nodeId: string) => {
  const upstream = new Set<string>();
  const addToSet = (id: string) => {
    edges
      .filter((e) => e.target === id)  // find what feeds INTO this node
      .forEach((e) => {
        upstream.add(e.source);
        addToSet(e.source);  // RECURSIVE — gets ALL ancestors
      });
  };
  addToSet(nodeId);
  return upstream;
};

const getVariablesForNode = (nodeId: string) => {
  const upstreamNodeIds = getUpStreamNodes(nodeId);
  // For agent-T8vB3mL5xK:
  //   Edges where target === "agent-T8vB3mL5xK" → [edge-xyZ8m]
  //   edge-xyZ8m.source = "start-k7mN2xR9pQ"
  //   Recursive: edges where target === "start-k7mN2xR9pQ" → none
  //   upstreamNodeIds = { "start-k7mN2xR9pQ" }

  return nodes
    .filter((node) => upstreamNodeIds.has(node.id))
    .map((n) => ({
      id: n.id,             // "start-k7mN2xR9pQ"
      label: n.data.label,  // "Start"
      outputs: n.data.outputs as string[],  // ["input"]
    }));
};
```

### File: `mention-input.tsx:40-57` — Building suggestion list

```typescript
const suggestions = useMemo(() => {
  const availableNodes = getVariablesForNode(nodeId);
  const result: suggestionType[] = [];
  availableNodes.forEach((node) => {
    node.outputs?.forEach((output: string) => {
      result.push({
        id: `${node.id}.${output}`,       // "start-k7mN2xR9pQ.input"
        display: `${nodeLabel}.${output}`, // "start.input" (human-readable)
      });
    });
  });
  return result;
}, [nodeId, getVariablesForNode]);
```

When the user selects `start.input` from the dropdown, `react-mentions` inserts `{{start-k7mN2xR9pQ.input}}` into the textarea using the markup pattern `{{__id__}}`.

### Summary of Variable Flow

```
Canvas Design Time                           Execution Time
─────────────────                           ──────────────

User types {{ in Agent instructions         context = {
                                                outputs: {
getVariablesForNode("agent-T8vB3mL5xK")         "start-k7mN2xR9pQ": {
  → upstream = {"start-k7mN2xR9pQ"}                  input: "..."   ← line 88 of executeWorkflow.ts
  → outputs of start = ["input"]                   },
  → suggestion = "start.input"                   }
  → inserts {{start-k7mN2xR9pQ.input}}        }

                                            Mustache.render(
                                              "Use {{start-k7mN2xR9pQ.input}}",
                                              context
                                            )
                                            → "Use give me a random nickname"
```

---

## 4. Step-by-Step Execution Trace

### Phase 1: Click Send → useChat Hook

#### File: `components/workflow/live-chat/chat-panel.tsx:57-86`

```typescript
const ChatPanel = ({ workflowId }: { workflowId: string }) => {
  const [chatId, setChatId] = useState(() => crypto.randomUUID());
  // → "c7e8f123-a456-4b78-9012-abcdef345678"

  const { messages, sendMessage, status } = useChat({
    id: chatId,
    messages: [],
    transport: createWorkFlowTransport({ workflowId: "wf_abc123" }),
  });

  const handleSubmit = (message: PromptInputMessage) => {
    sendMessage({ text: "give me a random nickname" });
    setInput("");
  };
```

#### Inside `@ai-sdk/react` useChat → `ai/dist/index.mjs` (AI SDK internals)

**Step 1a — Construct UIMessage** (`ai/dist/index.mjs:13429`):
```javascript
uiMessage = {
  parts: [{ type: "text", text: "give me a random nickname" }]
}
```

**Step 1b — Push to state** (`ai/dist/index.mjs:13460`):
```javascript
this.state.pushMessage({
  ...uiMessage,
  id: "msg-uuid-111",      // generated by generateId()
  role: "user",
});
// messages = [{ role: "user", id: "msg-uuid-111", parts: [{ type: "text", text: "give me a random nickname" }] }]
```

→ **React re-render**: User sees their message bubble appear.

**Step 1c — Status → "submitted"** (`ai/dist/index.mjs:13671`):
```javascript
this.setStatus({ status: "submitted" });
```

→ **React re-render**: `isLoading` is now `true` (chat-panel.tsx:71). The bouncing "Thinking" dots appear (chat-panel.tsx:153-166).

**Step 1d — Create streaming state** (`ai/dist/index.mjs:13677`):
```javascript
activeResponse = {
  state: createStreamingUIMessageState({
    lastMessage: undefined,          // no prior assistant message
    messageId: "msg-uuid-222",       // fresh ID for the assistant response
  }),
  abortController: new AbortController()
};
```
This creates an empty assistant message slot. It will accumulate `parts` as SSE chunks arrive from the workflow.

**Step 1e — Call `transport.sendMessages()`** (`ai/dist/index.mjs:13692`):
```javascript
stream = await this.transport.sendMessages({
  chatId: "c7e8f123-a456-4b78-9012-abcdef345678",
  messages: this.state.messages,     // Full chat history
  abortSignal: activeResponse.abortController.signal,
  trigger: "submit-message",
  messageId: undefined,
});
```

---

### Phase 2: Custom Transport Bridges to QStash

#### File: `lib/transport.ts`

`DefaultChatTransport` extends `HttpChatTransport` (`ai/dist/index.mjs:13259`).

**Step 2a — Call `prepareSendMessagesRequest`** (`ai/dist/index.mjs:13289`):
```javascript
preparedRequest = await this.prepareSendMessagesRequest({
  api: "/api/upstash/trigger",
  id: "c7e8f123-a456-4b78-9012-abcdef345678",
  messages: [{ id: "msg-uuid-111", role: "user", parts: [...] }],
  body: {}, headers: {}, credentials: undefined,
  trigger: "submit-message", messageId: undefined,
});
```

The overridden function (`lib/transport.ts:13-21`):
```javascript
async prepareSendMessagesRequest({ messages }) {
  return {
    body: { workflowId: "wf_abc123", messages },
    // Wraps the messages with the workflowId instead of the AI SDK's default body
  };
}
```

Result: POST body will be `{ workflowId: "wf_abc123", messages: [...] }` instead of the AI SDK's default `{ id, messages, trigger, messageId }`.

**Step 2b — Call custom `fetch`** (`ai/dist/index.mjs:13311`):
```javascript
const fetch2 = this.fetch ?? globalThis.fetch;   // this.fetch = custom override
const response = await fetch2("/api/upstash/trigger", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    workflowId: "wf_abc123",
    messages: [{ id: "msg-uuid-111", role: "user", parts: [...] }]
  }),
});
```

The custom fetch override (`lib/transport.ts:33-54`):
```javascript
fetch: async (input, init) => {
  // 1. POST to trigger endpoint
  const triggerResponse = await fetch("/api/upstash/trigger", {
    method: "POST",
    body: JSON.stringify({ workflowId: "wf_abc123", messages: [...] }),
  });

  // 2. Parse workflow run ID from response
  const triggerData = await triggerResponse.json();
  // { success: true, workflowRunId: "qstash_run_888" }

  // 3. Immediately open SSE connection
  return fetch("/api/workflow/live-chat?id=qstash_run_888", { method: "GET" });
  // Returns a Response with SSE body
};
```

---

### Phase 3: Trigger Route Enqueues QStash Message

#### File: `app/api/upstash/trigger/route.ts:13-56`

**Step 3a — Parse request:**
```javascript
const { workflowId, messages } = await request.json();
// workflowId = "wf_abc123"
// messages = [{ id: "msg-uuid-111", role: "user", parts: [{ type: "text", text: "give me a random nickname" }] }]
```

**Step 3b — Build QStash trigger payload:**
```javascript
const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const triggerPayload = {
  url: "http://localhost:3000/api/workflow/live-chat",  // QStash will POST here
  retries: 3,
  keepTriggerConfig: true,
  headers: { "x-vercel-protection-bypass": "" },
  body: { workflowId: "wf_abc123", messages: [...] },
};
```

**Step 3c — Send to QStash:**
```javascript
const client = new Client({
  baseUrl: process.env.QSTASH_BASE_URL!,
  token: process.env.QSTASH_TOKEN!,
});

const { workflowRunId } = await client.trigger(triggerPayload);
// workflowRunId = "qstash_run_888"
```

QStash internally:
1. Generates a unique run ID (`qstash_run_888`)
2. Returns it **immediately** in the HTTP response
3. Enqueues the message in its internal queue
4. Will asynchronously POST to `http://localhost:3000/api/workflow/live-chat` with the body `{ workflowId, messages }`

**Step 3d — Return to transport:**
```javascript
return NextResponse.json({ success: true, workflowRunId: "qstash_run_888" });
```

---

### Phase 4: SSE Stream Opens

The custom transport's fetch override has now:
1. Received `{ workflowRunId: "qstash_run_888" }` from the trigger route
2. Called `fetch("/api/workflow/live-chat?id=qstash_run_888", { method: "GET" })`

#### File: `app/api/workflow/live-chat/route.ts:9-58` — GET handler

**Step 4a — Parse workflow run ID:**
```javascript
const { searchParams } = new URL(req.url);
const workflowRunId = searchParams.get("id");
// "qstash_run_888"
```

**Step 4b — Create Realtime channel:**
```javascript
import { realtime } from "@/lib/realtime";
// lib/realtime.ts:12
// const realtime = new Realtime({ schema, redis });
// redis = new Redis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN })

const channel = realtime.channel("qstash_run_888");
```

This creates an Upstash Realtime channel backed by Redis pub/sub. The channel key is `qstash_run_888`. Both the SSE handler and the backend worker will connect to the **same** Redis channel using this key.

**Step 4c — Create SSE ReadableStream:**
```javascript
const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    await channel.subscribe({
      events: ["workflow.chunk"],     // Listen for "workflow.chunk" events
      history: true,                  // Get past events if we connect late
      onData({ data }) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
        if (data.type === "finish") {
          controller.close();         // Close SSE when workflow is done
        }
      },
    });
    req.signal.addEventListener("abort", () => {
      controller.close();             // Close if client disconnects
    });
  },
});

return new Response(stream, {
  headers: { "Content-Type": "text/event-stream" },
});
```

The SSE stream is now **open and listening**. Any `channel.emit("workflow.chunk", data)` calls from the backend worker will be forwarded as SSE `data: {...}\n\n` events to the browser.

**Step 4d — The Response flows back through the AI SDK:**

```
HttpChatTransport.sendMessages()
  → response = fetch(sseUrl)  ← Response with SSE ReadableStream body
  → response.ok? ✓, response.body exists? ✓
  → return this.processResponseStream(response.body)
```

`DefaultChatTransport.processResponseStream` (`ai/dist/index.mjs:13378-13392`):
```javascript
processResponseStream(stream) {
  return parseJsonEventStream2({
    stream,
    schema: uiMessageChunkSchema   // validates each data: line
  }).pipeThrough(new TransformStream({
    async transform(chunk, controller) {
      if (!chunk.success) throw chunk.error;
      controller.enqueue(chunk.value);  // validated UIMessageChunk
    }
  }));
}
```

The SSE body goes through:
1. `TextDecoderStream` (bytes → text)
2. `EventSourceParserStream` (from `eventsource-parser/stream`) → parses `data: {...}\n\n` into `{ data: "{...}" }` objects
3. Transform that `JSON.parse`s the data and validates against `uiMessageChunkSchema`

**`uiMessageChunkSchema`** (`ai/dist/index.mjs:5375-5544`) is a union of all valid chunk types. The critical entry for this workflow:

```javascript
z7.strictObject({
  type: z7.custom(                    // type must start with "data-"
    (value) => typeof value === "string" && value.startsWith("data-"),
  ),
  id: z7.string().optional(),
  data: z7.unknown(),                 // arbitrary payload
  transient: z7.boolean().optional(),
})
```

This is why `type: "data-workflow-Node"` works — it matches this custom data chunk schema.

The validated chunk stream flows into `AbstractChat.makeRequest()` (`ai/dist/index.mjs:13724-13739`):
```javascript
await consumeStream({
  stream: processUIMessageStream({
    stream,              // ReadableStream<UIMessageChunk>
    runUpdateMessageJob, // serialized job executor
    onData, onToolCall, ...
  }),
});
```

**The browser is now blocked waiting for SSE events on channel `qstash_run_888`.**

---

### Phase 5: QStash Callback — Workflow Starts

After QStash processes its queue, it POSTs to:
```
POST http://localhost:3000/api/workflow/live-chat
```

With headers:
```
upstash-signature: v1=...hmac...
Upstash-Workflow-Run-Id: qstash_run_888
Upstash-Workflow-Init: true
```

And body:
```json
{
  "workflowId": "wf_abc123",
  "messages": [{ "id": "msg-uuid-111", "role": "user", "parts": [{ "type": "text", "text": "give me a random nickname" }] }]
}
```

#### File: `app/api/workflow/live-chat/route.ts:60-139` — POST handler

**Step 5a — `serve()` wrapper** (`@upstash/workflow/nextjs.mjs:18-29`):
```javascript
export const serve = (routeFunction, options) => {
  const { handler: serveHandler } = serveBase(routeFunction, telemetry, options);
  return {
    POST: async (request) => await serveHandler(request),
  };
};
```

**Step 5b — `serveBase()`** (`@upstash/workflow/chunk-CWCCIOXR.mjs:3718-3943`) performs:

1. **Verify request signature** (line 3749):
   ```javascript
   await verifyRequest(requestPayload, request.headers.get("upstash-signature"), receiver);
   ```
   Validates HMAC signature to ensure the request genuinely came from QStash.

2. **Parse request** (line 3754):
   ```javascript
   const { rawInitialPayload, steps, isFirstInvocation, workflowRunEnded } = await parseRequest({...});
   // rawInitialPayload = '{"workflowId":"wf_abc123","messages":[{...}]}'
   // isFirstInvocation = true
   // steps = []
   // workflowRunEnded = false
   ```

3. **Create WorkflowContext** (line 3813):
   ```javascript
   const workflowContext = new WorkflowContext({
     qstashClient: regionalClient,
     workflowRunId: "qstash_run_888",
     initialPayload: { workflowId: "wf_abc123", messages: [...] },
     steps: [],
     url: "http://localhost:3000/api/workflow/live-chat",
   });
   ```
   The `requestPayload` property is set from `initialPayload` for convenient access.

4. **Call routeFunction** (line 3862): Since it's the first invocation, it calls `triggerFirstInvocation()` which executes the route function.

**Step 5c — The route function** (`app/api/workflow/live-chat/route.ts:61-124`):
```javascript
async (context) => {
  const { workflowId, messages } = context.requestPayload;
  const workflowRunId = context.workflowRunId;
  const channel = realtime.channel(workflowRunId);
  // SAME Realtime channel as the SSE handler!
  // Both connect to Redis pub/sub on key "qstash_run_888"

  const message = messages[messages.length - 1];
  const userInput = message.role === "user" && message.parts[0].type === "text"
    ? message.parts[0].text
    : "";
  // userInput = "give me a random nickname"
```

**Step 5d — Step 1: Fetch workflow from database:**
```javascript
const { nodes, edges } = await context.run("fetch-from-database", async () => {
  const workflowData = await prisma.workflow.findUnique({
    where: { id: "wf_abc123" },
  });
  const obj = JSON.parse(workflowData.flowObject);
  return { nodes: obj.nodes, edges: obj.edges };
});
```

Result:
```javascript
nodes = [
  { id: "start-k7mN2xR9pQ", type: "start", data: { label: "Start", outputs: ["input"], inputValue: " " } },
  { id: "agent-T8vB3mL5xK", type: "agent", data: { label: "Agent", outputs: ["output.text"], instructions: "You are a creative nickname generator.\\nThe user said: \"{{start-k7mN2xR9pQ.input}}\"\\nGenerate 3 fun nicknames.", model: "google/gemini-2.0-flash-001", tools: [], outputFormat: "text" } },
  { id: "end-H3jL9pW2mN", type: "end", data: { label: "End", outputs: ["output.end"], value: " " } }
]
edges = [
  { id: "edge-xyZ8m", source: "start-k7mN2xR9pQ", target: "agent-T8vB3mL5xK" },
  { id: "edge-mN4bV", source: "agent-T8vB3mL5xK", target: "end-H3jL9pW2mN" }
]
```

**Step 5e — Step 2: Execute workflow:**
```javascript
await context.run("workflow-execution", async () => {
  await executeWorkflow(nodes, edges, userInput, messages, channel, "qstash_run_888");
  // nodes, edges = from MongoDB
  // userInput = "give me a random nickname"
  // messages = [{ id: "msg-uuid-111", role: "user", parts: [...] }]
  // channel = Realtime channel("qstash_run_888")
});
```

#### `context.run()` internals (`@upstash/workflow/chunk-CWCCIOXR.mjs:2857-2860`)

```javascript
async run(stepName, stepFunction) {
  const wrappedStepFunction = (() => this.executor.wrapStep(stepName, stepFunction));
  return await this.addStep(new LazyFunctionStep(this, stepName, wrappedStepFunction));
}
```

`wrapStep` sets `this.executingStep = stepName` (for detecting illegal nested steps), calls the function, then unsets it.

`LazyFunctionStep.getResultStep()` (line 1254-1266):
```javascript
async getResultStep(concurrent, stepId) {
  let result = this.stepFunction();
  if (result instanceof Promise) result = await result;
  return { stepId, stepName, stepType: "Run", out: result, concurrent };
}
```

The `AutoExecutor.runSingle()` (line 2173-2198) checks if this step's result is already available from a previous invocation. If not:
1. Calls `submitSingleStep()` which runs the function, gets the result, submits it to QStash
2. Throws `WorkflowAbort` — the workflow pauses and QStash re-invokes with the result memoized

For this simple workflow, both `context.run()` calls execute within the same invocation because QStash delivers all steps at once for a first invocation.

---

### Phase 6: START Node Execution

#### File: `lib/workflow/executeWorkflow.ts:74-192`

**Step 6a — Initialize context:**
```javascript
const startNode = nodes.find(n => n.type === NodeTypeEnum.START);
// { id: "start-k7mN2xR9pQ", type: "start", data: { label: "Start", ... } }

const context: ExecutorContextType = {
  outputs: {
    ["start-k7mN2xR9pQ"]: {
      input: "give me a random nickname"     // ← PRE-SEEDED with userInput
    },
  },
  history: [{ id: "msg-uuid-111", role: "user", parts: [{ type: "text", text: "give me a random nickname" }] }],
  workflowRunId: "qstash_run_888",
  channel,   // Upstash Realtime channel("qstash_run_888")
};
```

**Step 6b — Topological sort:**
```javascript
const sortedNodes = topologicalSort(nodes, edges);
// → [start-k7mN2xR9pQ, agent-T8vB3mL5xK, end-H3jL9pW2mN]
const nodeToExecuteNext = new Set<string>(["start-k7mN2xR9pQ"]);
```

`topologicalSort` (executeWorkflow.ts:7-51) uses the `topological-sort` npm package:
1. Adds all 3 nodes to a graph
2. Adds 2 edges as directed connections
3. Calls `graph.sort()` → returns Map in dependency order
4. Filters out COMMENT nodes
5. Returns ordered array: `[Start, Agent, End]`

**Step 6c — Main loop iteration for Start node:**
```javascript
// node = { id: "start-k7mN2xR9pQ", type: "start" }
// nodeToExecuteNext.has("start-k7mN2xR9pQ") → true
```

**Emit "processing" status:**
```javascript
await channel.emit("workflow.chunk", {
  type: "data-workflow-Node",
  id: "start-k7mN2xR9pQ",
  data: {
    id: "start-k7mN2xR9pQ",
    nodeType: "start",
    nodeName: "Start",
    status: "processing",
  },
});
```

**SSE event sent to browser:**
```
data: {"type":"data-workflow-Node","id":"start-k7mN2xR9pQ","data":{"id":"start-k7mN2xR9pQ","nodeType":"start","nodeName":"Start","status":"processing"}}
```

**Browser (AI SDK processUIMessageStream):**
Receives chunk. Type is `"data-workflow-Node"` (starts with "data-") → matches custom data schema. No existing part with this type+id → **creates new part**:
```javascript
msg.parts = [
  { type: "data-workflow-Node", id: "start-k7mN2xR9pQ", data: { status: "processing", ... } }
]
```

**React re-render** → `NodeDisplay` renders Spinner for Start.

**Execute the Start node:**
```javascript
const executor = getNodeExecutor("start");  // ExecuteStartNode
const result = await executor(node, context);
```

**File: `components/workflow/custom-nodes/start/startnode-executor.ts:5-14`:**
```javascript
export const ExecuteStartNode = (node, context) => {
  const startOutput = context.outputs[node.id];
  // context.outputs["start-k7mN2xR9pQ"] = { input: "give me a random nickname" }
  // startOutput = { input: "give me a random nickname" }

  return {
    output: {
      input: startOutput?.input || "",   // "give me a random nickname"
    },
  };
  // Returns { output: { input: "give me a random nickname" } }
};
```

**Emit "complete" status:**
```javascript
await channel.emit("workflow.chunk", {
  type: "data-workflow-Node",
  id: "start-k7mN2xR9pQ",
  data: {
    id: "start-k7mN2xR9pQ",
    nodeType: "start",
    nodeName: "Start",
    status: "complete",
    output: result.output?.text || result.output,
    // result = { output: { input: "give me a random nickname" } }
    // result.output = { input: "give me a random nickname" }
    // result.output.text → undefined (no "text" property on this object)
    // So output = { input: "give me a random nickname" }  ← RAW OBJECT
  },
});
```

**SSE:**
```
data: {"type":"data-workflow-Node","id":"start-k7mN2xR9pQ","data":{"id":"start-k7mN2xR9pQ","nodeType":"start","status":"complete","output":{"input":"give me a random nickname"}}}
```

**Browser:** Finds existing part with same type+id → **updates** it:
```javascript
existingUIPart.data = { status: "complete", nodeType: "start", output: { input: "give me a random nickname" } }
```

**NodeDisplay renders:**
- Status: "complete" → `<Play>` icon (green)
- `output` is an object (not string) → `JSON.stringify(output, null, 2)` →
  ```json
  {
    "input": "give me a random nickname"
  }
  ```

**Skip storing output (Start nodes are skipped per line 134):**
```javascript
if (node?.type !== NodeTypeEnum.START) {
  context.outputs[node.id] = result.output;  // skipped
}
```

**Find next node:**
```javascript
const nextNodeIds = getNextNode("start-k7mN2xR9pQ", edges, context);
```

`getNextNode` (executeWorkflow.ts:53-72):
```javascript
// outgoing edges from "start-k7mN2xR9pQ":
// [{ id: "edge-xyZ8m", source: "start-k7mN2xR9pQ", target: "agent-T8vB3mL5xK" }]

// No selectedBranch on the output → follow ALL outgoing edges
return outgoingEdges.map(edge => edge.target);
// → ["agent-T8vB3mL5xK"]

nodeToExecuteNext.add("agent-T8vB3mL5xK");
```

---

### Phase 7: AGENT Node Execution

**Step 7a — Emit "processing":**
```javascript
await channel.emit("workflow.chunk", {
  type: "data-workflow-Node",
  id: "agent-T8vB3mL5xK",
  data: { id: "agent-T8vB3mL5xK", nodeType: "agent", nodeName: "Agent", status: "processing" },
});
```

**SSE → Browser → New part added:**
```javascript
msg.parts = [
  { type: "data-workflow-Node", id: "start-k7mN2xR9pQ", data: { status: "complete", ... } },
  { type: "data-workflow-Node", id: "agent-T8vB3mL5xK", data: { status: "processing" } },
]
```

**Step 7b — Execute Agent node:**

**File: `components/workflow/custom-nodes/agent/agentnode-executor.tsx:9-166`:**

**Extract node data:**
```javascript
const {
  instructions,        // "You are a creative nickname generator.\nThe user said: \"{{start-k7mN2xR9pQ.input}}\"\nGenerate 3 fun nicknames."
  model: selectedModel,  // "google/gemini-2.0-flash-001"
  tool: selectedTools,   // []
  outputFormat,          // "text"
  responseSchema,        // null
} = node.data;
```

**Step 7c — Variable replacement (agentnode-executor.tsx:25-28):**
```javascript
const replacedInstructions = replacesdVariables(instructions as string, context);
```

**File: `lib/helper.ts:10-14`:**
```javascript
export function replacesdVariables(template, variables) {
  return Mustache.render(template, variables);
}
```

Mustache receives the context object and resolves `{{start-k7mN2xR9pQ.input}}`:
1. Look up `context["start-k7mN2xR9pQ"]` → `{ input: "give me a random nickname" }`
2. Then `.input` → `"give me a random nickname"`

**Result:**
```javascript
replacedInstructions = "You are a creative nickname generator.\nThe user said: \"give me a random nickname\"\nGenerate 3 fun nicknames."
```

**Step 7d — Determine JSON output mode:**
```javascript
const jsonOutput = outputFormat === "json" && responseSchema
  ? { output: Output.object({ schema: convertJsonSchemaToZod(responseSchema) }) }
  : undefined;
// outputFormat is "text" → jsonOutput = undefined
```

**Step 7e — Call AI via server action:**
```javascript
const result = await streamAgentAction({
  model: "google/gemini-2.0-flash-001",
  instructions: "You are a creative nickname generator.\nThe user said: \"give me a random nickname\"\nGenerate 3 fun nicknames.",
  history: [{ id: "msg-uuid-111", role: "user", parts: [{ type: "text", text: "give me a random nickname" }] }],
  jsonOutput: undefined,
  selectedTools: [],
});
```

**File: `app/actions/agent-workflow.ts:12-55` (Server Action):**

```typescript
"use server";   // ← Next.js Server Action — runs on server

export async function streamAgentAction({ model, instructions, history, jsonOutput, selectedTools }) {
  // Convert UIMessage[] to model-compatible CoreMessage[]
  const modelMessage = await convertToModelMessages(history);
  // → [{ role: "user", content: [{ type: "text", text: "give me a random nickname" }] }]

  // Build tool registry (only native tools)
  const tools: Record<string, any> = {};
  for (const t of selectedTools.filter(t => t.type === "native")) {
    if (t.value === "webSearch") tools.webSearch = webSearch();
  }
  // selectedTools = [] → tools = {}

  // Build system prompt with instructions
  const systemPrompt = `You are a helpful assistant.
  IMPORTANT: Only respond to the user's MOST RECENT message.
  **Must use the following instructions: You are a creative nickname generator.
  The user said: "give me a random nickname"
  Generate 3 fun nicknames.`;

  // Call OpenRouter with streaming
  const result = streamText({
    model: openrouter.chat("google/gemini-2.0-flash-001"),
    system: systemPrompt,
    messages: [{ role: "user", content: [{ type: "text", text: "give me a random nickname" }] }],
    tools: undefined,
    stopWhen: stepCountIs(5),   // max 5 LLM steps (for tool loops)
  });

  return result;
  // result = {
  //   text: Promise<string>,          // full text
  //   textStream: AsyncIterable<string>,
  //   fullStream: AsyncIterable<StreamPart>,  // ALL chunk types
  //   toolCalls: Promise<Array<...>>,
  //   usage: Promise<{...}>,
  // }
}
```

`openrouter` (`lib/openrouter.ts:1-5`) is:
```typescript
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
export const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
```

This routes through OpenRouter which proxies to Google Gemini 2.0 Flash API.

**Step 7f — Streaming loop (agentnode-executor.tsx:88-156):**

Since `outputFormat === "text"`, the executor iterates `result.fullStream`:

```javascript
let fullText = "";
for await (const chunk of result.fullStream) {
  switch (chunk.type) {
    case "text-delta":
      fullText += chunk.text;
      await channel.emit("workflow.chunk", {
        type: "data-workflow-Node",
        id: "agent-T8vB3mL5xK",
        data: {
          id: "agent-T8vB3mL5xK",
          nodeType: "agent",
          nodeName: "Agent",
          status: "loading",
          type: "text-delta",
          output: fullText,       // ← PROGRESSIVE TEXT, grows each chunk
        },
      });
      break;

    case "tool-call":
      await channel.emit("workflow.chunk", {
        type: "data-workflow-Node",
        id: "agent-T8vB3mL5xK",
        data: {
          id: "agent-T8vB3mL5xK", nodeType: "agent", nodeName: "Agent",
          status: "loading", type: "tool-call",
          output: fullText,
          toolCall: { name: chunk.toolName },   // e.g. "webSearch"
        },
      });
      break;

    case "tool-result":
      await channel.emit("workflow.chunk", {
        type: "data-workflow-Node",
        id: "agent-T8vB3mL5xK",
        data: {
          id: "agent-T8vB3mL5xK", nodeType: "agent", nodeName: "Agent",
          status: "loading", type: "tool-result",
          output: fullText,
          toolResult: {
            toolCallId: chunk.toolCallId,
            name: chunk.toolName,
            result: chunk.output,
          },
        },
      });
      break;
  }
}
```

**Streaming timeline (each `channel.emit` → SSE → Browser → React re-render):**

| Iteration | Gemini chunk (text-delta) | fullText | User sees |
|-----------|--------------------------|----------|-----------|
| 1 | `"Here"` | `"Here"` | `Here` |
| 2 | `" are"` | `"Here are"` | `Here are` |
| 3 | `" 3"` | `"Here are 3"` | `Here are 3` |
| 4 | `" fun"` | `"Here are 3 fun"` | `Here are 3 fun` |
| 5 | `" nickname"` | `"Here are 3 fun nickname"` | `Here are 3 fun nickname` |
| ... | ... | ... | text grows progressively |
| final | `"!"` | `"Here are 3 fun nicknames:\n\n1. **Sparky** — A lively...\n2. **Blaze** — Perfect for...\n3. **Pixel** — A modern..."` | Full response |

Each text-delta **updates the existing part** (same type `"data-workflow-Node"`, same id `"agent-T8vB3mL5xK"`), so the output field keeps growing. React re-renders on each update, giving the user a streaming text effect.

**Step 7g — Return final output:**
```javascript
// After streaming loop ends
console.log("Agent full response:", fullText);
const outputResult = {
  output: {
    text: fullText,
  },
};
return outputResult;
// { output: { text: "Here are 3 fun nicknames:\n\n1. **Sparky**...3. **Pixel**" } }
```

**Step 7h — Back in executeWorkflow — emit "complete":**
```javascript
result = { output: { text: "Here are 3 fun nicknames:\n\n1. **Sparky**...3. **Pixel**" } };

await channel.emit("workflow.chunk", {
  type: "data-workflow-Node",
  id: "agent-T8vB3mL5xK",
  data: {
    id: "agent-T8vB3mL5xK",
    nodeType: "agent",
    nodeName: "Agent",
    status: "complete",
    output: result.output?.text || result.output,
    // result.output = { text: "Here are 3 fun nicknames:..." }
    // result.output.text = "Here are 3 fun nicknames:..."  ← EXISTS
    // So output = "Here are 3 fun nicknames:..."  ← STRING
  },
});
```

**SSE → Browser → Part updated:**
```javascript
existingUIPart.data = { status: "complete", output: "Here are 3 fun nicknames:\n\n1. **Sparky**...3. **Pixel**" }
```

**NodeDisplay renders:**
- Status "complete" → `<MousePointer2Icon />` (Agent icon, blue)
- `output` is a string → `<MessageResponse>{output}</MessageResponse>` renders text directly

**Store output and find next:**
```javascript
context.outputs["agent-T8vB3mL5xK"] = result.output;
// context.outputs = {
//   "start-k7mN2xR9pQ": { input: "give me a random nickname" },
//   "agent-T8vB3mL5xK": { text: "Here are 3 fun nicknames:..." },
// }

getNextNode("agent-T8vB3mL5xK", edges, context)
// → ["end-H3jL9pW2mN"]

nodeToExecuteNext.add("end-H3jL9pW2mN");
```

---

### Phase 8: END Node Execution

**Step 8a — Emit "processing":**
```javascript
await channel.emit("workflow.chunk", {
  type: "data-workflow-Node",
  id: "end-H3jL9pW2mN",
  data: {
    id: "end-H3jL9pW2mN", nodeType: "end", nodeName: "End", status: "processing",
  },
});
```

**SSE → Browser → New part:**
```javascript
msg.parts[2] = { type: "data-workflow-Node", id: "end-H3jL9pW2mN", data: { status: "processing" } }
```

**Step 8b — Execute End node:**

**File: `components/workflow/custom-nodes/end/endnode-executer.tsx:3-14`:**
```javascript
export const ExecuteEndNode = (node: Node) => {
  const text = node?.data.value as string;
  // node.data.value = " "   (from NODE_CONFIG.END.inputs.value)
  return {
    output: {
      input: text,   // " "
    },
  };
};
```

**Step 8c — Emit "complete":**
```javascript
await channel.emit("workflow.chunk", {
  type: "data-workflow-Node",
  id: "end-H3jL9pW2mN",
  data: {
    id: "end-H3jL9pW2mN",
    nodeType: "end",
    nodeName: "End",
    status: "complete",
    output: result.output?.text || result.output,
    // result = { output: { input: " " } }
    // result.output = { input: " " }
    // result.output.text → undefined
    // So output = { input: " " }  ← RAW OBJECT
  },
});
```

**NodeDisplay renders:**
- Status "complete" → `<Flag />` icon (red)
- `output` is object → `JSON.stringify({ input: " " }, null, 2)` →
  ```json
  {
    "input": " "
  }
  ```

**Step 8d — End node detected, emit "finish":**
```javascript
if (node?.type === NodeTypeEnum.END) {
  await channel.emit("workflow.chunk", {
    type: "finish",
    finishReason: "stop",
  });
  return { success: true, output: context.outputs };
}
```

**SSE:**
```
data: {"type":"finish","finishReason":"stop"}
```

**SSE handler** checks `data.type === "finish"` → `controller.close()`. The SSE ReadableStream ends.

**Browser AI SDK:** `consumeStream` reads until `done=true`. Status changes from `"streaming"` to `"ready"`.

---

## 5. How Chunks Become Message Parts (AI SDK Internals)

### File: `ai/dist/index.mjs:5602-6151` — `processUIMessageStream()`

The SSE stream passes through `parseJsonEventStream2` which parses each `data: {...}\n\n` line and validates against `uiMessageChunkSchema`. The validated chunks then enter `processUIMessageStream`.

For each chunk, it calls `runUpdateMessageJob` which serializes updates via `SerialJobExecutor`:

```javascript
async transform(chunk, controller) {
  await runUpdateMessageJob(async ({ state, write }) => {
    switch (chunk.type) {
      case "text-start":    // standard AI text
      case "text-delta":
      case "text-end":
      case "tool-input-start":
      case "tool-input-delta":
      case "tool-input-available":
      case "tool-output-available":
      // ... (standard AI SDK chunk types)

      default: {
        if (isDataUIMessageChunk(chunk)) {   // type starts with "data-"
          const dataChunk = chunk;

          // If transient → skip adding to message, just fire callback
          if (dataChunk.transient) {
            onData?.(dataChunk);
            break;
          }

          // Find existing part with same type AND id
          const existingUIPart = dataChunk.id != null
            ? state.message.parts.find(
                p => dataChunk.type === p.type && dataChunk.id === p.id
              )
            : undefined;

          if (existingUIPart != null) {
            existingUIPart.data = dataChunk.data;   // ← UPDATE existing part
          } else {
            state.message.parts.push(dataChunk);    // ← ADD new part
          }

          onData?.(dataChunk);
          write();   // ← triggers React re-render via setState
        }
      }
    }
    controller.enqueue(chunk);
  });
}
```

**Critical behavior**: The `id` field in each chunk determines whether a part is **created** or **updated**:
- First chunk for `start-k7mN2xR9pQ` (status: "processing") → no existing part found → **creates** new part
- Second chunk for `start-k7mN2xR9pQ` (status: "complete") → existing part FOUND → **updates** it in-place
- Same for `agent-T8vB3mL5xK`: first chunk creates, subsequent chunks update
- Same for `end-H3jL9pW2mN`: first chunk creates, second chunk updates

This means each node ends up with **exactly one** `data-workflow-Node` part in the message, whose `.data` property gets progressively overwritten as the workflow executes.

### The `finish` event (`ai/dist/index.mjs:6090-6098`):

```javascript
case "finish": {
  if (chunk.finishReason != null) {
    state.finishReason = chunk.finishReason;   // "stop"
  }
  // No part is added — just stores the finish reason as message metadata
  break;
}
```

### consumeStream (`ai/dist/index.mjs:6345`):

```javascript
async function consumeStream({ stream, onError }) {
  try {
    const reader = stream.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;   // SSE stream closed by "finish" event
    }
  } catch (error) {
    onError(error);
  }
}
```

After the stream ends, `makeRequest` sets `status: "ready"` (line 13740).

---

## 6. Final Render — What the User Sees

### Final message state in the AI SDK:

```javascript
messages = [
  // USER MESSAGE (id: msg-uuid-111)
  {
    id: "msg-uuid-111",
    role: "user",
    parts: [{ type: "text", text: "give me a random nickname" }]
  },
  // ASSISTANT MESSAGE (id: msg-uuid-222)
  {
    id: "msg-uuid-222",
    role: "assistant",
    parts: [
      {
        type: "data-workflow-Node",
        id: "start-k7mN2xR9pQ",
        data: {
          id: "start-k7mN2xR9pQ",
          nodeType: "start",
          nodeName: "Start",
          status: "complete",
          output: { input: "give me a random nickname" }    // ← object
        }
      },
      {
        type: "data-workflow-Node",
        id: "agent-T8vB3mL5xK",
        data: {
          id: "agent-T8vB3mL5xK",
          nodeType: "agent",
          nodeName: "Agent",
          status: "complete",
          output: "Here are 3 fun nicknames:\n\n1. **Sparky** — A lively...\n2. **Blaze** — Perfect for...\n3. **Pixel** — A modern..."    // ← string
        }
      },
      {
        type: "data-workflow-Node",
        id: "end-H3jL9pW2mN",
        data: {
          id: "end-H3jL9pW2mN",
          nodeType: "end",
          nodeName: "End",
          status: "complete",
          output: { input: " " }     // ← object
        }
      }
    ]
  }
]
```

### File: `components/workflow/live-chat/chat-panel.tsx:127-149` — Rendering logic:

```tsx
{messages?.map((msg) => (
  <Message from={msg.role} key={msg.id}>
    <MessageContent className="text-[15px]">
      {msg.parts.map((p, index) => {
        switch (p.type) {
          case "text":
            return <MessageResponse key={...}>{p.text}</MessageResponse>;
          case "data-workflow-Node":
            const data = p.data as NodeDataType;
            return <NodeDisplay key={...} data={data} />;
          default:
            return null;
        }
      })}
    </MessageContent>
  </Message>
))}
```

### File: `components/workflow/live-chat/chat-panel.tsx:205-263` — NodeDisplay component:

```tsx
const NodeDisplay = ({ data }: NodeDisplayDataType) => {
  const nodeConfig = getNodeConfig(data.nodeType);   // gets icon, label, color
  const Icon = nodeConfig.icon;
  const { status, output, error, toolCall, toolResult } = data;

  return (
    <div>
      {/* Header: icon + status indicator */}
      <div className={cn("px-1 py-2 flex items-center gap-2",
        status === "loading" && "animate-pulse")}>
        {status === "loading" ? <Spinner /> :
         status === "error" ? <AlertCircleIcon /> :
         <Icon className="h-4 w-4" />}
        <span className="text-sm font-medium"></span>    {/* empty span */}
      </div>

      {/* Tool calls (if any) */}
      {toolCall || toolResult ? (
        <div className="mx-3 my-2 px-3 bg-muted/50 rounded-lg border flex items-center gap-2">
          {toolResult ? (
            <><Check className="size-4 text-green-500" /> <span>{toolResult?.name}</span></>
          ) : (
            <TextShimmerLoader text={`Calling ${toolCall?.name} ...`} />
          )}
        </div>
      ) : null}

      {/* Output */}
      {output && (
        <div className="px-3 py-2">
          <MessageResponse>
            {typeof output === "string"
              ? output                                     // ← plain text rendering
              : JSON.stringify(output, null, 2)}            // ← object → JSON string
          </MessageResponse>
        </div>
      )}

      {/* Errors */}
      {status === "error" && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md">
          {JSON.stringify({ error })}
        </div>
      )}
    </div>
  );
};
```

### What the user actually sees rendered in the DOM:

```
─────────────────────────────────────────────────────────────────
  give me a random nickname                              (user bubble)
─────────────────────────────────────────────────────────────────
                                                         (assistant message)
  ▶                                                     (Start icon, green)
  {                                                     (JSON)
    "input": "give me a random nickname"
  }

  ◆                                                     (Agent icon, blue)
  Here are 3 fun nicknames:                             (plain text)

  1. **Sparky** — A lively, energetic name for someone who brings
     ideas to life.
  2. **Blaze** — Perfect for a bold, passionate, and fiery
     personality.
  3. **Pixel** — A modern, tech-savvy name for someone who loves
     gaming or digital art.

  🏁                                                     (End icon, red)
  {                                                     (JSON)
    "input": " "
  }
─────────────────────────────────────────────────────────────────
[  Send a message...                            [^]  ]  (input bar)
```

No thinking dots — `status` is `"ready"`, `isLoading` is `false`.

---

## 7. Why the End Node Shows `{ "input": " " }`

The complete chain:

```
1. node-config.ts:117-126
   [NodeTypeEnum.END]: {
     inputs: { value: " " },       // ← DEFAULT VALUE IS A SPACE
     outputs: ["output.end"],
   }

2. createNode("end") (node-config.ts:184-196)
   node.data = {
     label: "End",
     nodeType: "end",
     outputs: ["output.end"],
     value: " ",                   // ← FROM config.inputs.value
   }

3. Saved to MongoDB in flowObject
   "data": { "value": " ", "label": "End", "nodeType": "end", "outputs": ["output.end"] }

4. Loading from DB at runtime
   node.data.value = " "

5. ExecuteEndNode (endnode-executer.tsx:5)
   const text = node?.data.value;  // " "
   return { output: { input: " " } };

6. executeWorkflow.ts:130 — Choosing output for SSE emission:
   result.output?.text || result.output
   // result.output = { input: " " }
   // result.output.text → undefined (this object only has "input", not "text")
   // undefined is falsy → falls through to result.output
   // output = { input: " " }  ← RAW OBJECT

7. NodeDisplay (chat-panel.tsx:243-249)
   typeof output === "string" → false (it's an object)
   → JSON.stringify({ input: " " }, null, 2)
   → renders as:
     {
       "input": " "
     }
```

**Why doesn't this happen for the Agent node?** Because the Agent executor returns:
```javascript
{ output: { text: fullText } }
```
So `result.output.text` is the accumulated string. The engine picks it up via `result.output?.text`, making it a string. NodeDisplay then takes the `typeof output === "string"` branch and renders it directly.

**How to fix it:**
- **Option A (UI)**: Double-click the End node in the canvas and clear the `value` field to `""`
- **Option B (code change)**: Modify `endnode-executer.tsx` to return `undefined` when value is blank:
  ```typescript
  export const ExecuteEndNode = (node: Node) => {
    const text = node?.data.value as string;
    if (!text || text.trim() === "") return { output: undefined };
    return { output: { input: text } };
  };
  ```
- **Option C (code change)**: Modify `executeWorkflow.ts:130` to skip emitting End node output or to use a cleaner condition
