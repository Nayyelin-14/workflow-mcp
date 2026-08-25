// =====================================================================
// agent-workflow.ts
// =====================================================================
// Server-side actions (Next.js Server Actions) used by the AI workflow/agent builder.
//
// The `"use server"` directive means EVERY exported async function below runs ONLY on the
// server, never in the browser, and each one can be called directly from a client component
// (e.g. `await streamAgentAction({...})`) like a normal async function.
//
// Two categories of functions live here:
//   1. LLM actions  — build a system prompt + tool set, then call the OpenRouter model,
//                     either streaming tokens (streamAgentAction) or awaiting the full reply
//                     (generateAgentText).
//   2. MCP actions  — probe a remote MCP server for its tools (connectMcpServer) and
//                     persist the server + its encrypted credentials (addMCPServer).
// =====================================================================

"use server"; // ← every export below is a server-only function

// --- Imports --------------------------------------------------------------
import { openrouter } from "@/lib/openrouter"; // configured OpenRouter provider (wraps an LLM provider)
import { webSearch } from "@exalabs/ai-sdk"; // helper that builds a real web-search tool for the model
import { createMCPClient } from "@ai-sdk/mcp"; // creates an MCP client over HTTP/stdio to talk to an MCP server
import {
  stepCountIs, // helper: `stepCountIs(5)` stops the model after 5 model/tool steps
  streamText, // streams a model response token-by-token (returns a stream object)
  generateText, // waits for the FULL model response at once (returns the complete text)
  UIMessage, // type: message object used by the @ai-sdk chat UI
  ModelMessage, // type: message object accepted by streamText/generateText on the server
} from "ai";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server"; // read the logged-in user from Kinde
import prisma from "@/lib/prisma"; // Prisma client for reading/writing the DB
import { decryption, encryption } from "@/lib/encryption"; // AES-256-GCM encrypt/decrypt for stored API keys

// =====================================================================
// Shared tool types
// =====================================================================
// An agent node's "Tools" list can contain two shapes. These types describe both so every
// function in this file (and the executor that calls them) agrees on the data.
//
// Example of what ACTUALLY gets stored on a node's data.tools:
//   [
//     { type: "native", value: "webSearch" },                       // a built-in tool
//     { type: "mcp", value: "my_server", serverId: "a1b2...",       // an MCP server + chosen tools
//       tools: [{ name: "getWeather" }, { name: "getStock" }] },
//   ]
export type SelectedNativeTool = {
  type: "native"; // marker: this entry is a built-in tool
  value: string; // the tool's id, e.g. "webSearch"
};
export type SelectedMCPTool = {
  type: "mcp"; // marker: this entry is an external MCP server
  value: string; // the server's display label (e.g. "weather_api")
  tools: { name: string }[]; // which of the server's tools the user ticked on
  serverId: string; // DB id of the saved MCP server record we must connect to
};
export type SelectedTool = SelectedNativeTool | SelectedMCPTool; // either kind is valid

// =====================================================================
// buildSystemPrompt(instructions, selectedTools, jsonOutput?)
// =====================================================================
// Builds the text that tells the model WHO it is and WHAT it's allowed to use.
// It always embeds the agent node's instructions verbatim, and appends a list of the
// NATIVE tool names so the model knows its capabilities.
//
// Why not list MCP tools here? Because MCP tools are attached to `streamText`/`generateText`
// as real AI SDK tools — the model discovers them through their tool metadata, not via the
// prompt. So we only mention native tools (like webSearch) in the prompt.
function buildSystemPrompt(
  instructions: string, // e.g. "You are a weather assistant. Only answer using tools."
  selectedTools: SelectedTool[], // the node's whole tools array
  jsonOutput?: Record<string, unknown>, // (unused for the prompt text) kept for future use
): string {
  // 1) Filter down to ONLY the native entries. What's left after the filter:
  //    input:  [ {type:"native",value:"webSearch"}, {type:"mcp",...} ]
  //    output: [ {type:"native",value:"webSearch"} ]
  const toolNames = selectedTools
    .filter((t) => t.type === "native") // drop every mcp entry
    .map((t) => t.value); // keep just the id string, e.g. "webSearch"

  // 2) Turn the ids into bullet lines:
  //    toolNames = ["webSearch","sendEmail"]  →  toolList = "- webSearch\n- sendEmail"
  const toolList = toolNames.map((name) => `- ${name}`).join("\n");

  // 3) Start the system message with a strict follow-instructions rule + the user's text.
  //    e.g. "You follow instructions exactly. Never refuse or ask for clarification.\n\nYou are..."
  let prompt = `You follow instructions exactly. Never refuse or ask for clarification.\n\n${instructions}`;

  // 4) If there were any native tools, append their bullet list to the prompt.
  if (toolList) {
    prompt += `\n\nAvailable tools:\n${toolList}`; // result: "...\n\nAvailable tools:\n- webSearch"
  }

  return prompt; // the finished prompt string the model will see as its "system" message
}

