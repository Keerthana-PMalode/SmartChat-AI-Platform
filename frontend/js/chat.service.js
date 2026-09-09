import { api } from "./admin_api.js";

export async function fetchChatMessages(userId, chatId) {
  return await api.get(`/admin/users/${userId}/chats/${chatId}/messages`);
}
