# If/Else Node — Full Execution Scenario

## The Workflow

**User input:** `"I'm happy today"`

**Flow:** Start → Agent (LLM) → If/Else → one of three HTTP nodes → End

**Nodes:**
```ts
[
  { id: "start_1",    type: "start" },
  { id: "agent_2",    type: "agent",    data: { instructions: "Classify sentiment", model: "gpt-4" } },
  { id: "if_else_3",  type: "if_else",  data: { conditions: [
    { caseName: "Positive", variable: "{{agent_2.text}}", operator: "contains", value: "positive" },
    { caseName: "Neutral",  variable: "{{agent_2.text}}", operator: "contains", value: "neutral" }
  ]}},
  { id: "http_4",     type: "http",     data: { url: "https://api.example.com/happy", method: "POST" } },
  { id: "http_5",     type: "http",     data: { url: "https://api.example.com/neutral", method: "POST" } },
  { id: "http_6",     type: "http",     data: { url: "https://api.example.com/sad", method: "POST" } },
  { id: "end_7",      type: "end",      data: { value: "done" } }
]
```

**Edges:**
```ts
[
  { id: "e1", source: "start_1",   target: "agent_2" },
  { id: "e2", source: "agent_2",   target: "if_else_3" },
  { id: "e3", source: "if_else_3", sourceHandle: "condition-0", target: "http_4" },
  { id: "e4", source: "if_else_3", sourceHandle: "condition-1", target: "http_5" },
  { id: "e5", source: "if_else_3", sourceHandle: "else",        target: "http_6" },
  { id: "e6", source: "http_4",    target: "end_7" },
  { id: "e7", source: "http_5",    target: "end_7" },
  { id: "e8", source: "http_6",    target: "end_7" }
]
```

---

## Step 1 — Start Node

`executeWorkflow.ts:28`: `currentNodeId = "start_1"`

`executeWorkflow.ts:30`: `node = { id: "start_1", type: "start", ... }`

`executeWorkflow.ts:33`: `executorFactory = getNodeExecutor("start")` → Found in `NODE_EXECUTORS` → runs `ExecuteStartNode`

`executeWorkflow.ts:36-37`:
```ts
const result = await ExecuteStartNode(node, context);
// returns { output: { input: userInput } }
// userInput = "I'm happy today"
context.outputs["start_1"] = { input: "I'm happy today" }
```

After this:
```ts
outputs = {
  "start_1": { input: "I'm happy today" }
}
```

`executeWorkflow.ts:40-41`:
```ts
outgoingEdge = edges.find(e => e.source === "start_1")
// finds e1: { id: "e1", source: "start_1", target: "agent_2" }
currentNodeId = "agent_2"
```

---

## Step 2 — Agent Node

`currentNodeId = "agent_2"`

`node = { id: "agent_2", type: "agent", data: { instructions: "Classify sentiment", model: "gpt-4" } }`

`executorFactory = getNodeExecutor("agent")` → Found → runs `ExecuteAgentNode`

Inside `ExecuteAgentNode`:
```ts
const result = await streamAgentAction({
  model: "gpt-4",
  instructions: "Classify sentiment",
  history: [{ role: "user", content: "I'm happy today" }]
});
```

LLM generates: `"The sentiment is positive"`. Streamed to realtime channel. Full text accumulated.

Agent returns:
```ts
return {
  output: {
    text: "The sentiment is positive"
  }
};
```

`executeWorkflow.ts:37`:
```ts
context.outputs["agent_2"] = { text: "The sentiment is positive" }
```

Now outputs:
```ts
outputs = {
  "start_1": { input: "I'm happy today" },
  "agent_2": { text: "The sentiment is positive" }
}
```

`executeWorkflow.ts:40-41`:
```ts
outgoingEdge = edges.find(e => e.source === "agent_2") // finds e2
currentNodeId = "if_else_3"
```

---

## Step 3 — If/Else Node (THE KEY PART)

`currentNodeId = "if_else_3"`

`executorFactory = getNodeExecutor("if_else")` → Found → runs `ExecuteIfElseNode`

### Inside ExecuteIfElseNode

```ts
const { outputs } = context;
// outputs = {
//   "start_1": { input: "I'm happy today" },
//   "agent_2": { text: "The sentiment is positive" }
// }

const conditions = node.data.conditions;
// = [
//     { caseName: "Positive", variable: "{{agent_2.text}}", operator: "contains", value: "positive" },
//     { caseName: "Neutral",  variable: "{{agent_2.text}}", operator: "contains", value: "neutral" }
//   ]
```

---

### Iteration 0 — First condition ("Positive")

```ts
condition = {
  caseName: "Positive",
  variable: "{{agent_2.text}}",
  operator: "contains",
  value: "positive"
}
```

All fields present → does **not** `continue`.

---

**Line 29: `const variable = replacesdVariables(condition.variable, outputs)`**

`replacesdVariables("{{agent_2.text}}", outputs)` uses Mustache:
- Looks up `outputs["agent_2"]` → `{ text: "The sentiment is positive" }`
- Gets `.text` → `"The sentiment is positive"`
- Replaces `{{agent_2.text}}` → `"The sentiment is positive"`

