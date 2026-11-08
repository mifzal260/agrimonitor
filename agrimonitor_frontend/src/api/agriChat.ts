import { apiRequest, apiStreamRequest } from "./client";

export type AgriChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgriChatStatus = {
  available: boolean;
  model: string;
  message: string;
};

type StreamEvent = {
  content?: string;
  done?: boolean;
  error?: string;
};

export function getAgriChatStatus() {
  return apiRequest<AgriChatStatus>("/agri-chat/status");
}

export async function streamAgriChat(
  messages: AgriChatMessage[],
  onContent: (content: string) => void,
  signal?: AbortSignal,
) {
  const response = await apiStreamRequest("/agri-chat/chat", {
    method: "POST",
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!response.body) throw new Error("Streaming response is not available in this browser.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function consumeLine(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line) as StreamEvent;
    if (event.error) throw new Error(event.error);
    if (event.content) onContent(event.content);
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        consumeLine(buffer.slice(0, newlineIndex));
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");
      }
      if (done) break;
    }
    consumeLine(buffer);
  } finally {
    reader.releaseLock();
  }
}
