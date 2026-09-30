import { EventBus } from "./admin_events.js";

/* =========================================================
   GLOBAL UI REFERENCES
========================================================= */

const navItems = document.querySelectorAll(".nav-item[data-section]");

/* =========================================================
   COMMON HELPERS
========================================================= */

/**
 * Convert a section identifier such as:
 *
 *     "chat-history"
 *
 * into:
 *
 *     "Chat History"
 */
function formatTitle(section) {
  return section
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Escape HTML-sensitive characters before
 * inserting dynamic values into HTML.
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format a date using the browser's
 * local date/time formatting.
 */
function formatChatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Format a log timestamp.
 */
function formatLogDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

/**
 * Shorten a long session UUID for display
 * while keeping the complete value available
 * through the element's title attribute.
 */
function formatSessionId(sessionId) {
  if (!sessionId || sessionId === "-") {
    return "-";
  }

  if (sessionId.length > 20) {
    return `${sessionId.slice(0, 8)}...${sessionId.slice(-8)}`;
  }

  return sessionId;
}

/**
 * Normalize database message roles into the
 * two UI roles used by the chat view.
 */
function normalizeMessageRole(role) {
  const value = String(role ?? "")
    .trim()
    .toLowerCase();

  if (value === "user" || value === "human") {
    return "user";
  }

  /*
   * The database may contain:
   *
   * - assistant
   * - chatbot
   *
   * Everything other than a user message
   * is therefore treated as an assistant message.
   */
  return "assistant";
}

/**
 * Normalize a log level into a CSS class.
 */
function getLogLevelClass(level) {
  const normalized = String(level ?? "info")
    .trim()
    .toLowerCase();

  if (normalized === "warning") {
    return "warning";
  }

  if (normalized === "error") {
    return "error";
  }

  return "info";
}

/* =========================================================
   SIDEBAR NAVIGATION
========================================================= */

/**
 * Request navigation when a sidebar item
 * is clicked.
 */
navItems.forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();

    const section = item.dataset.section;

    window.location.hash = section;

    EventBus.emit("app:navigate", {
      section,
    });
  });
});

/**
 * Update the page title in the topbar.
 */
function updatePageTitle(section) {
  const pageTitle = document.getElementById("page-title");

  if (!pageTitle) {
    return;
  }

  const titles = {
    dashboard: "Dashboard",
    "chat-history": "Chat History",
    users: "Users",
    analytics: "Analytics",
    settings: "Settings",
    logs: "Logs",
  };

  pageTitle.textContent =
    titles[section] || formatTitle(section) || "Dashboard";
}

/**
 * Update the visible section after the
 * application navigation layer confirms navigation.
 */
EventBus.on("app:navigated", (event) => {
  const section = event.detail?.section;

  if (!section) {
    return;
  }

  document.querySelectorAll(".content-section").forEach((element) => {
    element.hidden = true;
  });

  document.querySelectorAll(".nav-item[data-section]").forEach((item) => {
    item.classList.toggle("active", item.dataset.section === section);
  });

  const target = document.getElementById(`${section}-section`);

  if (!target) {
    console.warn(`ADMIN UI: section not found: ${section}-section`);

    return;
  }

  target.hidden = false;

  updatePageTitle(section);
});

/* =========================================================
   DASHBOARD
========================================================= */

const dashboardTotalUsers = document.getElementById("dashboard-total-users");

const dashboardTotalConversations = document.getElementById(
  "dashboard-total-conversations",
);

const dashboardTotalMessages = document.getElementById(
  "dashboard-total-messages",
);

const dashboardActiveUsers = document.getElementById("dashboard-active-users");

const dashboardRecentUsers = document.getElementById("dashboard-recent-users");

const dashboardRecentConversations = document.getElementById(
  "dashboard-recent-conversations",
);

/* =========================================================
   DASHBOARD: LOADING
========================================================= */

EventBus.on("dashboard:loading", (event) => {
  const loading = event.detail?.loading;

  console.log("UI: dashboard loading:", loading);

  if (!loading) {
    return;
  }

  if (dashboardTotalUsers) {
    dashboardTotalUsers.textContent = "...";
  }

  if (dashboardTotalConversations) {
    dashboardTotalConversations.textContent = "...";
  }

  if (dashboardTotalMessages) {
    dashboardTotalMessages.textContent = "...";
  }

  if (dashboardActiveUsers) {
    dashboardActiveUsers.textContent = "...";
  }

  if (dashboardRecentUsers) {
    dashboardRecentUsers.innerHTML = "<p>Loading recent users...</p>";
  }

  if (dashboardRecentConversations) {
    dashboardRecentConversations.innerHTML =
      "<p>Loading recent conversations...</p>";
  }
});

/* =========================================================
   DASHBOARD: LOADED
========================================================= */

