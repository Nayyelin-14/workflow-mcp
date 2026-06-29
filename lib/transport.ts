import { DefaultChatTransport } from "ai";

export const createWorkFlowTransport = ({
  workflowId,
}: {
  workflowId: string;
}) => {
  console.log("\n=== Creating Workflow Transport ===");
  console.log("Workflow ID:", workflowId);

  return new DefaultChatTransport({
    api: "/api/upstash/trigger",
    async prepareSendMessagesRequest({ messages }) {
      console.log("\n--- prepareSendMessagesRequest ---");
      console.log("Sending messages count:", messages.length);
      console.log("Last message:", messages[messages.length - 1]?.content?.substring(0, 50));
      return {
        body: { workflowId, messages },
      };
    },
    prepareReconnectToStreamRequest: (data) => {
      console.log("\n--- prepareReconnectToStreamRequest ---");
      console.log("Reconnecting with data:", JSON.stringify(data, null, 2));
      return {
        ...data,
        headers: {
          ...data.headers,
          "x-is-reconnect": "true",
        },
      };
    },
    fetch: async (input, init) => {
      console.log("\n--- Transport fetch ---");
      console.log("Input:", input);
      console.log("Init method:", init?.method);
      console.log("Init body:", init?.body);

      const triggerResponse = await fetch(input, init);
      console.log("Trigger response status:", triggerResponse.status);

      const triggerData = await triggerResponse.json();
      const workflowRunId = triggerData.workflowRunId;
      console.log("Trigger data:", JSON.stringify(triggerData, null, 2));

      const sseUrl = `/api/workflow/live-chat?id=${workflowRunId}`;
      console.log("Connecting to SSE stream:", sseUrl);

      return fetch(sseUrl, {
        method: "GET",
      });
    },
  });
};
