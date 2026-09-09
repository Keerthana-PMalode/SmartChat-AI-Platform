import { EventBus } from "./admin_events.js";
import { modalManager } from "./modal_manager.js";
import { api } from "./admin_api.js";

let uiInitialized = false;

const USERS_PER_PAGE = 10;

let allUsers = [];
let filteredUsers = [];
let currentUsersPage = 1;
let allChats = [];


/* =========================
   INIT
========================= */

function initUI() {
  if (uiInitialized) {
    console.warn("UI already initialized");
    return;
  }

  uiInitialized = true;

  document.body.classList.add("fade-in");

  setupSidebarNavigation();
  setupLogout();
  setupUsers();
  setupChatHistory();
  setupChatModal();
  setupCreateUserDialog();
  setupLogs();

  const initialSection =
    window.location.hash.substring(1) || "dashboard";

  handleNavigation({
    detail: {
      section: initialSection,
    },
  });

  window.addEventListener("hashchange", onHashChange);

  EventBus.on("app:navigated", handleNavigation);
  EventBus.on("app:loggedout", handleLogout);
}

EventBus.on("app:ready", initUI);


/* =========================
   CREATE USER
========================= */

function setupCreateUserDialog() {
  document
    .getElementById("create-user-btn")
    ?.addEventListener("click", openCreateUserDialog);

  document
    .getElementById("refresh-users-btn")
    ?.addEventListener("click", () => {
      EventBus.emit("users:refresh-requested");
    });
}

/* =========================
   CREATE USER
========================= */

function openCreateUserDialog() {
  const username = prompt("Enter username:");

  if (!username?.trim()) return;

  const password = prompt("Enter password:");

  if (!password) return;

  const role = prompt(
    "Enter role (admin/user):",
    "user"
  );

  if (!role) return;

  EventBus.emit("users:create-requested", {
    username: username.trim(),
    password,
    role: role.trim().toLowerCase(),
  });
}


/* =========================
   NAVIGATION
========================= */

function setupSidebarNavigation() {
  const navItems = document.querySelectorAll(
    ".nav-item:not(.logout)"
  );

  navItems.forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();

      const section = item.dataset.section;

      if (!section) return;

      window.location.hash = section;

      EventBus.emit("app:navigate", {
        section,
      });
    });
  });
}

function onHashChange() {
  const section =
    window.location.hash.replace("#", "") || "dashboard";

  EventBus.emit("app:navigate", {
    section,
  });
}

function handleNavigation(event) {
  const section = event.detail?.section || "dashboard";

  highlightActiveSection(section);
  showContentPanel(section);
  updatePageTitle(section);
}

function highlightActiveSection(section) {
  const navItems = document.querySelectorAll(
    ".nav-item:not(.logout)"
  );

  navItems.forEach((item) => {
    item.classList.toggle(
      "active",
      item.dataset.section === section
    );
  });
}

function showContentPanel(section) {
  const panels = document.querySelectorAll(".content-panel");

  panels.forEach((panel) => {
    panel.classList.add("hidden");
  });

  const panel =
    document.getElementById(`${section}-panel`) ||
    document.getElementById("dashboard-panel");

  panel?.classList.remove("hidden");
}

function updatePageTitle(section) {
  const pageTitle = document.getElementById("page-title");

  if (!pageTitle) return;

  const titles = {
    dashboard: "Dashboard",
    users: "Users",
    "chat-history": "Chat History",
    analytics: "Analytics",
    settings: "Settings",
    logs: "Logs",
  };

  pageTitle.textContent = titles[section] || "Dashboard";
}

/* =========================
   USERS UI RENDERING
========================= */

function setupUsers() {
  document
    .getElementById("users-search-input")
    ?.addEventListener("input", handleUserSearch);

  document
    .getElementById("users-tbody")
    ?.addEventListener("click", handleUserTableClick);
}

