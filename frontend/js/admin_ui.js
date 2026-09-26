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
 * Format a chat date using the browser's
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
   * - assistant
   * - chatbot
   *
   * Everything other than a user message
   * is therefore treated as an assistant message.
   */
  return "assistant";
}

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

  pageTitle.textContent = titles[section] || "Dashboard";
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
   USER CONTROLS
========================================================= */

const userSearchInput = document.getElementById("user-search");

const userSearchButton = document.getElementById("user-search-btn");

const userClearSearchButton = document.getElementById("user-clear-search-btn");

/* =========================================================
   USER MANAGEMENT
========================================================= */

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
   REFRESH USERS
========================================================= */

/**
 * Request the Users service to reload the
 * current Users state.
 *
 * The service is responsible for preserving
 * the current search state.
 */
refreshUsersButton?.addEventListener("click", (event) => {
  event.preventDefault();

  console.log("UI: refresh users requested");

  EventBus.emit("users:refresh-requested");
});

/* =========================================================
   SEARCH USERS
========================================================= */

/**
 * Submit the current Users search.
 *
 * An empty search string is valid and means:
 *
 *     show all users
 */
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

/* =========================================================
   USER SEARCH UI
========================================================= */

/**
 * Show the Clear Search button only
 * when the search field contains text.
 */
function updateUserClearSearchButton() {
  if (!userClearSearchButton || !userSearchInput) {
    return;
  }

  const hasSearch = userSearchInput.value.trim().length > 0;

  userClearSearchButton.classList.toggle("hidden", !hasSearch);
}

/* =========================================================
   SEARCH - ENTER KEY
========================================================= */

userSearchInput?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();

  handleUserSearchSubmit();
});

/* =========================================================
   SEARCH - BUTTON
========================================================= */

userSearchButton?.addEventListener("click", (event) => {
  event.preventDefault();

  handleUserSearchSubmit();
});

/* =========================================================
   CLEAR USER SEARCH
========================================================= */

/**
 * Clear the Users search and request
 * the complete Users list again.
 */
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

/* =========================================================
   SEARCH INPUT STATE
========================================================= */

/**
 * Keep the Clear Search button synchronized
 * with the current input value.
 */
userSearchInput?.addEventListener("input", updateUserClearSearchButton);

/**
 * Initialize the Clear Search button state
 * when the page loads.
 */
updateUserClearSearchButton();

/* =========================================================
   CREATE USER MODAL
========================================================= */

/**
 * Open the Create User modal.
 */
createUserButton?.addEventListener("click", () => {
  console.log("UI: opening create user modal");

  createUserModal?.classList.remove("hidden");

  createUserModal?.setAttribute("aria-hidden", "false");

  document.getElementById("create-user-username")?.focus();
});

/**
 * Close the Create User modal
 * and reset the form.
 */
cancelCreateUserButton?.addEventListener("click", () => {
  console.log("UI: cancel create user");

  createUserForm?.reset();

  createUserModal?.classList.add("hidden");

  createUserModal?.setAttribute("aria-hidden", "true");

  updateCreateUserButton();
});

/* =========================================================
   CREATE USER
========================================================= */

/**
 * Submit the Create User form.
 */
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

/* =========================================================
   CREATE USER FORM VALIDATION
========================================================= */

/**
 * Enable the Create User submit button
 * only when the form is valid.
 */
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
   USER CREATED
========================================================= */

/**
 * Close and reset the Create User modal
 * after successful creation.
 */
EventBus.on("users:created", () => {
  console.log("UI: user created successfully");

  createUserForm?.reset();

  createUserModal?.classList.add("hidden");

  createUserModal?.setAttribute("aria-hidden", "true");

  updateCreateUserButton();
});

/* =========================================================
   USERS LOADING STATE
========================================================= */

/**
 * Display a loading row while Users
 * are being retrieved.
 */
EventBus.on("users:loading", (event) => {
  const loading = event.detail?.loading;

  console.log("UI: users loading:", loading);

  if (!usersTableBody) {
    return;
  }

  if (loading) {
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
  }
});

