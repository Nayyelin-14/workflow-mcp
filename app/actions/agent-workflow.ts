"use server";
import { openrouter } from "@/lib/openrouter";
import { webSearch } from "@exalabs/ai-sdk";

import { convertToModelMessages, stepCountIs, streamText, generateText, UIMessage } from "ai";

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

export async function generateAgentText({
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

  const result = await generateText({
    model: openrouter.chat(model),
    system: systemPrompt,
    messages: modelMessage,
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    ...jsonOutput,
  });

  return result.text;
}