// =====================================================================
// extractAgentContent(parts)
// =====================================================================
// Turns a workflow's streamed message "parts" into ONE clean assistant message.
// It looks only at parts that came from an AGENT node, and keeps the interesting bits:
// tool calls, tool results, and plain text.
// NOTE: currently dead code — the executor streams chunks straight to the UI and does not
// call this. Kept as a helper in case we later want to rebuild an agent's work as a message.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAgentContent(parts: any[]) {
  // 1) An empty bucket we will fill as we scan each node's chunk.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];

  // 2) – filter: keep only chunks that are agent-node output.
  //      A streamed chunk looks like:
  //        { type: "data-workflow-node", data: { nodeType: "agent", type, toolCall, ... } }
  //    – map: for each such chunk, normalize it into a content piece and push it.
  parts
    ?.filter(
      (p) => p.type === "data-workflow-node" && p.data?.nodeType === "agent",
    )
    ?.map((p) => {
      // 3) Shortcuts to the meaningful fields we read off the chunk.
      const { type, toolCall, toolResult, output } = p.data;

      // 4) If the chunk is about the model CALLING a tool, keep its id + name.
      //    e.g. → { type:"tool-call", toolCallId:"c_12", toolName:"webSearch" }
      if (type === "tool-call" && toolCall) {
        content.push({
          type: "tool-call",
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.name,
        });
      }

      // 5) If the chunk is the RESULT returned by an executed tool, keep that result.
      //    e.g. → { type:"tool-result", toolCallId:"c_12", toolName:"webSearch", result:{...} }
      if (type === "tool-result" && toolResult) {
        content.push({
          type: "tool-result",
          toolCallId: toolResult.toolCallId,
          toolName: toolResult.name,
          result: toolResult.result,
        });
      }

      // 6) If the chunk holds a plain string, treat it as model text.
      if (typeof output === "string") {
        content.push({ type: "text", text: output });
      }
      // 7) Else, if the output object has a `.text` property, extract that.
      else if (output?.text) {
        content.push({ type: "text", text: output.text });
      }
    });

  // 8) Package it as a single assistant message. If nothing matched, content is "".
  //    (an empty string tells the SDK "there's nothing here").
  return {
    role: "assistant" as const,
    content: content.length > 0 ? content : "",
  };
}

// =====================================================================
// convertToModelMessages(history)
// =====================================================================
// Converts the UI's chat history (UIMessage[]) into the exact message array that
// streamText/generateText accept (ModelMessage[]). Only messages that contain text are
// kept; empty or tool-only messages are removed so the model isn't confused.
function convertToModelMessages(history: UIMessage[]): ModelMessage[] {
  return history
    // 1) For every UI message, try to produce a ModelMessage.
    .map((msg) => {
      // msg.parts is an array like [{type:"text", text:"hi"}, {type:"tool",...}] —
      // we look for the FIRST text part and grab its string.
      const text =
        (msg.parts as Array<{ type: string; text?: string }>)?.find(
          (p) => p.type === "text",
        )?.text || "";
      if (!text) return null; // nothing to send → mark as removable

      // 2) Build a proper ModelMessage. e.g. { role: "user", content: "hi" }
      //    (content here is a plain string because we dropped the other parts).
      return { role: msg.role as "user" | "assistant", content: text };
    })
    // 3) Remove all the `null` placeholders we marked above.
    .filter((msg): msg is NonNullable<typeof msg> => msg !== null);
}