EventBus.on("dashboard:loaded", (event) => {
  const data = event.detail ?? {};

  const stats = data.stats ?? {};

  const recentUsers = data.recent_users ?? [];

  const recentConversations = data.recent_conversations ?? [];

  console.log("UI: dashboard loaded:", data);

  /* -------------------------------------------------------
     STATISTICS
  ------------------------------------------------------- */

  if (dashboardTotalUsers) {
    dashboardTotalUsers.textContent = stats.users ?? 0;
  }

  if (dashboardTotalConversations) {
    dashboardTotalConversations.textContent = stats.conversations ?? 0;
  }

  if (dashboardTotalMessages) {
    dashboardTotalMessages.textContent = stats.messages ?? 0;
  }

  if (dashboardActiveUsers) {
    dashboardActiveUsers.textContent = stats.active_users ?? 0;
  }

  /* -------------------------------------------------------
     RECENT USERS
  ------------------------------------------------------- */

  if (dashboardRecentUsers) {
    dashboardRecentUsers.innerHTML = "";

    if (recentUsers.length === 0) {
      dashboardRecentUsers.innerHTML = "<p>No recent users.</p>";
    } else {
      recentUsers.forEach((user) => {
        const item = document.createElement("div");

        item.className = "dashboard-recent-item";

        item.innerHTML = `
          <strong>${escapeHtml(user.username)}</strong>
          <span>${escapeHtml(user.role)}</span>
        `;

        dashboardRecentUsers.appendChild(item);
      });
    }
  }

  /* -------------------------------------------------------
     RECENT CONVERSATIONS
  ------------------------------------------------------- */

  if (dashboardRecentConversations) {
    dashboardRecentConversations.innerHTML = "";

    if (recentConversations.length === 0) {
      dashboardRecentConversations.innerHTML =
        "<p>No recent conversations.</p>";
    } else {
      recentConversations.forEach((chat) => {
        const item = document.createElement("div");

        item.className = "dashboard-recent-item";

        item.innerHTML = `
          <strong>${escapeHtml(chat.user)}</strong>

          <span>
            ${formatChatDate(chat.date)}
          </span>
        `;

        dashboardRecentConversations.appendChild(item);
      });
    }
  }
});

/* =========================================================
   DASHBOARD: ERROR
========================================================= */

EventBus.on("dashboard:error", (event) => {
  const message =
    event.detail?.message || event.detail?.error || "Failed to load dashboard.";

  console.error("UI: dashboard error:", message);

  if (dashboardTotalUsers) {
    dashboardTotalUsers.textContent = "0";
  }

  if (dashboardTotalConversations) {
    dashboardTotalConversations.textContent = "0";
  }

  if (dashboardTotalMessages) {
    dashboardTotalMessages.textContent = "0";
  }

  if (dashboardActiveUsers) {
    dashboardActiveUsers.textContent = "0";
  }

  if (dashboardRecentUsers) {
    dashboardRecentUsers.innerHTML = `<p>${escapeHtml(message)}</p>`;
  }

  if (dashboardRecentConversations) {
    dashboardRecentConversations.innerHTML = `<p>${escapeHtml(message)}</p>`;
  }
});

/* =========================================================
   USERS
========================================================= */

const userSearchInput = document.getElementById("user-search");

const userSearchButton = document.getElementById("user-search-btn");

const userClearSearchButton = document.getElementById("user-clear-search-btn");

const refreshUsersButton = document.getElementById("refresh-users-btn");

const createUserButton = document.getElementById("create-user-btn");

const createUserForm = document.getElementById("create-user-form");

const createUserSubmitButton = document.getElementById(
  "submit-create-user-btn",
);

const createUserModal = document.getElementById("create-user-modal");

const cancelCreateUserButton = document.getElementById(
  "cancel-create-user-btn",
);

const usersTableBody = document.getElementById("users-tbody");

/* =========================================================
   USERS: LOADING
========================================================= */

EventBus.on("users:loading", (event) => {
  const loading = event.detail?.loading;

  console.log("UI: users loading:", loading);

  if (!loading || !usersTableBody) {
    return;
  }

  usersTableBody.innerHTML = `
    <tr>
      <td
        colspan="4"
        style="text-align: center;"
      >
        Loading users...
      </td>
    </tr>
  `;
});

/* =========================================================
   USERS: LOADED
========================================================= */

EventBus.on("users:loaded", (event) => {
  const users = event.detail?.users ?? [];

  const search = event.detail?.search ?? "";

  console.log("UI: users loaded:", {
    users,
    search,
  });

  if (!usersTableBody) {
    console.error("Users table body not found");

    return;
  }

  usersTableBody.innerHTML = "";

  if (users.length === 0) {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td
        colspan="4"
        style="text-align: center;"
      >
        ${search ? "No users found for this search." : "No users found."}
      </td>
    `;

    usersTableBody.appendChild(row);

    return;
  }

  users.forEach((user) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>
        ${escapeHtml(user.id)}
      </td>

      <td>
        ${escapeHtml(user.username)}
      </td>

      <td>
        ${escapeHtml(user.role)}
      </td>

      <td>
        <button
          type="button"
          class="delete-user-btn"
          data-user-id="${escapeHtml(user.id)}"
        >
          Delete
        </button>
      </td>
    `;

    usersTableBody.appendChild(row);
  });
});

/* =========================================================
   USERS: ERROR
========================================================= */