EventBus.on("users:loading", (event) => {
  const tbody = document.getElementById("users-tbody");

  if (!tbody || !event.detail?.loading) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="text-center">
        Loading...
      </td>
    </tr>
  `;
});

EventBus.on("users:loaded", (event) => {
  const users = event.detail?.users;

  if (!Array.isArray(users)) return;

  allUsers = [...users].sort((a, b) => a.id - b.id);
  filteredUsers = [...allUsers];
  currentUsersPage = 1;

  renderUsersPage();
});

function renderUsersPage() {
  const tbody = document.getElementById("users-tbody");

  if (!tbody) return;

  const totalUsers = filteredUsers.length;

  const totalPages = Math.max(
    1,
    Math.ceil(totalUsers / USERS_PER_PAGE)
  );

  currentUsersPage = Math.min(
    currentUsersPage,
    totalPages
  );

  const startIndex =
    (currentUsersPage - 1) * USERS_PER_PAGE;

  const endIndex = Math.min(
    startIndex + USERS_PER_PAGE,
    totalUsers
  );

  const pageUsers = filteredUsers.slice(
    startIndex,
    endIndex
  );

  if (pageUsers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">
          No users found
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = pageUsers
      .map(renderUserRow)
      .join("");
  }

  updateUsersPagination(
    totalUsers,
    startIndex,
    endIndex,
    totalPages
  );
}

function renderUserRow(user) {
  return `
    <tr>
      <td>${escapeHtml(user.id)}</td>

      <td>${escapeHtml(user.username)}</td>

      <td>${escapeHtml(user.email ?? "-")}</td>

      <td>
        <span class="badge ${escapeHtml(user.role)}">
          ${escapeHtml(user.role)}
        </span>
      </td>

      <td>
        <div class="actions">
          <button
            type="button"
            class="delete-user-btn"
            data-user-id="${escapeHtml(user.id)}"
            title="Delete user"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  `;
}

function updateUsersPagination(
  totalUsers,
  startIndex,
  endIndex,
  totalPages
) {
  const summary = document.querySelector(
    "#users-panel .section-footer span"
  );

  const pagination = document.querySelector(
    "#users-panel .pagination"
  );

  if (!summary || !pagination) return;

  summary.textContent =
    totalUsers === 0
      ? "Showing 0 users"
      : `Showing ${startIndex + 1}-${endIndex} of ${totalUsers} users`;

  pagination.innerHTML = "";

  const previousButton = createPaginationButton(
    "<",
    currentUsersPage === 1,
    () => {
      currentUsersPage--;
      renderUsersPage();
    }
  );

  pagination.appendChild(previousButton);

  for (let page = 1; page <= totalPages; page++) {
    const pageButton = createPaginationButton(
      page,
      false,
      () => {
        currentUsersPage = page;
        renderUsersPage();
      }
    );

    if (page === currentUsersPage) {
      pageButton.classList.add("active");
    }

    pagination.appendChild(pageButton);
  }

  const nextButton = createPaginationButton(
    ">",
    currentUsersPage === totalPages,
    () => {
      currentUsersPage++;
      renderUsersPage();
    }
  );

  pagination.appendChild(nextButton);
}

function createPaginationButton(
  text,
  disabled,
  onClick
) {
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = text;
  button.disabled = disabled;
  button.addEventListener("click", onClick);

  return button;
}

function handleUserSearch(event) {
  const searchTerm = event.target.value
    .trim()
    .toLowerCase();

  filteredUsers = allUsers.filter((user) => {
    return [
      user.id,
      user.username,
      user.email,
      user.role,
    ].some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(searchTerm)
    );
  });

  currentUsersPage = 1;

  renderUsersPage();
}

function handleUserTableClick(event) {
  const deleteButton = event.target.closest(
    ".delete-user-btn"
  );

  if (!deleteButton) return;

  const userId = deleteButton.dataset.userId;

  if (!userId) return;

  confirmDeleteUser(userId);
}

async function confirmDeleteUser(userId) {
  const confirmed = await modalManager.confirm({
    modalId: "confirm-modal",
    title: "Delete User",
    message: "Are you sure you want to delete this user?",
    confirmText: "Delete",
    cancelText: "Cancel",
  });

  if (!confirmed) return;

  EventBus.emit("users:delete-requested", {
    userId: Number(userId),
  });
}

/* =========================
   CHAT HISTORY
========================= */

function setupChatHistory() {
  document.addEventListener(
    "click",
    handleChatHistoryClick
  );
}

EventBus.on("chat-history:loaded", (event) => {
  const chats = event.detail?.chats;

  const tbody = document.getElementById(
    "chat-history-tbody"
  );

  if (!tbody || !Array.isArray(chats)) return;

  allChats = [...chats];

  tbody.innerHTML = allChats
    .map(renderChatHistoryRow)
    .join("");
});


function renderChatHistoryRow(chat) {
  return `
    <tr>
      <td>${escapeHtml(chat.id)}</td>
      <td>${escapeHtml(chat.user)}</td>
      <td>${escapeHtml(chat.date)}</td>
      <td>${escapeHtml(chat.messages)}</td>
      <td>${escapeHtml(chat.status)}</td>

      <td>
        <button
          type="button"
          class="view-chat-btn"
          data-chat-id="${escapeHtml(chat.id)}"
          data-user-id="${escapeHtml(chat.user_id)}"
          data-session-id="${escapeHtml(chat.session_id)}"
          data-chat-date="${escapeHtml(chat.date)}"
        >
          View
        </button>
      </td>
    </tr>
  `;
}

function handleChatHistoryClick(event) {
  const viewButton = event.target.closest(".view-chat-btn");

  if (!viewButton) return;

  const chatId = Number(viewButton.dataset.chatId);
  const userId = Number(viewButton.dataset.userId);
  const sessionId = viewButton.dataset.sessionId;
  const chatDate = viewButton.dataset.chatDate;

  console.log("View clicked:", {
    chatId,
    userId,
    sessionId,
    chatDate,
  });

  if (!chatId || !userId) {
    console.error("Missing chat ID or user ID");
    return;
  }

  openChatView(
    userId,
    chatId,
    sessionId,
    chatDate
  );
}


async function openChatView(
  userId,
  chatId,
  sessionId,
  chatDate
) {
  try {
    const messages = await api.get(
      `/admin/users/${userId}/chats/${chatId}/messages`
    );

    displayChatMessages(
      chatId,
      sessionId,
      chatDate,
      messages
    );
  } catch (error) {
    console.error(
      "Failed to load chat messages:",
      error
    );
  }
}


/* =========================
   CHAT MODAL
========================= */

function setupChatModal() {
  document
    .getElementById("close-chat-view")
    ?.addEventListener("click", closeChatViewModal);

  document
    .getElementById("chat-view-modal")
    ?.addEventListener("click", (event) => {
      if (event.target.id === "chat-view-modal") {
        closeChatViewModal();
      }
    });
}


function displayChatMessages(
  chatId,
  sessionId,
  chatDate,
  messages
) {
  const chatIdElement =
    document.getElementById("chat-detail-id");

  const sessionElement =
    document.getElementById("chat-detail-session");

  const dateElement =
    document.getElementById("chat-detail-date");

  const messagesContainer =
    document.getElementById("chat-view-messages");

  if (!messagesContainer) return;

  if (chatIdElement) {
    chatIdElement.textContent = chatId;
  }

  if (sessionElement) {
    sessionElement.textContent =
      sessionId || "-";
  }

  if (dateElement) {
    dateElement.textContent =
      formatChatDate(chatDate);
  }

  const chatMessages = Array.isArray(messages)
    ? messages
    : [];

  if (chatMessages.length === 0) {
    messagesContainer.innerHTML = `
      <div class="no-messages">
        No messages found.
      </div>
    `;
  } else {
    messagesContainer.innerHTML = chatMessages
      .map(renderChatMessage)
      .join("");
  }

  document
    .getElementById("chat-view-modal")
    ?.classList.remove("hidden");
}

function renderChatMessage(message) {
  const role =
    message.role === "user"
      ? "User"
      : "Chatbot";

  return `
    <div class="chat-message ${escapeHtml(message.role)}">

      <div class="chat-message-bubble">

        <div class="chat-message-role">
          ${role}
        </div>

        <div class="chat-message-content">
          ${escapeHtml(message.content)}
        </div>

        <div class="chat-message-time">
          ${formatChatDate(message.created_at)}
        </div>

      </div>

    </div>
  `;
}


function closeChatViewModal() {
  document
    .getElementById("chat-view-modal")
    ?.classList.add("hidden");
}


/* =========================
   LOGOUT
========================= */

function setupLogout() {
  document
    .getElementById("logout-btn")
    ?.addEventListener("click", handleLogoutClick);
}

async function handleLogoutClick(event) {
  event.preventDefault();

  const confirmed = await modalManager.confirm({
    modalId: "confirm-modal",
    title: "Logout",
    message: "Are you sure you want to logout?",
    confirmText: "Logout",
    cancelText: "Stay",
  });

  if (confirmed) {
    EventBus.emit("app:logout");
  }
}

function handleLogout() {
  document.body.classList.add("fade-out");

  setTimeout(() => {
    window.location.href = "/login.html";
  }, 500);
}

/* =========================
   LOGS
========================= */

function setupLogs() {
  // Reserved for future logs-specific interactions.
}

EventBus.on("logs:loaded", (event) => {
  const logs = event.detail?.logs;

  const tbody = document.getElementById("logs-tbody");

  if (!tbody || !Array.isArray(logs)) return;

  tbody.innerHTML = logs
    .map(
      (log) => `
        <tr>
          <td>${escapeHtml(log.timestamp)}</td>
          <td>${escapeHtml(log.user)}</td>
          <td>${escapeHtml(log.action)}</td>
        </tr>
      `
    )
    .join("");
});

/* =========================
   UTILITIES
========================= */

function formatChatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}