import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useWorkflow } from "@/context/workflow-context";
import React from "react";
import ChatPanel from "./chat-panel";

const LiveChat = ({ workflowId }: { workflowId: string }) => {
  const { view, setView } = useWorkflow();
  const isPreview = view === "preview";

  const handlePreviewClose = () => {
    setView("edit");
  };
  return (
    <>
      <Sheet
        modal={false}
        open={isPreview}
        onOpenChange={(open) => !open && handlePreviewClose()}
      >
        <SheetContent
          side="right"
          className="w-[calc(100%-1rem)]! sm:max-w-sm! p-0
          bottom-4! right-4! top-auto!
          h-[520px]! max-h-[calc(100dvh-8rem)] z-95 bg-background
          rounded-xl overflow-hidden shadow-2xl border border-border/30"
          showCloseButton={false}
          overlayClass="bg-black/10! backdrop-blur-[2px]!"
        >
          <SheetTitle className="sr-only">Workflow Preview Chat</SheetTitle>
          <div className="h-full">
            <ChatPanel workflowId={workflowId} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default LiveChat;
