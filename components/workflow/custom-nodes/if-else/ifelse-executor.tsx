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

    const variable = replacesdVariables(condition.variable, outputs).trim();
    let conditionValue = condition.value?.trim() ?? "";
    conditionValue = conditionValue.replace(/^"|"$/g, "");

    const result = evaluateCondition(
      variable,
      condition.operator,
      conditionValue,
    );

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
// Here's exactly what happens in your workflow "customer agent":
// The Node agent-F18QACcHMO ("Classification Agent")
// Its output format is JSON, with this schema:
// {
//   "classification": { "enum": ["return_item", "cancel_subscription", "get_information"] }
// }
// When this agent runs, it asks the LLM to classify the user's message and returns something like:
// { output: { classification: "return_item" } }
// // or
// { output: { classification: "cancel_subscription" } }
// // or
// { output: { classification: "get_information" } }
// So {{agent-F18QACcHMO.output.classification}}
// This is a placeholder that gets replaced at runtime with the actual classification string. For example:
// - If the user says "I want to return my order" → the agent returns classification: "return_item" → the placeholder becomes "return_item"
// - If the user says "Cancel my subscription" → it becomes "cancel_subscription"
// How It's Used
// The If/Else node if_else-VH5NwrDqGJ has 3 conditions that each check this value:
// Condition	Checks if	Routes to
// condition-0	{{...classification}} = "return_item"	Return Agent
// condition-1	{{...classification}} = "cancel_subscription"	Retention Agent
// condition-2	{{...classification}} = "get_information"	Information Agent
// else	(none matched)	End
// Summary
// {{agent-F18QACcHMO.output.classification}} = the category the Classification Agent chose — one of "return_item", "cancel_subscription", or "get_information". It's just a way to pass the agent's result into the if/else conditions so your workflow can branch based on what the user wants.
