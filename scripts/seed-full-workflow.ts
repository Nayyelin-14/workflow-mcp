import { PrismaClient } from "../lib/generated/prisma/client";
import { customAlphabet } from "nanoid";
import { urlAlphabet } from "nanoid";

const prisma = new PrismaClient();
const generateSuffix = customAlphabet(urlAlphabet, 7);

function genId(type: string): string {
  return `${type.toLowerCase()}-${generateSuffix()}`;
}

async function main() {
  console.log("=== Seeding Full Workflow ===\n");

  // Find the most recent user from existing workflows
  const existing = await prisma.workflow.findFirst({
    orderBy: { createdAt: "desc" },
    select: { userId: true },
  });

  if (!existing?.userId) {
    console.error(
      "No existing workflows found. Create at least one workflow via the UI first so we can reuse your user ID."
    );
    process.exit(1);
  }

  const userId = existing.userId;
  console.log(`Using userId: ${userId}\n`);

  // Generate deterministic IDs so variable references are consistent
  const startId = genId("start");
  const classifyAgentId = genId("agent");
  const ifElseId = genId("if_else");
  const happyAgentId = genId("agent");
  const angryAgentId = genId("agent");
  const neutralAgentId = genId("agent");
  const endId = genId("end");

  console.log("Generated Node IDs:");
  console.log(`  Start:          ${startId}`);
  console.log(`  Classify Agent: ${classifyAgentId}`);
  console.log(`  If/Else:        ${ifElseId}`);
  console.log(`  Happy Agent:    ${happyAgentId}`);
  console.log(`  Angry Agent:    ${angryAgentId}`);
  console.log(`  Neutral Agent:  ${neutralAgentId}`);
  console.log(`  End:            ${endId}\n`);

  const nodes = [
    {
      id: startId,
      type: "start",
      position: { x: 50, y: 250 },
      data: {
        label: "Start",
        color: "bg-emerald-500",
        nodeType: "start",
        outputs: ["input"],
        inputValue: " ",
      },
    },
    {
      id: classifyAgentId,
      type: "agent",
      position: { x: 350, y: 250 },
      data: {
        label: "Classify Sentiment",
        color: "bg-blue-500",
        nodeType: "agent",
        outputs: ["output.text"],
        instructions: `Analyze the user's input and classify their sentiment as either "happy", "angry", or "neutral". User input: "{{${startId}.input}}" Reply with only one word: happy, angry, or neutral.`,
        model: "google/gemini-2.5-flash-lite",
        tools: [],
        outputFormat: "text",
        responseSchema: null,
      },
    },
    {
      id: ifElseId,
      type: "if_else",
      position: { x: 700, y: 250 },
      data: {
        label: "Check Sentiment",
        color: "bg-orange-500",
        nodeType: "if_else",
        outputs: ["output.result"],
        conditions: [
          {
            caseName: "Happy",
            variable: `{{${classifyAgentId}.output.text}}`,
            operator: "contains",
            value: "happy",
          },
          {
            caseName: "Angry",
            variable: `{{${classifyAgentId}.output.text}}`,
            operator: "contains",
            value: "angry",
          },
        ],
      },
    },
    {
      id: happyAgentId,
      type: "agent",
      position: { x: 1050, y: 50 },
      data: {
        label: "Respond Happy",
        color: "bg-emerald-500",
        nodeType: "agent",
        outputs: ["output.text"],
        instructions: `The user is feeling happy. Respond with an enthusiastic and cheerful message that matches their positive mood. Original input: "{{${startId}.input}}"`,
        model: "google/gemini-2.5-flash-lite",
        tools: [],
        outputFormat: "text",
        responseSchema: null,
      },
    },
    {
      id: angryAgentId,
      type: "agent",
      position: { x: 1050, y: 200 },
      data: {
        label: "Respond Angry",
        color: "bg-red-500",
        nodeType: "agent",
        outputs: ["output.text"],
        instructions: `The user is feeling angry. Respond with a calm and empathetic message acknowledging their frustration. Original input: "{{${startId}.input}}"`,
        model: "google/gemini-2.5-flash-lite",
        tools: [],
        outputFormat: "text",
        responseSchema: null,
      },
    },
    {
      id: neutralAgentId,
      type: "agent",
      position: { x: 1050, y: 350 },
      data: {
        label: "Respond Neutral",
        color: "bg-gray-500",
        nodeType: "agent",
        outputs: ["output.text"],
        instructions: `Respond with a helpful and friendly message. Original input: "{{${startId}.input}}"`,
        model: "google/gemini-2.5-flash-lite",
        tools: [],
        outputFormat: "text",
        responseSchema: null,
      },
    },
    {
      id: endId,
      type: "end",
      position: { x: 1400, y: 200 },
      data: {
        label: "End",
        color: "bg-red-500",
        nodeType: "end",
        outputs: ["output.end"],
        value: " ",
      },
    },
  ];

  const edges = [
    { id: genId("edge"), source: startId, target: classifyAgentId },
    { id: genId("edge"), source: classifyAgentId, target: ifElseId },
    { id: genId("edge"), source: ifElseId, sourceHandle: "condition-0", target: happyAgentId },
    { id: genId("edge"), source: ifElseId, sourceHandle: "condition-1", target: angryAgentId },
    { id: genId("edge"), source: ifElseId, sourceHandle: "else", target: neutralAgentId },
    { id: genId("edge"), source: happyAgentId, target: endId },
    { id: genId("edge"), source: angryAgentId, target: endId },
    { id: genId("edge"), source: neutralAgentId, target: endId },
  ];

  const name = "Full Sentiment Workflow (Seed)";

  const workflow = await prisma.workflow.create({
    data: {
      userId,
      name,
      description: "Start → Classify Sentiment → If/Else → Happy/Angry/Neutral → End",
      flowObject: JSON.stringify({ nodes, edges }),
    },
  });

  console.log(`✅ Workflow created!`);
  console.log(`   Name:    ${name}`);
  console.log(`   ID:      ${workflow.id}`);
  console.log(`   URL:     http://localhost:3000/SingleWorkflow/${workflow.id}\n`);

  console.log("To test: open the URL above, click the Preview button (top-right),");
  console.log("and type 'I'm happy today!' or 'This is so frustrating!' in the chat.\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
