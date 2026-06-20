# Node System

## The Canvas

The editor is built on React Flow. You drag nodes from a palette onto the canvas and connect them by drawing edges between ports. Each node represents a step in the workflow — an AI agent call, a conditional branch, an HTTP request, or an annotation.

## Node Types

Six node types are available:

| Node | Type | Deletable | Custom Component | Settings Panel |
|------|------|-----------|-----------------|----------------|
| Start | Entry point | No | Yes | Yes |
| Agent | AI agent configuration | Yes | Yes | Yes (full) |
| If/Else | Conditional branching | Yes | Yes | Yes |
| Comment | Annotation | Yes | Yes | Inline textarea |
| End | Terminal | Yes | Yes | Yes |
| HTTP | API request | (in palette only) | — | — |

All node types have custom canvas components with dedicated settings panels (except HTTP and Comment, which uses an inline textarea).

## Variable System

Downstream nodes can reference outputs from upstream nodes using `{{variable}}` syntax. When you type `{{` in an instruction field, a mention dropdown shows all available variables from connected upstream nodes (filtered by actual edge connections, not all nodes in the workflow).

For example, if an Agent node outputs `response.text`, a downstream node can reference it as `{{agent_abc123.response.text}}`.

## Agent Node Deep Dive

The Agent node is the most feature-rich:

1. **System Instructions** — Free-form text with `{{variable}}` mention support for dynamic inputs.
2. **Model Selection** — Choose from Gemini 2.0 Flash, Gemini 2.5 Flash Lite, Gemini 2.5 Flash, GPT-3.5 Turbo, or Claude 3 Haiku.
3. **Tools** — Enable web search or connect to external MCP servers.
4. **Output Format** — Text (free-form response) or JSON (structured output).
5. **JSON Schema Editor** — When JSON format is selected, a visual schema builder lets you define fields (name, type, description) and enum values for structured responses.

## AI Chat Preview

Preview your workflow with a built-in AI chat panel. When toggling to Preview mode, a floating chat window appears in the bottom-right corner. Powered by the Vercel AI SDK (`@ai-sdk/react`), it lets you interact with the workflow as if you were an end user. Messages are rendered with **streamdown** — a streaming Markdown renderer with support for CJK text, syntax-highlighted code blocks, LaTeX math, and Mermaid diagrams.

## Data Flow

1. The Start node triggers execution.
2. Connected nodes execute in topological order (upstream to downstream).
3. Each node's output is stored and available to downstream nodes via the variable system.
4. Conditional branches (If/Else) route execution based on runtime values.