EventBus.on("users:error", (event) => {
  const message = event.detail?.message || "Failed to load users.";

  console.error("UI: users error:", message);

  if (!usersTableBody) {
    return;
  }

  usersTableBody.innerHTML = `
    <tr>
      <td
        colspan="4"
        style="
          text-align: center;
          color: red;
        "
      >
        ${escapeHtml(message)}
      </td>
    </tr>
  `;
});

/* =========================================================
   USERS: REFRESH
========================================================= */

refreshUsersButton?.addEventListener("click", (event) => {
  event.preventDefault();

  console.log("UI: refresh users requested");

  EventBus.emit("users:refresh-requested");
});

/* =========================================================
   USERS: SEARCH
========================================================= */

function handleUserSearchSubmit() {
  if (!userSearchInput) {
    console.error("User search input not found");

    return;
  }

  const search = userSearchInput.value.trim();

  console.log("UI: user search requested:", search);

  updateUserClearSearchButton();

  EventBus.emit("users:search-requested", {
    search,
  });
}

function updateUserClearSearchButton() {
  if (!userClearSearchButton || !userSearchInput) {
    return;
  }

  const hasSearch = userSearchInput.value.trim().length > 0;

  userClearSearchButton.classList.toggle("hidden", !hasSearch);
}

userSearchInput?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();

  handleUserSearchSubmit();
});

userSearchButton?.addEventListener("click", (event) => {
  event.preventDefault();

  handleUserSearchSubmit();
});

userClearSearchButton?.addEventListener("click", (event) => {
  event.preventDefault();

  console.log("UI: clearing user search");

  if (userSearchInput) {
    userSearchInput.value = "";
  }

  updateUserClearSearchButton();

  EventBus.emit("users:search-requested", {
    search: "",
  });
});

userSearchInput?.addEventListener("input", updateUserClearSearchButton);

updateUserClearSearchButton();

/* =========================================================
   USERS: CREATE USER MODAL
========================================================= */

createUserButton?.addEventListener("click", () => {
  console.log("UI: opening create user modal");

  createUserModal?.classList.remove("hidden");

  createUserModal?.setAttribute("aria-hidden", "false");

  document.getElementById("create-user-username")?.focus();
});

cancelCreateUserButton?.addEventListener("click", () => {
  console.log("UI: cancel create user");

  createUserForm?.reset();

  createUserModal?.classList.add("hidden");

  createUserModal?.setAttribute("aria-hidden", "true");

  updateCreateUserButton();
});

/* =========================================================
   USERS: CREATE
========================================================= */

createUserForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!createUserForm.checkValidity()) {
    createUserForm.reportValidity();

    return;
  }

  const username = document
    .getElementById("create-user-username")
    ?.value.trim();

  const password = document.getElementById("create-user-password")?.value;

  const role = document.getElementById("create-user-role")?.value;

  console.log("UI: creating user:", {
    username,
    role,
  });

  EventBus.emit("users:create-requested", {
    username,
    password,
    role,
  });
});

function updateCreateUserButton() {
  if (!createUserForm || !createUserSubmitButton) {
    return;
  }

  createUserSubmitButton.disabled = !createUserForm.checkValidity();
}

createUserForm?.addEventListener("input", updateCreateUserButton);

createUserForm?.addEventListener("change", updateCreateUserButton);

updateCreateUserButton();

/* =========================================================
   USERS: CREATED
========================================================= */

EventBus.on("users:created", () => {
  console.log("UI: user created successfully");

  createUserForm?.reset();

  createUserModal?.classList.add("hidden");

  createUserModal?.setAttribute("aria-hidden", "true");

  updateCreateUserButton();
});

/* =========================================================
   USERS: DELETE
========================================================= */

usersTableBody?.addEventListener("click", (event) => {
  const deleteButton = event.target.closest(".delete-user-btn");

  if (!deleteButton) {
    return;
  }

  const userId = deleteButton.dataset.userId;

  if (!userId) {
    console.error("Delete button has no user ID");

    return;
  }

  const confirmed = window.confirm(
    "Are you sure you want to delete this user?",
  );

  if (!confirmed) {
    return;
  }

  console.log("UI: delete user requested:", userId);

  EventBus.emit("users:delete-requested", {
    userId: Number(userId),
  });
});

/* =========================================================
   CHAT HISTORY
========================================================= */

const chatHistoryTableBody = document.getElementById("chat-history-tbody");

const chatCount = document.getElementById("chat-count");

const chatPagination = document.getElementById("chat-pagination");

const refreshChatButton = document.getElementById("refresh-chat-btn");

const exportChatButton = document.getElementById("chat-export-btn");

const chatSearchInput = document.getElementById("chat-search");

const chatSearchButton = document.getElementById("chat-search-btn");

const chatClearSearchButton = document.getElementById("chat-clear-search-btn");

/* =========================================================
   CHAT HISTORY: LOADING
========================================================= */

EventBus.on("chat-history:loading", (event) => {
  const loading = event.detail?.loading;

  console.log("UI: chat history loading:", loading);

  if (!loading || !chatHistoryTableBody) {
    return;
  }

  chatHistoryTableBody.innerHTML = `
    <tr>
      <td
        colspan="6"
        style="text-align: center;"
      >
        Loading chat history...
      </td>
    </tr>
  `;
});

