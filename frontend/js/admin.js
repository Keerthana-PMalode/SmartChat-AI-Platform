import { initAnalyticsSection } from "./analytics.js";

import { EventBus } from "./admin_events.js";

import { setCurrentSection, canNavigateTo } from "./admin_state.js";

import { fetchUsers, handleCreateUser, deleteUser } from "./users.service.js";

import {
  fetchChatHistory,
  refreshChatHistory,
  searchChatHistory,
  setChatHistoryPage,
  exportChatHistory,
  fetchChatMessages,
} from "./chat_history.service.js";

import "./admin_ui.js";

/* =========================================================
   ADMIN AUTHORIZATION
========================================================= */

/**
 * Perform an initial authentication check before
 * allowing the admin application to continue.
 */
const token = localStorage.getItem("authToken");

const role = localStorage.getItem("role");

if (!token || role !== "admin") {
  localStorage.clear();

  window.location.href = "login.html";

  /*
   * Stop execution so that unauthorized users
   * cannot continue initializing the admin UI.
   */
  throw new Error("Unauthorized access");
}

/* =========================================================
   AUTHENTICATION CHECK
========================================================= */

/**
 * Verify that the current session still has
 * a valid authentication token and admin role.
 *
 * Returns:
 *   true  - authenticated admin
 *   false - authentication failed
 */
function checkAuthentication() {
  const token = localStorage.getItem("authToken");

  const role = localStorage.getItem("role");

  if (!token || role !== "admin") {
    localStorage.clear();

    window.location.href = "login.html";

    return false;
  }

  return true;
}

/* =========================================================
   USER EVENTS
========================================================= */

/**
 * Create User
 *
 * UI:
 *   users:create-requested
 *
 * Controller:
 *   handleCreateUser()
 *
 * Service:
 *   Performs the API operation and publishes
 *   the appropriate result event.
 */
EventBus.on("users:create-requested", (event) => {
  handleCreateUser(event.detail);
});

/**
 * Delete User
 */
EventBus.on("users:delete-requested", async (event) => {
  const userId = event.detail?.userId;

  if (!userId) {
    console.error("Invalid user deletion request:", event.detail);

    return;
  }

  await deleteUser(userId);
});

/**
 * Refresh Users
 */
EventBus.on("users:refresh-requested", async () => {
  console.log("CONTROLLER: refreshing users");

  /*
   * true indicates that this is an explicit
   * refresh request.
   */
  await fetchUsers(true);
});

/**
 * Search Users
 */
EventBus.on("users:search-requested", async (event) => {
  const search = event.detail?.search ?? "";

  console.log("CONTROLLER: searching users:", search);

  await fetchUsers(true, search);
});

/* =========================================================
   CHAT HISTORY EVENTS
========================================================= */

/**
 * Refresh Chat History
 *
 * A refresh reloads the chat history using the
 * current search/page state maintained by the
 * chat-history service.
 */
EventBus.on("chat-history:refresh-requested", async () => {
  console.log("CONTROLLER: refreshing chat history");

  await refreshChatHistory();
});

/**
 * Search Chat History
 *
 * An empty search string is valid and means:
 *
 *     show all chat history
 *
 * The service is responsible for resetting
 * pagination and fetching the appropriate data.
 */
EventBus.on("chat-history:search-requested", async (event) => {
  const search = event.detail?.search ?? "";

  console.log("CONTROLLER: searching chat history:", search);

  await searchChatHistory(search);
});

/**
 * Change Chat History Page
 */
EventBus.on("chat-history:page-requested", async (event) => {
  const page = event.detail?.page;

  if (!page) {
    return;
  }

  console.log("CONTROLLER: changing chat history page:", page);

  await setChatHistoryPage(page);
});

/**
 * Export Chat History
 */
EventBus.on("chat-history:export-requested", async () => {
  console.log("CONTROLLER: exporting chat history");

  await exportChatHistory();
});

/* =========================================================
   VIEW CHAT
========================================================= */

/**
 * Request the messages belonging to a selected
 * chat-history record.
 *
 * UI provides:
 *   - userId
 *   - chatId
 *
 * The service then retrieves the corresponding
 * conversation messages.
 */
EventBus.on("chat-history:view-requested", async (event) => {
  const userId = Number(event.detail?.userId);

  const chatId = Number(event.detail?.chatId);

  if (!userId || !chatId) {
    console.error("Invalid chat view request:", event.detail);

    return;
  }

  console.log("CONTROLLER: loading chat messages:", {
    userId,
    chatId,
  });

  await fetchChatMessages(userId, chatId);
});