```
variable = "The sentiment is positive"
```

---

**Line 30: `const conditionValue = condition.value`**

```
conditionValue = "positive"
```

---

**Line 32-33: `needsQuoting("The sentiment is positive")`**
```ts
function needsQuoting(val) {
  return isNaN(Number(val)) && !/^[""'].*[""']$/.test(val);
}
```

- `Number("The sentiment is positive")` → `NaN` → `isNaN(NaN)` = `true`
- `/^["'"].*["'"]$/.test("The sentiment is positive")` → `false` (no `"` or `'` at start/end)
- `true && true` = `true`

So:
```
varExpr = JSON.stringify("The sentiment is positive")
        = '"The sentiment is positive"'
```

---

**Line 35-37: `needsQuoting("positive")`**

- `Number("positive")` → `NaN` → `true`
- Not quoted → `false`
- `true && true` = `true`

```
valueExpr = JSON.stringify("positive")
          = '"positive"'
```

---

**Line 39: `const expression = \`${varExpr} ${condition.operator}  ${valueExpr}\``**

Template: `varExpr` + space + `condition.operator` + two spaces + `valueExpr`

```
expression = '"The sentiment is positive" contains  "positive"'
```

---

**Lines 41-46:**
```ts
const parser = new Parser();
const result = parser.evaluate(expression);
```

`expr-eval` evaluates the string expression.

```
result = true   (because "The sentiment is positive" contains "positive")
```

---

**Line 47: `if (result)` → `true`**

Enters the block:
```ts
return {
  output: {
    result: true,
    selectedBranch: "condition-0"   // <-- the matched branch!
  }
};
```

The function **returns immediately**. Iteration 1 (the "Neutral" condition) is **never reached**.

---

### Back in executeWorkflow.ts

```ts
const result = await ExecuteIfElseNode(node, context);
// result = { output: { result: true, selectedBranch: "condition-0" } }

context.outputs["if_else_3"] = {
  result: true,
  selectedBranch: "condition-0"
}
```

Now outputs:
```ts
outputs = {
  "start_1":    { input: "I'm happy today" },
  "agent_2":    { text: "The sentiment is positive" },
  "if_else_3":  { result: true, selectedBranch: "condition-0" }
}
```

---

**Line 40-41:** Edge following:
```ts
const outgoingEdge = edges.find((e) => e.source === currentNodeId);
currentNodeId = outgoingEdge?.target ?? null;
```

`edges.find(e => e.source === "if_else_3")` → finds **the first match** `e3`:
```
{ id: "e3", source: "if_else_3", sourceHandle: "condition-0", target: "http_4" }
```

`currentNodeId = "http_4"` ✅ — correctly follows `condition-0` because `e3` happens to be first.

**⚠️ BUG: The executor computed `selectedBranch: "condition-0"`, but the edge-following logic ignores `sourceHandle` entirely — it just takes the first edge. If edges were ordered `e5, e3, e4`, it would follow `else` regardless of the condition.**

---

## When condition is FALSE (e.g., LLM returned `"I don't know"`)

```
variable = "I don't know"
varExpr = '"I don\'t know"'
expression = '"I don\'t know" contains  "positive"'
```

`parser.evaluate(...)` → `false`

Doesn't enter the `if (result)` block. Continues to next iteration.

### Iteration 1 — Second condition ("Neutral")

```
variable = "I don't know"
varExpr = '"I don\'t know"'
valueExpr = '"neutral"'
expression = '"I don\'t know" contains  "neutral"'
```

`parser.evaluate(...)` → `false`

Continues. No more conditions → loop ends.

### After loop — no condition matched

```ts
return {
  output: {
    result: false,
    selectedBranch: "else"
  }
};
```

Back in `executeWorkflow.ts`:
```ts
context.outputs["if_else_3"] = { result: false, selectedBranch: "else" }
```

Edge follows first match (e3 / condition-0) — **WRONG BRANCH FOLLOWED**.

---

## Step 4 — HTTP Node

If `currentNodeId = "http_4"`, the HTTP node fires POST to the happy endpoint.

### Step 5 — End Node

Returns `{ output: { input: "done" } }`, no more edges → `currentNodeId = null` → loop exits.

---

## Variable Values Summary

| Variable | Runtime Value |
|---|---|
| `condition.variable` | `"{{agent_2.text}}"` |
| `condition.operator` | `"contains"` |
| `condition.value` | `"positive"` |
| `outputs["agent_2"]` | `{ text: "The sentiment is positive" }` |
| `variable` (resolved) | `"The sentiment is positive"` |
| `conditionValue` | `"positive"` |
| `varExpr` | `'"The sentiment is positive"'` |
| `valueExpr` | `'"positive"'` |
| `expression` | `'"The sentiment is positive" contains  "positive"'` |
| `result` (eval) | `true` |
| **Returned** | `{ output: { result: true, selectedBranch: "condition-0" } }` |