/* =========================================================
   CHAT HISTORY: LOADED
========================================================= */

EventBus.on("chat-history:loaded", (event) => {
  const data = event.detail ?? {};

  const chats = data.chats ?? [];

  const total = data.total ?? 0;

  const page = data.page ?? 1;

  const pageSize = data.pageSize ?? 10;

  const totalPages = data.totalPages ?? 1;

  console.log("UI: chat history loaded:", data);

  if (!chatHistoryTableBody) {
    console.error("Chat history table body not found");

    return;
  }

  chatHistoryTableBody.innerHTML = "";

  if (chats.length === 0) {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td
        colspan="6"
        style="text-align: center;"
      >
        No chat history found.
      </td>
    `;

    chatHistoryTableBody.appendChild(row);

    if (chatCount) {
      chatCount.textContent = "Showing 0 conversations";
    }

    renderChatPagination(page, totalPages);

    return;
  }

  chats.forEach((chat) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>
        ${escapeHtml(chat.id)}
      </td>

      <td>
        ${escapeHtml(chat.user)}
      </td>

      <td>
        ${formatChatDate(chat.date)}
      </td>

      <td>
        ${escapeHtml(chat.messages)}
      </td>

      <td>
        <span class="status-badge">
          ${escapeHtml(chat.status)}
        </span>
      </td>

      <td>
        <button
          type="button"
          class="view-chat-btn"
          data-chat-id="${escapeHtml(chat.id)}"
          data-user-id="${escapeHtml(chat.user_id)}"
          data-user="${escapeHtml(chat.user)}"
          data-session-id="${escapeHtml(chat.session_id)}"
          data-date="${escapeHtml(chat.date)}"
        >
          <i class="fas fa-eye"></i>
          View
        </button>
      </td>
    `;

    chatHistoryTableBody.appendChild(row);
  });

  if (chatCount) {
    const start = (page - 1) * pageSize + 1;

    const end = Math.min(page * pageSize, total);

    chatCount.textContent = `Showing ${start}-${end} of ${total} conversations`;
  }

  renderChatPagination(page, totalPages);
});

/* =========================================================
   CHAT HISTORY: ERROR
========================================================= */

EventBus.on("chat-history:error", (event) => {
  const message = event.detail?.message || "Failed to load chat history.";

  console.error("UI: chat history error:", event.detail?.error || message);

  if (!chatHistoryTableBody) {
    return;
  }

  chatHistoryTableBody.innerHTML = `
    <tr>
      <td
        colspan="6"
        style="text-align: center; color: red;"
      >
        ${escapeHtml(message)}
      </td>
    </tr>
  `;
});

/* =========================================================
   CHAT HISTORY: PAGINATION
========================================================= */

function renderChatPagination(currentPage, totalPages) {
  if (!chatPagination) {
    return;
  }

  chatPagination.innerHTML = "";

  if (totalPages <= 1) {
    return;
  }

  const createButton = (label, page, disabled = false) => {
    const button = document.createElement("button");

    button.type = "button";

    button.textContent = label;

    button.disabled = disabled;

    button.className = "pagination-btn";

    button.addEventListener("click", () => {
      EventBus.emit("chat-history:page-requested", {
        page,
      });
    });

    return button;
  };

  chatPagination.appendChild(
    createButton("Previous", currentPage - 1, currentPage <= 1),
  );

  for (let page = 1; page <= totalPages; page++) {
    const button = createButton(String(page), page);

    if (page === currentPage) {
      button.classList.add("active");
    }

    chatPagination.appendChild(button);
  }

  chatPagination.appendChild(
    createButton("Next", currentPage + 1, currentPage >= totalPages),
  );
}

/* =========================================================
   CHAT HISTORY: REFRESH
========================================================= */

refreshChatButton?.addEventListener("click", (event) => {
  event.preventDefault();

  console.log("UI: refresh chat history requested");

  EventBus.emit("chat-history:refresh-requested");
});

/* =========================================================
   CHAT HISTORY: SEARCH
========================================================= */

function handleSearchSubmit() {
  if (!chatSearchInput) {
    console.error("Chat search input not found");

    return;
  }

  const search = chatSearchInput.value.trim();

  console.log("UI: chat search requested:", search);

  updateClearSearchButton();

  EventBus.emit("chat-history:search-requested", {
    search,
  });
}

function updateClearSearchButton() {
  if (!chatClearSearchButton || !chatSearchInput) {
    return;
  }

  const hasSearch = chatSearchInput.value.trim().length > 0;

  chatClearSearchButton.classList.toggle("hidden", !hasSearch);
}

chatSearchInput?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();

  handleSearchSubmit();
});

chatSearchButton?.addEventListener("click", (event) => {
  event.preventDefault();

  handleSearchSubmit();
});

chatClearSearchButton?.addEventListener("click", (event) => {
  event.preventDefault();

  console.log("UI: clearing chat history search");

  if (chatSearchInput) {
    chatSearchInput.value = "";
  }

  updateClearSearchButton();

  EventBus.emit("chat-history:search-requested", {
    search: "",
  });
});

