import { EventBus } from "./admin_events.js";

import { setCurrentSection, canNavigateTo } from "./admin_state.js";

import { fetchUsers, handleCreateUser, deleteUser } from "./users.service.js";

import "./admin_ui.js";

/* =========================
   ADMIN AUTH CHECK
========================= */

const token = localStorage.getItem("authToken");

const role = localStorage.getItem("role");

if (!token || role !== "admin") {
  localStorage.clear();

  window.location.href = "login.html";

  throw new Error("Unauthorized access");
}

/* =========================
   AUTH CHECK
========================= */

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

/* =========================
   NAVIGATION
========================= */

function handleNavigationRequest(section) {
  if (!canNavigateTo(section)) return;

  setCurrentSection(section);

  EventBus.emit("app:navigated", {
    section,
  });

  if (section === "users") {
    fetchUsers();
  }
}

/* =========================
   CONTROLLER INIT
========================= */

function initController() {
  if (!checkAuthentication()) return;

  EventBus.on("app:navigate", (e) => {
    handleNavigationRequest(e.detail.section);
  });

  EventBus.on("app:logout", () => {
    localStorage.removeItem("authToken");

    localStorage.removeItem("username");

    localStorage.removeItem("role");

    window.location.href = "login.html";
  });

  console.log("Admin application ready");

  EventBus.emit("app:ready");
}

initController();

EventBus.on("users:create-requested", (e) => {
  handleCreateUser(e.detail);
});

EventBus.on("users:delete-requested", async (e) => {
  await deleteUser(e.detail.userId);
});