// =====================================================================
// buildAgentTools(selectedTools, history, openMcpClients)
// =====================================================================
// The ONE place that converts a node's selected tools into the tool map the AI SDK needs.
// Handles BOTH kinds:
//   - NATIVE tools (e.g. webSearch) — wrapped with a scoped, context-aware execute().
//   - MCP tools — connects to the saved server, decrypts its key, and registers the chosen
//     tools; it also pushes every opened client into `openMcpClients` so the caller can
//     close them when generation finishes (avoiding leaked connections).
// By sharing this, `streamAgentAction` and `generateAgentText` no longer duplicate code,
// and (importantly) MCP tools now work in the main streaming path too.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildAgentTools(
  selectedTools: SelectedTool[], // the node's selected tools (native + mcp)
  history: UIMessage[], // used to derive the "previous topic" for web searches
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  openMcpClients: any[], // caller supplies an array that collects opened MCP clients
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {}; // tool map we hand to the AI SDK
  // The last assistant topic (if any) so web searches stay in-context.
  const prevTopic = getAssistantContext(history);

  // 1) NATIVE tools.
  for (const t of selectedTools.filter((t) => t.type === "native")) {
    if (t.value === "webSearch") {
      // Build the real web-search tool.
      const ws = webSearch({ apiKey: process.env.EXA_API_KEY });
      // Register it: metadata the model reads + an execute() that runs the search,
      // augmenting the query with the previous topic when one exists.
      tools.webSearch = {
        description: ws.description,
        inputSchema: ws.inputSchema,
        execute: async (
          args: { query: string },
          options?: { abortSignal?: AbortSignal },
        ) => {
          const query = prevTopic
            ? `${args.query} - context: previous topic was ${prevTopic}`
            : args.query;
          const fn = ws.execute as (args: {
            query: string;
          }) => Promise<unknown>;
          return fn({ ...args, query });
        },
      };
    }
  }

  // 2) MCP tools — for every mcp server, connect and register the chosen tools.
  for (const t of selectedTools.filter((t) => t.type === "mcp")) {
    const { toolSet, mcpClient } = await getMcpToolsByServerId(t.serverId);
    openMcpClients.push(mcpClient); // remember it so the caller can close it later
    for (const tool of t.tools) {
      // Register only tools that still exist on the server; skip removed ones.
      if (toolSet[tool.name]) tools[tool.name] = toolSet[tool.name];
    }
  }

  return tools;
}

// =====================================================================
// streamAgentAction (STREAMING)
// =====================================================================
// Streams a model response token-by-token for a workflow's agent node.
// Returns the streaming result object; the caller iterates `result.fullStream`.
export async function streamAgentAction({
  model,
  instructions,
  history,
  jsonOutput,
  selectedTools,
  signal,
}: {
  model: string; // OpenRouter model id, e.g. "google/gemini-2.5-flash-lite"
  instructions: string; // the agent node's system instructions
  history: UIMessage[]; // the conversation so far
  jsonOutput?: Record<string, unknown>; // set when output format is JSON
  selectedTools: SelectedTool[]; // native + mcp tools the node selected
  signal?: AbortSignal; // lets the client cancel the callback stream
}) {
  // 1) Prepare the history the model should see.
  const modelMessage = await convertToModelMessages(history);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mcpClients: any[] = []; // collect every opened MCP client so we can close them
  // 2) Build the tool map from the selected tools (native + MCP) via the shared helper.
  const tools = await buildAgentTools(selectedTools, history, mcpClients);

  // 3) Compile the system prompt (the node's instructions + the native tool list).
  const systemPrompt = buildSystemPrompt(instructions, selectedTools, jsonOutput);

  // 4) Fire off the stream and hand its result object back to the caller.
  const result = streamText({
    model: openrouter.chat(model), // pick the requested OpenRouter model
    system: systemPrompt, // the compiled prompt
    messages: modelMessage, // the converted history
    tools: Object.keys(tools).length > 0 ? tools : undefined, // only attach tools if we built any
    stopWhen: stepCountIs(5), // cap the model at 5 steps to avoid runaway loops
    maxOutputTokens: 2000, // hard cap on tokens per generation
    abortSignal: signal, // allow cancellation
    ...jsonOutput, // spread the JSON output config if present
    // 5) Free any MCP client connections once the stream is done.
    onFinish: async () => {
      for (const client of mcpClients) await client.close();
    },
  });

  return result; // caller does: for await (const chunk of result.fullStream) ...
}