chatSearchInput?.addEventListener("input", updateClearSearchButton);

updateClearSearchButton();

/* =========================================================
   CHAT HISTORY: EXPORTING
========================================================= */

EventBus.on("chat-history:exporting", (event) => {
  const data = event.detail ?? {};

  console.log("UI: chat history export started:", data);

  if (!exportChatButton) {
    return;
  }

  exportChatButton.disabled = true;

  if (!exportChatButton.dataset.originalText) {
    exportChatButton.dataset.originalText = exportChatButton.textContent;
  }

  exportChatButton.textContent = "Exporting...";
});

/* =========================================================
   CHAT HISTORY: EXPORTED
========================================================= */

EventBus.on("chat-history:exported", (event) => {
  const data = event.detail ?? {};

  console.log("UI: chat history exported:", data);

  if (!exportChatButton) {
    return;
  }

  exportChatButton.disabled = false;

  exportChatButton.textContent =
    exportChatButton.dataset.originalText || "Export";

  const message = data.message || "Chat history exported successfully.";

  const exportStatus = document.getElementById("chat-export-status");

  if (exportStatus) {
    exportStatus.textContent = message;

    exportStatus.classList.remove("hidden");

    window.setTimeout(() => {
      exportStatus.classList.add("hidden");
    }, 3000);
  }
});

/* =========================================================
   CHAT HISTORY: EXPORT ERROR
========================================================= */

EventBus.on("chat-history:export-error", (event) => {
  const message = event.detail?.message || "Failed to export chat history.";

  console.error(
    "UI: chat history export failed:",
    event.detail?.error || message,
  );

  if (!exportChatButton) {
    return;
  }

  exportChatButton.disabled = false;

  exportChatButton.textContent =
    exportChatButton.dataset.originalText || "Export";

  const exportStatus = document.getElementById("chat-export-status");

  if (exportStatus) {
    exportStatus.textContent = message;

    exportStatus.classList.remove("hidden");

    window.setTimeout(() => {
      exportStatus.classList.add("hidden");
    }, 4000);
  }
});

/* =========================================================
   CHAT HISTORY: EXPORT REQUEST
========================================================= */

exportChatButton?.addEventListener("click", (event) => {
  event.preventDefault();

  console.log("UI: export chat history requested");

  EventBus.emit("chat-history:export-requested", {
    format: "csv",
  });
});

/* =========================================================
   CHAT HISTORY: VIEW CHAT
========================================================= */

chatHistoryTableBody?.addEventListener("click", (event) => {
  const button = event.target.closest(".view-chat-btn");

  if (!button) {
    return;
  }

  const chatId = Number(button.dataset.chatId);

  const userId = Number(button.dataset.userId);

  const user = button.dataset.user ?? "";

  const sessionId = button.dataset.sessionId ?? "";

  const date = button.dataset.date ?? "";

  console.log("UI: view chat requested:", {
    chatId,
    userId,
    user,
    sessionId,
    date,
  });

  EventBus.emit("chat-history:view-requested", {
    chatId,
    userId,
    user,
    sessionId,
    date,
  });
});

/* =========================================================
   CHAT VIEW MODAL
========================================================= */

const chatViewModal = document.getElementById("chat-view-modal");

const chatModalClose = document.getElementById("chat-modal-close");

const chatDetailId = document.getElementById("chat-detail-id");

const chatDetailUser = document.getElementById("chat-detail-user");

const chatDetailSession = document.getElementById("chat-detail-session");

const chatDetailDate = document.getElementById("chat-detail-date");

const chatViewMessages = document.getElementById("chat-view-messages");

const chatMessageCount = document.getElementById("chat-message-count");

/* =========================================================
   CHAT VIEW: OPEN REQUEST
========================================================= */

EventBus.on("chat-history:view-requested", (event) => {
  const { chatId, userId, sessionId, date, user } = event.detail ?? {};

  console.log("UI: opening chat view:", event.detail);

  if (chatDetailId) {
    chatDetailId.textContent = chatId ?? "-";
  }

  if (chatDetailUser) {
    chatDetailUser.textContent = user ?? "-";
  }

  if (chatDetailSession) {
    const session = sessionId || "-";

    chatDetailSession.textContent = formatSessionId(session);

    chatDetailSession.title = session;
  }

  if (chatDetailDate) {
    chatDetailDate.textContent = formatChatDate(date);
  }

  if (chatViewMessages) {
    chatViewMessages.innerHTML = `
        <div class="chat-loading">
          <i class="fas fa-spinner fa-spin"></i>
          Loading conversation...
        </div>
      `;
  }

  if (chatMessageCount) {
    chatMessageCount.textContent = "Loading...";
  }

  chatViewModal?.classList.remove("hidden");

  chatViewModal?.setAttribute("aria-hidden", "false");
});

/* =========================================================
   CHAT MESSAGES: LOADED
========================================================= */