/* =========================================================
   USERS ERROR
========================================================= */

/**
 * Display a friendly error state
 * when Users cannot be loaded.
 */
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
   RENDER USERS
========================================================= */

/**
 * Render the Users returned by
 * the Users service.
 *
 * The service is responsible for:
 *
 * - fetching users
 * - sorting users
 * - applying search
 *
 * The UI only renders the result.
 */
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

  /* -------------------------------------------------------
       EMPTY STATE
    ------------------------------------------------------- */

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

  /* -------------------------------------------------------
       USER ROWS
    ------------------------------------------------------- */

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
   DELETE USER
========================================================= */

/**
 * Use event delegation because Delete
 * buttons are dynamically generated.
 */
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

const exportAnalyticsButton = document.getElementById("analytics-export-btn");

const chatSearchInput = document.getElementById("chat-search");

const chatSearchButton = document.getElementById("chat-search-btn");

const chatClearSearchButton = document.getElementById("chat-clear-search-btn");

/* =========================================================
   RENDER CHAT HISTORY
========================================================= */

/**
 * Render chat-history records whenever the
 * chat history service publishes loaded data.
 */
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

  /* -------------------------------------------------------
       EMPTY STATE
    ------------------------------------------------------- */

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

  /* -------------------------------------------------------
       CHAT ROWS
    ------------------------------------------------------- */

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
            data-chat-id="${chat.id}"
            data-user-id="${chat.user_id}"
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

  /* -------------------------------------------------------
       RESULT COUNT
    ------------------------------------------------------- */

  if (chatCount) {
    const start = (page - 1) * pageSize + 1;

    const end = Math.min(page * pageSize, total);

    chatCount.textContent = `Showing ${start}-${end} of ${total} conversations`;
  }

  /* -------------------------------------------------------
       PAGINATION
    ------------------------------------------------------- */

  renderChatPagination(page, totalPages);
});

/* =========================================================
   CHAT HISTORY LOADING STATE
========================================================= */

/**
 * Display a loading row while chat history
 * is being retrieved.
 */
EventBus.on("chat-history:loading", (event) => {
  const loading = event.detail?.loading;

  console.log("UI: chat history loading:", loading);

  if (!chatHistoryTableBody) {
    return;
  }

  if (loading) {
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
  }
});

/* =========================================================
   CHAT HISTORY ERROR
========================================================= */

/**
 * Display a user-friendly error state when
 * chat history cannot be loaded.
 */
EventBus.on("chat-history:error", (event) => {
  const error = event.detail?.error;

  console.error("UI: chat history error:", error);

  if (!chatHistoryTableBody) {
    return;
  }

  chatHistoryTableBody.innerHTML = `
      <tr>
        <td
          colspan="6"
          style="text-align: center; color: red;"
        >
          Failed to load chat history.
        </td>
      </tr>
    `;
});

/* =========================================================
   CHAT PAGINATION
========================================================= */

/**
 * Render Previous, page-number, and Next
 * pagination controls.
 */
function renderChatPagination(currentPage, totalPages) {
  if (!chatPagination) {
    return;
  }

  chatPagination.innerHTML = "";

  if (totalPages <= 1) {
    return;
  }

  /**
   * Create a pagination button that requests
   * the specified page through the EventBus.
   */
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

  /* -------------------------------------------------------
     PREVIOUS
  ------------------------------------------------------- */

  chatPagination.appendChild(
    createButton("Previous", currentPage - 1, currentPage <= 1),
  );

  /* -------------------------------------------------------
     PAGE NUMBERS
  ------------------------------------------------------- */

  for (let page = 1; page <= totalPages; page++) {
    const button = createButton(String(page), page);

    if (page === currentPage) {
      button.classList.add("active");
    }

    chatPagination.appendChild(button);
  }

  /* -------------------------------------------------------
     NEXT
  ------------------------------------------------------- */

  chatPagination.appendChild(
    createButton("Next", currentPage + 1, currentPage >= totalPages),
  );
}

