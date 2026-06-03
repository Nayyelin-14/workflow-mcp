import React, { createContext, useContext, useState } from "react";

export type WorkFlowView = "edit" | "preview";
interface WorkflowContextType {
  view: WorkFlowView;
  setView: (view: WorkFlowView) => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(
  undefined,
);
export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<WorkFlowView>("edit");

  return (
    <WorkflowContext.Provider
      value={{
        view,
        setView,
      }} 
    >
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error("useWorkflow must be used within a WorkflowProvider");
  }
  return context;
}
