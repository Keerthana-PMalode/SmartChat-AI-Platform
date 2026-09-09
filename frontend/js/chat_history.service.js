import { api } from "./admin_api.js";
import { EventBus } from "./admin_events.js";

let chatsCache = null;

export async function fetchChatHistory(forceRefresh = false) {
  if (chatsCache && !forceRefresh) {
    EventBus.emit("chat-history:loaded", {
      chats: chatsCache,
    });

    return;
  }

  EventBus.emit("chat-history:loading", {
    loading: true,
  });

  try {
    const chats = await api.get("/admin/chats");

    chatsCache = chats;

    EventBus.emit("chat-history:loaded", {
      chats,
    });
  } catch (error) {
    console.error("Failed to fetch chat history:", error);

    EventBus.emit("chat-history:error", {
      error,
    });
  } finally {
    EventBus.emit("chat-history:loading", {
      loading: false,
    });
  }
}