EventBus.on("chat-messages:loaded", (event) => {
  const messages = event.detail?.messages ?? [];

  console.log("UI: chat messages loaded:", messages);

  if (!chatViewMessages) {
    console.error("Chat messages container not found");

    return;
  }

  if (chatMessageCount) {
    chatMessageCount.textContent = `${messages.length} ${
      messages.length === 1 ? "message" : "messages"
    }`;
  }

  chatViewMessages.innerHTML = "";

  if (messages.length === 0) {
    chatViewMessages.innerHTML = `
        <div class="chat-empty">
          <div class="chat-empty-icon">
            <i class="fas fa-comments"></i>
          </div>

          <h3>No messages yet</h3>

          <p>
            This conversation does not contain
            any messages.
          </p>
        </div>
      `;

    return;
  }

  messages.forEach((message) => {
    const messageElement = document.createElement("div");

    const role = normalizeMessageRole(message.role);

    const content = message.content ?? "";

    const createdAt = message.created_at;

    messageElement.className = `chat-view-message ${role}`;

    const avatar = document.createElement("div");

    avatar.className = "chat-message-avatar";

    avatar.innerHTML =
      role === "user"
        ? `<i class="fas fa-user"></i>`
        : `<i class="fas fa-robot"></i>`;

    const body = document.createElement("div");

    body.className = "chat-message-body";

    const header = document.createElement("div");

    header.className = "chat-message-header";

    const sender = document.createElement("span");

    sender.className = "chat-message-sender";

    sender.textContent = role === "user" ? "User" : "SmartChat";

    const timestamp = document.createElement("span");

    timestamp.className = "chat-message-time";

    timestamp.textContent = formatChatDate(createdAt);

    header.appendChild(sender);

    header.appendChild(timestamp);

    const contentElement = document.createElement("div");

    contentElement.className = "chat-message-content";

    contentElement.textContent = content;

    body.appendChild(header);

    body.appendChild(contentElement);

    messageElement.appendChild(avatar);

    messageElement.appendChild(body);

    chatViewMessages.appendChild(messageElement);
  });

  chatViewMessages.scrollTop = chatViewMessages.scrollHeight;
});

/* =========================================================
   CHAT MESSAGES: ERROR
========================================================= */

EventBus.on("chat-messages:error", (event) => {
  console.error("UI: failed to load chat messages:", event.detail?.error);

  if (chatMessageCount) {
    chatMessageCount.textContent = "Unable to load";
  }

  if (chatViewMessages) {
    chatViewMessages.innerHTML = `
        <div class="chat-error">
          <div class="chat-error-icon">
            <i class="fas fa-exclamation-circle"></i>
          </div>

          <h3>Unable to load conversation</h3>

          <p>
            Something went wrong while loading
            the messages. Please try again.
          </p>
        </div>
      `;
  }
});

/* =========================================================
   CHAT VIEW: CLOSE
========================================================= */

function closeChatViewModal() {
  if (!chatViewModal) {
    return;
  }

  chatViewModal.classList.add("hidden");

  chatViewModal.setAttribute("aria-hidden", "true");
}

chatModalClose?.addEventListener("click", closeChatViewModal);

chatViewModal?.addEventListener("click", (event) => {
  if (event.target === chatViewModal) {
    closeChatViewModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    chatViewModal &&
    !chatViewModal.classList.contains("hidden")
  ) {
    closeChatViewModal();
  }
});

/* =========================================================
   LOGS
========================================================= */

const logsTableBody = document.getElementById("logs-tbody");

const logsCount = document.getElementById("logs-count");

const logsPagination = document.getElementById("logs-pagination");

const logsRefreshButton = document.getElementById("logs-refresh-btn");

const logsExportButton = document.getElementById("logs-export-btn");

const logsSearchInput = document.getElementById("logs-search");

const logsSearchButton = document.getElementById("logs-search-btn");

const logsClearSearchButton = document.getElementById("logs-clear-search-btn");

const logsLevelFilter = document.getElementById("logs-level-filter");

/* =========================================================
   LOGS: LOADING
========================================================= */

EventBus.on("logs:loading", (event) => {
  const loading = event.detail?.loading;

  console.log("UI: logs loading:", loading);

  if (!loading || !logsTableBody) {
    return;
  }

  logsTableBody.innerHTML = `
    <tr>
      <td
        colspan="5"
        style="text-align: center;"
      >
        Loading logs...
      </td>
    </tr>
  `;

  if (logsCount) {
    logsCount.textContent = "Loading logs...";
  }

  if (logsPagination) {
    logsPagination.innerHTML = "";
  }
});

/* =========================================================
   LOGS: LOADED
========================================================= */