/* =========================================================
   REFRESH CHAT HISTORY
========================================================= */

/**
 * Request the chat-history service to reload
 * the current chat-history state.
 *
 * The service is responsible for deciding
 * whether that means refreshing the current
 * page/search state.
 */
refreshChatButton?.addEventListener("click", (event) => {
  event.preventDefault();

  console.log("UI: refresh chat history requested");

  EventBus.emit("chat-history:refresh-requested");
});

/* =========================================================
   EXPORT CHAT HISTORY
========================================================= */

/**
 * Request a CSV export of chat history.
 *
 * The chat-history service should listen for this event
 * and perform the actual API request/download.
 */
exportChatButton?.addEventListener("click", (event) => {
  event.preventDefault();

  console.log("UI: export chat history requested");

  EventBus.emit("chat-history:export-requested", {
    format: "csv",
  });
});


/* =========================================================
   CHAT HISTORY EXPORTED
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

  const message =
    data.message || "Chat history exported successfully.";

  const exportStatus = document.getElementById(
    "chat-export-status",
  );

  if (exportStatus) {
    exportStatus.textContent = message;
    exportStatus.classList.remove("hidden");

    window.setTimeout(() => {
      exportStatus.classList.add("hidden");
    }, 3000);
  }
});


/* =========================================================
   CHAT HISTORY EXPORTING
========================================================= */

EventBus.on("chat-history:exporting", (event) => {
  const data = event.detail ?? {};

  console.log("UI: chat history export started:", data);

  if (!exportChatButton) {
    return;
  }

  exportChatButton.disabled = true;

  if (!exportChatButton.dataset.originalText) {
    exportChatButton.dataset.originalText =
      exportChatButton.textContent;
  }

  exportChatButton.textContent = "Exporting...";
});


/* =========================================================
   CHAT HISTORY EXPORT ERROR
========================================================= */

EventBus.on("chat-history:export-error", (event) => {
  console.error(
    "UI: chat history export failed:",
    event.detail?.error,
  );

  if (!exportChatButton) {
    return;
  }

  exportChatButton.disabled = false;

  exportChatButton.textContent =
    exportChatButton.dataset.originalText || "Export";

  const exportStatus = document.getElementById(
    "chat-export-status",
  );

  if (exportStatus) {
    exportStatus.textContent =
      event.detail?.message ||
      "Failed to export chat history.";

    exportStatus.classList.remove("hidden");

    window.setTimeout(() => {
      exportStatus.classList.add("hidden");
    }, 4000);
  }
});


/* =========================================================
   CHAT HISTORY SEARCH
========================================================= */

/**
 * Submit the current search query.
 *
 * An empty query is valid and represents
 * "show all chat history".
 */
function handleSearchSubmit() {
  if (!chatSearchInput) {
    console.error("Chat search input not found");
    return;
  }

  const search = chatSearchInput.value.trim();

  console.log("UI: Chat search requested for:", search);

  updateClearSearchButton();

  EventBus.emit("chat-history:search-requested", {
    search,
  });
}


/* =========================================================
   ANALYTICS EXPORT REQUESTED
========================================================= */

/**
 * Request an analytics export.
 *
 * The analytics service/controller should listen for
 * analytics:export-requested and perform the API request.
 */
exportAnalyticsButton?.addEventListener("click", (event) => {
  event.preventDefault();

  console.log("UI: analytics export requested");

  EventBus.emit("analytics:export-requested", {
    format: "csv",
  });
});


/* =========================================================
   ANALYTICS EXPORTING
========================================================= */

EventBus.on("analytics:exporting", (event) => {
  const data = event.detail ?? {};

  console.log("UI: analytics export started:", data);

  if (!exportAnalyticsButton) {
    return;
  }

  exportAnalyticsButton.disabled = true;

  if (!exportAnalyticsButton.dataset.originalText) {
    exportAnalyticsButton.dataset.originalText =
      exportAnalyticsButton.textContent;
  }

  exportAnalyticsButton.textContent = "Exporting...";
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

  exportAnalyticsButton.disabled = false;

  exportAnalyticsButton.textContent =
    exportAnalyticsButton.dataset.originalText || "Export";
});


