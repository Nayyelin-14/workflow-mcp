import { DefaultChatTransport } from "ai";

export const createWorkFlowTransport = ({
  workflowId,
}: {
  workflowId: string;
}) => {
  return new DefaultChatTransport({
    api: "/api/upstash/trigger",
    async prepareSendMessagesRequest({ messages }) {
      return {
        body: { workflowId, messages },
      };
    },
    prepareReconnectToStreamRequest: (data) => {
      return {
        ...data,
        headers: {
          ...data.headers,
          "x-is-reconnect": "true",
        },
      };
    },
    fetch: async (input, init) => {
      const triggerResponse = await fetch(input, init); //// input = "/api/upstash/trigger" (from line 9: api)
      // init = { method: "POST", body: { workflowId, messages } }
      // ===============
      const triggerData = await triggerResponse.json();
      const workflowRunId = triggerData.workflowRunId;

      return fetch(`/api/workflow/live-chat?id=${workflowRunId}`, {
        method: "GET",
      });
    },
  });
};
