import { api } from "./admin_api.js";
import { EventBus } from "./admin_events.js";

const CHAT_PAGE_SIZE = 10;

let currentPage = 1;
let currentSearch = "";

/* =========================
   FETCH CHAT HISTORY
========================= */

export async function fetchChatHistory(
  page = currentPage,
  search = currentSearch,
) {
  EventBus.emit("chat-history:loading", {
    loading: true,
  });

  try {
    currentPage = page;
    currentSearch = search;

    const params = new URLSearchParams({
      page: String(currentPage),
      page_size: String(CHAT_PAGE_SIZE),
    });

    if (currentSearch.trim()) {
      params.set("search", currentSearch.trim());
    }

    const response = await api.get(`/admin/chats?${params.toString()}`);

    EventBus.emit("chat-history:loaded", {
      chats: response.items,
      total: response.total,
      page: response.page,
      pageSize: response.page_size,
      totalPages: response.total_pages,
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

/* =========================
   SEARCH
========================= */

export function searchChatHistory(search) {
  currentSearch = search ?? "";
  currentPage = 1;

  return fetchChatHistory(1, currentSearch);
}

/* =========================
   PAGINATION
========================= */

export function setChatHistoryPage(page) {
  const requestedPage = Number(page);

  if (!Number.isInteger(requestedPage) || requestedPage < 1) {
    return;
  }

  currentPage = requestedPage;

  return fetchChatHistory(currentPage, currentSearch);
}

/* =========================
   REFRESH
========================= */

export function refreshChatHistory() {
  return fetchChatHistory(currentPage, currentSearch);
}

/* =========================
   EXPORT
========================= */

export async function exportChatHistory() {
  try {
    const params = new URLSearchParams();

    if (currentSearch.trim()) {
      params.set("search", currentSearch.trim());
    }

    /*
     * Request all matching rows for export.
     *
     * The backend currently caps page_size at
     * 100, so we'll fetch in batches.
     */

    const firstResponse = await api.get(
      `/admin/chats?page=1&page_size=100${
        currentSearch.trim()
          ? `&search=${encodeURIComponent(currentSearch.trim())}`
          : ""
      }`,
    );

    let allChats = [...firstResponse.items];

    const totalPages = firstResponse.total_pages;

    for (let page = 2; page <= totalPages; page++) {
      const response = await api.get(
        `/admin/chats?page=${page}&page_size=100${
          currentSearch.trim()
            ? `&search=${encodeURIComponent(currentSearch.trim())}`
            : ""
        }`,
      );

      allChats.push(...response.items);
    }

    if (allChats.length === 0) {
      EventBus.emit("chat-history:export-empty");

      return;
    }

    const headers = [
      "ID",
      "User ID",
      "User",
      "Date",
      "Session ID",
      "Messages",
      "Status",
    ];

    function escapeCsvValue(value) {
      return `"${String(value ?? "").replace(/"/g, '""')}"`;
    }

    const rows = allChats.map((chat) => [
      chat.id,
      chat.user_id,
      chat.user,
      chat.date,
      chat.session_id,
      chat.messages,
      chat.status,
    ]);

    const csv = [
      headers.map(escapeCsvValue).join(","),
      ...rows.map((row) => row.map(escapeCsvValue).join(",")),
    ].join("\r\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = `chat-history-${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    EventBus.emit("chat-history:exported", {
      count: allChats.length,
    });
  } catch (error) {
    console.error("Failed to export chat history:", error);
  }
}

/* =========================
   FETCH CHAT MESSAGES
========================= */

export async function fetchChatMessages(userId, chatId) {
  EventBus.emit("chat-messages:loading", {
    loading: true,
    userId,
    chatId,
  });

  try {
    const response = await api.get(
      `/admin/users/${userId}/chats/${chatId}/messages`,
    );

    EventBus.emit("chat-messages:loaded", {
      messages: response,
      userId,
      chatId,
    });

    return response;
  } catch (error) {
    console.error("Failed to fetch chat messages:", error);

    EventBus.emit("chat-messages:error", {
      error,
      userId,
      chatId,
    });

    throw error;
  } finally {
    EventBus.emit("chat-messages:loading", {
      loading: false,
      userId,
      chatId,
    });
  }
}
