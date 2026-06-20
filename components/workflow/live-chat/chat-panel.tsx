import React, { useState } from "react";
import { UIMessage, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { ArrowUp, MessageSquare, PlusIcon, SparkleIcon } from "lucide-react";
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
import { createWorkFlowTransport } from "@/lib/transport";
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
              {messages?.map((msg) => (
                <Message from={msg.role} key={msg.id}>
                  <MessageContent className="text-[15px] ">
                    {msg.parts.map((p, index) => {
                      switch (p.type) {
                        case "text":
                          return (
                            <MessageResponse key={`${msg.id}-${index}`}>
                              {p.text}
                            </MessageResponse>
                          );
                        default:
                          return null;
                      }
                    })}
                  </MessageContent>
                </Message>
              ))}
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

export default ChatPanel;