// =====================================================================
// getAssistantContext(history)
// =====================================================================
// Extracts a short "current topic" from the last assistant message so web searches can be
// scoped to what the user is discussing. e.g. assistant said
// "I recommend visiting Japan. Here's a plan…" → context becomes "I recommend visiting Japan".
function getAssistantContext(history: UIMessage[]): string {
  // 1) Reverse the history and find the NEWEST message from the assistant.
  const prevPart = [...history] // copy so we don't mutate the original
    .reverse() // now working newest → oldest
    .find((m) => m.role === "assistant") // first assistant message we hit
    ?.parts?.find(
      // …then its first text part
      (p): p is { type: "text"; text: string } => p.type === "text",
    ) as { type: "text"; text: string } | undefined;
  const prevText = prevPart?.text || ""; // "I love visiting Japan. Here…" or ""
  // 2) If there's text, keep up to the first sentence, trimmed, capped at 120 chars.
  //    "I love visiting Japan. Here..."  →  "I love visiting Japan"
  return prevText ? prevText.split(/[.!?]/)[0].trim().substring(0, 120) : "";
}

// =====================================================================
// generateAgentText (NON-STREAMING)
// =====================================================================
// Same idea as streamAgentAction, but waits for the ENTIRE response and returns only the
// finished text. Used as a fallback (for example, when the stream produced no text).
export async function generateAgentText({
  model,
  instructions,
  history,
  jsonOutput,
  selectedTools,
  signal,
}: {
  model: string;
  instructions: string;
  history: UIMessage[];
  jsonOutput?: Record<string, unknown>;
  selectedTools: SelectedTool[];
  signal?: AbortSignal;
}) {
  // 1) Prepare history + local bookkeeping.
  const modelMessage = await convertToModelMessages(history);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mcpClients: any[] = []; // collect every opened MCP client so we can close them
  // 2) Build the tool map (native + MCP) via the SAME shared helper as streamAgentAction.
  const tools = await buildAgentTools(selectedTools, history, mcpClients);
  const systemPrompt = buildSystemPrompt(instructions, selectedTools, jsonOutput);

  // 3) Run the model to completion and harvest the text.
  const result = await generateText({
    model: openrouter.chat(model),
    system: systemPrompt,
    messages: modelMessage,
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    maxOutputTokens: 2000,
    abortSignal: signal,
    ...jsonOutput,
    // 4) When generation finishes, close every MCP client we opened (avoids leaks).
    onFinish: async () => {
      console.log("Closing MCP clients");
      for (const client of mcpClients) {
        await client.close();
      }
    },
  });

  return result.text; // deliver the final plain text to the caller
}

//// =====================================================================
//// MCP actions
//// =====================================================================

