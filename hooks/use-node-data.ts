import { useState } from "react";
import { useReactFlow } from "@xyflow/react";

export function useNodeData<T = string>(
  nodeId: string,
  key: string,
  initialValue: T | (() => T),
) {
  const { updateNodeData } = useReactFlow();
  const [value, setValue] = useState<T>(initialValue);

  const handleChange = (newValue: T) => {
    setValue(newValue);
  };

  const handleBlur = () => {
    updateNodeData(nodeId, { [key]: value });
  };

  return { value, setValue, handleChange, handleBlur };
}