EventBus.on("logs:loaded", (event) => {
  const data = event.detail ?? {};

  const logs = data.logs ?? [];

  const page = data.page ?? 1;

  const pageSize = data.pageSize ?? 50;

  const total = data.total ?? 0;

  const totalPages = data.totalPages ?? 1;

  const search = data.search ?? "";

  const level = data.level ?? "all";

  console.log("UI: logs loaded:", data);

  if (!logsTableBody) {
    console.error("Logs table body not found");

    return;
  }

  logsTableBody.innerHTML = "";

  if (logs.length === 0) {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td
        colspan="5"
        style="text-align: center;"
      >
        ${
          search || level !== "all"
            ? "No logs found for the selected filters."
            : "No system logs found."
        }
      </td>
    `;

    logsTableBody.appendChild(row);

    if (logsCount) {
      logsCount.textContent = "Showing 0 logs";
    }

    renderLogsPagination(page, totalPages);

    return;
  }

  logs.forEach((log) => {
    const row = document.createElement("tr");

    const levelClass = getLogLevelClass(log.level);

    row.innerHTML = `
      <td>
        ${formatLogDate(log.timestamp)}
      </td>

      <td>
        ${escapeHtml(log.user ?? "System")}
      </td>

      <td>
        <span
          class="log-level-badge ${levelClass}"
        >
          ${escapeHtml(log.level ?? "info")}
        </span>
      </td>

      <td>
        ${escapeHtml(log.action)}
      </td>

      <td>
        ${escapeHtml(log.details || "-")}
      </td>
    `;

    logsTableBody.appendChild(row);
  });

  if (logsCount) {
    const start = (page - 1) * pageSize + 1;

    const end = Math.min(page * pageSize, total);

    logsCount.textContent = `Showing ${start}-${end} of ${total} logs`;
  }

  renderLogsPagination(page, totalPages);
});

/* =========================================================
   LOGS: ERROR
========================================================= */

EventBus.on("logs:error", (event) => {
  const message = event.detail?.message || "Failed to load system logs.";

  console.error("UI: logs error:", message);

  if (!logsTableBody) {
    return;
  }

  logsTableBody.innerHTML = `
    <tr>
      <td
        colspan="5"
        style="
          text-align: center;
          color: red;
        "
      >
        ${escapeHtml(message)}
      </td>
    </tr>
  `;

  if (logsCount) {
    logsCount.textContent = "Unable to load logs";
  }

  if (logsPagination) {
    logsPagination.innerHTML = "";
  }
});

/* =========================================================
   LOGS: PAGINATION
========================================================= */

function renderLogsPagination(currentPage, totalPages) {
  if (!logsPagination) {
    return;
  }

  logsPagination.innerHTML = "";

  if (totalPages <= 1) {
    return;
  }

  const createButton = (label, page, disabled = false) => {
    const button = document.createElement("button");

    button.type = "button";

    button.textContent = label;

    button.disabled = disabled;

    button.className = "pagination-btn";

    button.addEventListener("click", () => {
      EventBus.emit("logs:page-requested", {
        page,
      });
    });

    return button;
  };

  logsPagination.appendChild(
    createButton("Previous", currentPage - 1, currentPage <= 1),
  );

  for (let page = 1; page <= totalPages; page++) {
    const button = createButton(String(page), page);

    if (page === currentPage) {
      button.classList.add("active");
    }

    logsPagination.appendChild(button);
  }

  logsPagination.appendChild(
    createButton("Next", currentPage + 1, currentPage >= totalPages),
  );
}

/* =========================================================
   LOGS: REFRESH
========================================================= */

logsRefreshButton?.addEventListener("click", (event) => {
  event.preventDefault();

  console.log("UI: refresh logs requested");

  EventBus.emit("logs:refresh-requested");
});

/* =========================================================
   LOGS: SEARCH
========================================================= */

function handleLogsSearchSubmit() {
  if (!logsSearchInput) {
    console.error("Logs search input not found");

    return;
  }

  const search = logsSearchInput.value.trim();

  console.log("UI: logs search requested:", search);

  updateLogsClearSearchButton();

  EventBus.emit("logs:search-requested", {
    search,
  });
}

function updateLogsClearSearchButton() {
  if (!logsClearSearchButton || !logsSearchInput) {
    return;
  }

  const hasSearch = logsSearchInput.value.trim().length > 0;

  logsClearSearchButton.classList.toggle("hidden", !hasSearch);
}

logsSearchInput?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();

  handleLogsSearchSubmit();
});

logsSearchButton?.addEventListener("click", (event) => {
  event.preventDefault();

  handleLogsSearchSubmit();
});

logsClearSearchButton?.addEventListener("click", (event) => {
  event.preventDefault();

  console.log("UI: clearing logs search");

  if (logsSearchInput) {
    logsSearchInput.value = "";
  }

  updateLogsClearSearchButton();

  EventBus.emit("logs:search-requested", {
    search: "",
  });
});

logsSearchInput?.addEventListener("input", updateLogsClearSearchButton);

updateLogsClearSearchButton();

/* =========================================================
   LOGS: LEVEL FILTER
========================================================= */

logsLevelFilter?.addEventListener("change", (event) => {
  const level = event.target.value || "all";

  console.log("UI: logs level requested:", level);

  EventBus.emit("logs:level-requested", {
    level,
  });
});

/* =========================================================
   HELPER
========================================================= */

function setLogsButtonText(button, text) {
  if (!button) {
    return;
  }

  const textElement = button.querySelector(".logs-action-text");

  if (textElement) {
    textElement.textContent = text;
  }
}

/* =========================================================
   LOGS: EXPORTING
========================================================= */

EventBus.on("logs:exporting", (event) => {
  const data = event.detail ?? {};

  console.log("UI: logs export started:", data);

  if (!logsExportButton) {
    return;
  }

  logsExportButton.disabled = true;

  logsExportButton.classList.add("is-exporting");

  setLogsButtonText(logsExportButton, "Exporting...");
});

/* =========================================================
   LOGS: EXPORTED
========================================================= */

EventBus.on("logs:exported", (event) => {
  const data = event.detail ?? {};

  console.log("UI: logs exported:", data);

  if (!logsExportButton) {
    return;
  }

  logsExportButton.disabled = false;

  logsExportButton.classList.remove("is-exporting");

  setLogsButtonText(logsExportButton, "Export");

  const exportStatus = document.getElementById("logs-export-status");

  if (exportStatus) {
    exportStatus.textContent = data.message || "Logs exported successfully.";

    exportStatus.classList.remove("hidden");

    window.setTimeout(() => {
      exportStatus.classList.add("hidden");
    }, 3000);
  }
});

/* =========================================================
   LOGS: EXPORT ERROR
========================================================= */

EventBus.on("logs:export-error", (event) => {
  console.error("UI: logs export failed:", event.detail?.error);

  if (!logsExportButton) {
    return;
  }

  logsExportButton.disabled = false;

  logsExportButton.classList.remove("is-exporting");

  setLogsButtonText(logsExportButton, "Export");
});

/* =========================================================
   LOGS: EXPORT REQUEST
========================================================= */

logsExportButton?.addEventListener("click", (event) => {
  event.preventDefault();

  console.log("UI: logs export requested");

  EventBus.emit("logs:export-requested", {
    format: "csv",
  });
});

/* =========================================================
   ANALYTICS
========================================================= */

const exportAnalyticsButton = document.getElementById("analytics-export-btn");

/* =========================================================
   ANALYTICS EXPORT REQUESTED
========================================================= */

/**
 * Request an analytics CSV export.
 *
 * The analytics controller/service performs the
 * actual export operation.
 */
exportAnalyticsButton?.addEventListener("click", (event) => {
  event.preventDefault();

  /*
   * Ignore clicks while an export is already running.
   * This also protects against duplicate requests.
   */
  if (exportAnalyticsButton.disabled) {
    return;
  }

  console.log("UI: analytics export requested");

  EventBus.emit("analytics:export-requested", {
    format: "csv",
  });
});

/* =========================================================
   ANALYTICS EXPORTING
========================================================= */

EventBus.on("analytics:exporting", (event) => {
  const exporting = event.detail?.exporting === true;

  console.log("UI: analytics exporting:", exporting);

  if (!exportAnalyticsButton) {
    return;
  }

  /*
   * Only enter the Exporting state when the service
   * explicitly tells us that an export has started.
   *
   * The service also emits:
   *
   *   { exporting: false }
   *
   * from its finally block. That event must restore
   * the button instead of putting it back into
   * "Exporting..." state.
   */
  if (exporting) {
    exportAnalyticsButton.disabled = true;

    if (!exportAnalyticsButton.dataset.originalText) {
      exportAnalyticsButton.dataset.originalText =
        exportAnalyticsButton.textContent;
    }

    exportAnalyticsButton.textContent = "Exporting...";

    return;
  }

  /*
   * Export finished.
   */
  exportAnalyticsButton.disabled = false;

  exportAnalyticsButton.textContent =
    exportAnalyticsButton.dataset.originalText || "Export";

  delete exportAnalyticsButton.dataset.originalText;
});

/* =========================================================
   ANALYTICS EXPORTED
========================================================= */

EventBus.on("analytics:exported", (event) => {
  const data = event.detail ?? {};

  console.log("UI: analytics exported:", data);

  if (!exportAnalyticsButton) {
    return;
  }

  /*
   * Make sure the button is restored even if the
   * exported event arrives before the final
   * analytics:exporting(false) event.
   */
  exportAnalyticsButton.disabled = false;

  exportAnalyticsButton.textContent =
    exportAnalyticsButton.dataset.originalText || "Export";

  delete exportAnalyticsButton.dataset.originalText;

  const message = data.message || "Analytics exported successfully.";

  const exportStatus = document.getElementById("analytics-export-status");

  if (exportStatus) {
    exportStatus.textContent = message;

    exportStatus.classList.remove("hidden");

    window.setTimeout(() => {
      exportStatus.classList.add("hidden");
    }, 3000);
  }
});

/* =========================================================
   ANALYTICS EXPORT ERROR
========================================================= */

EventBus.on("analytics:export-error", (event) => {
  console.error("UI: analytics export failed:", event.detail?.error);

  if (!exportAnalyticsButton) {
    return;
  }

  exportAnalyticsButton.disabled = false;

  exportAnalyticsButton.textContent =
    exportAnalyticsButton.dataset.originalText || "Export";

  delete exportAnalyticsButton.dataset.originalText;

  const status = document.getElementById("analytics-export-status");

  if (status) {
    status.textContent = event.detail?.message || "Failed to export analytics.";

    status.classList.remove("hidden");

    window.setTimeout(() => {
      status.classList.add("hidden");
    }, 4000);
  }
});
