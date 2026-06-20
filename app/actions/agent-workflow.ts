"use server";
import { openrouter } from "@/lib/openrouter";
import { webSearch } from "@exalabs/ai-sdk";

import { convertToModelMessages, stepCountIs, streamText, UIMessage } from "ai";
// model: string       // e.g. "google/gemini-2.0-flash-001"
// instructions: string  // e.g. "You are a customer support agent. Classify the issue as 'billing', 'technical', or 'general'"
// history: UIMessage[]  // chat history from the UI
// jsonOutput?: any      // structured output config (if JSON mode)
// selectedTools         // ["webSearch", "mcpServer", ...]

export async function streamAgentAction({
  model,
  instructions,
  history,
  jsonOutput,
  selectedTools,
}: {
  model: string;
  instructions: string;
  history: UIMessage[];
  jsonOutput?: Record<string, unknown>;
  selectedTools: Array<
    | { type: "native"; value: string }
    | { type: "mcp"; value: string; tools: [] }
  >;
}) {
  const modelMessage = await convertToModelMessages(history);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  for (const t of selectedTools.filter((t) => t.type === "native")) {
    if (t.value === "webSearch") tools.webSearch = webSearch();
  }

  const toolList = Object.entries(tools)
    ?.map(([name]) => `- ${name}`)
    ?.join("\n");

  const systemPrompt = `You are a helpful assistant.
  IMPORTANT: Only respond to the user's MOST RECENT message. 
  **Must use the following instructions: ${instructions}
  ${toolList ? `\nAvailable tools:\n${toolList}` : ""}`;

  const result = streamText({
    model: openrouter.chat(model),
    system: systemPrompt,
    messages: modelMessage,
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    stopWhen: stepCountIs(5),
    ...jsonOutput,
  });

  return result;
}
