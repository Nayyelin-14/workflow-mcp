import { streamAgentAction, generateAgentText } from "@/app/actions/agent-workflow";
import { MODELS } from "@/lib/constants";
import { openrouter } from "@/lib/openrouter";
import { replacesdVariables } from "@/lib/helper";
import { ExecutorContextType } from "@/types/workflow";
import { Node } from "@xyflow/react";
import { Output, generateText } from "ai";
import { convertJsonSchemaToZod } from "zod-from-json-schema";

export const ExecuteAgentNode = async (
  node: Node,
  context: ExecutorContextType,
) => {
  console.log(`\n=== Agent Node [${node.id}] ===`);
  console.log("Agent data:", JSON.stringify(node.data, null, 2));
  const { channel, history, signal } = context;

  const {
    instructions,
    model: selectedModel,
    tools: selectedTools = [],
    outputFormat = "text",
    responseSchema,
  } = node.data;

  const replacedInstructions = replacesdVariables(
    instructions as string,
    context.outputs,
  );
  const model = (selectedModel as string) || MODELS[0].value;

  console.log(replacedInstructions, "replacedInstructions");

  const jsonOutput =
    outputFormat === "json" && responseSchema
      ? {
          output: Output.object({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            schema: convertJsonSchemaToZod(responseSchema as any),
          }),
        }
      : undefined;

  if (signal?.aborted) {
    console.log(`[Agent] Node ${node.id} cancelled before starting`);
    return { output: { text: "" } };
  }

  const result = await streamAgentAction({
    model,
    instructions: replacedInstructions,
    history,
    jsonOutput,
    signal,
    selectedTools: selectedTools as Array<
      | { type: "native"; value: string }
      | { type: "mcp"; value: string; tools: [] }
    >,
  });
  // const result = {
  //   // The full text - await to get complete response
  //   text: Promise<string>,

  //   // Stream of text deltas only
  //   textStream: AsyncIterable<string>,

  //   // Stream of ALL chunks (text-delta, tool-call, tool-result, etc.)
  //   fullStream: AsyncIterable<StreamPart>,

  //   // Array of all tool calls made
  //   toolCalls: Promise<Array<{ toolName: string; args: any; result: any }>>,

  //   // Token usage
  //   usage: Promise<{
  //     promptTokens: number;
  //     completionTokens: number;
  //     totalTokens: number;
  //   }>,

  //   // For JSON output mode
  //   experimental_output: AsyncIterable<PartialOutput> | undefined,
  // };
  if (outputFormat === "json") {
    try {
      const text = await result.text;

      return {
        output: JSON.parse(text),
      };
    } catch {
      throw new Error("Failed to parse JSON output");
    }
  }

  let fullText = "";
  const toolResults: { name: string; result: unknown }[] = [];
  try {
    for await (const chunk of result.fullStream) {
      if (signal?.aborted) {
        console.log(`[Agent] Node ${node.id} cancelled during stream`);
        break;
      }
      const c = chunk as { type: string; text?: string; toolName?: string; toolCallId?: string; output?: unknown; message?: string; error?: unknown };
      if (c.type === "text-delta" || c.type === "text") {
        fullText += c.text ?? "";
        await channel.emit("workflow.chunk", {
          type: "data-workflow-Node",
          id: node.id,
          data: {
            id: node.id,
            nodeType: node.type,
            nodeName: node.data.label,
            status: "loading",
            type: "text",
            output: fullText,
          },
        });
      } else if (c.type === "error") {
        const errMsg = c.message ?? String(c.error ?? "Unknown error");
        console.error(`[Agent] Stream error: ${errMsg}`);
        throw new Error(errMsg);
      } else if (c.type === "tool-call") {
        await channel.emit("workflow.chunk", {
          type: "data-workflow-Node",
          id: node.id,
          data: {
            id: node.id,
            nodeType: node.type,
            nodeName: node.data.label,
            status: "loading",
            type: "tool-call",
            ...(fullText ? { output: fullText } : {}),
            toolCall: { name: c.toolName! },
          },
        });
      } else if (c.type === "tool-result") {
        toolResults.push({ name: c.toolName!, result: c.output });
        await channel.emit("workflow.chunk", {
          type: "data-workflow-Node",
          id: node.id,
          data: {
            id: node.id,
            nodeType: node.type,
            nodeName: node.data.label,
            status: "loading",
            type: "tool-result",
            ...(fullText ? { output: fullText } : {}),
            toolResult: {
              toolCallId: c.toolCallId!,
              name: c.toolName!,
              result: c.output,
            },
          },
        });
      }
    }
  } catch (e) {
    console.error(`[Agent] Stream iteration error for node ${node.id}:`, e);
  }

  if (signal?.aborted) {
    console.log(`[Agent] Node ${node.id} returning early due to cancellation`);
    return { output: { text: fullText || "" } };
  }

  if (!fullText && toolResults.length > 0) {
    const lastUserMsg = [...history].reverse().find((m) => m.role === "user");
    const userText =
      (lastUserMsg?.parts as any)?.find((p: any) => p.type === "text")?.text ||
      "";
    const toolSummary = toolResults
      .map((tr) => `${tr.name} returned: ${JSON.stringify(tr.result).substring(0, 2000)}`)
      .join("\n\n");
    const prompt = `The webSearch returned these results for "${userText}":\n\n${toolSummary}\n\nSummarize these results for the user.`;
    try {
      const { text } = await generateText({
        model: openrouter.chat(model),
        messages: [{ role: "user", content: prompt }],
        maxOutputTokens: 2000,
        abortSignal: signal,
      });
      fullText = text ?? "";
    } catch (e) {
      console.error(`[Agent] Failed to get summary after tool call:`, e);
    }
  }

  if (!fullText) {
    try {
      fullText = (await result.text) ?? "";
      console.log(`[Agent] Fallback text: "${fullText}"`);
    } catch (e) {
      console.error(`[Agent] Failed to get fallback text (stream text):`, e);
    }
  }

  if (!fullText) {
    try {
      console.log(`[Agent] Trying generateAgentText as last resort...`);
      fullText = await generateAgentText({
        model,
        instructions: replacedInstructions,
        history,
        jsonOutput,
        signal,
        selectedTools: selectedTools as Array<
          | { type: "native"; value: string }
          | { type: "mcp"; value: string; tools: [] }
        >,
      });
      console.log(`[Agent] generateAgentText result: "${fullText}"`);
    } catch (e) {
      console.error(`[Agent] generateAgentText also failed:`, e);
    }
  }

  console.log("Agent full response:", fullText);
  return { output: { text: fullText } };
};
