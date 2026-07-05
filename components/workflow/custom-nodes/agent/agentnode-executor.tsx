import { streamAgentAction, generateAgentText } from "@/app/actions/agent-workflow";
import { MODELS } from "@/lib/constants";
import { replacesdVariables } from "@/lib/helper";
import { ExecutorContextType } from "@/types/workflow";
import { Node } from "@xyflow/react";
import { Output } from "ai";
import { convertJsonSchemaToZod } from "zod-from-json-schema";

export const ExecuteAgentNode = async (
  node: Node,
  context: ExecutorContextType,
) => {
  console.log(`\n=== Agent Node [${node.id}] ===`);
  console.log("Agent data:", JSON.stringify(node.data, null, 2));
  const { channel, history } = context;

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

  const result = await streamAgentAction({
    model,
    instructions: replacedInstructions,
    history,
    jsonOutput,
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
  try {
    for await (const chunk of result.fullStream) {
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
            output: fullText,
            toolCall: { name: c.toolName! },
          },
        });
      } else if (c.type === "tool-result") {
        await channel.emit("workflow.chunk", {
          type: "data-workflow-Node",
          id: node.id,
          data: {
            id: node.id,
            nodeType: node.type,
            nodeName: node.data.label,
            status: "loading",
            type: "tool-result",
            output: fullText,
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