/* =========================================================
   ANALYTICS EXPORT ERROR
========================================================= */

EventBus.on("analytics:export-error", (event) => {
  console.error(
    "UI: analytics export failed:",
    event.detail?.error,
  );

  if (!exportAnalyticsButton) {
    return;
  }

  exportAnalyticsButton.disabled = false;

  exportAnalyticsButton.textContent =
    exportAnalyticsButton.dataset.originalText || "Export";
});


/* =========================================================
   SEARCH UI
========================================================= */

/**
 * Show the Clear Search button only when
 * the search field contains text.
 */
function updateClearSearchButton() {
  if (!chatClearSearchButton || !chatSearchInput) {
    return;
  }

  const hasSearch = chatSearchInput.value.trim().length > 0;

  chatClearSearchButton.classList.toggle("hidden", !hasSearch);
}

/* =========================================================
   SEARCH - ENTER KEY
========================================================= */

chatSearchInput?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();

  handleSearchSubmit();
});

/* =========================================================
   SEARCH - BUTTON
========================================================= */

chatSearchButton?.addEventListener("click", (event) => {
  event.preventDefault();

  handleSearchSubmit();
});

/* =========================================================
   CLEAR SEARCH
========================================================= */

/**
 * Clear the search field and request the
 * complete chat-history list again.
 */
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

/* =========================================================
   SEARCH INPUT STATE
========================================================= */

/**
 * Keep the Clear Search button synchronized
 * with the current input value.
 */
chatSearchInput?.addEventListener("input", updateClearSearchButton);

/**
 * Initialize the Clear Search button state
 * when the page first loads.
 */
updateClearSearchButton();

/* =========================================================
   VIEW CHAT
========================================================= */

/**
 * Use event delegation because View buttons
 * are dynamically generated with each table render.
 */
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
   CLOSE CHAT VIEW MODAL
========================================================= */

/**
 * Hide the chat-view modal.
 */
function closeChatViewModal() {
  if (!chatViewModal) {
    return;
  }

  chatViewModal.classList.add("hidden");

  chatViewModal.setAttribute("aria-hidden", "true");
}

/**
 * Close button.
 */
chatModalClose?.addEventListener("click", closeChatViewModal);

/**
 * Close when the user clicks the modal backdrop.
 */
chatViewModal?.addEventListener("click", (event) => {
  if (event.target === chatViewModal) {
    closeChatViewModal();
  }
});

/**
 * Close the modal when Escape is pressed.
 */
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
   VIEW CHAT REQUESTED
========================================================= */

/**
 * Populate and open the chat-view modal
 * when a chat is selected from the table.
 */
EventBus.on("chat-history:view-requested", (event) => {
  const { chatId, userId, sessionId, date, user } = event.detail ?? {};

  console.log("UI: opening chat view:", event.detail);

  /* -------------------------------------------------------
       CHAT ID
    ------------------------------------------------------- */

  if (chatDetailId) {
    chatDetailId.textContent = chatId ?? "-";
  }

  /* -------------------------------------------------------
       USER
    ------------------------------------------------------- */

  if (chatDetailUser) {
    chatDetailUser.textContent = user ?? "-";
  }

  /* -------------------------------------------------------
       SESSION ID
    ------------------------------------------------------- */

  if (chatDetailSession) {
    const session = sessionId || "-";

    chatDetailSession.textContent = formatSessionId(session);

    chatDetailSession.title = session;
  }

  /* -------------------------------------------------------
       DATE
    ------------------------------------------------------- */

  if (chatDetailDate) {
    chatDetailDate.textContent = formatChatDate(date);
  }

  /* -------------------------------------------------------
       RESET MESSAGE AREA
    ------------------------------------------------------- */

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

  /* -------------------------------------------------------
       OPEN MODAL
    ------------------------------------------------------- */

  chatViewModal?.classList.remove("hidden");

  chatViewModal?.setAttribute("aria-hidden", "false");
});

