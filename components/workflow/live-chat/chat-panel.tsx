import React, { useState } from "react";
import { UIMessage, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import {
  AlertCircleIcon,
  ArrowUp,
  Check,
  MessageSquare,
  PlusIcon,
  SparkleIcon,
} from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { TextShimmerLoader } from "@/components/ai-elements/text-shimmer";
import { createWorkFlowTransport } from "@/lib/transport";
import { getNodeConfig, NodeType } from "@/lib/workflow/node-config";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type NodeDataType = {
  id: string;
  nodeType: NodeType;
  nodeName: string;
  status: "loading" | "error" | "complete";
  type: "text-delta" | "tool-call" | "tool-result";
  toolCall?: { name: string };
  toolResult?: { name: string; result: any };
  output?: any;
  error?: any;
};

const ChatPanel = ({ workflowId }: { workflowId: string }) => {
  const [input, setInput] = useState<string>("");
  const [chatId, setChatId] = useState<string | null>(() =>
    crypto.randomUUID(),
  );

  const { messages, sendMessage, status } = useChat<UIMessage>({
    id: chatId ?? undefined,
    messages: [],
    transport: createWorkFlowTransport({
      workflowId,
    }),
  });

  const isLoading =
    status === "submitted" ||
    (status === "streaming" &&
      !Boolean(
        messages[messages.length - 1]?.parts.some(
          (part) => part.type === "text" && Boolean(part.text),
        ),
      ));

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message?.text?.trim()) return;
    sendMessage({
      text: message.text,
    });
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-auto">
      {/* chat header */}
      <div
        className="bg-linear-to-br from-primary
       via-primary/90 to-primary/80 px-4 py-3 relative"
      >
        <div className="flex items-center justify-between text-white">
          <h5 className="text-sm font-semibold tracking-tight">
            Workflow Preview
          </h5>
          <Button
            variant={"ghost"}
            size={"sm"}
            onClick={() => setChatId(crypto.randomUUID())}
          >
            New Chat <PlusIcon size={14} />
          </Button>
        </div>
      </div>

      <div className="relative flex flex-col flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <Empty className="border-0 gap-4">
              <EmptyHeader className="gap-3">
                <EmptyMedia variant={"icon"}>
                  <SparkleIcon size={20} className="text-primary" />
                </EmptyMedia>
                <EmptyTitle>Preview your workflow</EmptyTitle>
                <EmptyDescription>
                  Write a prompt as if you are the user to test your workflow
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <Conversation className="flex-1">
            <ConversationContent className="pt-6 px-3">
              {messages?.map((msg) => {
                const hasSteps = msg.parts.some(
                  (p) => p.type === "data-workflow-Node",
                );
                const hasText = msg.parts.some(
                  (p) => p.type === "text" && Boolean(p.text),
                );
                const isThisMessageStreaming =
                  status === "streaming" &&
                  msg.id === messages[messages.length - 1]?.id;

                return (
                  <Message from={msg.role} key={msg.id}>
                    <MessageContent className="text-[15px]">
                      {msg.parts.map((p, index) => {
                        switch (p.type) {
                          case "text":
                            return (
                              <MessageResponse key={`${msg.id}-${index}`}>
                                {p.text}
                              </MessageResponse>
                            );
                          case "data-workflow-Node":
                            return (
                              <NodeDisplay
                                key={`${msg.id}-workflow-${index}`}
                                data={p.data as NodeDataType}
                              />
                            );
                          default:
                            return null;
                        }
                      })}
                      {msg.role === "assistant" &&
                        !isThisMessageStreaming &&
                        hasSteps &&
                        !hasText && (
                          <p className="px-1 py-1 text-sm text-muted-foreground italic">
                            This run finished without sending any text back
                            to the user — connect an Agent or set a message
                            on the End node to produce a reply.
                          </p>
                        )}
                    </MessageContent>
                  </Message>
                );
              })}
              {isLoading && (
                <div className="flex items-start gap-3 px-4 py-2 max-w-[95%]">
                  <div className="flex items-center gap-2.5 rounded-xl bg-secondary/40 px-4 py-3">
                    <span className="flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:0ms]" />
                      <span className="size-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:150ms]" />
                      <span className="size-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:300ms]" />
                    </span>
                    <span className="text-xs text-muted-foreground/60 font-medium">
                      Thinking
                    </span>
                  </div>
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        )}

        <div className="p-3 bg-background border-t">
          <PromptInput
            onSubmit={handleSubmit}
            className="rounded-xl! shadow-sm border"
          >
            <PromptInputBody>
              <PromptInputTextarea
                value={input}
                placeholder="Send a message..."
                className="pt-2 text-sm"
                onChange={(e) => setInput(e.target.value)}
              />
            </PromptInputBody>
            <PromptInputFooter className="flex justify-end p-2 ">
              <PromptInputSubmit
                disabled={!input.trim() || isLoading}
                className="h-8! w-8! p-0! 
              rounded-lg! bg-primary! text-primary-foreground"
              >
                <ArrowUp size={16} />
              </PromptInputSubmit>
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
};

type NodeDisplayDataType = {
  data: NodeDataType;
};

function summarizeOutput(output: unknown): string | null {
  if (output == null) return null;
  if (typeof output === "string") return output || null;
  if (typeof output === "object") {
    const record = output as Record<string, unknown>;
    if (typeof record.text === "string") return record.text || null;
    if (typeof record.matchedCase === "string")
      return `→ ${record.matchedCase}`;
    if (typeof record.selectedBranch === "string")
      return `→ ${record.selectedBranch}`;
    if (typeof record.input === "string") return record.input || null;
  }
  return null;
}

export const NodeDisplay = ({ data }: NodeDisplayDataType) => {
  const nodeConfig = getNodeConfig(data.nodeType);
  if (!nodeConfig) return null;
  const Icon = nodeConfig.icon;
  const { status, output, error, toolCall, toolResult } = data;

  const summary = summarizeOutput(output);
  const showRawOutput = output != null && !summary;

  return (
    <div className="my-1.5 flex gap-2.5 px-1 py-1">
      <div
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-md text-white",
          nodeConfig.color,
          status === "loading" && "animate-pulse",
        )}
      >
        {status === "loading" ? (
          <Spinner className="size-3.5" />
        ) : status === "error" ? (
          <AlertCircleIcon className="size-3.5" />
        ) : (
          <Icon className="size-3.5" />
        )}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <span className="text-sm font-semibold text-foreground/90">
          {data.nodeName}
        </span>

        {summary && (
          <p className="mt-0.5 text-sm text-muted-foreground">{summary}</p>
        )}

        {showRawOutput && (
          <pre className="mt-1 overflow-x-auto rounded-md bg-muted/30 p-2 text-xs text-muted-foreground">
            {JSON.stringify(output, null, 2)}
          </pre>
        )}

        {(toolCall || toolResult) && (
          <div className="mt-1.5 flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
            {toolResult ? (
              <>
                <Check className="size-4 text-green-500" />
                <span className="text-sm">{toolResult?.name}</span>
              </>
            ) : (
              <TextShimmerLoader text={`Calling ${toolCall?.name} ... `} />
            )}
          </div>
        )}

        {status === "error" && (
          <div className="mt-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {typeof error === "string" ? error : JSON.stringify(error)}
          </div>
        )}
      </div>
    </div>
  );
};
export default ChatPanel;