// =====================================================================
// connectMcpServer(url, apiKey)
// =====================================================================
// Probes a remote MCP server to (a) confirm it's reachable and (b) return the list of tools
// it exposes. Called at the "connect" step of the MCP dialog — nothing is saved yet.
export async function connectMcpServer({
  url,
  apiKey,
}: {
  url: string;
  apiKey: string;
}) {
  if (!url) {
    throw new Error("Something went wrong with mcp server");
  }

  // 1) Open a TEMPORARY client to the MCP server, using Bearer auth if a key was given.
  //    e.g. createMCPClient({ transport: { type:"http", url:"https://x.io/mcp", headers:{...} } })
  const mcpClient = await createMCPClient({
    transport: {
      type: "http", // required
      url, // required — the MCP server URL
      headers: apiKey
        ? { Authorization: `Bearer ${apiKey}` } // e.g. "Bearer my-top-secret-key"
        : undefined,
    },
  });

  // 2) Ask the server which tools it offers, then flatten them into clean objects.
  //     toolSet = { aWeather: {...}, aStock: {...} }
  //     toolsArray = [{ name:"aWeather", description:"...", inputSchema:{} }, ...]
  const toolSet = await mcpClient.tools();
  const toolsArray = Object.entries(toolSet).map(([name, tool]) => ({
    name,
    // description can be a plain string OR a function — resolve a function to its value.
    description:
      typeof tool.description === "function"
        ? tool.description({ context: {} })
        : tool.description || "",
    inputSchema: tool.inputSchema,
  }));

  // 3) We only wanted to PEEK; close the connection before returning.
  await mcpClient.close();
  console.log("mcp tool", toolsArray);
  return { tools: toolsArray }; // hand the discovered tools back to the dialog
}

// =====================================================================
// addMCPServer(url, apiKey, label)
// =====================================================================
// Persists an MCP server for the logged-in user, encrypting the API key at rest.
// If the same user+URL already exists, it reuses that DB row and just updates label/token.
export async function addMCPServer({
  url,
  apiKey,
  label,
}: {
  url: string;
  apiKey: string;
  label: string;
}) {
  // 1) Must be signed in before any DB write.
  const kindeSession = await getKindeServerSession();
  const loggedInUser = await kindeSession.getUser();
  if (!loggedInUser) {
    throw new Error("User not found");
  }

  // 2) Does this user already have a saved server with THIS url?
  //    (select by userId + url so two different users can each save the same URL separately)
  let server = await prisma.mcpServer.findFirst({
    where: { userId: loggedInUser.id, url },
  });

  // 3) Encrypt the key (empty string if the user gave no key) so the DB never holds plaintext.
  const encryptedKey = apiKey ? encryption(apiKey) : "";

  // 4) Branch on whether a row already existed.
  if (!server) {
    // – Not found → create a new server row.
    server = await prisma.mcpServer.create({
      data: { userId: loggedInUser.id, label, url, token: encryptedKey },
    });
  } else {
    // – Found → reuse this row, update the label and token only.
    server = await prisma.mcpServer.update({
      where: { id: server.id },
      data: { label, token: encryptedKey },
    });
  }
  return { serverId: server.id }; // hand the id back so the client can reference this server
}

// =====================================================================
// getMcpToolsByServerId(serverId)
// =====================================================================
// Opens a LIVE MCP client to a previously-saved server, decrypting its key, and returns
// the client + all of that server's tools. The caller is responsible for closing the client.
async function getMcpToolsByServerId(serverId: string) {
  // 1) Load the saved server record from the DB by id.
  const server = await prisma.mcpServer.findUnique({
    where: { id: serverId },
  });
  if (!server) {
    throw new Error("Server not found");
  }

  // 2) The token is stored ENCRYPTED → decrypt it back so we can authenticate.
  //    (if no token was stored, apiKey becomes undefined and we connect with no auth header)
  const apiKey = server.token ? decryption(server.token) : undefined;

  const url = server.url;
  // 3) Open a real client to the server with that auth.
  const mcpClient = await createMCPClient({
    transport: {
      type: "http",
      url,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    },
  });
  // 4) Fetch the full tool registry once and return BOTH the tools and the live client.
  const toolSet = await mcpClient.tools();
  return { toolSet, mcpClient };
}