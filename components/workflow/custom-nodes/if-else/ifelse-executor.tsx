import { replacesdVariables } from "@/lib/helper";
import { ExecutorContextType } from "@/types/workflow";
import { Node } from "@xyflow/react";

export type ExecuteCondition = {
  caseName?: string;
  variable?: string;
  operator?: string;
  value?: string;
};

const OPERATORS_WITHOUT_VALUE = new Set(["is_empty", "is_not_empty"]);

function evaluateCondition(
  variable: string,
  operator: string,
  value: string,
): boolean {
  switch (operator) {
    case "=":
      return variable === value;
    case "!=":
      return variable !== value;
    case "contains":
      return variable.includes(value);
    case "not_contains":
      return !variable.includes(value);
    case "starts_with":
      return variable.startsWith(value);
    case "ends_with":
      return variable.endsWith(value);
    case ">":
    case "<":
    case ">=":
    case "<=": {
      const left = Number(variable);
      const right = Number(value);
      if (Number.isNaN(left) || Number.isNaN(right)) return false;
      if (operator === ">") return left > right;
      if (operator === "<") return left < right;
      if (operator === ">=") return left >= right;
      return left <= right;
    }
    case "is_empty":
      return variable.trim().length === 0;
    case "is_not_empty":
      return variable.trim().length > 0;
    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

export const ExecuteIfElseNode = (node: Node, context: ExecutorContextType) => {
  const { outputs } = context;

  const conditions = (node.data?.conditions as ExecuteCondition[]) || [];

  if (!Array.isArray(conditions)) {
    throw new Error("Conditions must be in array");
  }

  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];

    if (!condition.operator || !condition.variable) {
      continue;
    }
    if (
      !OPERATORS_WITHOUT_VALUE.has(condition.operator) &&
      condition.value === undefined
    ) {
      continue;
    }

    const variable = replacesdVariables(condition.variable, outputs);
    const conditionValue = condition.value ?? "";

    const result = evaluateCondition(variable, condition.operator, conditionValue);

    if (result) {
      return {
        output: {
          result: true,
          selectedBranch: `condition-${i}`,
          matchedCase: condition.caseName || `Condition ${i + 1}`,
        },
      };
    }
  }

  return {
    output: {
      result: false,
      selectedBranch: "else",
      matchedCase: "Else",
    },
  };
};
