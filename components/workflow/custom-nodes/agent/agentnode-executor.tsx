import { streamAgentAction } from "@/app/actions/agent-workflow";
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
  const { outputs, channel, history } = context;

  const {
    instructions,
    model: selectedModel,
    tool: selectedTools = [],
    outputFormat = "text",
    responseSchema,
  } = node.data;

  const replacedInstructions = replacesdVariables(
    instructions as string,
    context,
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
    } catch (error) {
      throw new Error("Failed to parse JSON output");
    }
  }

  let fullText = "";
  for await (const chunk of result.fullStream) {
    switch (chunk.type) {
      case "text-delta":
        fullText += chunk.text;
        await channel.emit("workflow.chunk", {
          type: "data-workflow-Node",
          id: node.id,
          data: {
            id: node.id,
            nodeType: node.type,
            nodeName: node.data.label,
            status: "loading",
            type: "text-delta",
            output: fullText,
          },
        });
        break;

      case "tool-call":
        // 1. Agent executor → emits "workflow.chunk" on a realtime channel
        // 2. /api/workflow/live-chat (SSE endpoint) → subscribes to
        // that channel and writes each chunk as data: {...}\n\n SSE events to the HTTP response
        // 3. Frontend (DefaultChatTransport from
        //  AI SDK in lib/transport.ts) → does GET /api/workflow/live-chat?id=xxx,
        // reads the SSE stream, and feeds the chunks into the useChat hook which renders the live UI
        // So the catcher is the SSE route (app/api/workflow/live-chat/route.ts:20-28),
        // which acts as a bridge between the realtime channel (backend worker)
        //  and the browser (frontend SSE stream).
        await channel.emit("workflow.chunk", {
          type: "data-workflow-Node",
          id: node.id,
          data: {
            id: node.id,
            nodeType: node.type,
            nodeName: node.data.label,
            status: "loading",
            type: "tool-call",
            toolCall: {
              name: chunk.toolName,
            },
          },
        });
        break;

      default:
        break;
    }
  }

  return {
    output: {
      text: fullText,
    },
  };
};