/* =========================================================
   APPLICATION NAVIGATION
========================================================= */

/**
 * Handle navigation requests coming from the
 * admin UI.
 *
 * Flow:
 *
 *     UI
 *      ↓
 *     app:navigate
 *      ↓
 *     handleNavigationRequest()
 *      ↓
 *     admin_state
 *      ↓
 *     app:navigated
 *      ↓
 *     UI updates visible panel
 */
function handleNavigationRequest(section) {
  /*
   * Prevent navigation to sections that the
   * current application state does not allow.
   */
  console.log("NAVIGATION REQUEST:", section);

  const allowed = canNavigateTo(section);

  console.log("NAVIGATION ALLOWED:", allowed);

  if (!allowed) {
    return;
  }

  setCurrentSection(section);

  EventBus.emit("app:navigated", {
    section,
  });

  /* -------------------------------------------------------
     LOAD USERS SECTION
  ------------------------------------------------------- */

  if (section === "users") {
    fetchUsers();
  }

  /* -------------------------------------------------------
     LOAD CHAT HISTORY SECTION
  ------------------------------------------------------- */

  if (section === "chat-history") {
    fetchChatHistory();
  }

  /* -------------------------------------------------------
     LOAD ANALYTICS SECTION
  ------------------------------------------------------- */

  if (section === "analytics") {
    console.log("ANALYTICS SECTION SELECTED");
  }
}

/* =========================================================
   LOGOUT
========================================================= */

/**
 * Open the logout confirmation modal.
 */
function showLogoutConfirmation() {
  const modal = document.getElementById("confirm-modal");

  if (!modal) {
    console.error("Logout confirmation modal not found");

    return;
  }

  modal.classList.remove("hidden");

  modal.setAttribute("aria-hidden", "false");
}

/**
 * Close the logout confirmation modal.
 */
function closeLogoutConfirmation() {
  const modal = document.getElementById("confirm-modal");

  if (!modal) {
    return;
  }

  modal.classList.add("hidden");

  modal.setAttribute("aria-hidden", "true");
}

/**
 * Remove the current authentication state
 * and redirect the administrator to login.
 */
function performLogout() {
  localStorage.removeItem("authToken");

  localStorage.removeItem("username");

  localStorage.removeItem("role");

  window.location.href = "login.html";
}

/* =========================================================
   CONTROLLER INITIALIZATION
========================================================= */

/**
 * Initialize the admin controller.
 *
 * This function:
 *
 * 1. Verifies authentication.
 * 2. Initializes page-level UI state.
 * 3. Registers application event listeners.
 * 4. Registers logout handlers.
 * 5. Emits app:ready.
 * 6. Loads the initial section.
 */
function initController() {
  /* -------------------------------------------------------
     AUTHENTICATION
  ------------------------------------------------------- */

  if (!checkAuthentication()) {
    console.log("INIT: authentication failed");

    return;
  }

  initAnalyticsSection();

  /* -------------------------------------------------------
     INITIAL PAGE STATE
  ------------------------------------------------------- */

  document.body.classList.add("fade-in");

  /* =======================================================
     NAVIGATION EVENT
  ======================================================= */

  EventBus.on("app:navigate", (event) => {
    const section = event.detail?.section;

    if (!section) {
      return;
    }

    handleNavigationRequest(section);
  });

  /* =======================================================
     LOGOUT EVENT
  ======================================================= */

  EventBus.on("app:logout", () => {
    showLogoutConfirmation();
  });

  /* =======================================================
     LOGOUT BUTTON
  ======================================================= */

  document.getElementById("logout-btn")?.addEventListener("click", (event) => {
    event.preventDefault();

    EventBus.emit("app:logout");
  });

  /* =======================================================
     LOGOUT CONFIRMATION
  ======================================================= */

  document
    .getElementById("logout-confirm-btn")
    ?.addEventListener("click", () => {
      performLogout();
    });

  /* =======================================================
     LOGOUT CANCELLATION
  ======================================================= */

  document
    .getElementById("logout-cancel-btn")
    ?.addEventListener("click", () => {
      closeLogoutConfirmation();
    });

  /* =======================================================
     APPLICATION READY
  ======================================================= */

  EventBus.on("app:ready", () => {
    document.body.classList.add("fade-in");
  });

  EventBus.emit("app:ready");

  /* =======================================================
     INITIAL SECTION
  ======================================================= */

  const initialSection = window.location.hash.substring(1) || "dashboard";

  handleNavigationRequest(initialSection);
}

/* =========================================================
   START ADMIN CONTROLLER
========================================================= */

initController();