/* =========================================================
   CHAT MESSAGES LOADED
========================================================= */

/**
 * Render the messages returned by the
 * chat-message service.
 */
EventBus.on("chat-messages:loaded", (event) => {
  const messages = event.detail?.messages ?? [];

  console.log("UI: chat messages loaded:", messages);

  if (!chatViewMessages) {
    console.error("Chat messages container not found");
    return;
  }

  /* -------------------------------------------------------
       MESSAGE COUNT
    ------------------------------------------------------- */

  if (chatMessageCount) {
    chatMessageCount.textContent = `${messages.length} ${
      messages.length === 1 ? "message" : "messages"
    }`;
  }

  /* -------------------------------------------------------
       CLEAR EXISTING CONTENT
    ------------------------------------------------------- */

  chatViewMessages.innerHTML = "";

  /* -------------------------------------------------------
       EMPTY STATE
    ------------------------------------------------------- */

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

  /* -------------------------------------------------------
       RENDER MESSAGES
    ------------------------------------------------------- */

  messages.forEach((message) => {
    const messageElement = document.createElement("div");

    const role = normalizeMessageRole(message.role);

    const content = message.content ?? "";

    const createdAt = message.created_at;

    messageElement.className = `chat-view-message ${role}`;

    /* -----------------------------------------------------
         AVATAR
      ----------------------------------------------------- */

    const avatar = document.createElement("div");

    avatar.className = "chat-message-avatar";

    avatar.innerHTML =
      role === "user"
        ? `<i class="fas fa-user"></i>`
        : `<i class="fas fa-robot"></i>`;

    /* -----------------------------------------------------
         MESSAGE BODY
      ----------------------------------------------------- */

    const body = document.createElement("div");

    body.className = "chat-message-body";

    /* -----------------------------------------------------
         MESSAGE HEADER
      ----------------------------------------------------- */

    const header = document.createElement("div");

    header.className = "chat-message-header";

    /* Sender */

    const sender = document.createElement("span");

    sender.className = "chat-message-sender";

    sender.textContent = role === "user" ? "User" : "SmartChat";

    /* Timestamp */

    const timestamp = document.createElement("span");

    timestamp.className = "chat-message-time";

    timestamp.textContent = formatChatDate(createdAt);

    header.appendChild(sender);

    header.appendChild(timestamp);

    /* -----------------------------------------------------
         MESSAGE CONTENT
      ----------------------------------------------------- */

    const contentElement = document.createElement("div");

    contentElement.className = "chat-message-content";

    contentElement.textContent = content;

    /* -----------------------------------------------------
         ASSEMBLE MESSAGE
      ----------------------------------------------------- */

    body.appendChild(header);

    body.appendChild(contentElement);

    messageElement.appendChild(avatar);

    messageElement.appendChild(body);

    chatViewMessages.appendChild(messageElement);
  });

  /* -------------------------------------------------------
       SCROLL TO LATEST MESSAGE
    ------------------------------------------------------- */

  chatViewMessages.scrollTop = chatViewMessages.scrollHeight;
});

/* =========================================================
   CHAT MESSAGE ERROR
========================================================= */

/**
 * Display a friendly error message when the
 * conversation messages cannot be loaded.
 */
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
   DASHBOARD LOADING
========================================================= */

EventBus.on("dashboard:loading", (event) => {
  const loading = event.detail?.loading;

  if (!loading) {
    return;
  }

  console.log("UI: dashboard loading");

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
});

/* =========================================================
   DASHBOARD ERROR
========================================================= */

EventBus.on("dashboard:error", (event) => {
  console.error("UI: dashboard error:", event.detail?.error);

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
    dashboardRecentUsers.innerHTML = "<p>Unable to load recent users.</p>";
  }

  if (dashboardRecentConversations) {
    dashboardRecentConversations.innerHTML =
      "<p>Unable to load recent conversations.</p>";
  }
});

/* =========================================================
   RENDER DASHBOARD
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
