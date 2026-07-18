"use server";
import { openrouter } from "@/lib/openrouter";
import { webSearch } from "@exalabs/ai-sdk";

import {
  stepCountIs,
  streamText,
  generateText,
  UIMessage,
  ModelMessage,
} from "ai";

function buildSystemPrompt(
  instructions: string,
  selectedTools: Array<
    | { type: "native"; value: string }
    | { type: "mcp"; value: string; tools: [] }
  >,
  jsonOutput?: Record<string, unknown>,
): string {
  const toolNames = selectedTools
    .filter((t) => t.type === "native")
    .map((t) => t.value);

  const toolList = toolNames.map((name) => `- ${name}`).join("\n");

  let prompt = `You follow instructions exactly. Never refuse or ask for clarification.\n\n${instructions}`;

  if (toolList) {
    prompt += `\n\nAvailable tools:\n${toolList}`;
  }

  return prompt;
}

function extractAgentContent(parts: any[]) {
  const content: any[] = [];

  parts
    ?.filter(
      (p) => p.type === "data-workflow-node" && p.data?.nodeType === "agent",
    )
    ?.map((p) => {
      const { type, toolCall, toolResult, output } = p.data;

      if (type === "tool-call" && toolCall) {
        content.push({
          type: "tool-call",
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.name,
        });
      }

      if (type === "tool-result" && toolResult) {
        content.push({
          type: "tool-result",
          toolCallId: toolResult.toolCallId,
          toolName: toolResult.name,
          result: toolResult.result,
        });
      }

      if (typeof output === "string") {
        content.push({
          type: "text",
          text: output,
        });
      } else if (output?.text) {
        content.push({
          type: "text",
          text: output.text,
        });
      }
    });

  return {
    role: "assistant" as const,
    content: content.length > 0 ? content : "",
  };
}

function convertToModelMessages(history: UIMessage[]): ModelMessage[] {
  return history
    .map((msg) => {
      const text =
        (msg.parts as any)?.find((p: any) => p.type === "text")?.text || "";
      if (!text) return null;
      return { role: msg.role as "user" | "assistant", content: text };
    })
    .filter((msg): msg is NonNullable<typeof msg> => msg !== null);
}

export async function streamAgentAction({
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
  selectedTools: Array<
    | { type: "native"; value: string }
    | { type: "mcp"; value: string; tools: [] }
  >;
  signal?: AbortSignal;
}) {
  const modelMessage = await convertToModelMessages(history);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  for (const t of selectedTools.filter((t) => t.type === "native")) {
    if (t.value === "webSearch") {
      const ws = webSearch({ apiKey: process.env.EXA_API_KEY });
      const prevTopic = getAssistantContext(history);
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
          const fn = ws.execute as (
            args: { query: string },
          ) => Promise<unknown>;
          return fn({ ...args, query });
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

function getAssistantContext(history: UIMessage[]): string {
  const prevPart = [...history]
    .reverse()
    .find((m) => m.role === "assistant")
    ?.parts?.find((p: any) => p.type === "text") as
    | { type: "text"; text: string }
    | undefined;
  const prevText = prevPart?.text || "";
  return prevText
    ? prevText.split(/[.!?]/)[0].trim().substring(0, 120)
    : "";
}

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
  selectedTools: Array<
    | { type: "native"; value: string }
    | { type: "mcp"; value: string; tools: [] }
  >;
  signal?: AbortSignal;
}) {
  const modelMessage = await convertToModelMessages(history);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  const prevTopic = getAssistantContext(history);

  for (const t of selectedTools.filter((t) => t.type === "native")) {
    if (t.value === "webSearch") {
      const ws = webSearch({ apiKey: process.env.EXA_API_KEY });
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
          const fn = ws.execute as (
            args: { query: string },
          ) => Promise<unknown>;
          return fn({ ...args, query });
        },
      };
    }
  }

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
