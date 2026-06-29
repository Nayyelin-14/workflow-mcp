import { replacesdVariables } from "@/lib/helper";
import { ExecutorContextType } from "@/types/workflow";
import { Node } from "@xyflow/react";
import { Parser } from "expr-eval";
export type ExecuteCondition = {
  caseName?: string;
  variable?: string;
  operator?: string;
  value?: string;
};

export const ExecuteIfElseNode = (node: Node, context: ExecutorContextType) => {
  const { outputs } = context;

  const conditions = (node.data?.conditions as ExecuteCondition[]) || [];

  if (!Array.isArray(conditions)) {
    throw new Error("Conditions must be in array");
  }

  console.log("=== IfElseNode Execution ===");
  console.log("Context outputs:", JSON.stringify(outputs, null, 2));

  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    console.log(`\n--- Condition ${i} ---`);
    console.log("Raw condition data:", JSON.stringify(condition, null, 2));

    if (
      !condition.operator ||
      condition.value === undefined ||
      !condition.variable
    ) {
      console.log(`Skipping condition ${i}: missing fields`);
      continue;
    }

    const variable = replacesdVariables(condition.variable, outputs);
    const conditionValue = condition.value;

    console.log("Resolved variable:", variable);
    console.log("Condition value:", conditionValue);

    const varExpr = needsQuoting(variable)
      ? JSON.stringify(variable)
      : variable;

    const valueExpr = needsQuoting(conditionValue)
      ? JSON.stringify(conditionValue)
      : conditionValue;

    console.log("varExpr:", varExpr);
    console.log("valueExpr:", valueExpr);

    const expression = `${varExpr} ${condition.operator}  ${valueExpr}`;
    console.log("Expression to evaluate:", expression);

    try {
      const parser = new Parser();
      const result = parser.evaluate(expression);
      console.log("Evaluation result:", result);

      if (result) {
        console.log(`✅ Condition ${i} matched! Branch: condition-${i}`);
        return {
          output: {
            result: true,
            selectedBranch: `condition-${i}`,
          },
        };
      } else {
        console.log(`❌ Condition ${i} did not match`);
      }
    } catch (error) {
      console.error(`Error evaluating condition ${i}:`, error);
      throw new Error("Error evaluating condition");
    }
  }

  console.log("\n⚠️ No condition matched, falling back to else branch");
  return {
    output: {
      result: false,
      selectedBranch: "else",
    },
  };
};

function needsQuoting(val: string) {
  return isNaN(Number(val)) && !/^[""'].*[""']$/.test(val);
}
